/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { toWibDateInputValue } from '@/lib/date/wib'
import { requirePoskestrenFeature } from '@/lib/poskestren/access'
import {
  assertDate,
  cleanText,
  decodeCursor,
  encodeCursor,
  normalizePoskestrenListQuery,
  parsePositiveInteger,
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

async function writeAudit(
  session: Awaited<ReturnType<typeof requirePoskestrenFeature>>,
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
  await requirePoskestrenFeature(PATH)
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
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS has_patient
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
  await requirePoskestrenFeature(PATH)
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
  const session = await requirePoskestrenFeature(PATH, 'create')
  const santri = await queryOne<{ id: string; nis: string; nama_lengkap: string; poskestren_code: string | null }>(
    `SELECT id, nis, nama_lengkap, poskestren_code
     FROM santri
     WHERE id = ? AND status_global = 'aktif'`,
    [input.santriId]
  )
  if (!santri) return { success: false as const, error: 'Santri aktif tidak ditemukan.' }

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM poskestren_patient WHERE santri_id = ?',
    [santri.id]
  )
  if (existing) return { success: false as const, error: 'Santri sudah terdaftar sebagai pasien.' }

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
    null,
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
  bloodType?: string
  allergies?: string
  specialConditions?: string
  routineMedicines?: string
  emergencyContact?: string
  notes?: string
}) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const patient = await queryOne<{ id: string; nama_lengkap: string }>(
    `SELECT p.id, s.nama_lengkap
     FROM poskestren_patient p JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [input.id]
  )
  if (!patient) return { success: false as const, error: 'Pasien tidak ditemukan.' }

  await (await getDB()).prepare(
    `UPDATE poskestren_patient
     SET allergies = ?, special_conditions = ?, routine_medicines = ?,
         notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    cleanText(input.allergies),
    cleanText(input.specialConditions),
    cleanText(input.routineMedicines),
    cleanText(input.notes),
    input.id
  ).run()

  await writeAudit(session, 'update', 'poskestren_patient', input.id, `Memperbarui profil medis ${patient.nama_lengkap}`)
  refresh()
  return { success: true as const }
}

