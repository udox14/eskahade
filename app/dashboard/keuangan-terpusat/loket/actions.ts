'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne, queryOne as mainQueryOne } from '@/lib/db'
import { canConfigureCashUnits, requireCashierOperator } from '@/lib/finance/access'
import { resolveCredential } from '@/lib/finance/credentials'
import { withdrawPocketMoney } from '@/lib/finance/withdrawal'
import type { CredentialKind } from '@/lib/finance/types'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'

const PATH = '/dashboard/keuangan-terpusat/loket'

async function audit(actorId: string, action: string, entityType: string, entityId: string, after: unknown) {
  await (await getDB()).prepare(`INSERT INTO finance_audit_log
    (id,actor_type,actor_id,action,entity_type,entity_id,after_json)
    VALUES(?,'STAFF',?,?,?,?,?)`).bind(
    generateId(), actorId, action, entityType, entityId, JSON.stringify(after),
  ).run()
}

async function activeShiftForOperator(shiftId: string, operatorId: string) {
  return queryOne<{
    id: string; cash_unit_id: string; terminal_id: string; opening_cash_rupiah: number
    opened_at: string; unit_name: string; asrama_scope: string | null
  }>(`SELECT sh.id,sh.cash_unit_id,sh.terminal_id,sh.opening_cash_rupiah,sh.opened_at,
      cu.name unit_name,cu.asrama_scope
    FROM finance_cash_shifts sh
    JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id AND cu.is_active=1
    JOIN finance_cash_unit_operators a ON a.cash_unit_id=sh.cash_unit_id
      AND a.operator_id=sh.operator_id AND a.is_active=1
    WHERE sh.id=? AND sh.operator_id=? AND sh.status='OPEN'`, [shiftId, operatorId])
}

export async function identifyStudent(shiftId: string, kind: CredentialKind, rawToken: string) {
  const session = await requireCashierOperator()
  const shift = await activeShiftForOperator(String(shiftId || ''), session.id)
  if (!shift) return { error: 'Shift aktif atau penugasan Unit Kas tidak ditemukan.' }

  const credential = await resolveCredential(kind, String(rawToken || '').trim())
  if (!credential) return { error: 'Kartu/QR tidak aktif atau tidak sesuai mode.' }
  const master = await mainQueryOne<{
    id: string; nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null; foto_url: string | null
  }>(`SELECT id,nis,nama_lengkap,asrama,kamar,foto_url
    FROM santri WHERE id=? AND status_global='aktif' ${shift.asrama_scope ? 'AND asrama=?' : ''}`,
    shift.asrama_scope ? [credential.santri_id, shift.asrama_scope] : [credential.santri_id])
  if (master) await syncFinanceStudentSnapshot(master.id)
  if (!master) return { error: shift.asrama_scope ? `Santri tidak termasuk scope ${shift.asrama_scope}.` : 'Santri tidak ditemukan dalam scope loket.' }

  const wallet = await queryOne<{ balance_rupiah: number }>(
    `SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='JAJAN'`, [master.id])
  const limits = await queryOne<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(
    `SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`, [master.id])
  const spent = await queryOne<{ daily: number; weekly: number; monthly: number }>(`SELECT
      COALESCE(SUM(CASE WHEN date(created_at,'+7 hours')=date('now','+7 hours') THEN amount_rupiah ELSE 0 END),0) daily,
      COALESCE(SUM(CASE WHEN strftime('%Y-%W',created_at,'+7 hours')=strftime('%Y-%W','now','+7 hours') THEN amount_rupiah ELSE 0 END),0) weekly,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours') THEN amount_rupiah ELSE 0 END),0) monthly
    FROM finance_withdrawals WHERE santri_id=? AND status='SUCCESS'`, [master.id])

  const limitSummary = {
    daily: { limit: limits?.daily_rupiah ?? null, spent: Number(spent?.daily || 0) },
    weekly: { limit: limits?.weekly_rupiah ?? null, spent: Number(spent?.weekly || 0) },
    monthly: { limit: limits?.monthly_rupiah ?? null, spent: Number(spent?.monthly || 0) },
  }
  return {
    success: true as const,
    student: { ...master, balance_rupiah: Number(wallet?.balance_rupiah || 0) },
    limits: limitSummary,
  }
}

export async function submitWithdrawal(input: {
  requestKey: string; credentialKind: CredentialKind; rawToken: string; pin: string; amountRupiah: number
  cashUnitId: string; shiftId: string; terminalId: string; identityConfirmed: boolean
}) {
  const session = await requireCashierOperator()
  const shift = await activeShiftForOperator(String(input.shiftId || ''), session.id)
  if (!shift || shift.cash_unit_id !== input.cashUnitId || shift.terminal_id !== input.terminalId) {
    return { error: 'Shift, terminal, atau Unit Kas tidak sesuai dengan operator.' }
  }
  const result = await withdrawPocketMoney({
    ...input,
    cashUnitId: shift.cash_unit_id,
    terminalId: shift.terminal_id,
    idempotencyKey: input.requestKey,
    operatorId: session.id,
  })
  if (result.success) {
    await audit(session.id, 'CREATE_WITHDRAWAL', 'WITHDRAWAL', result.withdrawalId, {
      shiftId: shift.id, cashUnitId: shift.cash_unit_id, amountRupiah: input.amountRupiah,
    })
    revalidatePath(PATH)
  }
  return result
}

