// lib/finance/cash-transfers.ts
// Mutasi Kas Bank ↔ Tunai: uang diambil dari rekening Koperasi untuk laci loket (BANK_TO_CASH)
// atau uang tunai disetor kembali ke rekening (CASH_TO_BANK).
//
// Bukan pembayaran, pendapatan, alokasi, maupun penyaluran — hanya perpindahan tempat simpan uang.
// Efeknya: kas masuk/keluar sesi kas, dan penjelasan untuk baris debit/kredit di rekening koran.
// Invariant dijaga di sini dan oleh trigger migrasi 0200 (lihat file migrasi).

import crypto from 'node:crypto'
import { batch, generateId, now, query, queryOne } from '@/lib/db'
import { getActiveCashSession, recalculateCashSession } from './cash-session'
import { operationIdentity, operationReplay, operationStatement } from './operation'
import { rupiah } from './money'
import { transferAccountSnapshot, type TransferAccount } from './transfer-config'
import { putPrivateImageBytes } from '@/lib/r2/private-proofs'

export type CashTransferDirection = 'BANK_TO_CASH' | 'CASH_TO_BANK'
export type CashTransferStatus = 'POSTED' | 'VOIDED'

export const CASH_TRANSFER_LABEL: Record<CashTransferDirection, string> = {
  BANK_TO_CASH: 'Ambil dari rekening',
  CASH_TO_BANK: 'Setor ke rekening',
}
export const CASH_TRANSFER_PROOF_MAX_BYTES = 3 * 1024 * 1024
/** Waktu transaksi bank boleh mundur sampai 7 hari (mis. diambil sebelum sesi dibuka). */
const MAX_BACKDATE_MS = 7 * 24 * 3600 * 1000

export interface CashTransferRow {
  id: string
  transfer_number: string
  direction: CashTransferDirection
  amount: number
  cash_session_id: string
  session_code: string
  session_status: 'OPEN' | 'CLOSED'
  operator_id: string
  operator_name: string | null
  account_snapshot: string
  account_number: string
  handled_by_name: string
  bank_transacted_at: string
  bank_reference: string | null
  notes: string | null
  status: CashTransferStatus
  void_reason: string | null
  voided_at: string | null
  statement_transaction_id: string | null
  matched_at: string | null
  match_notes: string | null
  created_at: string
}

const SELECT_ROWS = `
  SELECT t.id, t.transfer_number, t.direction, t.amount, t.cash_session_id, s.session_code, s.status AS session_status, t.operator_id,
         u.full_name AS operator_name, t.account_snapshot, t.account_number, t.handled_by_name, t.bank_transacted_at,
         t.bank_reference, t.notes, t.status, t.void_reason, t.voided_at, t.statement_transaction_id, t.matched_at,
         t.match_notes, t.created_at
  FROM finance_cash_transfers t
  JOIN finance_cash_sessions s ON s.id = t.cash_session_id
  LEFT JOIN users u ON u.id = t.operator_id`

export function normalizeAccountNumber(value: string | null | undefined): string {
  return String(value ?? '').replace(/[\s.-]/g, '')
}