export async function getPatients(input: PoskestrenListQuery = {}): Promise<PoskestrenListResult<PatientRow>> {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const cursor = decodeCursor(normalized.cursor)
  const where = ['1=1']
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
    `SELECT p.id, p.santri_id, p.medical_record_no, p.blood_type, p.allergies,
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
  await requirePoskestrenFeature(PATH)
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
  }>(
    `WITH latest_episode AS (
       SELECT COALESCE(ab.episode_id, ab.id) AS episode_id, MAX(ab.created_at) AS max_created
       FROM absen_sakit ab
       WHERE ab.status_sakit = 'SAKIT' AND ab.sembuh_at IS NULL
       GROUP BY COALESCE(ab.episode_id, ab.id)
     )
     SELECT ab.id AS absen_sakit_id, le.episode_id, ab.santri_id, s.nama_lengkap, s.nis,
            s.asrama, s.kamar, ab.sakit_apa, ab.mulai_at
     FROM latest_episode le
     JOIN absen_sakit ab
       ON COALESCE(ab.episode_id, ab.id) = le.episode_id AND ab.created_at = le.max_created
     JOIN santri s ON s.id = ab.santri_id
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

async function insertQueueVisit(input: {
  patientId: string
  queueDate: string
  actorId: string
  sourceType: 'MANUAL' | 'DATA_SAKIT'
  sourceEpisodeId?: string | null
  sourceAbsenSakitId?: string | null
  complaint?: string | null
}) {
  const id = generateId()
  const db = await getDB()
  await db.prepare(
    `INSERT INTO poskestren_visit (
       id, patient_id, queue_date, queue_number, source_type, source_episode_id,
       source_absen_sakit_id, complaint, registered_by
     )
     SELECT ?, ?, ?, COALESCE(MAX(queue_number), 0) + 1, ?, ?, ?, ?, ?
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
    input.actorId,
    input.queueDate
  ).run()
  return id
}

export async function registerManualVisit(input: { patientId: string; complaint?: string; queueDate?: string }) {
  const session = await requirePoskestrenFeature(PATH, 'create')
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
  const id = await insertQueueVisit({
    patientId: patient.id,
    queueDate: date,
    actorId: session.id,
    sourceType: 'MANUAL',
    complaint: cleanText(input.complaint),
  })
  await writeAudit(session, 'create', 'poskestren_visit', id, `Mendaftarkan kunjungan ${patient.nama_lengkap}`)
  refresh()
  return { success: true as const, id }
}

export async function importSickEpisode(input: { episodeId: string; absenSakitId: string }) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  if (!input.episodeId || !input.absenSakitId) {
    return { success: false as const, error: 'Data episode tidak lengkap.' }
  }
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
    const id = await insertQueueVisit({
      patientId,
      queueDate: toWibDateInputValue(),
      actorId: session.id,
      sourceType: 'DATA_SAKIT',
      sourceEpisodeId: resolvedEpisodeId,
      sourceAbsenSakitId: source.id,
      complaint: source.sakit_apa,
    })
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
  await requirePoskestrenFeature(PATH)
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
    `SELECT v.id, v.patient_id, v.queue_date, v.queue_number, v.status, v.source_type,
            v.complaint, v.diagnosis, v.treatment, v.follow_up,
            v.referral_destination, v.referral_notes, v.personnel_id, v.practice_session_id,
            v.started_at, v.completed_at,
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
  await requirePoskestrenFeature(PATH)
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
  const session = await requirePoskestrenFeature(PATH)
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
  const session = await requirePoskestrenFeature(PATH, 'create')
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
  const session = await requirePoskestrenFeature(PATH, 'update')
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
  const session = await requirePoskestrenFeature(PATH, 'update')
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
  const session = await requirePoskestrenFeature(PATH, 'update')
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
  await requirePoskestrenFeature(PATH)
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

export async function completeVisit(input: {
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
  const session = await requirePoskestrenFeature(PATH, 'update')
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

  const cleanItems = (input.prescriptionItems || [])
    .filter(item => item.medicineId)
    .map(item => ({
      medicineId: item.medicineId,
      requested: parsePositiveInteger(item.requestedQuantityBase, 'Jumlah obat'),
      dosage: cleanText(item.dosage, 200),
      notes: cleanText(item.notes, 200),
    }))

  const uniqueMedicineIds = [...new Set(cleanItems.map(item => item.medicineId))]
  if (uniqueMedicineIds.length !== cleanItems.length) {
    return { success: false as const, error: 'Obat yang sama tidak boleh muncul dua kali.' }
  }

  const db = await getDB()
  const medicineRows = uniqueMedicineIds.length
    ? await query<{ id: string; name: string; total_stock_base: number }>(
        `SELECT id, name, total_stock_base
         FROM poskestren_medicine
         WHERE id IN (${uniqueMedicineIds.map(() => '?').join(',')}) AND is_active = 1`,
        uniqueMedicineIds
      )
    : []
  if (medicineRows.length !== uniqueMedicineIds.length) {
    return { success: false as const, error: 'Salah satu obat tidak ditemukan.' }
  }

  const statements: any[] = []
  const prescriptionId = cleanItems.length ? generateId() : null
  let hasShortage = false
  if (prescriptionId) {
    statements.push(db.prepare(
      `INSERT INTO poskestren_prescription(id, visit_id, status, created_by)
       VALUES (?, ?, 'DRAFT', ?)`
    ).bind(prescriptionId, visit.id, session.id))
  }

  for (const item of cleanItems) {
    const medicine = medicineRows.find(row => row.id === item.medicineId)!
    const dispensed = Math.min(item.requested, Number(medicine.total_stock_base))
    const prescriptionItemId = generateId()
    if (dispensed > 0) {
      const mutation = prepareStockMutationFromSnapshot(db, {
        medicineId: item.medicineId,
        medicineName: medicine.name,
        stockBefore: Number(medicine.total_stock_base),
        quantityDelta: -dispensed,
        movementType: 'PATIENT',
        movementDate: toWibDateInputValue(),
        referenceType: 'PRESCRIPTION_ITEM',
        referenceId: prescriptionItemId,
        actorId: session.id,
        notes: item.dosage,
      })
      statements.push(...mutation.statements)
    }
    if (dispensed < item.requested) hasShortage = true
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_prescription_item(
           id, prescription_id, medicine_id, dosage, requested_quantity_base,
           dispensed_quantity_base, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(prescriptionItemId, prescriptionId, item.medicineId, item.dosage, item.requested, dispensed, item.notes)
    )
  }

  if (prescriptionId) {
    statements.push(
      db.prepare(
        `UPDATE poskestren_prescription
         SET status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(hasShortage ? 'PARTIAL' : 'DISPENSED', prescriptionId)
    )
  }

  const finalStatus: PoskestrenVisitStatus = cleanText(input.referralDestination, 200) ? 'DIRUJUK' : 'SELESAI'
  const now = new Date().toISOString()
  statements.push(
    db.prepare(
      `UPDATE poskestren_visit
       SET status = ?, complaint = ?, diagnosis_id = ?, diagnosis = ?, treatment = ?, follow_up = ?,
           referral_destination = ?, referral_notes = ?, completed_at = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND status = 'DIPERIKSA'`
    ).bind(
      finalStatus,
      complaint,
      diagnosisRow?.id || null,
      diagnosisText,
      cleanText(input.treatment),
      cleanText(input.followUp),
      cleanText(input.referralDestination, 200),
      cleanText(input.referralNotes),
      now,
      now,
      session.id,
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

  await writeAudit(session, 'update', 'poskestren_visit', visit.id, `Menyelesaikan pemeriksaan ${visit.nama_lengkap}`, {
    status: finalStatus,
    prescription_items: cleanItems.length,
    partial_dispense: hasShortage,
  })
  refresh()
  revalidatePath(POSKESTREN_HREF.medicine)
  revalidatePath(POSKESTREN_HREF.reports)
  return { success: true as const, status: finalStatus, partial: hasShortage }
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
  const session = await requirePoskestrenFeature(PATH, 'update')
  const reason = cleanText(input.reason, 500)
  const diagnosis = cleanText(input.diagnosis)
  if (!reason || !diagnosis) return { success: false as const, error: 'Alasan revisi dan diagnosis wajib diisi.' }
  const before = await queryOne<any>(
    `SELECT id, status, complaint, diagnosis, treatment, follow_up,
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
    db.prepare(
      `INSERT INTO poskestren_visit_revision(
         id, visit_id, revision_no, before_json, reason, revised_by
       ) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(generateId(), input.visitId, revisionNo, JSON.stringify(before), reason, session.id),
    db.prepare(
      `UPDATE poskestren_visit
       SET status = ?, diagnosis = ?, treatment = ?, follow_up = ?,
           referral_destination = ?, referral_notes = ?, revision_no = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      finalStatus,
      diagnosis,
      cleanText(input.treatment),
      cleanText(input.followUp),
      cleanText(input.referralDestination, 200),
      cleanText(input.referralNotes),
      revisionNo,
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
  await requirePoskestrenFeature(PATH)
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
  const session = await requirePoskestrenFeature(PATH, 'create')
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
  const session = await requirePoskestrenFeature(PATH, 'create')
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
  await requirePoskestrenFeature(PATH)
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
  const session = await requirePoskestrenFeature(PATH, 'update')
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
  const session = await requirePoskestrenFeature(PATH, 'update')
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

