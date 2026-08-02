/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { isSuperAccess } from '@/lib/auth/session'
import { requirePoskestrenClinicalWrite } from '@/lib/poskestren/access'
import { cleanText } from '@/lib/poskestren/query'
import { prepareStockMutationFromSnapshot } from '@/lib/poskestren/stock-snapshot'

const PATH = '/dashboard/poskestren/pemeriksaan'
const CLEANUP_SETTING = 'poskestren_sample_cleanup_done'

function refresh() {
  revalidatePath(PATH)
  revalidatePath('/dashboard/poskestren/obat')
  revalidatePath('/dashboard/poskestren/cetak')
}

export async function getVisitRevisionEditorData(visitId: string) {
  await requirePoskestrenClinicalWrite()
  const visit = await queryOne<any>(
    `SELECT v.id, v.queue_date, v.queue_number, v.status, v.practice_session_id,
            v.personnel_id, v.complaint, v.diagnosis_id, v.diagnosis,
            v.treatment, v.follow_up, v.referral_destination, v.referral_notes,
            v.revision_no, s.nama_lengkap, s.poskestren_code, s.nis,
            p.full_name AS doctor_name
     FROM poskestren_visit v
     JOIN poskestren_patient patient ON patient.id = v.patient_id
     JOIN santri s ON s.id = patient.santri_id
     LEFT JOIN poskestren_personnel p ON p.id = v.personnel_id
     WHERE v.id = ? AND v.status IN ('SELESAI','DIRUJUK')`,
    [visitId]
  )
  if (!visit) throw new Error('Pemeriksaan selesai tidak ditemukan.')
  const [sessions, diagnoses, medicines, prescriptionItems, revisions] = await Promise.all([
    query<any>(
      `SELECT ps.id, ps.personnel_id, ps.session_date, ps.status,
              ps.started_at, ps.ended_at, p.full_name, p.profession
       FROM poskestren_practice_session ps
       JOIN poskestren_personnel p ON p.id = ps.personnel_id
       WHERE ps.session_date = ?
       ORDER BY p.full_name COLLATE NOCASE, ps.started_at`,
      [visit.queue_date]
    ),
    query<{ id: string; name: string }>(
      `SELECT id, name FROM poskestren_diagnosis
       WHERE is_active = 1 OR id = ?
       ORDER BY name COLLATE NOCASE`,
      [visit.diagnosis_id || '']
    ),
    query<any>(
      `SELECT id, name, form, strength, total_stock_base
       FROM poskestren_medicine WHERE is_active = 1
       ORDER BY name COLLATE NOCASE`
    ),
    query<any>(
      `SELECT rxi.id, rxi.medicine_id, m.name AS medicine_name,
              rxi.requested_quantity_base, rxi.dispensed_quantity_base,
              rxi.dosage, rxi.notes
       FROM poskestren_prescription rx
       JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
       JOIN poskestren_medicine m ON m.id = rxi.medicine_id
       WHERE rx.visit_id = ?
       ORDER BY rxi.created_at, rxi.id`,
      [visit.id]
    ),
    query<any>(
      `SELECT vr.revision_no, vr.reason, vr.created_at, u.full_name AS revised_by_name
       FROM poskestren_visit_revision vr
       LEFT JOIN users u ON u.id = vr.revised_by
       WHERE vr.visit_id = ?
       ORDER BY vr.revision_no DESC`,
      [visit.id]
    ),
  ])
  return { visit, sessions, diagnoses, medicines, prescriptionItems, revisions }
}

export async function getSampleCleanupState() {
  const session = await requirePoskestrenClinicalWrite()
  if (!isSuperAccess(session)) return { isAdmin: false, locked: true }
  const setting = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [CLEANUP_SETTING]
  )
  return {
    isAdmin: true,
    locked: setting?.value === '1',
  }
}

export async function getSampleCleanupCandidates(q = '') {
  const session = await requirePoskestrenClinicalWrite()
  if (!isSuperAccess(session)) {
    return { isAdmin: false, locked: true, items: [] as any[] }
  }
  const setting = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [CLEANUP_SETTING]
  )
  const locked = setting?.value === '1'
  if (locked) return { isAdmin: true, locked: true, items: [] as any[] }
  const search = cleanText(q, 100)
  const params: unknown[] = []
  let filter = ''
  if (search) {
    const like = `%${search}%`
    filter = 'AND (s.nama_lengkap LIKE ? OR s.nis = ? OR s.poskestren_code = ? OR v.complaint LIKE ? OR v.diagnosis LIKE ?)'
    params.push(like, search, search.toUpperCase(), like, like)
  }
  const items = await query<any>(
    `SELECT v.id, v.queue_date, v.queue_number, v.status, v.complaint, v.diagnosis,
            v.completed_at, s.nama_lengkap, s.nis, s.poskestren_code,
            p.full_name AS doctor_name,
            COALESCE(SUM(rxi.dispensed_quantity_base), 0) AS dispensed_quantity
     FROM poskestren_visit v
     JOIN poskestren_patient patient ON patient.id = v.patient_id
     JOIN santri s ON s.id = patient.santri_id
     LEFT JOIN poskestren_personnel p ON p.id = v.personnel_id
     LEFT JOIN poskestren_prescription rx ON rx.visit_id = v.id
     LEFT JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
     WHERE v.source_type = 'MANUAL'
       AND v.status IN ('SELESAI','DIRUJUK','BATAL')
       ${filter}
     GROUP BY v.id
     ORDER BY v.queue_date DESC, v.queue_number DESC
     LIMIT 200`,
    params
  )
  return { isAdmin: true, locked: false, items }
}

