'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import {
  getFinanceDB as getDB,
  generateId,
  financeQuery as financeQuery,
  financeQueryOne,
  query as mainQuery,
  queryOne as mainQueryOne,
} from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'

const PATH = '/dashboard/keuangan-terpusat/unit-kas'

async function audit(actorId: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  await (await getDB()).prepare(`INSERT INTO finance_audit_log
    (id,actor_type,actor_id,action,entity_type,entity_id,before_json,after_json)
    VALUES(?,'STAFF',?,?,?,?,?,?)`).bind(
    generateId(), actorId, action, entityType, entityId,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
  ).run()
}

function cleanUnitInput(input: { name: string; asramaScope?: string | null; fixedFloatRupiah: number }) {
  const name = String(input.name || '').trim()
  const asramaScope = String(input.asramaScope || '').trim() || null
  const fixedFloatRupiah = Number(input.fixedFloatRupiah)
  if (name.length < 3) return { error: 'Nama Unit Kas minimal 3 karakter.' } as const
  if (!Number.isSafeInteger(fixedFloatRupiah) || fixedFloatRupiah < 0) return { error: 'Saldo tetap harus berupa rupiah bulat dan tidak negatif.' } as const
  return { name, asramaScope, fixedFloatRupiah }
}

export async function createCashUnit(input: { name: string; asramaScope?: string | null; fixedFloatRupiah: number }) {
  const session = await requireFinanceAccess('CONFIGURE')
  const clean = cleanUnitInput(input)
  if ('error' in clean) return clean
  const duplicate = await financeQueryOne<{ id: string }>('SELECT id FROM finance_cash_units WHERE lower(name)=lower(?)', [clean.name])
  if (duplicate) return { error: 'Nama Unit Kas sudah digunakan.' }
  const id = generateId()
  await (await getDB()).prepare(`INSERT INTO finance_cash_units
    (id,name,asrama_scope,fixed_float_rupiah,created_at) VALUES(?,?,?,?,datetime('now'))`).bind(
    id, clean.name, clean.asramaScope, clean.fixedFloatRupiah,
  ).run()
  await audit(session.id, 'CREATE_CASH_UNIT', 'CASH_UNIT', id, null, clean)
  revalidatePath(PATH)
  revalidatePath('/dashboard/keuangan-terpusat/loket')
  return { success: true as const, id }
}

export async function updateCashUnit(input: { id: string; name: string; asramaScope?: string | null; fixedFloatRupiah: number }) {
  const session = await requireFinanceAccess('CONFIGURE')
  const clean = cleanUnitInput(input)
  if ('error' in clean) return clean
  const current = await financeQueryOne<any>('SELECT * FROM finance_cash_units WHERE id=?', [input.id])
  if (!current) return { error: 'Unit Kas tidak ditemukan.' }
  const duplicate = await financeQueryOne<{ id: string }>('SELECT id FROM finance_cash_units WHERE lower(name)=lower(?) AND id<>?', [clean.name, input.id])
  if (duplicate) return { error: 'Nama Unit Kas sudah digunakan.' }
  await (await getDB()).prepare(`UPDATE finance_cash_units
    SET name=?,asrama_scope=?,fixed_float_rupiah=? WHERE id=?`).bind(
    clean.name, clean.asramaScope, clean.fixedFloatRupiah, input.id,
  ).run()
  await audit(session.id, 'UPDATE_CASH_UNIT', 'CASH_UNIT', input.id, current, clean)
  revalidatePath(PATH)
  revalidatePath('/dashboard/keuangan-terpusat/loket')
  return { success: true as const }
}

export async function setCashUnitActive(id: string, active: boolean) {
  const session = await requireFinanceAccess('CONFIGURE')
  const current = await financeQueryOne<any>('SELECT * FROM finance_cash_units WHERE id=?', [id])
  if (!current) return { error: 'Unit Kas tidak ditemukan.' }
  if (!active) {
    const open = await financeQueryOne<{ id: string }>(`SELECT id FROM finance_cash_shifts WHERE cash_unit_id=? AND status='OPEN' LIMIT 1`, [id])
    if (open) return { error: 'Unit Kas tidak dapat dinonaktifkan selama masih memiliki shift terbuka.' }
  }
  await (await getDB()).prepare('UPDATE finance_cash_units SET is_active=? WHERE id=?').bind(active ? 1 : 0, id).run()
  await audit(session.id, active ? 'ACTIVATE_CASH_UNIT' : 'DEACTIVATE_CASH_UNIT', 'CASH_UNIT', id, current, { ...current, is_active: active ? 1 : 0 })
  revalidatePath(PATH)
  revalidatePath('/dashboard/keuangan-terpusat/loket')
  return { success: true as const }
}