function cleanText(value: string | null | undefined, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

function generateTransferNumber(): string {
  const date = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  return `KAS-${date}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export async function getCashTransfer(id: string): Promise<CashTransferRow | null> {
  return queryOne<CashTransferRow>(`${SELECT_ROWS} WHERE t.id = ?`, [id])
}

export interface CashTransferListFilter {
  /** Batasi ke mutasi yang dicatat operator ini (Petugas Koperasi hanya melihat miliknya). */
  operatorId?: string | null
  direction?: CashTransferDirection | 'SEMUA'
  /** POSTED_UNMATCHED = belum dicocokkan rekening koran; MATCHED = sudah; VOIDED = dibatalkan. */
  state?: 'SEMUA' | 'POSTED_UNMATCHED' | 'MATCHED' | 'VOIDED'
  /** Tanggal WIB (YYYY-MM-DD), berdasarkan waktu transaksi di bank. */
  fromDate?: string | null
  toDate?: string | null
  /** Pencarian bebas: nomor mutasi, kode sesi, petugas, referensi bank, atau catatan. */
  search?: string | null
  limit?: number
  offset?: number
}

/** Daftar mutasi kas lintas sesi + ringkasan (menu Kas Bank). */
export async function listCashTransfers(filter: CashTransferListFilter = {}) {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.operatorId) { where.push('t.operator_id = ?'); params.push(filter.operatorId) }
  if (filter.direction === 'BANK_TO_CASH' || filter.direction === 'CASH_TO_BANK') { where.push('t.direction = ?'); params.push(filter.direction) }
  if (filter.state === 'POSTED_UNMATCHED') where.push(`t.status = 'POSTED' AND t.statement_transaction_id IS NULL`)
  else if (filter.state === 'MATCHED') where.push('t.statement_transaction_id IS NOT NULL')
  else if (filter.state === 'VOIDED') where.push(`t.status = 'VOIDED'`)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  // bank_transacted_at disimpan UTC; batas tanggal WIB = 00:00 WIB = 17:00 UTC hari sebelumnya.
  if (filter.fromDate && dateRe.test(filter.fromDate)) {
    where.push('t.bank_transacted_at >= ?'); params.push(new Date(filter.fromDate + 'T00:00:00+07:00').toISOString())
  }
  if (filter.toDate && dateRe.test(filter.toDate)) {
    where.push('t.bank_transacted_at < ?')
    params.push(new Date(new Date(filter.toDate + 'T00:00:00+07:00').getTime() + 24 * 3600 * 1000).toISOString())
  }
  const search = cleanText(filter.search, 80)
  if (search) {
    const like = `%${search.toLowerCase()}%`
    where.push(`(LOWER(t.transfer_number) LIKE ? OR LOWER(s.session_code) LIKE ? OR LOWER(t.handled_by_name) LIKE ? OR LOWER(COALESCE(u.full_name, '')) LIKE ? OR LOWER(COALESCE(t.bank_reference, '')) LIKE ? OR LOWER(COALESCE(t.notes, '')) LIKE ?)`)
    params.push(like, like, like, like, like, like)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200)
  const offset = Math.max(filter.offset ?? 0, 0)
  const [items, summary] = await Promise.all([
    query<CashTransferRow>(`${SELECT_ROWS} ${whereSql} ORDER BY t.bank_transacted_at DESC, t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]),
    queryOne<{ total: number; bank_in: number; bank_out: number; unmatched: number; voided: number }>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN t.status = 'POSTED' AND t.direction = 'BANK_TO_CASH' THEN t.amount ELSE 0 END), 0) AS bank_in,
              COALESCE(SUM(CASE WHEN t.status = 'POSTED' AND t.direction = 'CASH_TO_BANK' THEN t.amount ELSE 0 END), 0) AS bank_out,
              COALESCE(SUM(CASE WHEN t.status = 'POSTED' AND t.statement_transaction_id IS NULL THEN 1 ELSE 0 END), 0) AS unmatched,
              COALESCE(SUM(CASE WHEN t.status = 'VOIDED' THEN 1 ELSE 0 END), 0) AS voided
       FROM finance_cash_transfers t
       JOIN finance_cash_sessions s ON s.id = t.cash_session_id
       LEFT JOIN users u ON u.id = t.operator_id
       ${whereSql}`, params),
  ])
  return {
    items,
    total: summary?.total ?? 0,
    summary: {
      bankIn: summary?.bank_in ?? 0,
      bankOut: summary?.bank_out ?? 0,
      unmatched: summary?.unmatched ?? 0,
      voided: summary?.voided ?? 0,
    },
  }
}

export async function listCashTransfersForSession(sessionId: string): Promise<CashTransferRow[]> {
  return query<CashTransferRow>(`${SELECT_ROWS} WHERE t.cash_session_id = ? ORDER BY t.created_at DESC`, [sessionId])
}

function friendly(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('CASH_SESSION_NOT_OPEN')) throw new Error('Sesi kas Anda belum dibuka atau sudah ditutup.')
  if (message.includes('INSUFFICIENT_CASH')) throw new Error('Uang di laci kas tidak cukup untuk mutasi ini. Muat ulang lalu periksa saldo laci.')
  if (message.includes('finance_cash_transfers.proof_hash')) throw new Error('Foto bukti ini sudah pernah dipakai untuk mutasi kas lain.')
  if (message.includes('IDEMPOTENCY_CONFLICT') || message.includes('finance_idempotency_keys.key')) {
    throw new Error('Permintaan ini sudah diproses dengan data berbeda. Muat ulang halaman.')
  }
  if (message.includes('CASH_TRANSFER_MATCHED')) throw new Error('Mutasi ini sudah dicocokkan dengan rekening koran dan tidak bisa dibatalkan.')
  if (message.includes('CASH_TRANSFER_FINAL') || message.includes('CASH_TRANSFER_INVALID_TRANSITION')) {
    throw new Error('Mutasi ini sudah dibatalkan atau statusnya berubah. Muat ulang halaman.')
  }
  throw error instanceof Error ? error : new Error(message)
}

// ------------------------------------------------------------------
// Catat mutasi (Loket Kasir)
// ------------------------------------------------------------------

export interface RecordCashTransferInput {
  idempotencyKey: string
  direction: CashTransferDirection
  amount: number
  accountId: string
  handledByName: string
  /** ISO 8601 dengan zona waktu. */
  bankTransactedAt: string
  bankReference?: string | null
  notes?: string | null
  proofBytes: Uint8Array
  proofMimeType: string
}

export interface CashTransferResult {
  id: string
  transferNumber: string
  direction: CashTransferDirection
  amount: number
  cashSessionId: string
}

export async function recordCashTransfer(operatorId: string, input: RecordCashTransferInput): Promise<CashTransferResult> {
  const direction = input.direction
  if (direction !== 'BANK_TO_CASH' && direction !== 'CASH_TO_BANK') throw new Error('Jenis mutasi kas tidak valid.')
  const amount = rupiah(input.amount, 'Nominal mutasi kas')
  if (amount <= 0) throw new Error('Nominal mutasi kas harus lebih dari Rp0.')
  const handledByName = cleanText(input.handledByName, 80)
  if (handledByName.length < 2) throw new Error('Nama petugas yang ke bank wajib diisi.')
  const bankReference = cleanText(input.bankReference, 80) || null
  const notes = cleanText(input.notes, 300) || null
  const transactedAt = new Date(input.bankTransactedAt)
  if (Number.isNaN(transactedAt.getTime())) throw new Error('Waktu transaksi bank tidak valid.')
  if (transactedAt.getTime() > Date.now() + 10 * 60 * 1000) throw new Error('Waktu transaksi bank tidak boleh di masa depan.')
  if (transactedAt.getTime() < Date.now() - MAX_BACKDATE_MS) throw new Error('Waktu transaksi bank lebih dari 7 hari yang lalu. Hubungi Bendahara untuk penyesuaian.')
  if (!input.proofBytes?.length || input.proofBytes.length > CASH_TRANSFER_PROOF_MAX_BYTES) {
    throw new Error('Foto bukti (struk/slip bank) wajib, maksimal 3 MB.')
  }
  const proofHash = crypto.createHash('sha256').update(input.proofBytes).digest('hex')

  const identity = operationIdentity('CASH_TRANSFER', operatorId, input.idempotencyKey,
    [direction, amount, input.accountId, handledByName, transactedAt.toISOString(), bankReference, notes, proofHash])
  const replay = await operationReplay<CashTransferResult>(identity)
  if (replay) return replay

  const session = await getActiveCashSession(operatorId)
  if (!session) throw new Error('Buka sesi kas terlebih dahulu sebelum mencatat mutasi kas.')

  const account = await queryOne<TransferAccount>(
    `SELECT id, bank_name, account_number, account_holder, notes, is_active, sort_order
     FROM finance_transfer_accounts WHERE id = ? AND is_active = 1`,
    [input.accountId]
  )
  if (!account) throw new Error('Pilih rekening Koperasi yang aktif.')
  const accountNumber = normalizeAccountNumber(account.account_number)

  if (direction === 'CASH_TO_BANK') {
    const summary = await recalculateCashSession(session.id)
    const available = summary.available_balance ?? summary.expected_closing_balance
    if (amount > available) {
      throw new Error(`Uang di laci tidak cukup untuk disetor (tersedia Rp${available.toLocaleString('id-ID')}, disetor Rp${amount.toLocaleString('id-ID')}).`)
    }
  }

  const reused = await queryOne<{ transfer_number: string }>(
    `SELECT transfer_number FROM finance_cash_transfers WHERE proof_hash = ?`, [proofHash])
  if (reused) throw new Error(`Foto bukti ini sudah dipakai untuk mutasi ${reused.transfer_number}.`)

  const proofKey = await putPrivateImageBytes(input.proofBytes, input.proofMimeType, 'bukti-mutasi-kas', {
    operatorId, cashSessionId: session.id,
  })
  const id = generateId()
  const result: CashTransferResult = { id, transferNumber: generateTransferNumber(), direction, amount, cashSessionId: session.id }
  try {
    await batch([
      operationStatement(identity, result, { amount, cashSessionId: session.id }),
      {
        sql: `INSERT INTO finance_cash_transfers (id, transfer_number, direction, amount, cash_session_id, operator_id,
                account_id, account_snapshot, account_number, handled_by_name, bank_transacted_at, bank_reference,
                proof_object_key, proof_hash, notes, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
        params: [id, result.transferNumber, direction, amount, session.id, operatorId, account.id,
          transferAccountSnapshot(account), accountNumber, handledByName, transactedAt.toISOString(), bankReference,
          proofKey, proofHash, notes, now()],
      },
    ])
  } catch (error) { friendly(error) }
  await recalculateCashSession(session.id)
  return result
}

