/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'
import { claim, normalizeClinical, normalizePrescription, type ClinicalInput } from '@/lib/poskestren/clinical'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { toWibDateInputValue } from '@/lib/date/wib'
import { requirePoskestrenStaffFeature } from '@/lib/poskestren/access'
import {
  assertDate,
  cleanText,
  decodeCursor,
  encodeCursor,
  normalizePoskestrenListQuery,
  parseNonNegativeInteger,
  toFtsPrefixQuery,
} from '@/lib/poskestren/query'
import { prepareStockMutationFromSnapshot } from '@/lib/poskestren/stock-snapshot'
import {
  POSKESTREN_HREF,
  type PoskestrenListQuery,
  type PoskestrenListResult,
  type PoskestrenVisitStatus,
  type PrescriptionDraftItem,
} from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.examination
const refresh = () => revalidatePath(PATH)

type PatientRow = {
  profile_version: number
  id: string
  santri_id: string
  medical_record_no: string
  blood_type: string | null
  allergies: string | null
  special_conditions: string | null
  routine_medicines: string | null
  emergency_contact: string | null
  notes: string | null
  created_at: string
  nama_lengkap: string
  nis: string
  asrama: string | null
  kamar: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  status_global: string
  foto_url: string | null
}

function patientRecordNo(nis: string) {
  return `RM-${String(nis).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')}`
}

// Migration 0147 creates an empty, permanent profile for every santri. A profile
// only belongs in Daftar Pasien after it is explicitly registered or used by a
// clinical service.
const listedPatientSql = (alias = 'p') => `(
  ${alias}.created_by IS NOT NULL
  OR EXISTS (SELECT 1 FROM poskestren_visit v WHERE v.patient_id = ${alias}.id)
  OR EXISTS (SELECT 1 FROM poskestren_dorm_visit dv WHERE dv.patient_id = ${alias}.id)
  OR EXISTS (SELECT 1 FROM poskestren_observation o WHERE o.patient_id = ${alias}.id)
  OR EXISTS (SELECT 1 FROM poskestren_outside_treatment ot WHERE ot.patient_id = ${alias}.id)
)`

async function writeAudit(
  session: Awaited<ReturnType<typeof requirePoskestrenStaffFeature>>,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  details?: Record<string, unknown>
) {
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren',
    action,
    fiturHref: PATH,
    logKind: action === 'create' ? 'create' : 'update',
    entityType,
    entityId,
    summary,
    details,
  })
}

export async function searchActiveSantri(keyword: string) {
  await requirePoskestrenStaffFeature(PATH)
  const q = String(keyword || '').trim().slice(0, 60)
  if (q.length < 2) return []
  const like = `%${q}%`
  return query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    sekolah: string | null
    kelas_sekolah: string | null
    foto_url: string | null
    has_patient: number
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.foto_url,
            CASE WHEN p.id IS NOT NULL AND ${listedPatientSql()} THEN 1 ELSE 0 END AS has_patient
     FROM santri s
     LEFT JOIN poskestren_patient p ON p.santri_id = s.id
     WHERE s.status_global = 'aktif'
       AND (s.nis = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR s.kamar LIKE ?
            OR s.sekolah LIKE ? OR s.kelas_sekolah LIKE ?)
     ORDER BY CASE WHEN s.nis = ? THEN 0 ELSE 1 END, s.nama_lengkap
     LIMIT 50`,
    [q, like, like, like, like, like, q]
  )
}

export async function searchPreventiveTargets(input: {
  asrama?: string
  kamar?: string
  kelas?: string
}) {
  await requirePoskestrenStaffFeature(PATH)
  const asrama = cleanText(input.asrama, 100)
  const kamar = cleanText(input.kamar, 100)
  const kelas = cleanText(input.kelas, 100)
  if (!asrama && !kamar && !kelas) {
    return { items: [], truncated: false, error: 'Pilih minimal satu filter sasaran.' }
  }
  const where = [`status_global = 'aktif'`]
  const params: unknown[] = []
  if (asrama) { where.push('asrama = ?'); params.push(asrama) }
  if (kamar) { where.push('kamar = ?'); params.push(kamar) }
  if (kelas) { where.push('kelas_sekolah = ?'); params.push(kelas) }
  const rows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
  }>(
    `SELECT id, nis, nama_lengkap, asrama, kamar, kelas_sekolah
     FROM santri
     WHERE ${where.join(' AND ')}
     ORDER BY nama_lengkap COLLATE NOCASE
     LIMIT 501`,
    params
  )
  return { items: rows.slice(0, 500), truncated: rows.length > 500, error: null }
}

export async function createPatient(input: {
  santriId: string
  bloodType?: string
  allergies?: string
  specialConditions?: string
  routineMedicines?: string
  emergencyContact?: string
  notes?: string
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'create')
  const santri = await queryOne<{ id: string; nis: string; nama_lengkap: string; poskestren_code: string | null }>(
    `SELECT id, nis, nama_lengkap, poskestren_code
     FROM santri
     WHERE id = ? AND status_global = 'aktif'`,
    [input.santriId]
  )
  if (!santri) return { success: false as const, error: 'Santri aktif tidak ditemukan.' }

  const existing = await queryOne<{ id: string; is_listed: number }>(
    `SELECT p.id, CASE WHEN ${listedPatientSql()} THEN 1 ELSE 0 END AS is_listed
     FROM poskestren_patient p WHERE p.santri_id = ?`,
    [santri.id]
  )
  if (existing?.is_listed) return { success: false as const, error: 'Profil santri sudah tersedia. Gunakan Edit profil medis pada Daftar Pasien.' }

  if (existing) {
    await (await getDB()).prepare(
      `UPDATE poskestren_patient SET
         blood_type = ?, allergies = ?, special_conditions = ?, routine_medicines = ?,
         emergency_contact = ?, notes = ?, created_by = ?,
         profile_version = profile_version + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      cleanText(input.bloodType, 10),
      cleanText(input.allergies),
      cleanText(input.specialConditions),
      cleanText(input.routineMedicines),
      cleanText(input.emergencyContact, 200),
      cleanText(input.notes),
      session.id,
      existing.id
    ).run()

    await writeAudit(session, 'create', 'poskestren_patient', existing.id, `Mendaftarkan pasien ${santri.nama_lengkap}`, {
      santri_id: santri.id,
    })
    refresh()
    return { success: true as const, id: existing.id }
  }

  const id = generateId()
  await (await getDB()).prepare(
    `INSERT INTO poskestren_patient (
       id, santri_id, medical_record_no, blood_type, allergies, special_conditions,
       routine_medicines, emergency_contact, notes, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    santri.id,
    santri.poskestren_code || patientRecordNo(santri.nis),
    cleanText(input.bloodType, 10),
    cleanText(input.allergies),
    cleanText(input.specialConditions),
    cleanText(input.routineMedicines),
    cleanText(input.emergencyContact, 200),
    cleanText(input.notes),
    session.id
  ).run()

  await writeAudit(session, 'create', 'poskestren_patient', id, `Mendaftarkan pasien ${santri.nama_lengkap}`, {
    santri_id: santri.id,
  })
  refresh()
  return { success: true as const, id }
}

export async function updatePatient(input: {
  id: string
  profileVersion: number
  bloodType?: string
  allergies?: string
  specialConditions?: string
  routineMedicines?: string
  emergencyContact?: string
  notes?: string
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const patient = await queryOne<{ id: string; nama_lengkap: string }>(
    `SELECT p.id, s.nama_lengkap
     FROM poskestren_patient p JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [input.id]
  )
  if (!patient) return { success: false as const, error: 'Pasien tidak ditemukan.' }

  const mapping = {bloodType:'blood_type',allergies:'allergies',specialConditions:'special_conditions',
    routineMedicines:'routine_medicines',emergencyContact:'emergency_contact',notes:'notes'} as const
  const fields = Object.entries(mapping).filter(([key])=>Object.prototype.hasOwnProperty.call(input,key))
  if(!fields.length) return {success:true as const}
  const values = fields.map(([key])=>cleanText(input[key as keyof typeof mapping]))
  const result = await (await getDB()).prepare(
    'UPDATE poskestren_patient SET '+fields.map(([,column])=>column+'=?').join(',')+
    ",profile_version=profile_version+1,updated_at=datetime('now') WHERE id=? AND profile_version=?"
  ).bind(...values,input.id,input.profileVersion).run()
  if(!result.meta.changes) return {success:false as const,error:'Profil telah diubah. Muat ulang sebelum menyimpan.'}

  await writeAudit(session, 'update', 'poskestren_patient', input.id, `Memperbarui profil medis ${patient.nama_lengkap}`)
  refresh()
  return { success: true as const }
}

