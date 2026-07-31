/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { requirePoskestrenClinicalWrite } from '@/lib/poskestren/access'
import { cleanText, normalizePoskestrenListQuery } from '@/lib/poskestren/query'
import { normalizeClinicalMedicines, prepareStockMutation } from '@/lib/poskestren/stock'
import type { ClinicalMedicineDraftItem, PoskestrenListQuery } from '@/lib/poskestren/types'

const PATH = '/dashboard/poskestren/observasi'

function refresh() {
  revalidatePath(PATH)
  revalidatePath('/dashboard/poskestren/pemeriksaan')
  revalidatePath('/dashboard/poskestren/obat')
}

async function ensurePatient(santriId: string, actorId: string) {
  const existing = await queryOne<{ id: string }>('SELECT id FROM poskestren_patient WHERE santri_id = ?', [santriId])
  if (existing) return existing.id
  const santri = await queryOne<{ id: string; nis: string; poskestren_code: string | null }>(
    `SELECT id, nis, poskestren_code FROM santri WHERE id = ? AND status_global = 'aktif'`,
    [santriId]
  )
  if (!santri) throw new Error('Santri aktif tidak ditemukan.')
  const id = generateId()
  await (await getDB()).prepare(
    `INSERT INTO poskestren_patient(id, santri_id, medical_record_no, created_by)
     VALUES (?, ?, ?, ?)`
  ).bind(id, santri.id, santri.poskestren_code || `RM-${santri.nis}`, actorId).run()
  return id
}

async function audit(session: any, action: string, entityType: string, entityId: string, summary: string, details?: any) {
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_observasi',
    action,
    fiturHref: PATH,
    logKind: action === 'create' ? 'create' : 'update',
    entityType,
    entityId,
    summary,
    details,
  })
}

