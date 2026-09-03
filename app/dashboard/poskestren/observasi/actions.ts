/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'
import { medicalEventDetail } from '@/lib/poskestren/medical-detail'
import { parseWibDateTime } from '@/lib/date/wib'
import { claim, normalizeClinical, type ClinicalInput } from '@/lib/poskestren/clinical'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { requirePoskestrenClinicalWrite } from '@/lib/poskestren/access'
import { cleanText, normalizePoskestrenListQuery } from '@/lib/poskestren/query'
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
  requestId?: string
  clinicalSnapshot?: ClinicalInput
  symptoms: string
  notes?: string
}) {
  const session = await requirePoskestrenClinicalWrite()
  const symptoms = cleanText(input.symptoms)
  const admittedAt = parseWibDateTime(input.admittedAt)
  if (!symptoms || Number.isNaN(admittedAt.getTime())) {
    return { success: false as const, error: 'Tanggal masuk dan gejala wajib diisi.' }
  }
  if(input.requestId) {
    const existing=await queryOne<{id:string}>('SELECT id FROM poskestren_observation WHERE id=?',[input.requestId])
    if(existing)return {success:true as const,id:existing.id}
  }
  const patientId = await ensurePatient(input.santriId, session.id)
  const active = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_observation WHERE patient_id = ? AND status = 'ACTIVE'`,
    [patientId]
  )
  if (active) return { success: false as const, error: 'Santri masih memiliki observasi aktif.' }
  const id = input.requestId || generateId()
  const db=await getDB()
  const clinical = input.clinicalSnapshot ? normalizeClinical(input.clinicalSnapshot) : null
  await db.batch([claim(db,'observe:'+id),
    db.prepare("INSERT INTO poskestren_observation(id,patient_id,admitted_at,symptoms,notes,status,created_by,clinical_snapshot) VALUES(?,?,?,?,?,'ACTIVE',?,?)")
    .bind(id,patientId,admittedAt.toISOString(),symptoms,cleanText(input.notes),session.id,clinical?JSON.stringify(clinical):null)])
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
  return { observation, medicines, medicalDetail: await medicalEventDetail('OBSERVASI',id) }
}

export async function addObservationMedicine(_input: {
  observationId: string
  administeredAt: string
  medicine: ClinicalMedicineDraftItem
}) {
  void _input
  await requirePoskestrenClinicalWrite()
  return {success:false as const,error:'Gunakan resep dokter dan Penyerahan Obat untuk pemberian obat Observasi.'}
}

export async function closeObservation(input: {
  observationId: string
  dischargedAt: string
  result: 'RECOVERED' | 'REFERRED'
  referralDestination?: string
}) {
  const session = await requirePoskestrenClinicalWrite()
  const dischargedAt = parseWibDateTime(input.dischargedAt)
  const referralDestination = cleanText(input.referralDestination, 200)
  if (Number.isNaN(dischargedAt.getTime())) return { success: false as const, error: 'Tanggal keluar tidak valid.' }
  if (!['RECOVERED','REFERRED'].includes(input.result)) return { success: false as const, error: 'Hasil observasi tidak valid.' }
  if (input.result === 'REFERRED' && !referralDestination) {
    return { success: false as const, error: 'Tujuan rujukan wajib diisi.' }
  }
  const current=await queryOne<{admitted_at:string}>('SELECT admitted_at FROM poskestren_observation WHERE id=?',[input.observationId])
  if(!current || dischargedAt.getTime()<new Date(current.admitted_at).getTime()) return {success:false as const,error:'Tanggal keluar tidak boleh sebelum tanggal masuk.'}
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