// ------------------------------------------------------------------
// Batalkan (VOID) — hanya selama sesi masih OPEN dan belum dicocokkan
// ------------------------------------------------------------------

export async function voidCashTransfer(
  actor: { userId: string; roles: readonly string[] },
  input: { id: string; reason: string }
): Promise<void> {
  const reason = cleanText(input.reason, 300)
  if (reason.length < 5) throw new Error('Alasan pembatalan wajib diisi (minimal 5 huruf).')
  const row = await getCashTransfer(String(input.id || ''))
  if (!row) throw new Error('Mutasi kas tidak ditemukan.')
  if (row.status !== 'POSTED') throw new Error('Mutasi ini sudah dibatalkan.')
  if (row.statement_transaction_id) throw new Error('Mutasi ini sudah dicocokkan dengan rekening koran dan tidak bisa dibatalkan.')
  const canVoid = row.operator_id === actor.userId || actor.roles.some(role => role === 'admin' || role === 'bendahara')
  if (!canVoid || actor.roles.includes('pimpinan')) throw new Error('FORBIDDEN: Hanya pencatat, Admin, atau Bendahara yang dapat membatalkan mutasi kas.')
  const session = await recalculateCashSession(row.cash_session_id)
  if (session.status !== 'OPEN') throw new Error('Sesi kas mutasi ini sudah ditutup. Koreksi lewat mutasi baru di sesi berikutnya.')
  if (row.direction === 'BANK_TO_CASH') {
    const available = session.available_balance ?? session.expected_closing_balance
    if (row.amount > available) {
      throw new Error(`Uang di laci (Rp${available.toLocaleString('id-ID')}) lebih kecil dari nominal yang dibatalkan. Periksa kembali laci kas.`)
    }
  }
  const timestamp = now()
  try {
    await batch([{
      sql: `UPDATE finance_cash_transfers SET status = 'VOIDED', void_reason = ?, voided_by = ?, voided_at = ?
            WHERE id = ? AND status = 'POSTED' AND statement_transaction_id IS NULL`,
      params: [reason, actor.userId, timestamp, row.id],
    }])
  } catch (error) { friendly(error) }
  const check = await getCashTransfer(row.id)
  if (check?.status !== 'VOIDED') throw new Error('Mutasi ini baru saja berubah. Muat ulang halaman.')
  await recalculateCashSession(row.cash_session_id)
}

