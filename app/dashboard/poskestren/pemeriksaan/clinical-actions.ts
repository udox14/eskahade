/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'
import { medicalEventDetail } from '@/lib/poskestren/medical-detail'
import { claim, normalizePrescription } from '@/lib/poskestren/clinical'
import { registerDormVisit } from './clinical-workflow-actions'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { toWibDateInputValue } from '@/lib/date/wib'
import {
  requireOutsideTreatmentWrite,
  requirePoskestrenClinicalWrite,
  requirePoskestrenHealthRead,
} from '@/lib/poskestren/access'
import {
  cleanText,
  decodeCursor,
  encodeCursor,
  normalizePoskestrenListQuery,
} from '@/lib/poskestren/query'
import { prepareStockMutation } from '@/lib/poskestren/stock'
import type {
  ClinicalMedicineDraftItem,
  MedicalRecordSummaryRow,
  MedicalRecordSummaryPatient,
  MedicalRecordSummaryEvent,
  PoskestrenListQuery,
  PrescriptionDraftItem,
} from '@/lib/poskestren/types'

const PATH = '/dashboard/poskestren/pemeriksaan'
const OBSERVATION_PATH = '/dashboard/poskestren/observasi'
const MEDICINE_PATH = '/dashboard/poskestren/obat'

function refreshHealth() {
  revalidatePath(PATH)
  revalidatePath(OBSERVATION_PATH)
  revalidatePath(MEDICINE_PATH)
}

async function audit(
  session: Awaited<ReturnType<typeof requirePoskestrenClinicalWrite>>,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  details?: Record<string, unknown>
) {
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_pemeriksaan',
    action,
    fiturHref: PATH,
    logKind: action === 'create' ? 'create' : 'update',
    entityType,
    entityId,
    summary,
    details,
  })
}

async function ensurePatient(santriId: string, actorId: string) {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM poskestren_patient WHERE santri_id = ?',
    [santriId]
  )
  if (existing) return existing.id
  const santri = await queryOne<{ id: string; nis: string; poskestren_code: string | null }>(
    `SELECT id, nis, poskestren_code FROM santri
     WHERE id = ? AND status_global = 'aktif'`,
    [santriId]
  )
  if (!santri) throw new Error('Santri aktif tidak ditemukan.')
  const id = generateId()
  const code = santri.poskestren_code || `RM-${santri.nis}`
  await (await getDB()).prepare(
    `INSERT INTO poskestren_patient(id, santri_id, medical_record_no, created_by)
     VALUES (?, ?, ?, ?)`
  ).bind(id, santri.id, code, actorId).run()
  return id
}

export async function getClinicalAccessInfo() {
  const access = await requirePoskestrenHealthRead()
  return {
    mode: access.mode,
    asrama: access.asrama,
    isFull: access.mode === 'FULL',
    canWriteOutsideTreatment: access.canWriteOutsideTreatment,
  }
}

export async function searchHealthSantri(keyword: string) {
  const access = await requirePoskestrenHealthRead()
  const q = cleanText(keyword, 80) || ''
  if (q.length < 2) return []
  const like = `%${q}%`
  const where = [`s.status_global = 'aktif'`]
  const params: unknown[] = []
  if (access.mode === 'SUMMARY_ASRAMA') {
    where.push('s.asrama = ?')
    params.push(access.asrama)
  }
  params.push(q, like, like, like, q)
  return query<any>(
    `SELECT s.id, s.poskestren_code, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            s.tanggal_lahir, s.foto_url, p.id AS patient_id,
            ${access.mode === 'FULL' ? 'p.allergies AS drug_allergies, p.special_conditions AS disease_history' : 'NULL AS drug_allergies, NULL AS disease_history'}
     FROM santri s
     LEFT JOIN poskestren_patient p ON p.santri_id = s.id
     WHERE ${where.join(' AND ')}
       AND (s.nis = ? OR s.nama_lengkap LIKE ? OR s.poskestren_code LIKE ? OR s.asrama LIKE ?)
     ORDER BY CASE WHEN s.nis = ? THEN 0 ELSE 1 END, s.nama_lengkap COLLATE NOCASE
     LIMIT 40`,
    params
  )
}

export async function getDiagnosisOptions(q = '') {
  await requirePoskestrenHealthRead()
  const search = cleanText(q, 80)
  const params: unknown[] = []
  const where = ['is_active = 1']
  if (search) {
    where.push('name LIKE ?')
    params.push(`%${search}%`)
  }
  return query<{ id: string; name: string }>(
    `SELECT id, name FROM poskestren_diagnosis
     WHERE ${where.join(' AND ')}
     ORDER BY name COLLATE NOCASE LIMIT 200`,
    params
  )
}