export async function cleanupSampleVisits(input: { visitIds: string[]; reason: string }) {
  const session = await requirePoskestrenClinicalWrite()
  if (!isSuperAccess(session)) {
    return { success: false as const, error: 'Cleanup data sampel hanya tersedia untuk admin.' }
  }
  const reason = cleanText(input.reason, 500)
  const visitIds = [...new Set((input.visitIds || []).map(id => cleanText(id, 100)).filter((id): id is string => Boolean(id)))].slice(0, 100)
  if (!reason || visitIds.length === 0) {
    return { success: false as const, error: 'Pilih data sampel dan isi alasan cleanup.' }
  }
  const setting = await queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [CLEANUP_SETTING])
  if (setting?.value === '1') return { success: false as const, error: 'Cleanup data sampel sudah pernah dijalankan dan telah dikunci.' }
  const placeholders = visitIds.map(() => '?').join(',')
  const visits = await query<{ id: string; queue_date: string }>(
    `SELECT id, queue_date FROM poskestren_visit
     WHERE id IN (${placeholders}) AND source_type = 'MANUAL'
       AND status IN ('SELESAI','DIRUJUK','BATAL')`,
    visitIds
  )
  if (visits.length !== visitIds.length) {
    return { success: false as const, error: 'Ada data yang tidak valid atau bukan pendaftaran manual.' }
  }
  const prescriptionRows = await query<any>(
    `SELECT rx.id AS prescription_id, rxi.id AS prescription_item_id,
            rxi.medicine_id, m.name AS medicine_name,
            rxi.dispensed_quantity_base
     FROM poskestren_prescription rx
     JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
     JOIN poskestren_medicine m ON m.id = rxi.medicine_id
     WHERE rx.visit_id IN (${placeholders})`,
    visitIds
  )
  const grouped = new Map<string, { name: string; quantity: number }>()
  for (const row of prescriptionRows) {
    const current = grouped.get(row.medicine_id) || { name: row.medicine_name, quantity: 0 }
    current.quantity += Number(row.dispensed_quantity_base || 0)
    grouped.set(row.medicine_id, current)
  }
  const medicineIds = [...grouped.keys()]
  const stocks = medicineIds.length
    ? await query<{ id: string; total_stock_base: number }>(
      `SELECT id, total_stock_base FROM poskestren_medicine
       WHERE id IN (${medicineIds.map(() => '?').join(',')})`,
      medicineIds
    )
    : []
  const stockMap = new Map(stocks.map(row => [row.id, Number(row.total_stock_base)]))
  const cleanupId = generateId()
  const db = await getDB()
  const statements: D1PreparedStatement[] = []
  for (const [medicineId, item] of grouped) {
    if (item.quantity <= 0) continue
    const mutation = await prepareStockMutationFromSnapshot(db, {
      medicineId,
      medicineName: item.name,
      stockBefore: stockMap.get(medicineId) || 0,
      quantityDelta: item.quantity,
      movementType: 'REVERSAL',
      movementDate: new Date().toISOString().slice(0, 10),
      referenceType: 'SAMPLE_CLEANUP',
      referenceId: `${cleanupId}:${medicineId}`,
      actorId: session.id,
      notes: reason,
    })
    statements.push(...mutation.statements)
  }
  statements.push(
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'VISIT' AND entity_id IN (${placeholders})`).bind(...visitIds),
    db.prepare(`DELETE FROM poskestren_visit_revision WHERE visit_id IN (${placeholders})`).bind(...visitIds),
    db.prepare(`DELETE FROM poskestren_prescription WHERE visit_id IN (${placeholders})`).bind(...visitIds),
    db.prepare(`DELETE FROM poskestren_visit WHERE id IN (${placeholders})`).bind(...visitIds),
    db.prepare(
      `INSERT INTO app_settings(key, value, updated_at) VALUES (?, '1', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).bind(CLEANUP_SETTING)
  )
  await db.batch(statements)
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_pemeriksaan',
    action: 'delete',
    fiturHref: PATH,
    logKind: 'delete',
    entityType: 'poskestren_sample_cleanup',
    entityId: cleanupId,
    summary: `Cleanup satu kali ${visitIds.length} data sampel pemeriksaan`,
    details: { visit_ids: visitIds, reason, reversed_medicines: grouped.size },
  })
  refresh()
  return { success: true as const, deleted: visitIds.length }
}
