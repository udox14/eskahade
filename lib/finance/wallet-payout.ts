// lib/finance/wallet-payout.ts
// Pencairan uang jajan kolektif: a representative takes cash for several santri.
//
// Money model (no double recording, no unpaid entitlement):
// - handover: per santri one ledger OUT WITHDRAWAL_KOLEKTIF from the operator's OPEN
//   cash session, one payout item DIBAWA, all in ONE batch (with idempotency key);
// - settlement: every item must end DITERIMA or DIBATALKAN. A cancelled item gets a
//   ledger IN WITHDRAWAL_KOLEKTIF_RETURN (cash back into the drawer) in the same batch.
// - a santri can be in only one live payout per WIB day; the cash session cannot close
//   while a batch is still DIBAWA (DB triggers from migration 0198).

import { batch, generateId, now, query, queryOne } from '@/lib/db'
import { walletMutationStatements } from './wallet-statements'
import { evaluateWalletLimit } from './wallet'
import { getActiveCashSession, recalculateCashSession } from './cash-session'
import { operationIdentity, operationReplay, operationStatement } from './operation'
import { rupiah } from './money'
import { isAsramaBebasTagihan } from './non-billable-santri'
import { financeNotices, kickNotificationDispatch } from '@/lib/notifications/runtime'
import { outboxIdsOf } from '@/lib/notifications/outbox'
import { payoutSettledNotices, payoutTakenNotices } from '@/lib/notifications/finance-events'

export const MAX_PAYOUT_ITEMS = 60