export async function saveDiagnosis(input: { id?: string; name: string; isActive?: boolean }) {
  const session = await requirePoskestrenClinicalWrite()
  const name = cleanText(input.name, 160)
  if (!name) return { success: false as const, error: 'Nama diagnosis wajib diisi.' }
  const id = cleanText(input.id, 100) || generateId()
  try {
    await (await getDB()).prepare(
      `INSERT INTO poskestren_diagnosis(id, name, is_active, created_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         is_active = excluded.is_active,
         updated_at = datetime('now')`
    ).bind(id, name, input.isActive === false ? 0 : 1, session.id).run()
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return { success: false as const, error: 'Diagnosis dengan nama tersebut sudah ada.' }
    }
    throw error
  }
  await audit(session, input.id ? 'update' : 'create', 'poskestren_diagnosis', id, `Menyimpan diagnosis ${name}`)
  refreshHealth()
  return { success: true as const, id }
}

export async function getMedicalRecordPatients(
  input: PoskestrenListQuery & {
    asrama?: string
    diagnosisId?: string
    personnelId?: string
    medicineId?: string
  } = {}
) {
  const access = await requirePoskestrenHealthRead()
  const normalized = normalizePoskestrenListQuery(input)
  if(access.mode!=='FULL' && (input.diagnosisId || input.personnelId || input.medicineId || input.status)) {
    throw new Error('Filter klinis hanya tersedia untuk petugas dan dokter.')
  }
  const cursor = decodeCursor(normalized.cursor)
  const eventWhere: string[] = []
  const eventParams: unknown[] = []
  if (normalized.from) { eventWhere.push('event_date >= ?'); eventParams.push(normalized.from) }
  if (normalized.to) { eventWhere.push('event_date <= ?'); eventParams.push(normalized.to) }
  const where = ['1=1']
  const params: unknown[] = [...eventParams]
  if (access.mode === 'SUMMARY_ASRAMA') {
    where.push('s.asrama = ?')
    params.push(access.asrama)
  } else if (input.asrama) {
    where.push('s.asrama = ?')
    params.push(cleanText(input.asrama, 100))
  }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.poskestren_code = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR s.kamar LIKE ?)')
    params.push(normalized.q, normalized.q.toUpperCase(), like, like, like)
  }
  if (input.diagnosisId) {
    where.push(`(EXISTS (
      SELECT 1 FROM poskestren_visit vx
      WHERE vx.patient_id = p.id AND vx.diagnosis_id = ?
        AND vx.status IN ('SELESAI','DIRUJUK')
    ) OR EXISTS (
      SELECT 1 FROM poskestren_clinical_exam ce
      LEFT JOIN poskestren_dorm_visit cd ON cd.id=ce.dorm_visit_id
      LEFT JOIN poskestren_observation co ON co.id=ce.observation_id
      WHERE COALESCE(cd.patient_id,co.patient_id)=p.id AND json_extract(ce.clinical_json,'$.diagnosisId') = ?
    ))`)
    params.push(input.diagnosisId, input.diagnosisId)
  }
  if (input.personnelId) {
    where.push(`(EXISTS (
      SELECT 1 FROM poskestren_visit vx
      WHERE vx.patient_id = p.id AND vx.personnel_id = ?
        AND vx.status IN ('SELESAI','DIRUJUK')
    ) OR EXISTS (
      SELECT 1 FROM poskestren_clinical_exam ce
      LEFT JOIN poskestren_dorm_visit cd ON cd.id=ce.dorm_visit_id
      LEFT JOIN poskestren_observation co ON co.id=ce.observation_id
      WHERE COALESCE(cd.patient_id,co.patient_id)=p.id AND ce.personnel_id = ?
    ))`)
    params.push(input.personnelId, input.personnelId)
  }
  if (input.medicineId) {
    where.push(`(EXISTS (
      SELECT 1 FROM poskestren_visit vx
      JOIN poskestren_prescription rx ON rx.visit_id = vx.id
      JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
      WHERE vx.patient_id = p.id AND rxi.medicine_id = ?
    ) OR EXISTS (
      SELECT 1 FROM poskestren_clinical_exam ce
      LEFT JOIN poskestren_dorm_visit cd ON cd.id=ce.dorm_visit_id
      LEFT JOIN poskestren_observation co ON co.id=ce.observation_id
      WHERE COALESCE(cd.patient_id,co.patient_id)=p.id AND EXISTS(SELECT 1 FROM poskestren_clinical_prescription_item ci WHERE ci.exam_id=ce.id AND ci.medicine_id=?)
    ))`)
    params.push(input.medicineId, input.medicineId)
  }
  if (['SELESAI', 'DIRUJUK'].includes(normalized.status || '')) {
    where.push(`EXISTS (
      SELECT 1 FROM poskestren_visit vx
      WHERE vx.patient_id = p.id AND vx.status = ?
        AND (? = '' OR vx.queue_date >= ?)
        AND (? = '' OR vx.queue_date <= ?)
    )`)
    params.push(normalized.status, normalized.from || '', normalized.from || '', normalized.to || '', normalized.to || '')
  }
  if (cursor && typeof cursor[0] === 'string' && typeof cursor[1] === 'string') {
    where.push('(e.last_event_at < ? OR (e.last_event_at = ? AND p.id < ?))')
    params.push(cursor[0], cursor[0], cursor[1])
  }
  const eventFilter = eventWhere.length ? `WHERE ${eventWhere.join(' AND ')}` : ''
  const rows = await query<any>(
    `WITH all_events AS (
       SELECT patient_id, queue_date AS event_date, completed_at AS event_at, status,
              complaint, COALESCE(d.name, v.diagnosis) AS result_text
       FROM poskestren_visit v
       LEFT JOIN poskestren_diagnosis d ON d.id = v.diagnosis_id
       WHERE (v.status IN ('SELESAI','DIRUJUK') OR v.awaiting_medicine=1)
       UNION ALL
       SELECT patient_id, SUBSTR(visited_at,1,10), visited_at, 'VISIT_ASRAMA', complaint, complaint
       FROM poskestren_dorm_visit
       UNION ALL
       SELECT patient_id, SUBSTR(admitted_at,1,10), COALESCE(discharged_at, admitted_at),
              status, symptoms, CASE WHEN status = 'REFERRED' THEN referral_destination ELSE status END
       FROM poskestren_observation
       UNION ALL
       SELECT patient_id, SUBSTR(treated_at,1,10), treated_at, 'BEROBAT_KELUAR', complaint, provider_name
       FROM poskestren_outside_treatment
     ),
     filtered_events AS (
       SELECT * FROM all_events ${eventFilter}
     ),
     event_summary AS (
       SELECT patient_id, MAX(event_at) AS last_event_at, COUNT(*) AS event_count
       FROM filtered_events GROUP BY patient_id
     ),
     latest AS (
       SELECT fe.patient_id, fe.event_at, fe.status, fe.complaint, fe.result_text
       FROM filtered_events fe
       JOIN event_summary es ON es.patient_id = fe.patient_id AND es.last_event_at = fe.event_at
       GROUP BY fe.patient_id
     )
     SELECT p.id AS patient_id, p.medical_record_no, s.id AS santri_id, s.poskestren_code,
            s.nis, s.nama_lengkap, s.asrama, s.kamar, s.foto_url,
            e.last_event_at, e.event_count, l.status AS last_status,
            l.complaint AS last_complaint, l.result_text AS last_result
     FROM event_summary e
     JOIN poskestren_patient p ON p.id = e.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN latest l ON l.patient_id = p.id
     WHERE ${where.join(' AND ')}
     ORDER BY e.last_event_at DESC, p.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return {
    items: access.mode==='FULL' ? items : items.map(row=>({patient_id:row.patient_id,nama_lengkap:row.nama_lengkap,last_event_at:toWibDateInputValue(row.last_event_at)} satisfies MedicalRecordSummaryRow)),
    nextCursor: hasMore && last ? encodeCursor([last.last_event_at, last.patient_id]) : null,
    hasMore,
    truncated: normalized.isAll && hasMore,
    limit: normalized.limit,
    accessMode: access.mode,
  }
}

export async function getPatientMedicalTimeline(input: {
  patientId: string
  cursor?: string
  limit?: 20 | 50 | 100
}) {
  const access = await requirePoskestrenHealthRead()
  const limit = [20, 50, 100].includes(Number(input.limit)) ? Number(input.limit) : 20
  const patient = await queryOne<any>(
    `SELECT p.id AS patient_id, p.medical_record_no, p.allergies, p.special_conditions,
            p.routine_medicines, p.notes, p.blood_type, p.emergency_contact, p.profile_version, s.id AS santri_id, s.poskestren_code,
            s.nis, s.nama_lengkap, s.asrama, s.kamar, s.foto_url, s.tanggal_lahir
     FROM poskestren_patient p JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [input.patientId]
  )
  if (!patient) throw new Error('Profil pasien tidak ditemukan.')
  if (access.mode === 'SUMMARY_ASRAMA' && patient.asrama !== access.asrama) {
    throw new Error('Akses rekam kesehatan di luar asrama binaan ditolak.')
  }
  const cursor = decodeCursor(input.cursor || '')
  const params: unknown[] = [input.patientId, input.patientId, input.patientId, input.patientId]
  let cursorSql = ''
  if (cursor && typeof cursor[0] === 'string' && typeof cursor[1] === 'string') {
    cursorSql = 'WHERE (event_at < ? OR (event_at = ? AND event_id < ?))'
    params.push(cursor[0], cursor[0], cursor[1])
  }
  params.push(limit + 1)
  const rows = await query<any>(
    `WITH timeline AS (
       SELECT v.id AS event_id, 'PEMERIKSAAN' AS event_type,
              COALESCE(v.completed_at, v.updated_at, v.created_at) AS event_at, v.status,
              v.complaint AS summary, COALESCE(d.name, v.diagnosis) AS result_text,
              v.referral_destination, pp.full_name AS personnel_name
       FROM poskestren_visit v
       LEFT JOIN poskestren_diagnosis d ON d.id = v.diagnosis_id
       LEFT JOIN poskestren_personnel pp ON pp.id = v.personnel_id
       WHERE v.patient_id = ? AND (v.status IN ('SELESAI','DIRUJUK') OR v.awaiting_medicine=1)
       UNION ALL
       SELECT dv.id, 'VISIT_ASRAMA', dv.visited_at, CASE WHEN dv.status='LEGACY' THEN 'SELESAI' ELSE dv.status END,
              dv.complaint, NULL, NULL, u.full_name
       FROM poskestren_dorm_visit dv LEFT JOIN users u ON u.id = dv.created_by
       WHERE dv.patient_id = ?
       UNION ALL
       SELECT o.id, 'OBSERVASI', COALESCE(o.discharged_at,o.admitted_at), o.status,
              o.symptoms, CASE WHEN o.status = 'RECOVERED' THEN 'SEMBUH' ELSE o.referral_destination END,
              o.referral_destination, u.full_name
       FROM poskestren_observation o LEFT JOIN users u ON u.id = o.created_by
       WHERE o.patient_id = ?
       UNION ALL
       SELECT ot.id, 'BEROBAT_KELUAR', ot.treated_at, 'SELESAI',
              ot.complaint, ot.provider_name, NULL, u.full_name
       FROM poskestren_outside_treatment ot LEFT JOIN users u ON u.id = ot.created_by
       WHERE ot.patient_id = ?
     )
     SELECT * FROM timeline ${cursorSql}
     ORDER BY event_at DESC, event_id DESC LIMIT ?`,
    params
  )
  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  const safePatient = access.mode==='FULL' ? patient : {patient_id:patient.patient_id,nama_lengkap:patient.nama_lengkap} satisfies MedicalRecordSummaryPatient
  const safeItems = access.mode==='FULL'
    ? await Promise.all(items.map(async row=>({...row,detail:await medicalEventDetail(row.event_type,row.event_id)})))
    : items.map(row=>({event_id:row.event_id,event_at:toWibDateInputValue(row.event_at)} satisfies MedicalRecordSummaryEvent))
  return {
    patient: safePatient,
    items: safeItems,
    nextCursor: hasMore && last ? encodeCursor([last.event_at, last.event_id]) : null,
    hasMore,
    accessMode: access.mode,
  }
}