// ------------------------------------------------------------------
// Rekonsiliasi: cocokkan dengan baris rekening koran
// ------------------------------------------------------------------

export interface StatementLineSummary {
  id: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  date: string
  reference: string | null
  remark: string | null
}

const STATEMENT_SELECT = `
  SELECT st.id, st.type_normalized AS type, st.amount, st.transaction_date_raw AS date, st.transaction_id AS reference, st.remark
  FROM finance_bri_statement_transactions st
  JOIN finance_bri_statement_fetches f ON f.id = st.fetch_id AND f.status = 'SUCCESS'`

const NORMALIZED_STATEMENT_ACCOUNT = `REPLACE(REPLACE(REPLACE(st.account_no, '-', ''), ' ', ''), '.', '')`

/** Baris rekening koran yang dapat menjadi pasangan mutasi kas (belum dipakai, arah/nominal/rekening sama). */
export async function findStatementCandidates(transfer: Pick<CashTransferRow, 'direction' | 'amount' | 'account_number'>, limit = 5) {
  const type = transfer.direction === 'BANK_TO_CASH' ? 'DEBIT' : 'CREDIT'
  return query<StatementLineSummary>(
    `${STATEMENT_SELECT}
     WHERE st.type_normalized = ? AND st.amount = ? AND st.currency = 'IDR' AND ${NORMALIZED_STATEMENT_ACCOUNT} = ?
       AND NOT EXISTS (SELECT 1 FROM finance_cash_transfers ct WHERE ct.statement_transaction_id = st.id)
       AND (st.type_normalized = 'DEBIT' OR (st.matched_payment_id IS NULL AND st.match_status NOT IN ('MATCHED', 'UNALLOCATED_RECORDED')))
     ORDER BY st.created_at DESC LIMIT ?`,
    [type, transfer.amount, transfer.account_number, limit]
  )
}

