'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne, queryOne as mainQueryOne } from '@/lib/db'
import { financeAsramaScope, requireFinanceAccess } from '@/lib/finance/access'
import { resolveCredential } from '@/lib/finance/credentials'
import { withdrawPocketMoney } from '@/lib/finance/withdrawal'
import type { CredentialKind } from '@/lib/finance/types'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'

const PATH = '/dashboard/keuangan-terpusat/loket'

export async function identifyStudent(kind: CredentialKind, rawToken: string) {
  const session = await requireFinanceAccess('CREATE')
  const credential = await resolveCredential(kind, String(rawToken || '').trim())
  if (!credential) return { error: 'Kartu/QR tidak aktif atau tidak sesuai mode.' }
  const scope = financeAsramaScope(session)
  const master = await mainQueryOne<{ id: string; nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null; foto_url: string | null }>(`SELECT id,nis,nama_lengkap,asrama,kamar,foto_url
    FROM santri WHERE id=? AND status_global='aktif' ${scope ? 'AND asrama=?' : ''}`, scope ? [credential.santri_id, scope] : [credential.santri_id])
  if (master) await syncFinanceStudentSnapshot(master.id)
  const wallet = master ? await queryOne<{ balance_rupiah: number }>(`SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='JAJAN'`, [master.id]) : null
  const student = master ? { ...master, balance_rupiah: Number(wallet?.balance_rupiah || 0) } : null
  if (!student) return { error: 'Santri tidak ditemukan dalam scope loket.' }
  const limits = await queryOne<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(`SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`, [student.id])
  return { success: true as const, credentialId: credential.id, student, limits }
}

export async function submitWithdrawal(input: {
  requestKey: string; credentialKind: CredentialKind; rawToken: string; pin: string; amountRupiah: number
  cashUnitId: string; shiftId: string; terminalId: string; identityConfirmed: boolean
}) {
  const session = await requireFinanceAccess('CREATE')
  const result = await withdrawPocketMoney({ ...input, idempotencyKey: input.requestKey, operatorId: session.id })
  if (result.success) revalidatePath(PATH)
  return result
}

export async function createCashUnit(input: { name: string; asramaScope?: string | null; fixedFloatRupiah: number }) {
  const session = await requireFinanceAccess('CONFIGURE')
  const id = generateId()
  await (await getDB()).prepare(`INSERT INTO finance_cash_units(id,name,asrama_scope,fixed_float_rupiah,created_at) VALUES(?,?,?,?,datetime('now'))`).bind(
    id, String(input.name || '').trim(), input.asramaScope || null, Number(input.fixedFloatRupiah),
  ).run()
  await (await getDB()).prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CREATE_CASH_UNIT','CASH_UNIT',?,?)`).bind(
    generateId(), session.id, id, JSON.stringify(input),
  ).run()
  revalidatePath(PATH)
  return { success: true as const, id }
}

export async function openCashShift(input: { cashUnitId: string; openingCashRupiah: number; terminalId: string }) {
  const session = await requireFinanceAccess('CREATE')
  const id = generateId()
  try {
    await (await getDB()).prepare(`INSERT INTO finance_cash_shifts(id,cash_unit_id,operator_id,terminal_id,opening_cash_rupiah) VALUES(?,?,?,?,?)`).bind(
      id, input.cashUnitId, session.id, String(input.terminalId || '').trim(), Number(input.openingCashRupiah),
    ).run()
    revalidatePath(PATH)
    return { success: true as const, id }
  } catch { return { error: 'Operator masih memiliki shift terbuka atau data shift tidak valid.' } }
}

export async function closeCashShift(input: { shiftId: string; actualClosingRupiah: number }) {
  const session = await requireFinanceAccess('CREATE')
  const db = await getDB()
  const shift = await queryOne<{ opening_cash_rupiah: number; paid: number }>(`SELECT sh.opening_cash_rupiah,COALESCE(SUM(w.amount_rupiah),0) paid
    FROM finance_cash_shifts sh LEFT JOIN finance_withdrawals w ON w.shift_id=sh.id AND w.status='SUCCESS'
    WHERE sh.id=? AND sh.operator_id=? AND sh.status='OPEN' GROUP BY sh.id`, [input.shiftId, session.id])
  if (!shift) return { error: 'Shift terbuka tidak ditemukan.' }
  const expected = Number(shift.opening_cash_rupiah) - Number(shift.paid)
  const actual = Number(input.actualClosingRupiah)
  await db.prepare(`UPDATE finance_cash_shifts SET expected_closing_rupiah=?,actual_closing_rupiah=?,discrepancy_rupiah=?,status=?,closed_at=datetime('now')
    WHERE id=? AND operator_id=? AND status='OPEN'`).bind(expected, actual, actual - expected, actual === expected ? 'CLOSED_OK' : 'CLOSED_REVIEW', input.shiftId, session.id).run()
  revalidatePath(PATH)
  return { success: true as const, expected, discrepancy: actual - expected }
}

export async function getCashierBootstrap() {
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const units = await query<{ id: string; name: string; asrama_scope: string | null; fixed_float_rupiah: number }>(`SELECT id,name,asrama_scope,fixed_float_rupiah FROM finance_cash_units WHERE is_active=1 ${scope ? 'AND asrama_scope=?' : ''} ORDER BY name`, scope ? [scope] : [])
  const shift = await queryOne<{ id: string; cash_unit_id: string; terminal_id: string; opening_cash_rupiah: number; opened_at: string }>(`SELECT id,cash_unit_id,terminal_id,opening_cash_rupiah,opened_at FROM finance_cash_shifts WHERE operator_id=? AND status='OPEN' LIMIT 1`, [session.id])
  const history = await query<any>(`SELECT w.id,w.amount_rupiah,w.created_at,w.credential_kind,s.full_name nama_lengkap,s.nis FROM finance_withdrawals w JOIN finance_student_snapshots s ON s.santri_id=w.santri_id
    WHERE w.operator_id=? ORDER BY w.created_at DESC LIMIT 20`, [session.id])
  return { units, shift, history }
}