export async function getPatients(input: PoskestrenListQuery = {}): Promise<PoskestrenListResult<PatientRow>> {
  await requirePoskestrenStaffFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const cursor = decodeCursor(normalized.cursor)
  const where = [listedPatientSql()]
  const params: unknown[] = []

  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.nama_lengkap LIKE ? OR p.medical_record_no LIKE ? OR s.asrama LIKE ? OR s.kamar LIKE ?)')
    params.push(normalized.q, like, like, like, like)
  }
  if (cursor && typeof cursor[0] === 'string' && typeof cursor[1] === 'string') {
    where.push('(p.created_at < ? OR (p.created_at = ? AND p.id < ?))')
    params.push(cursor[0], cursor[0], cursor[1])
  }

  const rows = await query<PatientRow>(
    `SELECT p.id, p.santri_id, p.medical_record_no, p.profile_version, p.blood_type, p.allergies,
            p.special_conditions, p.routine_medicines, p.emergency_contact, p.notes, p.created_at,
            s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah,
            s.status_global, s.foto_url
     FROM poskestren_patient p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor([last.created_at, last.id]) : null,
    hasMore,
    truncated: normalized.isAll && hasMore,
    limit: normalized.limit,
  }
}

export async function getSickCandidates(input: { q?: string; gender?: string; asrama?: string; dateFrom?: string; dateTo?: string } = {}) {
  await requirePoskestrenStaffFeature(PATH)
  const q = String(input.q || '').trim().slice(0, 60)
  const like = `%${q}%`
  const where = [`s.status_global = 'aktif'`, `NOT EXISTS (SELECT 1 FROM poskestren_visit v WHERE v.source_episode_id = le.episode_id)`]
  const params: unknown[] = []

  if (q) {
    where.push(`(s.nis = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR ab.sakit_apa LIKE ?)`)
    params.push(q, like, like, like)
  }
  if (input.gender) {
    where.push(`s.jenis_kelamin = ?`)
    params.push(input.gender)
  }
  if (input.asrama) {
    where.push(`s.asrama = ?`)
    params.push(input.asrama)
  }
  if (input.dateFrom) {
    where.push(`COALESCE(ab.mulai_at, ab.created_at) >= ?`)
    params.push(input.dateFrom)
  }
  if (input.dateTo) {
    where.push(`COALESCE(ab.mulai_at, ab.created_at) <= ?`)
    params.push(input.dateTo + ' 23:59:59')
  }

  return query<{
    absen_sakit_id: string
    episode_id: string
    santri_id: string
    nama_lengkap: string
    nis: string
    asrama: string | null
    kamar: string | null
    sakit_apa: string | null
    mulai_at: string | null
    allergies: string | null
    special_conditions: string | null
  }>(
    `WITH latest_episode AS (
       SELECT COALESCE(ab.episode_id, ab.id) AS episode_id, MAX(ab.created_at) AS max_created
       FROM absen_sakit ab
       WHERE ab.status_sakit = 'SAKIT' AND ab.sembuh_at IS NULL
       GROUP BY COALESCE(ab.episode_id, ab.id)
     )
     SELECT ab.id AS absen_sakit_id, le.episode_id, ab.santri_id, s.nama_lengkap, s.nis,
            s.asrama, s.kamar, ab.sakit_apa, ab.mulai_at,
            p.allergies, p.special_conditions
     FROM latest_episode le
     JOIN absen_sakit ab
       ON COALESCE(ab.episode_id, ab.id) = le.episode_id AND ab.created_at = le.max_created
     JOIN santri s ON s.id = ab.santri_id
     LEFT JOIN poskestren_patient p ON p.santri_id = s.id
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(ab.mulai_at, ab.created_at) DESC
     LIMIT 100`,
    params
  )
}

async function ensurePatientForSantri(
  db: Awaited<ReturnType<typeof getDB>>,
  santri: { id: string; nis: string; poskestren_code: string | null },
  actorId: string
) {
  const existing = await db.prepare('SELECT id FROM poskestren_patient WHERE santri_id = ?').bind(santri.id).first() as { id: string } | null
  if (existing) return existing.id
  const id = generateId()
  await db.prepare(
    `INSERT INTO poskestren_patient(id, santri_id, medical_record_no, created_by)
     VALUES (?, ?, ?, ?)`
  ).bind(id, santri.id, santri.poskestren_code || patientRecordNo(santri.nis), actorId).run()
  return id
}

async function insertQueueVisit(db: Awaited<ReturnType<typeof getDB>>, input: {
  patientId: string
  queueDate: string
  actorId: string
  sourceType: 'MANUAL' | 'DATA_SAKIT'
  sourceEpisodeId?: string | null
  sourceAbsenSakitId?: string | null
  complaint?: string | null
  temperatureCelsius?: number | null
  systolicPressure?: number | null
  diastolicPressure?: number | null
  weightKg?: number | null
}) {
  const id = generateId()
  await db.prepare(
    `INSERT INTO poskestren_visit (
       id, patient_id, queue_date, queue_number, source_type, source_episode_id,
       source_absen_sakit_id, complaint, temperature_celsius, systolic_pressure,
       diastolic_pressure, weight_kg, registered_by
     )
     SELECT ?, ?, ?, COALESCE(MAX(queue_number), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
     FROM poskestren_visit
     WHERE queue_date = ?`
  ).bind(
    id,
    input.patientId,
    input.queueDate,
    input.sourceType,
    input.sourceEpisodeId || null,
    input.sourceAbsenSakitId || null,
    input.complaint || null,
    input.temperatureCelsius ?? null,
    input.systolicPressure ?? null,
    input.diastolicPressure ?? null,
    input.weightKg ?? null,
    input.actorId,
    input.queueDate
  ).run()
  return id
}

function parseVitals(input: {
  temperatureCelsius?: number | null
  systolicPressure?: number | null
  diastolicPressure?: number | null
  weightKg?: number | null
}) {
  const temperature = input.temperatureCelsius == null || input.temperatureCelsius === 0
    ? null
    : Number(input.temperatureCelsius)
  const systolic = input.systolicPressure == null || input.systolicPressure === 0
    ? null
    : Number(input.systolicPressure)
  const diastolic = input.diastolicPressure == null || input.diastolicPressure === 0
    ? null
    : Number(input.diastolicPressure)
  const weight = input.weightKg == null || input.weightKg === 0 ? null : Number(input.weightKg)
  if (temperature !== null && (!Number.isFinite(temperature) || temperature < 30 || temperature > 45)) {
    return { error: 'Suhu badan harus antara 30–45 °C.' }
  }
  if (systolic !== null && (!Number.isInteger(systolic) || systolic < 40 || systolic > 300)) {
    return { error: 'Tekanan sistolik harus antara 40–300.' }
  }
  if (diastolic !== null && (!Number.isInteger(diastolic) || diastolic < 30 || diastolic > 200)) {
    return { error: 'Tekanan diastolik harus antara 30–200.' }
  }
  if (weight !== null && (!Number.isFinite(weight) || weight < 1 || weight > 300)) {
    return { error: 'Berat badan harus antara 1–300 kg.' }
  }
  return { temperatureCelsius: temperature, systolicPressure: systolic, diastolicPressure: diastolic, weightKg: weight }
}

function patientAnamnesisStatement(
  db: Awaited<ReturnType<typeof getDB>>, visitId: string, allergies?: string, diseaseHistory?: string
) {
  return db.prepare("UPDATE poskestren_visit SET clinical_snapshot=json_object('allergies',CASE WHEN ? THEN ? ELSE (SELECT allergies FROM poskestren_patient WHERE id=patient_id) END,'diseaseHistory',CASE WHEN ? THEN ? ELSE (SELECT special_conditions FROM poskestren_patient WHERE id=patient_id) END) WHERE id=?")
    .bind(allergies!==undefined?1:0,cleanText(allergies),diseaseHistory!==undefined?1:0,cleanText(diseaseHistory),visitId)
}

export async function registerManualVisit(input: {
  patientId: string
  complaint: string
  queueDate?: string
  temperatureCelsius?: number | null
  systolicPressure?: number | null
  diastolicPressure?: number | null
  weightKg?: number | null
  diseaseHistory?: string
  allergies?: string
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'create')
  const complaint = cleanText(input.complaint)
  if (!complaint) return { success: false as const, error: 'Keluhan wajib diisi saat pendaftaran.' }
  const vitals = parseVitals(input)
  if ('error' in vitals) return { success: false as const, error: vitals.error }
  const patient = await queryOne<{ id: string; nama_lengkap: string; status_global: string }>(
    `SELECT p.id, s.nama_lengkap, s.status_global
     FROM poskestren_patient p JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [input.patientId]
  )
  if (!patient || patient.status_global !== 'aktif') {
    return { success: false as const, error: 'Pasien aktif tidak ditemukan.' }
  }
  const date = input.queueDate ? assertDate(input.queueDate) : toWibDateInputValue()
  const db = await getDB()
  const id = await insertQueueVisit(db, {
    patientId: patient.id,
    queueDate: date,
    actorId: session.id,
    sourceType: 'MANUAL',
    complaint,
    temperatureCelsius: vitals.temperatureCelsius,
    systolicPressure: vitals.systolicPressure,
    diastolicPressure: vitals.diastolicPressure,
    weightKg: vitals.weightKg,
  })
  await patientAnamnesisStatement(db, id, input.allergies, input.diseaseHistory).run()
  await writeAudit(session, 'create', 'poskestren_visit', id, `Mendaftarkan kunjungan ${patient.nama_lengkap}`, {
    complaint,
  })
  refresh()
  return { success: true as const, id }
}