export async function getDoctorsAndSessions() {
  const session = await requirePoskestrenClinicalWrite()
  const doctors = await query<any>(
    `SELECT p.id, p.full_name, p.profession, p.user_id,
            ps.id AS open_session_id, ps.session_date, ps.started_at, ps.created_by
     FROM poskestren_personnel p
     LEFT JOIN poskestren_practice_session ps ON ps.personnel_id = p.id AND ps.status = 'OPEN'
     WHERE p.personnel_type = 'MEDICAL' AND p.is_active = 1
     ORDER BY CASE WHEN p.user_id = ? THEN 0 ELSE 1 END, p.full_name COLLATE NOCASE`,
    [session.id]
  )
  return { doctors, currentUserId: session.id }
}

export async function startPracticeForDoctor(input: { personnelId: string; notes?: string }) {
  const session = await requirePoskestrenClinicalWrite()
  const doctor = await queryOne<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM poskestren_personnel
     WHERE id = ? AND personnel_type = 'MEDICAL' AND is_active = 1`,
    [input.personnelId]
  )
  if (!doctor) return { success: false as const, error: 'Dokter aktif tidak ditemukan.' }
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_practice_session
     WHERE personnel_id = ? AND status = 'OPEN' LIMIT 1`,
    [doctor.id]
  )
  if (existing) return { success: true as const, id: existing.id, alreadyOpen: true }
  const id = generateId()
  await (await getDB()).prepare(
    `INSERT INTO poskestren_practice_session(
       id, personnel_id, session_date, status, started_at, notes, created_by
     ) VALUES (?, ?, ?, 'OPEN', ?, ?, ?)`
  ).bind(id, doctor.id, toWibDateInputValue(), new Date().toISOString(), cleanText(input.notes), session.id).run()
  await audit(session, 'create', 'poskestren_practice_session', id, `Membuka sesi praktik ${doctor.full_name}`)
  refreshHealth()
  return { success: true as const, id }
}