export function wibDate(date = new Date()): string {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

export interface PayoutCandidate {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  blok: string | null
  balance: number
  remaining_quota: number
  taken_today: number
  blocked_reason: string | null
}

export async function getPayoutCandidates(filter: { asrama: string; kamar?: string | null; blok?: string | null }): Promise<PayoutCandidate[]> {
  const asrama = filter.asrama.trim()
  if (!asrama) return []
  const params: unknown[] = [asrama]
  let extra = ''
  if (filter.kamar) { extra += ' AND s.kamar = ?'; params.push(filter.kamar) }
  if (filter.blok) { extra += ' AND kc.blok = ?'; params.push(filter.blok) }
  const today = wibDate()
  const rows = await query<
    Omit<PayoutCandidate, 'remaining_quota' | 'blocked_reason'> & {
      daily_used: number
      weekly_used: number
      monthly_used: number
      parent_daily: number | null
      parent_weekly: number | null
      parent_monthly: number | null
    }
  >(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, kc.blok,
            COALESCE((SELECT SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END) FROM finance_wallet_ledger WHERE santri_id = s.id), 0) AS balance,
            COALESCE((SELECT SUM(CASE WHEN movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN' THEN -amount ELSE amount END) FROM finance_wallet_ledger
              WHERE santri_id = s.id AND movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF','WITHDRAWAL_KOLEKTIF_RETURN')
                AND date(created_at, '+7 hours') = ?), 0) AS daily_used,
            COALESCE((SELECT SUM(CASE WHEN movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN' THEN -amount ELSE amount END) FROM finance_wallet_ledger
              WHERE santri_id = s.id AND movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF','WITHDRAWAL_KOLEKTIF_RETURN')
                AND strftime('%Y-%W', created_at, '+7 hours') = strftime('%Y-%W', 'now', '+7 hours')), 0) AS weekly_used,
            COALESCE((SELECT SUM(CASE WHEN movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN' THEN -amount ELSE amount END) FROM finance_wallet_ledger
              WHERE santri_id = s.id AND movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF','WITHDRAWAL_KOLEKTIF_RETURN')
                AND strftime('%Y-%m', created_at, '+7 hours') = strftime('%Y-%m', 'now', '+7 hours')), 0) AS monthly_used,
            (SELECT parent_daily_limit FROM finance_wallet_limits WHERE santri_id = s.id) AS parent_daily,
            (SELECT parent_weekly_limit FROM finance_wallet_limits WHERE santri_id = s.id) AS parent_weekly,
            (SELECT parent_monthly_limit FROM finance_wallet_limits WHERE santri_id = s.id) AS parent_monthly,
            COALESCE((SELECT SUM(i.amount) FROM finance_wallet_payout_items i WHERE i.santri_id = s.id AND i.payout_date = ?
              AND i.status IN ('DIBAWA','DITERIMA')), 0) AS taken_today
     FROM santri s
     LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = s.kamar
     WHERE s.status_global = 'aktif' AND s.asrama = ?${extra}
     ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
     LIMIT 400`,
    [today, today, ...params]
  )
  const global = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'uang_jajan_global_daily_limit'`)
  const globalLimit = global && /^\d+$/.test(global.value) ? Number(global.value) : 100000
  return rows.map(row => {
    const daily = row.parent_daily === null ? globalLimit : Math.min(globalLimit, row.parent_daily)
    const dailyRem = Math.max(0, daily - row.daily_used)
    const weeklyRem = row.parent_weekly === null ? Number.MAX_SAFE_INTEGER : Math.max(0, row.parent_weekly - row.weekly_used)
    const monthlyRem = row.parent_monthly === null ? Number.MAX_SAFE_INTEGER : Math.max(0, row.parent_monthly - row.monthly_used)
    const remaining = Math.min(dailyRem, weeklyRem, monthlyRem)
    let blocked: string | null = null
    if (isAsramaBebasTagihan(row.asrama)) blocked = 'Asrama tanpa layanan keuangan'
    else if (row.taken_today > 0) blocked = 'Sudah dicairkan hari ini'
    else if (row.balance <= 0) blocked = 'Saldo kosong'
    else if (dailyRem <= 0) blocked = 'Limit harian habis'
    else if (weeklyRem <= 0) blocked = 'Limit mingguan habis'
    else if (monthlyRem <= 0) blocked = 'Limit bulanan habis'
    return { id: row.id, nis: row.nis, nama_lengkap: row.nama_lengkap, asrama: row.asrama, kamar: row.kamar, blok: row.blok,
      balance: row.balance, remaining_quota: remaining, taken_today: row.taken_today, blocked_reason: blocked }
  })
}

export interface CreatePayoutInput {
  idempotencyKey: string
  asrama: string
  scopeLabel?: string | null
  representativeSantriId?: string | null
  representativeName: string
  notes?: string | null
  items: Array<{ santriId: string; amount: number }>
}

export interface PayoutBatchResult {
  batchId: string
  batchNumber: string
  totalAmount: number
  itemCount: number
}

function generateBatchNumber(): string {
  const date = wibDate().replace(/-/g, '')
  return `PJK-${date}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

function friendly(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('DAILY_LIMIT_EXCEEDED')) throw new Error('Ada santri yang melebihi limit harian. Muat ulang daftar lalu sesuaikan nominal.')
  if (message.includes('WEEKLY_LIMIT_EXCEEDED') || message.includes('MONTHLY_LIMIT_EXCEEDED')) throw new Error('Ada santri yang melebihi limit mingguan/bulanan dari wali.')
  if (message.includes('OVERDRAW') || message.includes('STALE_BALANCE')) throw new Error('Saldo salah satu santri berubah. Muat ulang daftar.')
  if (message.includes('uq_finance_payout_items_santri_day') || message.includes('finance_wallet_payout_items.santri_id')) throw new Error('Ada santri yang sudah masuk pencairan lain hari ini.')
  if (message.includes('CASH_SESSION_NOT_OPEN')) throw new Error('Sesi kas Anda belum dibuka atau sudah ditutup.')
  if (message.includes('STUDENT_NOT_BILLABLE')) throw new Error('Ada santri yang tidak aktif atau tidak memiliki layanan keuangan.')
  if (message.includes('PAYOUT_GUARD_ABORT') || message.includes('PAYOUT_ITEM_FINAL') || message.includes('PAYOUT_BATCH_FINAL')) {
    throw new Error('Pencairan ini sudah diproses atau datanya berubah. Muat ulang halaman.')
  }
  throw error instanceof Error ? error : new Error(message)
}

export async function createPayoutBatch(operatorId: string, input: CreatePayoutInput): Promise<PayoutBatchResult> {
  const items = input.items.map(item => ({ santriId: String(item.santriId), amount: rupiah(item.amount, 'Nominal pencairan') }))
  const identity = operationIdentity('WALLET_PAYOUT_CREATE', operatorId, input.idempotencyKey,
    [input.asrama, input.representativeName, input.representativeSantriId || null, items])
  const replay = await operationReplay<PayoutBatchResult>(identity)
  if (replay) return replay

  if (!items.length) throw new Error('Pilih minimal satu santri.')
  if (items.length > MAX_PAYOUT_ITEMS) throw new Error(`Maksimal ${MAX_PAYOUT_ITEMS} santri per pencairan. Bagi menjadi beberapa perwakilan.`)
  if (new Set(items.map(i => i.santriId)).size !== items.length) throw new Error('Ada santri yang tercantum dua kali.')
  if (items.some(i => i.amount <= 0)) throw new Error('Nominal setiap santri harus lebih dari Rp0.')
  const representativeName = String(input.representativeName || '').trim().slice(0, 80)
  if (representativeName.length < 2) throw new Error('Nama perwakilan wajib diisi.')
  const asrama = String(input.asrama || '').trim()
  if (!asrama) throw new Error('Asrama wajib dipilih.')
  if (isAsramaBebasTagihan(asrama)) throw new Error('Asrama ini tidak memiliki layanan uang jajan.')

  const session = await getActiveCashSession(operatorId)
  if (!session) throw new Error('Buka sesi kas terlebih dahulu sebelum menyerahkan uang ke perwakilan.')
  const today = wibDate()
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const summary = await recalculateCashSession(session.id)
  if ((summary.available_balance ?? summary.expected_closing_balance) < total) {
    throw new Error(`Uang di laci kas tidak cukup (tersedia Rp${(summary.available_balance ?? 0).toLocaleString('id-ID')}, dibutuhkan Rp${total.toLocaleString('id-ID')}).`)
  }

  const students = await query<{ id: string; nama_lengkap: string; asrama: string | null; status_global: string }>(
    `SELECT id, nama_lengkap, asrama, status_global FROM santri WHERE id IN (${items.map(() => '?').join(',')})`,
    items.map(i => i.santriId))
  const byId = new Map(students.map(s => [s.id, s]))
  for (const item of items) {
    const student = byId.get(item.santriId)
    if (!student || student.status_global !== 'aktif') throw new Error('Ada santri yang tidak ditemukan atau tidak aktif.')
    if (isAsramaBebasTagihan(student.asrama)) throw new Error(`${student.nama_lengkap} tidak memiliki layanan uang jajan.`)
    const limit = await evaluateWalletLimit(item.santriId)
    if (item.amount > limit.remainingDailyQuota) {
      throw new Error(`${student.nama_lengkap}: nominal Rp${item.amount.toLocaleString('id-ID')} melebihi sisa limit hari ini Rp${limit.remainingDailyQuota.toLocaleString('id-ID')}.`)
    }
  }
  if (input.representativeSantriId) {
    const rep = await queryOne<{ id: string }>(`SELECT id FROM santri WHERE id = ? AND status_global = 'aktif'`, [input.representativeSantriId])
    if (!rep) throw new Error('Perwakilan tidak ditemukan.')
  }

  const batchId = generateId()
  const batchNumber = generateBatchNumber()
  const timestamp = now()
  const result: PayoutBatchResult = { batchId, batchNumber, totalAmount: total, itemCount: items.length }
  const statements: Array<{ sql: string; params: unknown[] }> = [
    operationStatement(identity, result, { amount: total, cashSessionId: session.id }),
    {
      sql: `INSERT INTO finance_wallet_payout_batches (id, batch_number, payout_date, cash_session_id, operator_id, representative_santri_id,
              representative_name, asrama, scope_label, status, item_count, total_amount, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DIBAWA', ?, ?, ?, ?)`,
      params: [batchId, batchNumber, today, session.id, operatorId, input.representativeSantriId || null, representativeName, asrama,
        String(input.scopeLabel || '').trim().slice(0, 80) || null, items.length, total, String(input.notes || '').trim().slice(0, 300) || null, timestamp],
    },
  ]
  const notices: Array<{ sql: string; params: unknown[] }> = []
  for (const item of items) {
    const itemId = generateId()
    const wallet = walletMutationStatements({
      santriId: item.santriId, direction: 'OUT', movementType: 'WITHDRAWAL_KOLEKTIF', amount: item.amount,
      referenceId: itemId, cashSessionId: session.id, operatorId,
      notes: `Pencairan kolektif ${batchNumber} via ${representativeName}`,
    })
    statements.push(...wallet.statements)
    statements.push({
      sql: `INSERT INTO finance_wallet_payout_items (id, batch_id, santri_id, payout_date, amount, status, ledger_out_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'DIBAWA', ?, ?, ?)`,
      params: [itemId, batchId, item.santriId, today, item.amount, wallet.id, timestamp, timestamp],
    })
    notices.push(...await financeNotices(() => payoutTakenNotices({
      itemId, santriId: item.santriId, namaSantri: byId.get(item.santriId)?.nama_lengkap ?? 'santri', amount: item.amount, updatedAt: timestamp,
    }, representativeName)))
  }
  try { await batch([...statements, ...notices]) } catch (error) { friendly(error) }
  await recalculateCashSession(session.id)
  if (notices.length) await kickNotificationDispatch(outboxIdsOf(notices))
  return result
}

export interface SettlePayoutInput {
  batchId: string
  idempotencyKey: string
  cancelled: Array<{ itemId: string; reason: string }>
  /** Cash physically counted back at the loket; must equal the sum of cancelled items. */
  returnedCash: number
  notes?: string | null
}

export async function settlePayoutBatch(operatorId: string, input: SettlePayoutInput) {
  const cancelled = input.cancelled.map(c => ({ itemId: String(c.itemId), reason: String(c.reason || '').trim().slice(0, 200) }))
  const returnedCash = rupiah(input.returnedCash, 'Uang dikembalikan', true)
  const identity = operationIdentity('WALLET_PAYOUT_SETTLE', operatorId, input.idempotencyKey, [input.batchId, cancelled, returnedCash])
  const replay = await operationReplay<{ batchId: string }>(identity)
  if (replay) return replay

  const payout = await queryOne<{ id: string; batch_number: string; status: string }>(
    `SELECT id, batch_number, status FROM finance_wallet_payout_batches WHERE id = ?`, [input.batchId])
  if (!payout) throw new Error('Pencairan tidak ditemukan.')
  if (payout.status !== 'DIBAWA') throw new Error('Pencairan ini sudah diselesaikan.')
  const items = await query<{ id: string; santri_id: string; amount: number; status: string; nama_lengkap: string }>(
    `SELECT i.id, i.santri_id, i.amount, i.status, s.nama_lengkap FROM finance_wallet_payout_items i
     JOIN santri s ON s.id = i.santri_id WHERE i.batch_id = ?`, [payout.id])
  const byId = new Map(items.map(i => [i.id, i]))
  if (new Set(cancelled.map(c => c.itemId)).size !== cancelled.length) throw new Error('Ada santri yang dibatalkan dua kali.')
  for (const c of cancelled) {
    const item = byId.get(c.itemId)
    if (!item || item.status !== 'DIBAWA') throw new Error('Data pencairan berubah. Muat ulang halaman.')
    if (c.reason.length < 3) throw new Error(`Alasan pembatalan ${item.nama_lengkap} wajib diisi (misal: pulang ke rumah).`)
  }
  const cancelledTotal = cancelled.reduce((sum, c) => sum + byId.get(c.itemId)!.amount, 0)
  if (returnedCash !== cancelledTotal) {
    throw new Error(`Uang yang dikembalikan harus Rp${cancelledTotal.toLocaleString('id-ID')} (jumlah hak santri yang dibatalkan). Hitung ulang uang dari perwakilan.`)
  }
  const session = cancelled.length ? await getActiveCashSession(operatorId) : null
  if (cancelled.length && !session) throw new Error('Buka sesi kas untuk menerima uang yang dikembalikan.')

  const timestamp = now()
  const cancelledIds = new Set(cancelled.map(c => c.itemId))
  const deliveredTotal = items.filter(i => !cancelledIds.has(i.id)).reduce((sum, i) => sum + i.amount, 0)
  const statements: Array<{ sql: string; params: unknown[] }> = [
    operationStatement(identity, { batchId: payout.id }, { amount: returnedCash, cashSessionId: session?.id }),
  ]
  for (const c of cancelled) {
    const item = byId.get(c.itemId)!
    const wallet = walletMutationStatements({
      santriId: item.santri_id, direction: 'IN', movementType: 'WITHDRAWAL_KOLEKTIF_RETURN', amount: item.amount,
      referenceId: item.id, cashSessionId: session!.id, operatorId,
      notes: `Dikembalikan ke loket (${c.reason}) — ${payout.batch_number}`,
    })
    statements.push(...wallet.statements)
    statements.push({
      sql: `UPDATE finance_wallet_payout_items SET status = 'DIBATALKAN', ledger_return_id = ?, cancel_reason = ?, updated_at = ?
            WHERE id = ? AND status = 'DIBAWA'`,
      params: [wallet.id, c.reason, timestamp, item.id],
    })
  }
  statements.push({
    sql: `UPDATE finance_wallet_payout_items SET status = 'DITERIMA', updated_at = ? WHERE batch_id = ? AND status = 'DIBAWA'`,
    params: [timestamp, payout.id],
  })
  statements.push({
    sql: `UPDATE finance_wallet_payout_batches SET status = 'SELESAI', total_delivered = ?, total_returned = ?, settled_by = ?, settled_at = ?,
            settle_notes = ? WHERE id = ? AND status = 'DIBAWA'`,
    params: [deliveredTotal, cancelledTotal, operatorId, timestamp, String(input.notes || '').trim().slice(0, 300) || null, payout.id],
  })
  // Notifikasi per santri, dijaga status & updated_at item hasil batch ini (bukan item yang diproses petugas lain).
  const reasons = new Map(cancelled.map(c => [c.itemId, c.reason]))
  const notices = await financeNotices(() => items.filter(i => i.status === 'DIBAWA').flatMap(i => payoutSettledNotices(
    { itemId: i.id, santriId: i.santri_id, namaSantri: i.nama_lengkap, amount: i.amount },
    cancelledIds.has(i.id) ? 'DIBATALKAN' : 'DITERIMA', timestamp, reasons.get(i.id))))
  try { await batch([...statements, ...notices]) } catch (error) { friendly(error) }
  const check = await queryOne<{ status: string }>(`SELECT status FROM finance_wallet_payout_batches WHERE id = ?`, [payout.id])
  if (check?.status !== 'SELESAI') throw new Error('Pencairan ini baru saja diproses petugas lain. Muat ulang halaman.')
  if (session) await recalculateCashSession(session.id)
  if (notices.length) await kickNotificationDispatch(outboxIdsOf(notices))
  return { batchId: payout.id }
}

export interface PayoutBatchRow {
  id: string
  batch_number: string
  payout_date: string
  status: 'DIBAWA' | 'SELESAI'
  representative_name: string
  asrama: string
  scope_label: string | null
  item_count: number
  total_amount: number
  total_delivered: number
  total_returned: number
  operator_name: string | null
  settled_by_name: string | null
  created_at: string
  settled_at: string | null
}

export async function listPayoutBatches(filter: { status?: 'DIBAWA' | 'SELESAI'; date?: string; limit?: number } = {}) {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.status) { where.push('b.status = ?'); params.push(filter.status) }
  if (filter.date) { where.push('b.payout_date = ?'); params.push(filter.date) }
  params.push(Math.min(filter.limit ?? 100, 300))
  return query<PayoutBatchRow>(
    `SELECT b.id, b.batch_number, b.payout_date, b.status, b.representative_name, b.asrama, b.scope_label, b.item_count,
            b.total_amount, b.total_delivered, b.total_returned, op.full_name AS operator_name, st.full_name AS settled_by_name,
            b.created_at, b.settled_at
     FROM finance_wallet_payout_batches b
     LEFT JOIN users op ON op.id = b.operator_id LEFT JOIN users st ON st.id = b.settled_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE b.status WHEN 'DIBAWA' THEN 0 ELSE 1 END, b.created_at DESC LIMIT ?`, params)
}

export async function getPayoutBatchDetail(batchId: string) {
  const header = await queryOne<PayoutBatchRow & { notes: string | null; settle_notes: string | null }>(
    `SELECT b.*, op.full_name AS operator_name, st.full_name AS settled_by_name
     FROM finance_wallet_payout_batches b LEFT JOIN users op ON op.id = b.operator_id LEFT JOIN users st ON st.id = b.settled_by
     WHERE b.id = ?`, [batchId])
  if (!header) return null
  const items = await query<{ id: string; santri_id: string; nis: string; nama_lengkap: string; kamar: string | null; amount: number; status: string; cancel_reason: string | null }>(
    `SELECT i.id, i.santri_id, s.nis, s.nama_lengkap, s.kamar, i.amount, i.status, i.cancel_reason
     FROM finance_wallet_payout_items i JOIN santri s ON s.id = i.santri_id
     WHERE i.batch_id = ? ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap`, [batchId])
  return { header, items }
}
