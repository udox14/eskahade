'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, query, queryOne } from '@/lib/db'
import { financeAsramaScope, financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import { closeIncidentMode, openIncidentMode, recordIncidentTopup } from '@/lib/finance/incidents'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'
import { runBulk } from '@/lib/finance/bulk'

const PATH = '/dashboard/keuangan-terpusat/insiden'

export async function openIncidentAction(form: FormData) {
  const session = await requireFinanceAccess('CHECK')
  const openedBy = String(form.get('openedBy') || '')
  const proposer = await queryOne<{ id: string; role: string; roles: string | null }>(`SELECT id,role,roles FROM users WHERE id=?`, [openedBy])
  let extraRoles: string[] = []
  try { extraRoles = JSON.parse(proposer?.roles || '[]') } catch { extraRoles = [] }
  if (!proposer || (proposer.role !== 'bendahara' && !extraRoles.includes('bendahara'))) {
    return { success: false as const, error: 'Pembuka incident harus pengguna dengan role Bendahara.' }
  }
  const channels = form.getAll('channels').map(String).filter(channel => ['CASH', 'EMERGENCY_TRANSFER'].includes(channel)) as Array<'CASH' | 'EMERGENCY_TRANSFER'>
  const result = await openIncidentMode({
    reason: String(form.get('reason') || ''),
    channels,
    startsAt: String(form.get('startsAt') || ''),
    endsAt: String(form.get('endsAt') || ''),
    openedBy,
    approvedBy: session.id,
  })
  if (result.success) revalidatePath(PATH)
  return result
}

export async function recordIncidentTopupAction(form: FormData) {
  const session = await requireFinanceAccess('CREATE')
  const nis = String(form.get('nis') || '').trim()
  const student = await queryOne<{ id: string; asrama: string | null }>(`SELECT id,asrama FROM santri WHERE nis=? AND status_global='aktif'`, [nis])
  if (!student) return { success: false as const, error: 'Santri aktif tidak ditemukan.' }
  const scope = financeAsramaScope(session)
  if (scope && student.asrama !== scope) return { success: false as const, error: 'Santri berada di luar scope asrama Anda.' }
  await syncFinanceStudentSnapshot(student.id)
  const reference = String(form.get('receiptReference') || '').trim()
  if (reference.length < 3) return { success: false as const, error: 'Referensi penerimaan minimal 3 karakter.' }
  const channel = String(form.get('channel')) as 'CASH' | 'EMERGENCY_TRANSFER'
  const result = await recordIncidentTopup({
    idempotencyKey: `${String(form.get('incidentId'))}:${reference.toLowerCase()}`,
    incidentId: String(form.get('incidentId')),
    santriId: student.id,
    channel,
    amountRupiah: Number(form.get('amountRupiah')),
    receivedBy: session.id,
    shiftId: channel === 'CASH' ? String(form.get('shiftId') || '') || null : null,
    bankReference: channel === 'EMERGENCY_TRANSFER' ? String(form.get('bankReference') || '') || null : null,
    asramaScope: student.asrama,
  })
  if (result.success) {
    revalidatePath(PATH)
    revalidatePath('/dashboard/keuangan-terpusat')
  }
  return result
}

/**
 * Impor massal penerimaan darurat. Saat gateway mati justru volumenya melonjak,
 * jadi jalur ini yang paling dibutuhkan — tetapi pengamannya tidak dilonggarkan:
 * incident harus aktif, channel harus yang disetujui, referensi tetap unik per
 * penerimaan, dan santri di luar scope asrama tetap ditolak.
 */
export type IncidentTopupImportRow = {
  row: number; incidentId: string; nis: string; amountRupiah: number
  channel: 'CASH' | 'EMERGENCY_TRANSFER'; receiptReference: string; shiftId: string | null; bankReference: string | null
}

export async function importIncidentTopupsAction(rows: IncidentTopupImportRow[]) {
  const session = await requireFinanceAccess('CREATE')
  const scope = financeAsramaScope(session)
  const list = [...new Set(rows.map(item => item.nis).filter(Boolean))]
  const students = list.length
    ? await query<{ id: string; nis: string; asrama: string | null }>(`SELECT id,nis,asrama FROM santri WHERE status_global='aktif' AND nis IN (${list.map(() => '?').join(',')})`, list)
    : []
  const byNis = new Map(students.map(student => [student.nis, student]))
  for (const student of students) await syncFinanceStudentSnapshot(student.id)

  const summary = await runBulk(rows, async item => {
    const student = byNis.get(item.nis)
    if (!student) return { success: false, error: `NIS ${item.nis} bukan santri aktif.` }
    if (scope && student.asrama !== scope) return { success: false, error: `Santri ${item.nis} berada di luar scope asrama Anda.` }
    if (item.receiptReference.trim().length < 3) return { success: false, error: 'Referensi penerimaan minimal 3 karakter.' }
    return recordIncidentTopup({
      idempotencyKey: `${item.incidentId}:${item.receiptReference.trim().toLowerCase()}`,
      incidentId: item.incidentId,
      santriId: student.id,
      channel: item.channel,
      amountRupiah: item.amountRupiah,
      receivedBy: session.id,
      shiftId: item.channel === 'CASH' ? item.shiftId : null,
      bankReference: item.channel === 'EMERGENCY_TRANSFER' ? item.bankReference : null,
      asramaScope: student.asrama,
    })
  })
  if (summary.success && summary.created) {
    revalidatePath(PATH)
    revalidatePath('/dashboard/keuangan-terpusat')
  }
  return summary
}

export async function closeIncidentAction(form: FormData) {
  const session = await requireFinanceAccess('EXECUTE')
  const result = await closeIncidentMode({
    incidentId: String(form.get('incidentId')),
    actorId: session.id,
    reason: String(form.get('reason') || ''),
  })
  if (result.success) revalidatePath(PATH)
  return result
}

export async function getIncidentData() {
  const session = await requireFinanceAccess('VIEW')
  const capabilities = await financeCapabilities(session)
  const scope = financeAsramaScope(session)
  const incidents = await financeQuery<any>(`SELECT m.*,
    (SELECT COUNT(*) FROM finance_incident_receipts r WHERE r.incident_id=m.id) receipt_count,
    (SELECT COALESCE(SUM(r.amount_rupiah),0) FROM finance_incident_receipts r WHERE r.incident_id=m.id) received_rupiah
    FROM finance_incident_modes m ORDER BY m.created_at DESC LIMIT 50`)
  const receipts = await financeQuery<any>(`SELECT r.*,s.nis,s.full_name student_name,s.asrama,cu.name cash_unit_name
    FROM finance_incident_receipts r
    LEFT JOIN finance_student_snapshots s ON s.santri_id=r.santri_id
    LEFT JOIN finance_cash_shifts sh ON sh.id=r.shift_id
    LEFT JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id
    WHERE 1=1 ${scope ? 'AND s.asrama=?' : ''}
    ORDER BY r.created_at DESC LIMIT 150`, scope ? [scope] : [])
  const openShifts = await financeQuery<any>(`SELECT sh.id,sh.operator_id,sh.terminal_id,sh.opened_at,cu.name unit_name,cu.asrama_scope
    FROM finance_cash_shifts sh JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id
    WHERE sh.status='OPEN' ${scope ? 'AND cu.asrama_scope=?' : ''}
    ORDER BY sh.opened_at DESC`, scope ? [scope] : [])
  const proposers = await query<any>(`SELECT id,full_name,email FROM users WHERE role='bendahara' OR roles LIKE '%"bendahara"%' ORDER BY full_name,email`)
  const users = await query<any>(`SELECT id,full_name,email FROM users`)
  const names = new Map(users.map(row => [row.id, row.full_name || row.email]))
  return {
    incidents: incidents.map(row => ({ ...row, opened_by_name: names.get(row.opened_by) || row.opened_by, approved_by_name: names.get(row.approved_by) || row.approved_by })),
    receipts: receipts.map(row => ({ ...row, received_by_name: names.get(row.received_by) || row.received_by })),
    openShifts: openShifts.map(row => ({ ...row, operator_name: names.get(row.operator_id) || row.operator_id })),
    proposers,
    scope,
    // Cocokkan dengan izin yang benar-benar dipakai action terkait:
    // openIncidentAction=CHECK, recordIncidentTopupAction=CREATE, closeIncidentAction=EXECUTE.
    canApprove: capabilities.check,
    canCreate: capabilities.create,
    canClose: capabilities.execute,
    nowMs: Date.now(),
  }
}