export async function closePracticeForDoctor(sessionId: string) {
  const session = await requirePoskestrenClinicalWrite()
  const row = await queryOne<{ id: string; full_name: string }>(
    `SELECT ps.id, p.full_name
     FROM poskestren_practice_session ps
     JOIN poskestren_personnel p ON p.id = ps.personnel_id
     WHERE ps.id = ? AND ps.status = 'OPEN'`,
    [sessionId]
  )
  if (!row) return { success: false as const, error: 'Sesi aktif tidak ditemukan.' }
  await (await getDB()).prepare(
    `UPDATE poskestren_practice_session
     SET status = 'CLOSED', ended_at = ?
     WHERE id = ? AND status = 'OPEN'`
  ).bind(new Date().toISOString(), row.id).run()
  await audit(session, 'update', 'poskestren_practice_session', row.id, `Menutup sesi praktik ${row.full_name}`)
  refreshHealth()
  return { success: true as const }
}

export async function beginVisitWithSession(input: { visitId: string; practiceSessionId: string }) {
  const session = await requirePoskestrenClinicalWrite()
  const practice = await queryOne<{ id: string; personnel_id: string }>(
    `SELECT id, personnel_id FROM poskestren_practice_session
     WHERE id = ? AND status = 'OPEN'`,
    [input.practiceSessionId]
  )
  if (!practice) return { success: false as const, error: 'Pilih sesi dokter yang masih aktif.' }
  const now = new Date().toISOString()
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_visit
     SET status = 'DIPERIKSA', personnel_id = ?, practice_session_id = ?,
         started_at = COALESCE(started_at, ?), updated_by = ?, updated_at = ?
     WHERE id = ? AND status = 'MENUNGGU'`
  ).bind(practice.personnel_id, practice.id, now, session.id, now, input.visitId).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Kunjungan tidak lagi menunggu.' }
  await audit(session, 'update', 'poskestren_visit', input.visitId, 'Memulai pemeriksaan melalui sesi dokter', {
    practice_session_id: practice.id,
    personnel_id: practice.personnel_id,
  })
  refreshHealth()
  return { success: true as const }
}

export async function createDormVisit(input: {
  santriId:string;visitedAt:string;complaint:string;allergies?:string;diseaseHistory?:string;notes?:string;
  temperatureCelsius?:number|null;systolicPressure?:number|null;diastolicPressure?:number|null;weightKg?:number|null;
  medicines?:ClinicalMedicineDraftItem[]
}) {
  if(input.medicines?.length) throw new Error('Resep Visit Asrama harus diinput dokter setelah pendaftaran.')
  return registerDormVisit({...input,requestId:generateId()})
}

export async function getDormVisits(input: PoskestrenListQuery = {}) {
  await requirePoskestrenClinicalWrite()
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.from) { where.push('SUBSTR(dv.visited_at,1,10) >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('SUBSTR(dv.visited_at,1,10) <= ?'); params.push(normalized.to) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.poskestren_code = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR dv.complaint LIKE ?)')
    params.push(normalized.q, normalized.q.toUpperCase(), like, like, like)
  }
  const rows = await query<any>(
    `SELECT dv.id, dv.status, dv.personnel_id, dv.completed_at, dv.visited_at, dv.temperature_celsius, dv.systolic_pressure,
            dv.diastolic_pressure, dv.weight_kg, dv.complaint,
            s.poskestren_code, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            GROUP_CONCAT(dvm.medicine_name, ', ') AS medicine_names,
            u.full_name AS created_by_name
     FROM poskestren_dorm_visit dv
     JOIN poskestren_patient p ON p.id = dv.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN poskestren_dorm_visit_medicine dvm ON dvm.dorm_visit_id = dv.id
     LEFT JOIN users u ON u.id = dv.created_by
     WHERE ${where.join(' AND ')}
     GROUP BY dv.id
     ORDER BY dv.visited_at DESC, dv.id DESC LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  return { items: rows.slice(0, normalized.limit), hasMore: rows.length > normalized.limit }
}