export async function importSickEpisode(input: {
  episodeId: string
  absenSakitId: string
  temperatureCelsius?: number | null
  systolicPressure?: number | null
  diastolicPressure?: number | null
  weightKg?: number | null
  diseaseHistory?: string
  allergies?: string
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'create')
  if (!input.episodeId || !input.absenSakitId) {
    return { success: false as const, error: 'Data episode tidak lengkap.' }
  }
  const vitals = parseVitals(input)
  if ('error' in vitals) return { success: false as const, error: vitals.error }
  const source = await queryOne<{
    id: string
    episode_id: string
    santri_id: string
    sakit_apa: string | null
    nis: string
    nama_lengkap: string
    poskestren_code: string | null
  }>(
    `SELECT ab.id, COALESCE(ab.episode_id, ab.id) AS episode_id, ab.santri_id, ab.sakit_apa,
            s.nis, s.nama_lengkap, s.poskestren_code
     FROM absen_sakit ab JOIN santri s ON s.id = ab.santri_id
     WHERE ab.id = ?
       AND ab.status_sakit = 'SAKIT' AND ab.sembuh_at IS NULL
       AND s.status_global = 'aktif'`,
    [input.absenSakitId]
  )
  if (!source) return { success: false as const, error: 'Episode sakit aktif tidak ditemukan atau santri sudah tidak aktif.' }

  // Verifikasi episode_id cocok (loose check jika episode_id berbeda dari yang dikirim UI)
  const resolvedEpisodeId = source.episode_id

  const already = await queryOne<{ id: string }>('SELECT id FROM poskestren_visit WHERE source_episode_id = ?', [resolvedEpisodeId])
  if (already) return { success: false as const, error: 'Episode ini sudah pernah diimpor sebelumnya.' }

  try {
    const db = await getDB()
    const patientId = await ensurePatientForSantri(db, { id: source.santri_id, nis: source.nis, poskestren_code: source.poskestren_code }, session.id)
    const id = await insertQueueVisit(db, {
      patientId,
      queueDate: toWibDateInputValue(),
      actorId: session.id,
      sourceType: 'DATA_SAKIT',
      sourceEpisodeId: resolvedEpisodeId,
      sourceAbsenSakitId: source.id,
      complaint: source.sakit_apa,
      temperatureCelsius: vitals.temperatureCelsius,
      systolicPressure: vitals.systolicPressure,
      diastolicPressure: vitals.diastolicPressure,
      weightKg: vitals.weightKg,
    })
    await patientAnamnesisStatement(db, id, input.allergies, input.diseaseHistory).run()
    await writeAudit(session, 'create', 'poskestren_visit', id, `Mengimpor Data Sakit ${source.nama_lengkap}`, {
      source_episode_id: resolvedEpisodeId,
    })
    refresh()
    return { success: true as const, id }
  } catch (error) {
    const msg = String(error instanceof Error ? error.message : error)
    if (msg.includes('UNIQUE')) return { success: false as const, error: 'Episode sudah diimpor (konflik data).' }
    if (msg.includes('FOREIGN')) return { success: false as const, error: 'Referensi data tidak valid. Coba muat ulang halaman.' }
    console.error('[importSickEpisode] error:', msg)
    return { success: false as const, error: `Gagal mengimpor: ${msg.slice(0, 120)}` }
  }
}