export async function getObservations(input: PoskestrenListQuery = {}) {
  await requirePoskestrenClinicalWrite()
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.status) { where.push('o.status = ?'); params.push(normalized.status) }
  if (normalized.from) { where.push('SUBSTR(o.admitted_at,1,10) >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('SUBSTR(o.admitted_at,1,10) <= ?'); params.push(normalized.to) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(s.nis = ? OR s.poskestren_code = ? OR s.nama_lengkap LIKE ? OR s.asrama LIKE ? OR o.symptoms LIKE ?)')
    params.push(normalized.q, normalized.q.toUpperCase(), like, like, like)
  }
  const rows = await query<any>(
    `SELECT o.id, o.admitted_at, o.discharged_at, o.symptoms, o.notes, o.status,
            o.referral_destination, s.id AS santri_id, s.poskestren_code, s.nis,
            s.nama_lengkap, s.asrama, s.kamar, s.foto_url,
            COUNT(om.id) AS medicine_count,
            MAX(om.administered_at) AS last_medicine_at
     FROM poskestren_observation o
     JOIN poskestren_patient p ON p.id = o.patient_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN poskestren_observation_medicine om ON om.observation_id = o.id
     WHERE ${where.join(' AND ')}
     GROUP BY o.id
     ORDER BY CASE WHEN o.status = 'ACTIVE' THEN 0 ELSE 1 END,
              COALESCE(o.discharged_at,o.admitted_at) DESC, o.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  return { items: rows.slice(0, normalized.limit), hasMore: rows.length > normalized.limit }
}

export async function createObservation(input: {
  santriId: string
  admittedAt: string
  symptoms: string
  notes?: string
}) {
  const session = await requirePoskestrenClinicalWrite()
  const symptoms = cleanText(input.symptoms)
  const admittedAt = new Date(input.admittedAt)
  if (!symptoms || Number.isNaN(admittedAt.getTime())) {
    return { success: false as const, error: 'Tanggal masuk dan gejala wajib diisi.' }
  }
  const patientId = await ensurePatient(input.santriId, session.id)
  const active = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_observation WHERE patient_id = ? AND status = 'ACTIVE'`,
    [patientId]
  )
  if (active) return { success: false as const, error: 'Santri masih memiliki observasi aktif.' }
  const id = generateId()
  await (await getDB()).prepare(
    `INSERT INTO poskestren_observation(
       id, patient_id, admitted_at, symptoms, notes, status, created_by
     ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
  ).bind(id, patientId, admittedAt.toISOString(), symptoms, cleanText(input.notes), session.id).run()
  await audit(session, 'create', 'poskestren_observation', id, 'Membuka observasi pasien', { patient_id: patientId })
  refresh()
  return { success: true as const, id }
}

export async function getObservationDetail(id: string) {
  await requirePoskestrenClinicalWrite()
  const observation = await queryOne<any>(
    `SELECT o.*, s.poskestren_code, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            s.foto_url, p.allergies, p.special_conditions
     FROM poskestren_observation o
     JOIN poskestren_patient p ON p.id = o.patient_id
     JOIN santri s ON s.id = p.santri_id
     WHERE o.id = ?`,
    [id]
  )
  if (!observation) throw new Error('Observasi tidak ditemukan.')
  const medicines = await query<any>(
    `SELECT om.*, u.full_name AS created_by_name
     FROM poskestren_observation_medicine om
     LEFT JOIN users u ON u.id = om.created_by
     WHERE om.observation_id = ?
     ORDER BY om.administered_at DESC, om.id DESC`,
    [id]
  )
  return { observation, medicines }
}

export async function addObservationMedicine(input: {
  observationId: string
  administeredAt: string
  medicine: ClinicalMedicineDraftItem
}) {
  const session = await requirePoskestrenClinicalWrite()
  const observation = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM poskestren_observation WHERE id = ?`,
    [input.observationId]
  )
  if (!observation || observation.status !== 'ACTIVE') {
    return { success: false as const, error: 'Observasi sudah selesai atau tidak ditemukan.' }
  }
  const administeredAt = new Date(input.administeredAt)
  if (Number.isNaN(administeredAt.getTime())) return { success: false as const, error: 'Waktu pemberian obat tidak valid.' }
  const [medicine] = normalizeClinicalMedicines([input.medicine])
  const id = generateId()
  const db = await getDB()
  const statements: D1PreparedStatement[] = []
  let medicineName = medicine.medicineName
  if (medicine.sourceType === 'STOCK') {
    const mutation = await prepareStockMutation(db, {
      medicineId: medicine.medicineId!,
      quantityDelta: -Number(medicine.quantityBase),
      movementType: 'PATIENT',
      movementDate: administeredAt.toISOString().slice(0, 10),
      referenceType: 'OBSERVATION_MEDICINE',
      referenceId: id,
      actorId: session.id,
      notes: medicine.dosage,
    })
    medicineName = mutation.medicineName
    statements.push(...mutation.statements)
  }
  statements.push(
    db.prepare(
      `INSERT INTO poskestren_observation_medicine(
         id, observation_id, administered_at, source_type, medicine_id,
         medicine_name, quantity_base, dosage, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, observation.id, administeredAt.toISOString(), medicine.sourceType,
      medicine.medicineId || null, medicineName, medicine.quantityBase,
      medicine.dosage, medicine.notes, session.id
    )
  )
  await db.batch(statements)
  await audit(session, 'create', 'poskestren_observation_medicine', id, 'Mencatat pemberian obat observasi', {
    observation_id: observation.id,
    source_type: medicine.sourceType,
  })
  refresh()
  return { success: true as const, id }
}

export async function closeObservation(input: {
  observationId: string
  dischargedAt: string
  result: 'RECOVERED' | 'REFERRED'
  referralDestination?: string
}) {
  const session = await requirePoskestrenClinicalWrite()
  const dischargedAt = new Date(input.dischargedAt)
  const referralDestination = cleanText(input.referralDestination, 200)
  if (Number.isNaN(dischargedAt.getTime())) return { success: false as const, error: 'Tanggal keluar tidak valid.' }
  if (!['RECOVERED','REFERRED'].includes(input.result)) return { success: false as const, error: 'Hasil observasi tidak valid.' }
  if (input.result === 'REFERRED' && !referralDestination) {
    return { success: false as const, error: 'Tujuan rujukan wajib diisi.' }
  }
  const result = await (await getDB()).prepare(
    `UPDATE poskestren_observation
     SET status = ?, discharged_at = ?, referral_destination = ?,
         updated_by = ?, updated_at = datetime('now')
     WHERE id = ? AND status = 'ACTIVE'`
  ).bind(input.result, dischargedAt.toISOString(), referralDestination, session.id, input.observationId).run()
  if (!result.meta?.changes) return { success: false as const, error: 'Observasi sudah selesai atau tidak ditemukan.' }
  await audit(session, 'update', 'poskestren_observation', input.observationId, 'Menutup observasi pasien', {
    result: input.result,
    referral_destination: referralDestination,
  })
  refresh()
  return { success: true as const }
}