export async function openCashShift(input: { cashUnitId: string; openingCashRupiah: number; terminalId: string }) {
  const session = await requireCashierOperator()
  const openingCash = Number(input.openingCashRupiah)
  const terminalId = String(input.terminalId || '').trim()
  if (!Number.isSafeInteger(openingCash) || openingCash < 0) return { error: 'Kas fisik awal harus berupa rupiah bulat dan tidak negatif.' }
  if (!terminalId) return { error: 'Identitas terminal tidak valid.' }
  const assignment = await queryOne<{ id: string }>(`SELECT cu.id FROM finance_cash_units cu
    JOIN finance_cash_unit_operators a ON a.cash_unit_id=cu.id
    WHERE cu.id=? AND cu.is_active=1 AND a.operator_id=? AND a.is_active=1`, [input.cashUnitId, session.id])
  if (!assignment) return { error: 'Anda tidak ditugaskan pada Unit Kas tersebut.' }

  const id = generateId()
  try {
    await (await getDB()).prepare(`INSERT INTO finance_cash_shifts
      (id,cash_unit_id,operator_id,terminal_id,opening_cash_rupiah) VALUES(?,?,?,?,?)`).bind(
      id, input.cashUnitId, session.id, terminalId, openingCash,
    ).run()
    await audit(session.id, 'OPEN_CASH_SHIFT', 'CASH_SHIFT', id, { cashUnitId: input.cashUnitId, openingCashRupiah: openingCash, terminalId })
    revalidatePath(PATH)
    return { success: true as const, id }
  } catch {
    return { error: 'Operator masih memiliki shift terbuka atau data shift tidak valid.' }
  }
}

export async function closeCashShift(input: { shiftId: string; actualClosingRupiah: number; note?: string }) {
  const session = await requireCashierOperator()
  const shift = await activeShiftForOperator(String(input.shiftId || ''), session.id)
  if (!shift) return { error: 'Shift terbuka tidak ditemukan.' }
  const actual = Number(input.actualClosingRupiah)
  if (!Number.isSafeInteger(actual) || actual < 0) return { error: 'Kas fisik akhir harus berupa rupiah bulat dan tidak negatif.' }
  const total = await queryOne<{ paid: number }>(`SELECT COALESCE(SUM(amount_rupiah),0) paid
    FROM finance_withdrawals WHERE shift_id=? AND status='SUCCESS'`, [shift.id])
  const paid = Number(total?.paid || 0)
  const expected = Number(shift.opening_cash_rupiah) - paid
  const discrepancy = actual - expected
  const note = String(input.note || '').trim()
  if (discrepancy !== 0 && note.length < 5) return { error: 'Catatan minimal 5 karakter wajib diisi jika terdapat selisih kas.' }
  const status = discrepancy === 0 ? 'CLOSED_OK' : 'CLOSED_REVIEW'
  await (await getDB()).prepare(`UPDATE finance_cash_shifts
    SET expected_closing_rupiah=?,actual_closing_rupiah=?,discrepancy_rupiah=?,
      operator_closing_note=?,status=?,closed_at=datetime('now')
    WHERE id=? AND operator_id=? AND status='OPEN'`).bind(
    expected, actual, discrepancy, note || null, status, shift.id, session.id,
  ).run()
  await audit(session.id, 'CLOSE_CASH_SHIFT', 'CASH_SHIFT', shift.id, { expected, actual, discrepancy, status, note: note || null })
  revalidatePath(PATH)
  revalidatePath('/dashboard/keuangan-terpusat/unit-kas')
  return { success: true as const, expected, discrepancy, status }
}

export async function getCashierBootstrap() {
  const session = await requireCashierOperator()
  const units = await query<{ id: string; name: string; asrama_scope: string | null; fixed_float_rupiah: number }>(`SELECT
      cu.id,cu.name,cu.asrama_scope,cu.fixed_float_rupiah
    FROM finance_cash_units cu
    JOIN finance_cash_unit_operators a ON a.cash_unit_id=cu.id
    WHERE cu.is_active=1 AND a.operator_id=? AND a.is_active=1
    ORDER BY cu.name`, [session.id])
  const shift = await queryOne<{
    id: string; cash_unit_id: string; terminal_id: string; opening_cash_rupiah: number
    opened_at: string; unit_name: string; asrama_scope: string | null; paid_rupiah: number
  }>(`SELECT sh.id,sh.cash_unit_id,sh.terminal_id,sh.opening_cash_rupiah,sh.opened_at,
      cu.name unit_name,cu.asrama_scope,
      COALESCE((SELECT SUM(w.amount_rupiah) FROM finance_withdrawals w WHERE w.shift_id=sh.id AND w.status='SUCCESS'),0) paid_rupiah
    FROM finance_cash_shifts sh
    JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id
    WHERE sh.operator_id=? AND sh.status='OPEN' LIMIT 1`, [session.id])
  const history = shift ? await query<any>(`SELECT w.id,w.amount_rupiah,w.created_at,w.credential_kind,
      s.full_name nama_lengkap,s.nis
    FROM finance_withdrawals w
    JOIN finance_student_snapshots s ON s.santri_id=w.santri_id
    WHERE w.shift_id=? ORDER BY w.created_at DESC LIMIT 20`, [shift.id]) : []
  return {
    units,
    shift: shift ? { ...shift, expected_cash_rupiah: Number(shift.opening_cash_rupiah) - Number(shift.paid_rupiah) } : null,
    history,
    operator: { id: session.id, name: session.full_name },
    capabilities: { canConfigure: canConfigureCashUnits(session) },
  }
}