/** Mutasi kas setoran yang belum dicocokkan dan bisa menjelaskan satu baris kredit. */
export async function findPendingCashDeposits(statement: { amount: number; account_no: string }) {
  return query<{ transfer_number: string }>(
    `SELECT transfer_number FROM finance_cash_transfers
     WHERE direction = 'CASH_TO_BANK' AND status = 'POSTED' AND statement_transaction_id IS NULL
       AND amount = ? AND account_number = ?
     ORDER BY created_at DESC LIMIT 3`,
    [statement.amount, normalizeAccountNumber(statement.account_no)]
  )
}

export async function isStatementLinkedToCashTransfer(statementTransactionId: string): Promise<string | null> {
  const row = await queryOne<{ transfer_number: string }>(
    `SELECT transfer_number FROM finance_cash_transfers WHERE statement_transaction_id = ?`, [statementTransactionId])
  return row?.transfer_number ?? null
}

export async function getCashTransferReconciliation() {
  const pending = await query<CashTransferRow>(
    `${SELECT_ROWS} WHERE t.status = 'POSTED' AND t.statement_transaction_id IS NULL ORDER BY t.created_at DESC LIMIT 100`)
  const candidates = await Promise.all(pending.map(row => findStatementCandidates(row)))
  const unexplainedDebits = await query<StatementLineSummary>(
    `${STATEMENT_SELECT}
     WHERE st.type_normalized = 'DEBIT'
       AND NOT EXISTS (SELECT 1 FROM finance_cash_transfers ct WHERE ct.statement_transaction_id = st.id)
     ORDER BY st.created_at DESC LIMIT 50`)
  const recentMatched = await query<CashTransferRow>(
    `${SELECT_ROWS} WHERE t.statement_transaction_id IS NOT NULL ORDER BY t.matched_at DESC LIMIT 20`)
  return {
    pending: pending.map((row, i) => ({ transfer: row, candidates: candidates[i] })),
    unexplainedDebits,
    recentMatched,
  }
}

export async function linkCashTransferToStatement(
  actorId: string,
  input: { cashTransferId: string; statementTransactionId: string; notes: string }
): Promise<void> {
  const notes = cleanText(input.notes, 300)
  if (notes.length < 10) throw new Error('Catatan pemeriksaan wajib diisi (minimal 10 huruf).')
  const row = await getCashTransfer(String(input.cashTransferId || ''))
  if (!row) throw new Error('Mutasi kas tidak ditemukan.')
  if (row.status !== 'POSTED') throw new Error('Mutasi kas yang dibatalkan tidak dapat dicocokkan.')
  if (row.statement_transaction_id) throw new Error('Mutasi kas ini sudah dicocokkan.')
  const candidates = await findStatementCandidates(row, 50)
  if (!candidates.some(c => c.id === input.statementTransactionId)) {
    throw new Error('Baris rekening koran tidak cocok (arah, nominal, atau rekening berbeda) atau sudah dipakai.')
  }
  const timestamp = now()
  try {
    await batch([{
      sql: `UPDATE finance_cash_transfers SET statement_transaction_id = ?, matched_by = ?, matched_at = ?, match_notes = ?
            WHERE id = ? AND status = 'POSTED' AND statement_transaction_id IS NULL`,
      params: [input.statementTransactionId, actorId, timestamp, notes, row.id],
    }])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('uq_finance_cash_transfers_statement') || message.includes('statement_transaction_id')) {
      throw new Error('Baris rekening koran ini sudah dipakai untuk mutasi kas lain.')
    }
    if (message.includes('CASH_TRANSFER')) throw new Error('Mutasi kas atau baris rekening koran baru saja berubah. Muat ulang halaman.')
    throw error
  }
  const check = await getCashTransfer(row.id)
  if (check?.statement_transaction_id !== input.statementTransactionId) throw new Error('Mutasi ini baru saja berubah. Muat ulang halaman.')
}