export async function getOutsideReferences() {
  await requirePoskestrenHealthRead()
  const rows = await query<any>(
    `SELECT id, reference_type, name, is_active
     FROM poskestren_outside_reference
     WHERE is_active = 1
     ORDER BY reference_type, name COLLATE NOCASE`
  )
  return {
    regions: rows.filter(row => row.reference_type === 'REGION'),
    providers: rows.filter(row => row.reference_type === 'PROVIDER'),
    drivers: rows.filter(row => row.reference_type === 'DRIVER'),
  }
}

export async function saveOutsideReference(input: {
  id?: string
  referenceType: 'REGION' | 'PROVIDER' | 'DRIVER'
  name: string
}) {
  const session = await requirePoskestrenClinicalWrite()
  const name = cleanText(input.name, 160)
  if (!['REGION','PROVIDER','DRIVER'].includes(input.referenceType) || !name) {
    return { success: false as const, error: 'Jenis dan nama master wajib diisi.' }
  }
  const id = cleanText(input.id, 100) || generateId()
  try {
    await (await getDB()).prepare(
      `INSERT INTO poskestren_outside_reference(id, reference_type, name, created_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`
    ).bind(id, input.referenceType, name, session.id).run()
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Nama master sudah tersedia.' }
    throw error
  }
  await audit(session, input.id ? 'update' : 'create', 'poskestren_outside_reference', id, `Menyimpan master ${input.referenceType}: ${name}`)
  refreshHealth()
  return { success: true as const, id }
}