export async function getVisits(input: PoskestrenListQuery & { date?: string } = {}) {
  await requirePoskestrenStaffFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const date = input.date ? assertDate(input.date) : toWibDateInputValue()
  const cursor = decodeCursor(normalized.cursor)
  const where = ['v.queue_date = ?']
  const params: unknown[] = [date]
  if (normalized.status) {
    where.push('v.status = ?')
    params.push(normalized.status)
  }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR s.kamar LIKE ? OR v.diagnosis LIKE ?)')
    params.push(normalized.q, like, like, like, like)
  }
  if (cursor && Number.isFinite(Number(cursor[0]))) {
    where.push('v.queue_number > ?')
    params.push(Number(cursor[0]))
  }
  const rows = await query<{
    id: string
    patient_id: string
    queue_date: string
    queue_number: number
    status: PoskestrenVisitStatus
    source_type: string
    complaint: string | null
    diagnosis: string | null
    treatment: string | null
    follow_up: string | null
    referral_destination: string | null
    referral_notes: string | null
    personnel_id: string | null
    practice_session_id: string | null
    started_at: string | null
    completed_at: string | null
    awaiting_medicine: number
    temperature_celsius: number | null
    systolic_pressure: number | null
    diastolic_pressure: number | null
    weight_kg: number | null
    nama_lengkap: string
    nis: string
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    medical_record_no: string
    allergies: string | null
    special_conditions: string | null
    personnel_name: string | null
  }>(
    `SELECT v.clinical_snapshot, v.id, v.patient_id, v.queue_date, v.queue_number, v.status, v.source_type,
            v.complaint, v.diagnosis, v.treatment, v.follow_up,
            v.referral_destination, v.referral_notes, v.personnel_id, v.practice_session_id,
            v.started_at, v.completed_at, v.awaiting_medicine,
            v.temperature_celsius, v.systolic_pressure, v.diastolic_pressure, v.weight_kg,
            s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            p.medical_record_no, p.allergies, p.special_conditions,
            pp.full_name AS personnel_name
     FROM poskestren_visit v
     JOIN poskestren_patient p ON p.id = v.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN poskestren_personnel pp ON pp.id = v.personnel_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.queue_number
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  return {
    items,
    nextCursor: hasMore && items.length ? encodeCursor([items.at(-1)!.queue_number]) : null,
    hasMore,
    truncated: normalized.isAll && hasMore,
    limit: normalized.limit,
  }
}

export async function getExaminationHistory(input: PoskestrenListQuery = {}) {
  await requirePoskestrenStaffFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const cursor = decodeCursor(normalized.cursor)
  const where = ["v.status IN ('SELESAI','DIRUJUK')"]
  const params: unknown[] = []
  if (normalized.from) {
    where.push('v.queue_date >= ?')
    params.push(normalized.from)
  }
  if (normalized.to) {
    where.push('v.queue_date <= ?')
    params.push(normalized.to)
  }
  if (normalized.q) {
    const fts = toFtsPrefixQuery(normalized.q)
    const like = `%${normalized.q}%`
    where.push(`(
      s.nis = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ?
      OR v.id IN (
        SELECT entity_id FROM poskestren_search_fts
        WHERE entity_type = 'VISIT' AND poskestren_search_fts MATCH ?
      )
    )`)
    params.push(normalized.q, like, like, fts || '""')
  }
  if (cursor && typeof cursor[0] === 'string' && typeof cursor[1] === 'string') {
    where.push('(v.completed_at < ? OR (v.completed_at = ? AND v.id < ?))')
    params.push(cursor[0], cursor[0], cursor[1])
  }
  const rows = await query<any>(
    `SELECT v.id, v.queue_date, v.status, v.source_type, v.complaint, v.diagnosis,
            v.treatment, v.follow_up, v.referral_destination, v.referral_notes,
            v.completed_at, v.revision_no, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            pp.full_name AS personnel_name,
            GROUP_CONCAT(DISTINCT m.name) AS medicine_names
     FROM poskestren_visit v
     JOIN poskestren_patient p ON p.id = v.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN poskestren_personnel pp ON pp.id = v.personnel_id
     LEFT JOIN poskestren_prescription rx ON rx.visit_id = v.id
     LEFT JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
     LEFT JOIN poskestren_medicine m ON m.id = rxi.medicine_id
     WHERE ${where.join(' AND ')}
     GROUP BY v.id
     ORDER BY v.completed_at DESC, v.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor([last.completed_at, last.id]) : null,
    hasMore,
    truncated: normalized.isAll && hasMore,
    limit: normalized.limit,
  }
}

async function getMedicalPersonnelForSession(userId: string) {
  return queryOne<{ id: string; full_name: string }>(
    `SELECT id, full_name
     FROM poskestren_personnel
     WHERE user_id = ? AND personnel_type = 'MEDICAL' AND is_active = 1`,
    [userId]
  )
}

export async function getMyPracticeSession() {
  const session = await requirePoskestrenStaffFeature(PATH)
  const personnel = await getMedicalPersonnelForSession(session.id)
  if (!personnel) return { personnel: null, practice: null }
  const practice = await queryOne<any>(
    `SELECT id, session_date, status, started_at, ended_at, notes
     FROM poskestren_practice_session
     WHERE personnel_id = ? AND status = 'OPEN'
     LIMIT 1`,
    [personnel.id]
  )
  return { personnel, practice }
}