export async function setCashUnitOperator(cashUnitId: string, operatorId: string, active: boolean) {
  const session = await requireFinanceAccess('CONFIGURE')
  const unit = await financeQueryOne<{ id: string; name: string }>('SELECT id,name FROM finance_cash_units WHERE id=?', [cashUnitId])
  if (!unit) return { error: 'Unit Kas tidak ditemukan.' }
  const operator = await mainQueryOne<{ id: string; full_name: string | null; role: string; roles: string | null }>(
    `SELECT id,full_name,role,roles FROM users WHERE id=?`, [operatorId])
  let roles: string[] = []
  try { roles = JSON.parse(operator?.roles || '[]') } catch { roles = [] }
  if (!operator || (operator.role !== 'operator_loket' && !roles.includes('operator_loket'))) {
    return { error: 'Pengguna belum memiliki role Operator Loket.' }
  }
  if (!active) {
    const open = await financeQueryOne<{ id: string }>(`SELECT id FROM finance_cash_shifts
      WHERE cash_unit_id=? AND operator_id=? AND status='OPEN' LIMIT 1`, [cashUnitId, operatorId])
    if (open) return { error: 'Penugasan tidak dapat dicabut saat operator masih memiliki shift terbuka pada unit ini.' }
  }
  await (await getDB()).prepare(`INSERT INTO finance_cash_unit_operators
      (cash_unit_id,operator_id,assigned_by,is_active,assigned_at,updated_at)
      VALUES(?,?,?,?,datetime('now'),datetime('now'))
      ON CONFLICT(cash_unit_id,operator_id) DO UPDATE SET
        is_active=excluded.is_active,assigned_by=excluded.assigned_by,updated_at=datetime('now')`).bind(
    cashUnitId, operatorId, session.id, active ? 1 : 0,
  ).run()
  await audit(session.id, active ? 'ASSIGN_CASH_OPERATOR' : 'UNASSIGN_CASH_OPERATOR', 'CASH_UNIT_OPERATOR', `${cashUnitId}:${operatorId}`, null, {
    cashUnitId, operatorId, active, operatorName: operator.full_name,
  })
  revalidatePath(PATH)
  revalidatePath('/dashboard/keuangan-terpusat/loket')
  return { success: true as const }
}

export async function reviewCashDiscrepancy(shiftId: string, note: string) {
  const session = await requireFinanceAccess('CONFIGURE')
  const cleanNote = String(note || '').trim()
  if (cleanNote.length < 5) return { error: 'Catatan review minimal 5 karakter.' }
  const shift = await financeQueryOne<any>(`SELECT * FROM finance_cash_shifts
    WHERE id=? AND status='CLOSED_REVIEW' AND supervisor_id IS NULL`, [shiftId])
  if (!shift) return { error: 'Shift tidak ditemukan atau sudah direview.' }
  await (await getDB()).prepare(`UPDATE finance_cash_shifts
    SET supervisor_id=?,supervisor_note=?,supervisor_reviewed_at=datetime('now')
    WHERE id=? AND status='CLOSED_REVIEW' AND supervisor_id IS NULL`).bind(session.id, cleanNote, shiftId).run()
  await audit(session.id, 'REVIEW_CASH_DISCREPANCY', 'CASH_SHIFT', shiftId, shift, { ...shift, supervisor_id: session.id, supervisor_note: cleanNote })
  revalidatePath(PATH)
  return { success: true as const }
}

export async function getCashUnitManagementData() {
  await requireFinanceAccess('CONFIGURE')
  const operators = await mainQuery<{ id: string; full_name: string | null; email: string; asrama_binaan: string | null }>(`SELECT
      id,full_name,email,asrama_binaan FROM users
    WHERE role='operator_loket' OR roles LIKE '%"operator_loket"%'
    ORDER BY full_name,email`)
  const units = await financeQuery<any>(`SELECT cu.*,
      (SELECT COUNT(*) FROM finance_cash_unit_operators a WHERE a.cash_unit_id=cu.id AND a.is_active=1) operator_count,
      (SELECT COUNT(*) FROM finance_cash_shifts sh WHERE sh.cash_unit_id=cu.id AND sh.status='OPEN') open_shift_count
    FROM finance_cash_units cu ORDER BY cu.is_active DESC,cu.name`)
  const assignments = await financeQuery<any>(`SELECT cash_unit_id,operator_id,is_active
    FROM finance_cash_unit_operators WHERE is_active=1`)
  const shifts = await financeQuery<any>(`SELECT sh.*,cu.name unit_name,
      COALESCE((SELECT SUM(w.amount_rupiah) FROM finance_withdrawals w WHERE w.shift_id=sh.id AND w.status='SUCCESS'),0) paid_rupiah
    FROM finance_cash_shifts sh JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id
    ORDER BY CASE sh.status WHEN 'OPEN' THEN 0 WHEN 'CLOSED_REVIEW' THEN 1 ELSE 2 END,sh.opened_at DESC LIMIT 60`)
  const names = new Map(operators.map(row => [row.id, row.full_name || row.email]))
  return {
    operators,
    units,
    assignments,
    shifts: shifts.map(row => ({ ...row, operator_name: names.get(row.operator_id) || row.operator_id })),
  }
}