export async function saveOutsideTreatment(input: {
  id?: string
  santriId: string
  treatedAt: string
  regionId: string
  providerId: string
  driverId?: string
  complaint: string
}) {
  const access = await requireOutsideTreatmentWrite()
  const complaint = cleanText(input.complaint)
  const treatedAt = new Date(input.treatedAt)
  if (Number.isNaN(treatedAt.getTime()) || !complaint) {
    return { success: false as const, error: 'Tanggal dan keluhan wajib diisi.' }
  }
  const santri = await queryOne<{ id: string; asrama: string | null; kamar: string | null }>(
    `SELECT id, asrama, kamar FROM santri WHERE id = ? AND status_global = 'aktif'`,
    [input.santriId]
  )
  if (!santri) return { success: false as const, error: 'Santri aktif tidak ditemukan.' }
  if (access.mode === 'SUMMARY_ASRAMA' && santri.asrama !== access.asrama) {
    return { success: false as const, error: 'Santri bukan anggota asrama binaan Anda.' }
  }
  const refs = await query<any>(
    `SELECT id, reference_type, name FROM poskestren_outside_reference
     WHERE id IN (?, ?, ?) AND is_active = 1`,
    [input.regionId, input.providerId, input.driverId || '']
  )
  const region = refs.find(row => row.id === input.regionId && row.reference_type === 'REGION')
  const provider = refs.find(row => row.id === input.providerId && row.reference_type === 'PROVIDER')
  const driver = input.driverId
    ? refs.find(row => row.id === input.driverId && row.reference_type === 'DRIVER')
    : null
  if (!region || !provider || (input.driverId && !driver)) {
    return { success: false as const, error: 'Wilayah, klinik/dokter, atau supir tidak valid.' }
  }
  const patientId = await ensurePatient(santri.id, access.session.id)
  const id = cleanText(input.id, 100) || generateId()
  if (input.id && access.mode === 'SUMMARY_ASRAMA') {
    const existing = await queryOne<{ asrama_snapshot: string | null }>(
      'SELECT asrama_snapshot FROM poskestren_outside_treatment WHERE id = ?',
      [id]
    )
    if (!existing || existing.asrama_snapshot !== access.asrama) {
      return { success: false as const, error: 'Data Berobat Keluar tidak dapat diedit.' }
    }
  }
  await (await getDB()).prepare(
    `INSERT INTO poskestren_outside_treatment(
       id, patient_id, treated_at, asrama_snapshot, kamar_snapshot,
       region_id, region_name, provider_id, provider_name,
       driver_id, driver_name, complaint, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       treated_at = excluded.treated_at,
       region_id = excluded.region_id,
       region_name = excluded.region_name,
       provider_id = excluded.provider_id,
       provider_name = excluded.provider_name,
       driver_id = excluded.driver_id,
       driver_name = excluded.driver_name,
       complaint = excluded.complaint,
       updated_by = excluded.created_by,
       updated_at = datetime('now')`
  ).bind(
    id, patientId, treatedAt.toISOString(), santri.asrama, santri.kamar,
    region.id, region.name, provider.id, provider.name,
    driver?.id || null, driver?.name || null, complaint, access.session.id
  ).run()
  await logActivity({
    actor: actorFromSession(access.session),
    module: 'poskestren_pemeriksaan',
    action: input.id ? 'update' : 'create',
    fiturHref: PATH,
    logKind: input.id ? 'update' : 'create',
    entityType: 'poskestren_outside_treatment',
    entityId: id,
    summary: input.id ? 'Memperbarui Data Berobat Keluar' : 'Mencatat Data Berobat Keluar',
    details: { patient_id: patientId, asrama: santri.asrama },
  })
  refreshHealth()
  return { success: true as const, id }
}