export async function startPracticeSession(notes?: string) {
  const session = await requirePoskestrenStaffFeature(PATH, 'create')
  const personnel = await getMedicalPersonnelForSession(session.id)
  if (!personnel) return { success: false as const, error: 'Akun belum ditautkan ke tenaga medis aktif.' }
  const open = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_practice_session WHERE personnel_id = ? AND status = 'OPEN'`,
    [personnel.id]
  )
  if (open) return { success: true as const, id: open.id }
  const id = generateId()
  await (await getDB()).prepare(
    `INSERT INTO poskestren_practice_session(
       id, personnel_id, session_date, status, started_at, notes, created_by
     ) VALUES (?, ?, ?, 'OPEN', ?, ?, ?)`
  ).bind(id, personnel.id, toWibDateInputValue(), new Date().toISOString(), cleanText(notes), session.id).run()
  await writeAudit(session, 'create', 'poskestren_practice_session', id, `Membuka sesi praktik ${personnel.full_name}`)
  refresh()
  return { success: true as const, id }
}

export async function closePracticeSession(id: string) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const personnel = await getMedicalPersonnelForSession(session.id)
  if (!personnel) return { success: false as const, error: 'Tenaga medis tidak ditemukan.' }
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_practice_session
     SET status = 'CLOSED', ended_at = ?
     WHERE id = ? AND personnel_id = ? AND status = 'OPEN'`
  ).bind(new Date().toISOString(), id, personnel.id).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Sesi sudah ditutup atau tidak ditemukan.' }
  await writeAudit(session, 'update', 'poskestren_practice_session', id, `Menutup sesi praktik ${personnel.full_name}`)
  refresh()
  return { success: true as const }
}

export async function beginVisit(visitId: string) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const personnel = await getMedicalPersonnelForSession(session.id)
  if (!personnel) return { success: false as const, error: 'Akun belum ditautkan ke tenaga medis aktif.' }
  const practice = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_practice_session
     WHERE personnel_id = ? AND status = 'OPEN' LIMIT 1`,
    [personnel.id]
  )
  if (!practice) return { success: false as const, error: 'Buka sesi praktik terlebih dahulu.' }
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_visit
     SET status = 'DIPERIKSA', personnel_id = ?, practice_session_id = ?,
         started_at = COALESCE(started_at, ?), updated_at = ?
     WHERE id = ? AND status = 'MENUNGGU'`
  ).bind(personnel.id, practice.id, new Date().toISOString(), new Date().toISOString(), visitId).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Kunjungan tidak lagi menunggu.' }
  refresh()
  return { success: true as const }
}

export async function cancelVisit(visitId: string, reason: string) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const cleanReason = cleanText(reason, 300)
  if (!cleanReason) return { success: false as const, error: 'Alasan pembatalan wajib diisi.' }
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_visit
     SET status = 'BATAL', follow_up = ?, updated_at = ?
     WHERE id = ? AND status IN ('MENUNGGU','DIPERIKSA')`
  ).bind(`Batal: ${cleanReason}`, new Date().toISOString(), visitId).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Kunjungan tidak dapat dibatalkan.' }
  await writeAudit(session, 'update', 'poskestren_visit', visitId, 'Membatalkan kunjungan POSKESTREN', { reason: cleanReason })
  refresh()
  return { success: true as const }
}

export async function getMedicineOptions() {
  await requirePoskestrenStaffFeature(PATH)
  return query<{
    id: string
    name: string
    generic_name: string | null
    base_unit: string
    total_stock_base: number
  }>(
    `SELECT id, name, generic_name, base_unit, total_stock_base
     FROM poskestren_medicine
     WHERE is_active = 1
     ORDER BY name COLLATE NOCASE
     LIMIT 500`
  )
}

export async function completeVisit(input: ClinicalInput & {
  visitId: string
  complaint: string
  diagnosis: string
  diagnosisId?: string
  treatment?: string
  followUp?: string
  referralDestination?: string
  referralNotes?: string
  prescriptionItems?: PrescriptionDraftItem[]
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const complaint = cleanText(input.complaint)
  const diagnosis = cleanText(input.diagnosis)
  const diagnosisRow = input.diagnosisId
    ? await queryOne<{ id: string; name: string }>(
        'SELECT id, name FROM poskestren_diagnosis WHERE id = ? AND is_active = 1',
        [input.diagnosisId]
      )
    : null
  if (input.diagnosisId && !diagnosisRow) return { success: false as const, error: 'Diagnosis tidak valid.' }
  const diagnosisText = diagnosisRow?.name || diagnosis
  if (!complaint || !diagnosis) {
    return { success: false as const, error: 'Keluhan dan diagnosis wajib diisi.' }
  }
  const visit = await queryOne<{ id: string; status: PoskestrenVisitStatus; personnel_id: string | null; nama_lengkap: string }>(
    `SELECT v.id, v.status, v.personnel_id, s.nama_lengkap
     FROM poskestren_visit v
     JOIN poskestren_patient p ON p.id = v.patient_id
     JOIN santri s ON s.id = p.santri_id
     WHERE v.id = ?`,
    [input.visitId]
  )
  if (!visit || visit.status !== 'DIPERIKSA' || !visit.personnel_id) {
    return { success: false as const, error: 'Kunjungan belum aktif atau sudah selesai.' }
  }

  const normalizedItems = await normalizePrescription(input.prescriptionItems || [])
  const cleanItems = normalizedItems.filter(item=>item.sourceType==='STOCK').map(item=>({...item,requested:item.quantity}))
  const externalItems = normalizedItems.filter(item=>item.sourceType==='EXTERNAL')
  const clinical = normalizeClinical(input)
  const db = await getDB()
  const statements: any[] = []
  const prescriptionId = normalizedItems.length ? generateId() : null
  if (prescriptionId) {
    statements.push(db.prepare(
      `INSERT INTO poskestren_prescription(id, visit_id, status, created_by)
       VALUES (?, ?, 'DRAFT', ?)`
    ).bind(prescriptionId, visit.id, session.id))
  }

  for (const item of cleanItems) {
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_prescription_item(
           id, prescription_id, medicine_id, dosage, requested_quantity_base,
           dispensed_quantity_base, notes
         ) VALUES (?, ?, ?, ?, ?, 0, ?)`
      ).bind(generateId(), prescriptionId, item.medicineId, item.dosage, item.requested, item.notes)
    )
  }

  statements.unshift(claim(db,'complete-visit:'+visit.id,"EXISTS(SELECT 1 FROM poskestren_visit WHERE id=? AND status='DIPERIKSA' AND awaiting_medicine=0)",[visit.id]))
  for (const item of externalItems) statements.push(db.prepare(
    'INSERT INTO poskestren_prescription_external_item(id,prescription_id,medicine_name,quantity,unit,dosage,notes) VALUES(?,?,?,?,?,?,?)'
  ).bind(generateId(),prescriptionId,item.medicineName,item.quantity,item.unit,item.dosage,item.notes))
  statements.push(db.prepare('UPDATE poskestren_visit SET clinical_snapshot=?,fee_category=? WHERE id=?')
    .bind(JSON.stringify(clinical), clinical.followUp ? 'TREATMENT' : 'NORMAL',visit.id))
  const now = new Date().toISOString()
  statements.push(
    db.prepare(
      `UPDATE poskestren_visit
       SET awaiting_medicine = 1, complaint = ?, diagnosis_id = ?, diagnosis = ?, treatment = ?, follow_up = ?,
           referral_destination = ?, referral_notes = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND status = 'DIPERIKSA' AND awaiting_medicine = 0`
    ).bind(
      complaint,
      diagnosisRow?.id || null,
      diagnosisText,
      cleanText(input.treatment),
      cleanText(input.followUp),
      cleanText(input.referralDestination, 200),
      cleanText(input.referralNotes),
      session.id,
      now,
      visit.id
    )
  )
  statements.push(
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'VISIT' AND entity_id = ?`).bind(visit.id),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('VISIT', ?, ?)`
    ).bind(visit.id, [complaint, diagnosisText, cleanText(input.treatment), cleanText(input.followUp)].filter(Boolean).join(' '))
  )
  await db.batch(statements)

  await writeAudit(session, 'update', 'poskestren_visit', visit.id, `Menyelesaikan pemeriksaan ${visit.nama_lengkap} (menunggu penyerahan obat)`, {
    prescription_items: cleanItems.length,
  })
  refresh()
  revalidatePath(POSKESTREN_HREF.medicine)
  revalidatePath(POSKESTREN_HREF.reports)
  return { success: true as const, status: 'DIPERIKSA' as const, awaitingMedicine: true }
}

export async function getDeliveryQueue(input: PoskestrenListQuery & { date?: string } = {}) {
  await requirePoskestrenStaffFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const date = input.date ? assertDate(input.date) : toWibDateInputValue()
  const cursor = decodeCursor(normalized.cursor)
  const where = ['v.queue_date = ?', 'v.awaiting_medicine = 1']
  const params: unknown[] = [date]
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR s.kamar LIKE ? OR v.diagnosis LIKE ? OR v.complaint LIKE ?)')
    params.push(normalized.q, like, like, like, like, like)
  }
  if (cursor && Number.isFinite(Number(cursor[0]))) {
    where.push('v.queue_number > ?')
    params.push(Number(cursor[0]))
  }
  const rows = await query<any>(
    `SELECT v.id, v.queue_number, v.status, v.complaint, v.diagnosis,
            v.referral_destination, v.temperature_celsius, v.systolic_pressure,
            v.diastolic_pressure, v.weight_kg,
            s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            p.medical_record_no, p.allergies,
            pp.full_name AS doctor_name,
            GROUP_CONCAT(DISTINCT m.name || ' (' || rxi.requested_quantity_base || ')') AS prescription_summary
     FROM poskestren_visit v
     JOIN poskestren_patient p ON p.id = v.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN poskestren_personnel pp ON pp.id = v.personnel_id
     LEFT JOIN poskestren_prescription rx ON rx.visit_id = v.id AND rx.status = 'DRAFT'
     LEFT JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
     LEFT JOIN poskestren_medicine m ON m.id = rxi.medicine_id
     WHERE ${where.join(' AND ')}
     GROUP BY v.id
     ORDER BY v.queue_number
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  return {
    items,
    nextCursor: hasMore && items.length ? encodeCursor([items.at(-1)!.queue_number]) : null,
    hasMore,
    truncated: normalized.isAll && hasMore,
    limit: normalized.limit,
  }
}

export async function getVisitPrescriptionForDelivery(visitId: string) {
  await requirePoskestrenStaffFeature(PATH)
  const visit = await queryOne<any>(
    `SELECT v.id, v.queue_number, v.queue_date, v.status, v.complaint, v.diagnosis,
            v.referral_destination, v.referral_notes, v.temperature_celsius,
            v.systolic_pressure, v.diastolic_pressure, v.weight_kg,
            s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            p.medical_record_no, p.allergies, p.special_conditions,
            pp.full_name AS doctor_name
     FROM poskestren_visit v
     JOIN poskestren_patient p ON p.id = v.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN poskestren_personnel pp ON pp.id = v.personnel_id
     WHERE v.id = ? AND v.awaiting_medicine = 1`,
    [visitId]
  )
  if (!visit) return null
  const prescription = await queryOne<any>(
    `SELECT id, status FROM poskestren_prescription WHERE visit_id = ? AND status = 'DRAFT'`,
    [visitId]
  )
  const items = prescription
    ? await query<any>(
        `SELECT rxi.id, rxi.medicine_id, rxi.dosage, rxi.requested_quantity_base,
                rxi.dispensed_quantity_base, rxi.notes,
                m.name, m.base_unit, m.total_stock_base
         FROM poskestren_prescription_item rxi
         JOIN poskestren_medicine m ON m.id = rxi.medicine_id
         WHERE rxi.prescription_id = ?
         ORDER BY m.name COLLATE NOCASE`,
        [prescription.id]
      )
    : []
  const externalItems = prescription ? await query<any>('SELECT * FROM poskestren_prescription_external_item WHERE prescription_id=?',[prescription.id]) : []
  return { visit, prescription, items, externalItems }
}

export async function deliverVisitMedicines(input: {
  visitId: string
  items: Array<{ medicineId: string; quantity: number }>
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const visit = await queryOne<{
    id: string
    status: PoskestrenVisitStatus
    queue_date: string
    referral_destination: string | null
    nama_lengkap: string
    asrama: string | null
    awaiting_medicine: number
  }>(
    `SELECT v.id, v.status, v.queue_date, v.referral_destination, s.nama_lengkap, s.asrama,
            v.awaiting_medicine
     FROM poskestren_visit v
     JOIN poskestren_patient p ON p.id = v.patient_id
     JOIN santri s ON s.id = p.santri_id
     WHERE v.id = ?`,
    [input.visitId]
  )
  if (!visit) return { success: false as const, error: 'Kunjungan tidak ditemukan.' }
  if (Number(visit.awaiting_medicine) !== 1) {
    return { success: false as const, error: 'Kunjungan tidak menunggu penyerahan obat.' }
  }
  const prescription = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM poskestren_prescription WHERE visit_id = ?`,
    [visit.id]
  )
  if (prescription && prescription.status !== 'DRAFT') {
    return { success: false as const, error: 'Obat sudah pernah diserahkan.' }
  }
  const prescriptionItems = prescription
    ? await query<{ id: string; medicine_id: string; dosage: string | null; requested_quantity_base: number }>(
        `SELECT id, medicine_id, dosage, requested_quantity_base
         FROM poskestren_prescription_item WHERE prescription_id = ?`,
        [prescription.id]
      )
    : []

  const cleaned = (input.items || []).slice(0, 100).map((item, index) => ({
    medicineId: cleanText(item.medicineId, 120) || '',
    quantity: parseNonNegativeInteger(item.quantity, `Jumlah obat baris ${index + 1}`),
  }))
  if (cleaned.some(item => !item.medicineId)) {
    return { success: false as const, error: 'Obat wajib dipilih pada setiap baris.' }
  }
  if (new Set(cleaned.map(item => item.medicineId)).size !== cleaned.length) {
    return { success: false as const, error: 'Obat yang sama tidak boleh diulang.' }
  }
  if (cleaned.some(item => item.quantity > Number(prescriptionItems.find(row=>row.medicine_id===item.medicineId)?.requested_quantity_base ?? -1))) {
    return {success:false as const,error:'Jumlah penyerahan melebihi resep.'}
  }
  const allowedIds = new Set(prescriptionItems.map(item => item.medicine_id))
  if (cleaned.some(item => !allowedIds.has(item.medicineId))) {
    return { success: false as const, error: 'Ada obat yang tidak ada di resep dokter.' }
  }
  if (!prescription && cleaned.length) {
    return { success: false as const, error: 'Kunjungan ini tidak memiliki resep obat.' }
  }

  const db = await getDB()
  const statements: any[] = [claim(db,'deliver-visit:'+visit.id,
    "EXISTS(SELECT 1 FROM poskestren_visit WHERE id=? AND awaiting_medicine=1)",[visit.id])]
  const medicineRows = cleaned.length
    ? await query<{ id: string; name: string; total_stock_base: number }>(
        `SELECT id, name, total_stock_base
         FROM poskestren_medicine
         WHERE id IN (${cleaned.map(() => '?').join(',')}) AND is_active = 1`,
        cleaned.map(item => item.medicineId)
      )
    : []
  if (medicineRows.length !== cleaned.length) {
    return { success: false as const, error: 'Salah satu obat tidak ditemukan.' }
  }

  let dispensedCount = 0
  if (prescription) {
    for (const item of cleaned) {
      if (item.quantity === 0) continue
      const prescriptionItem = prescriptionItems.find(row => row.medicine_id === item.medicineId)!
      const medicine = medicineRows.find(row => row.id === item.medicineId)!
      const mutation = await prepareStockMutationFromSnapshot(db, {
        medicineId: item.medicineId,
        medicineName: medicine.name,
        stockBefore: Number(medicine.total_stock_base),
        quantityDelta: -item.quantity,
        movementType: 'PATIENT',
        movementDate: visit.queue_date,
        referenceType: 'PRESCRIPTION_ITEM',
        referenceId: prescriptionItem.id,
        actorId: session.id,
        notes: prescriptionItem.dosage,
        preferredAsrama: visit.asrama,
      })
      statements.push(...mutation.statements)
      statements.push(
        db.prepare(
          `UPDATE poskestren_prescription_item
           SET dispensed_quantity_base = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).bind(item.quantity, prescriptionItem.id)
      )
      dispensedCount++
    }
  }

  const finalStatus: PoskestrenVisitStatus = cleanText(visit.referral_destination, 200) ? 'DIRUJUK' : 'SELESAI'
  const now = new Date().toISOString()
  statements.push(
    db.prepare(
      `UPDATE poskestren_visit
       SET status = ?, awaiting_medicine = 0, completed_at = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND awaiting_medicine = 1`
    ).bind(finalStatus, now, session.id, now, visit.id)
  )
  if (prescription) {
    const rxStatus = dispensedCount === prescriptionItems.length
      ? 'DISPENSED'
      : dispensedCount > 0 ? 'PARTIAL' : 'CANCELLED'
    statements.push(
      db.prepare(
        `UPDATE poskestren_prescription
         SET status = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'DRAFT'`
      ).bind(rxStatus, prescription.id)
    )
  }

  try {
    await db.batch(statements)
  } catch (error) {
    const msg = String(error instanceof Error ? error.message : error)
    return { success: false as const, error: msg.slice(0, 160) }
  }

  await writeAudit(session, 'update', 'poskestren_visit', visit.id, `Penyerahan obat ${visit.nama_lengkap}`, {
    status: finalStatus,
    medicine_delivered: dispensedCount,
  })
  refresh()
  revalidatePath(POSKESTREN_HREF.medicine)
  revalidatePath(POSKESTREN_HREF.reports)
  return { success: true as const, status: finalStatus }
}

export async function reviseCompletedVisit(input: {
  visitId: string
  reason: string
  diagnosis: string
  treatment?: string
  followUp?: string
  referralDestination?: string
  referralNotes?: string
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  const reason = cleanText(input.reason, 500)
  const diagnosis = cleanText(input.diagnosis)
  if (!reason || !diagnosis) return { success: false as const, error: 'Alasan revisi dan diagnosis wajib diisi.' }
  const before = await queryOne<any>(
    `SELECT id, status, complaint, diagnosis, diagnosis_id, treatment, follow_up,
            referral_destination, referral_notes, revision_no
     FROM poskestren_visit
     WHERE id = ? AND status IN ('SELESAI','DIRUJUK')`,
    [input.visitId]
  )
  if (!before) return { success: false as const, error: 'Pemeriksaan selesai tidak ditemukan.' }
  const revisionNo = Number(before.revision_no) + 1
  const finalStatus = cleanText(input.referralDestination, 200) ? 'DIRUJUK' : 'SELESAI'
  const db = await getDB()
  await db.batch([
    claim(db,'basic-revise:'+input.visitId+':'+revisionNo,'EXISTS(SELECT 1 FROM poskestren_visit WHERE id=? AND revision_no=?)',[input.visitId,Number(before.revision_no||0)]),
    db.prepare("UPDATE poskestren_visit SET fee_category=CASE WHEN COALESCE(follow_up,'')<>? THEN ? ELSE fee_category END WHERE id=?")
      .bind(cleanText(input.followUp)||'',cleanText(input.followUp)?'TREATMENT':'NORMAL',input.visitId),
    db.prepare(
      `INSERT INTO poskestren_visit_revision(
         id, visit_id, revision_no, before_json, reason, revised_by
       ) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(generateId(), input.visitId, revisionNo, JSON.stringify(before), reason, session.id),
    db.prepare(
      `UPDATE poskestren_visit
       SET status = ?, diagnosis_id = NULL, diagnosis = ?, treatment = ?, follow_up = ?,
           referral_destination = ?, referral_notes = ?, revision_no = ?,
           updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      finalStatus,
      diagnosis,
      cleanText(input.treatment),
      cleanText(input.followUp),
      cleanText(input.referralDestination, 200),
      cleanText(input.referralNotes),
      revisionNo,
      session.id,
      new Date().toISOString(),
      input.visitId
    ),
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'VISIT' AND entity_id = ?`).bind(input.visitId),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('VISIT', ?, ?)`
    ).bind(input.visitId, [before.complaint, diagnosis, cleanText(input.treatment), cleanText(input.followUp)].filter(Boolean).join(' ')),
  ])
  await writeAudit(session, 'update', 'poskestren_visit', input.visitId, 'Merevisi pemeriksaan selesai', {
    revision_no: revisionNo,
    reason,
  })
  refresh()
  return { success: true as const }
}

export async function getPreventiveData(input: PoskestrenListQuery = {}) {
  await requirePoskestrenStaffFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.from) {
    where.push('p.program_date >= ?')
    params.push(normalized.from)
  }
  if (normalized.to) {
    where.push('p.program_date <= ?')
    params.push(normalized.to)
  }
  if (normalized.status) {
    where.push('p.status = ?')
    params.push(normalized.status)
  }
  if (normalized.q) {
    const fts = toFtsPrefixQuery(normalized.q)
    where.push(`p.id IN (
      SELECT entity_id FROM poskestren_search_fts
      WHERE entity_type = 'PREVENTIVE' AND poskestren_search_fts MATCH ?
    )`)
    params.push(fts || '""')
  }
  const [types, programs] = await Promise.all([
    query<any>(
      `SELECT id, name, is_active FROM poskestren_preventive_type
       WHERE is_active = 1 ORDER BY name`
    ),
    query<any>(
      `SELECT p.id, p.title, p.program_date, p.target_summary, p.description,
              p.attachment_url, p.status, t.name AS type_name,
              pp.full_name AS personnel_name,
              COUNT(pt.id) AS participant_count,
              SUM(CASE WHEN pt.attendance = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN pt.follow_up IS NOT NULL AND pt.follow_up <> '' THEN 1 ELSE 0 END) AS follow_up_count
       FROM poskestren_preventive_program p
       LEFT JOIN poskestren_preventive_type t ON t.id = p.type_id
       LEFT JOIN poskestren_personnel pp ON pp.id = p.personnel_id
       LEFT JOIN poskestren_preventive_participant pt ON pt.program_id = p.id
       WHERE ${where.join(' AND ')}
       GROUP BY p.id
       ORDER BY p.program_date DESC, p.created_at DESC
       LIMIT ?`,
      [...params, normalized.limit]
    ),
  ])
  return { types, programs, truncated: normalized.isAll && programs.length === normalized.limit }
}

export async function createPreventiveType(name: string) {
  const session = await requirePoskestrenStaffFeature(PATH, 'create')
  const cleanName = cleanText(name, 100)
  if (!cleanName) return { success: false as const, error: 'Nama jenis program wajib diisi.' }
  const id = generateId()
  try {
    await (await getDB()).prepare(
      `INSERT INTO poskestren_preventive_type(id, name, created_by) VALUES (?, ?, ?)`
    ).bind(id, cleanName, session.id).run()
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Jenis program sudah ada.' }
    throw error
  }
  await writeAudit(session, 'create', 'poskestren_preventive_type', id, `Menambah jenis preventif ${cleanName}`)
  refresh()
  return { success: true as const, id }
}

export async function createPreventiveProgram(input: {
  typeId?: string
  title: string
  programDate: string
  targetSummary?: string
  description?: string
  attachmentUrl?: string
  personnelId?: string
  participantIds?: string[]
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'create')
  const title = cleanText(input.title, 200)
  if (!title) return { success: false as const, error: 'Judul program wajib diisi.' }
  const date = assertDate(input.programDate)
  const ids = [...new Set((input.participantIds || []).filter(Boolean))].slice(0, 500)
  if (ids.length) {
    const valid = await query<{ id: string }>(
      `SELECT id FROM santri
       WHERE status_global = 'aktif' AND id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    if (valid.length !== ids.length) return { success: false as const, error: 'Ada peserta yang tidak valid.' }
  }
  const id = generateId()
  const db = await getDB()
  const statements = [
    db.prepare(
      `INSERT INTO poskestren_preventive_program(
         id, type_id, title, program_date, target_summary, description,
         attachment_url, personnel_id, status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`
    ).bind(
      id,
      input.typeId || null,
      title,
      date,
      cleanText(input.targetSummary, 300),
      cleanText(input.description, 2000),
      cleanText(input.attachmentUrl, 500),
      input.personnelId || null,
      session.id
    ),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('PREVENTIVE', ?, ?)`
    ).bind(id, [title, input.targetSummary, input.description].filter(Boolean).join(' ')),
    ...ids.map(santriId =>
      db.prepare(
        `INSERT INTO poskestren_preventive_participant(id, program_id, santri_id)
         VALUES (?, ?, ?)`
      ).bind(generateId(), id, santriId)
    ),
  ]
  await db.batch(statements)
  await writeAudit(session, 'create', 'poskestren_preventive_program', id, `Membuat program preventif ${title}`, {
    participant_count: ids.length,
  })
  refresh()
  return { success: true as const, id }
}

export async function getPreventiveParticipants(programId: string) {
  await requirePoskestrenStaffFeature(PATH)
  return query<any>(
    `SELECT pt.id, pt.santri_id, pt.attendance, pt.result, pt.follow_up, pt.notes,
            s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah
     FROM poskestren_preventive_participant pt
     JOIN santri s ON s.id = pt.santri_id
     WHERE pt.program_id = ?
     ORDER BY s.nama_lengkap`,
    [programId]
  )
}

export async function updatePreventiveParticipant(input: {
  id: string
  attendance: 'PENDING' | 'PRESENT' | 'ABSENT'
  result?: string
  followUp?: string
  notes?: string
}) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  if (!['PENDING', 'PRESENT', 'ABSENT'].includes(input.attendance)) {
    return { success: false as const, error: 'Status kehadiran tidak valid.' }
  }
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_preventive_participant
     SET attendance = ?, result = ?, follow_up = ?, notes = ?, updated_by = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    input.attendance,
    cleanText(input.result),
    cleanText(input.followUp),
    cleanText(input.notes),
    session.id,
    input.id
  ).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Peserta tidak ditemukan.' }
  refresh()
  return { success: true as const }
}

export async function updatePreventiveStatus(
  id: string,
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
) {
  const session = await requirePoskestrenStaffFeature(PATH, 'update')
  if (!['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return { success: false as const, error: 'Status program tidak valid.' }
  }
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_preventive_program
     SET status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(status, id).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Program tidak ditemukan.' }
  await writeAudit(session, 'update', 'poskestren_preventive_program', id, `Mengubah status preventif menjadi ${status}`)
  refresh()
  return { success: true as const }
}