export async function getOutsideTreatments(input: PoskestrenListQuery = {}) {
  const access = await requirePoskestrenHealthRead()
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (access.mode === 'SUMMARY_ASRAMA') { where.push('ot.asrama_snapshot = ?'); params.push(access.asrama) }
  if (normalized.from) { where.push('SUBSTR(ot.treated_at,1,10) >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('SUBSTR(ot.treated_at,1,10) <= ?'); params.push(normalized.to) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.poskestren_code = ? OR s.nama_lengkap LIKE ? OR ot.provider_name LIKE ? OR ot.complaint LIKE ?)')
    params.push(normalized.q, normalized.q.toUpperCase(), like, like, like)
  }
  const rows = await query<any>(
    `SELECT ot.id, ot.treated_at, ot.asrama_snapshot, ot.kamar_snapshot,
            ot.region_id, ot.provider_id, ot.driver_id,
            ot.region_name, ot.provider_name, ot.driver_name, ot.complaint,
            s.id AS santri_id, s.poskestren_code, s.nis, s.nama_lengkap, s.foto_url,
            u.full_name AS created_by_name
     FROM poskestren_outside_treatment ot
     JOIN poskestren_patient p ON p.id = ot.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN users u ON u.id = ot.created_by
     WHERE ${where.join(' AND ')}
     ORDER BY ot.treated_at DESC, ot.id DESC LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  return {
    items: rows.slice(0, normalized.limit),
    hasMore: rows.length > normalized.limit,
    accessMode: access.mode,
    canWrite: access.canWriteOutsideTreatment,
  }
}

export async function reviseCompletedVisitFull(input: {
  visitId: string
  reason: string
  practiceSessionId: string
  complaint: string
  diagnosisId: string
  treatment?: string
  followUp?: string
  referralDestination?: string
  referralNotes?: string
  prescriptionItems?: PrescriptionDraftItem[]
}) {
  const session = await requirePoskestrenClinicalWrite()
  const reason = cleanText(input.reason, 500)
  const complaint = cleanText(input.complaint)
  if (!reason || !complaint || !input.diagnosisId || !input.practiceSessionId) {
    return { success: false as const, error: 'Alasan, sesi dokter, keluhan, dan diagnosis wajib diisi.' }
  }
  const before = await queryOne<any>(
    `SELECT v.*, d.name AS diagnosis_name
     FROM poskestren_visit v
     LEFT JOIN poskestren_diagnosis d ON d.id = v.diagnosis_id
     WHERE v.id = ? AND v.status IN ('SELESAI','DIRUJUK')`,
    [input.visitId]
  )
  if (!before) return { success: false as const, error: 'Pemeriksaan selesai tidak ditemukan.' }
  const practice = await queryOne<{ id: string; personnel_id: string; session_date: string }>(
    `SELECT id, personnel_id, session_date FROM poskestren_practice_session
     WHERE id = ?`,
    [input.practiceSessionId]
  )
  if (!practice || practice.session_date !== before.queue_date) {
    return { success: false as const, error: 'Sesi dokter harus berasal dari tanggal pelayanan yang sama.' }
  }
  const diagnosis = await queryOne<{ id: string; name: string }>(
    'SELECT id, name FROM poskestren_diagnosis WHERE id = ? AND is_active = 1',
    [input.diagnosisId]
  )
  if (!diagnosis) return { success: false as const, error: 'Diagnosis tidak valid.' }
  const normalizedItems = await normalizePrescription(input.prescriptionItems||[])
  const cleanItems = normalizedItems.filter(item=>item.sourceType==='STOCK')
  const externalItems = normalizedItems.filter(item=>item.sourceType==='EXTERNAL')
  const oldItems = await query<any>(
    `SELECT rxi.medicine_id, rxi.dispensed_quantity_base, rxi.dosage, rxi.notes
     FROM poskestren_prescription rx
     JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
     WHERE rx.visit_id = ?`,
    [before.id]
  )
  const revisionNo = Number(before.revision_no || 0) + 1
  const db = await getDB()
  const statements: D1PreparedStatement[] = []
  const medicineIds = [...new Set([...oldItems.map(row => row.medicine_id), ...cleanItems.map(row => row.medicineId)])]
  for (const medicineId of medicineIds) {
    const oldQty = Number(oldItems.find(row => row.medicine_id === medicineId)?.dispensed_quantity_base || 0)
    const newQty = Number(cleanItems.find(row => row.medicineId === medicineId)?.quantity || 0)
    const delta = newQty - oldQty
    if (delta === 0) continue
    const mutation = await prepareStockMutation(db, {
      medicineId,
      quantityDelta: -delta,
      movementType: delta > 0 ? 'PATIENT' : 'REVERSAL',
      movementDate: before.queue_date,
      referenceType: 'VISIT_REVISION',
      referenceId: `${before.id}:${revisionNo}:${medicineId}`,
      actorId: session.id,
      notes: `Revisi ${revisionNo}: ${reason}`,
    })
    statements.push(...mutation.statements)
  }
  const prescription = await queryOne<{ id: string }>(
    'SELECT id FROM poskestren_prescription WHERE visit_id = ?',
    [before.id]
  )
  const prescriptionId = prescription?.id || (normalizedItems.length ? generateId() : null)
  const oldExternal = prescription ? await query<any>('SELECT * FROM poskestren_prescription_external_item WHERE prescription_id=?',[prescription.id]) : []
  statements.unshift(claim(db,'revise:'+before.id+':'+revisionNo,
    'EXISTS(SELECT 1 FROM poskestren_visit WHERE id=? AND revision_no=?)',[before.id,Number(before.revision_no||0)]))
  const beforeSnapshot = {
    visit: before,
    prescriptionItems: oldItems,
    externalItems: oldExternal,
  }
  statements.push(
    db.prepare(
      `INSERT INTO poskestren_visit_revision(
         id, visit_id, revision_no, before_json, reason, revised_by
       ) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(generateId(), before.id, revisionNo, JSON.stringify(beforeSnapshot), reason, session.id)
  )
  if (prescriptionId && !prescription) {
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_prescription(id, visit_id, status, created_by)
         VALUES (?, ?, 'DISPENSED', ?)`
      ).bind(prescriptionId, before.id, session.id)
    )
  }
  if (prescriptionId) {
    statements.push(db.prepare('DELETE FROM poskestren_prescription_item WHERE prescription_id = ?').bind(prescriptionId))
    for (const item of cleanItems) {
      statements.push(
        db.prepare(
          `INSERT INTO poskestren_prescription_item(
             id, prescription_id, medicine_id, dosage, requested_quantity_base,
             dispensed_quantity_base, notes
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(generateId(), prescriptionId, item.medicineId, item.dosage, item.quantity, item.quantity, item.notes)
      )
    }
    statements.push(
      db.prepare(
        `UPDATE poskestren_prescription
         SET status = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(normalizedItems.length ? 'DISPENSED' : 'CANCELLED', prescriptionId)
    )
  }
  if(prescriptionId) {
    statements.push(db.prepare('DELETE FROM poskestren_prescription_external_item WHERE prescription_id=?').bind(prescriptionId))
    for(const item of externalItems) statements.push(db.prepare('INSERT INTO poskestren_prescription_external_item(id,prescription_id,medicine_name,quantity,unit,dosage,notes) VALUES(?,?,?,?,?,?,?)')
      .bind(generateId(),prescriptionId,item.medicineName,item.quantity,item.unit,item.dosage,item.notes))
  }
  if(cleanText(input.followUp)!==cleanText(before.follow_up)) statements.push(db.prepare('UPDATE poskestren_visit SET fee_category=? WHERE id=?').bind(cleanText(input.followUp)?'TREATMENT':'NORMAL',before.id))
  const referralDestination = cleanText(input.referralDestination, 200)
  const finalStatus = referralDestination ? 'DIRUJUK' : 'SELESAI'
  statements.push(
    db.prepare(
      `UPDATE poskestren_visit
       SET status = ?, personnel_id = ?, practice_session_id = ?, complaint = ?,
           diagnosis_id = ?, diagnosis = ?, treatment = ?, follow_up = ?,
           referral_destination = ?, referral_notes = ?, revision_no = ?,
           updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      finalStatus, practice.personnel_id, practice.id, complaint,
      diagnosis.id, diagnosis.name, cleanText(input.treatment), cleanText(input.followUp),
      referralDestination, cleanText(input.referralNotes), revisionNo,
      session.id, new Date().toISOString(), before.id
    ),
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'VISIT' AND entity_id = ?`).bind(before.id),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('VISIT', ?, ?)`
    ).bind(before.id, [complaint, diagnosis.name, cleanText(input.treatment), cleanText(input.followUp)].filter(Boolean).join(' '))
  )
  await db.batch(statements)
  await audit(session, 'update', 'poskestren_visit', before.id, 'Merevisi pemeriksaan selesai dan sinkronisasi stok', {
    revision_no: revisionNo,
    reason,
    medicine_count: cleanItems.length,
  })
  refreshHealth()
  return { success: true as const }
}

