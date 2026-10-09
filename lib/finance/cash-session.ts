// lib/finance/cash-session.ts
// Modul Fondasi & Lifecycle Sesi Kas (Fase 4C & Fase 6: PRD #23, Implementation Plan #2.1 #4 & #20)
// Menjamin:
// 1. Setiap transaksi tunai (penerimaan pembayaran, setoran, dan penarikan) terhubung ke sesi kas aktif (non-orphan).
// 2. Saldo awal (opening balance) merepresentasikan kas fisik riil di laci kasir.
// 3. Pelacakan kas masuk (cash-in) dan kas keluar (cash-out).
// 4. Penutupan sesi kas dengan penghitungan fisik (actual closing balance), kalkulasi selisih otomatis,
//    serta audit trail catatan selisih (difference_notes) jika terjadi mismatch.
// 5. Rekalkulasi authoritatif dari entri buku besar mutasi riil (finance_payments & finance_wallet_ledger).

import { query, queryOne, execute, generateId, now } from '@/lib/db'

export interface FinanceCashSession {
  id: string
  session_code: string
  operator_id: string
  operator_name?: string | null
  opened_at: string
  opening_balance: number
  total_cash_in: number
  total_cash_out: number
  expected_closing_balance: number
  reserved_cash_out?: number
  available_balance?: number
  actual_closing_balance: number | null
  difference: number | null
  difference_notes: string | null
  closed_at: string | null
  status: 'OPEN' | 'CLOSED'
  created_at: string
  updated_at: string
}

export interface CashSessionTransactionSummary {
  session: FinanceCashSession
  paymentsCount: number
  totalPaymentsAmount: number
  withdrawalsCount: number
  totalWithdrawalsAmount: number
  topupsCount: number
  totalTopupsAmount: number
}

function generateSessionCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SES-${datePart}-${randomSuffix}`
}

/**
 * Mengambil sesi kas berstatus 'OPEN' milik operator/kasir.
 * Mengembalikan null jika belum ada sesi kas yang aktif.
 */
export async function getActiveCashSession(
  operatorId: string
): Promise<FinanceCashSession | null> {
  const existing = await queryOne<FinanceCashSession>(
    `SELECT s.*, u.full_name AS operator_name
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     WHERE s.operator_id = ? AND s.status = 'OPEN'
     ORDER BY s.opened_at DESC
     LIMIT 1`,
    [operatorId]
  )

  return existing || null
}

/**
 * Mengambil sesi kas berdasarkan ID.
 */
export async function getCashSessionById(
  sessionId: string
): Promise<FinanceCashSession | null> {
  const session = await queryOne<FinanceCashSession>(
    `SELECT s.*, u.full_name AS operator_name
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     WHERE s.id = ?`,
    [sessionId]
  )
  return session || null
}

/**
 * Membuka sesi kas baru dengan saldo kas fisik awal (opening balance) yang valid.
 * Saldo awal harus merepresentasikan uang kas riil di laci loket, bukan asumsi sistem Rp0.
 */
export async function openCashSession(
  operatorId: string,
  openingBalance: number,
  notes?: string
): Promise<FinanceCashSession> {
  const active = await getActiveCashSession(operatorId)
  if (active) {
    throw new Error(`Operator sudah memiliki sesi kas aktif dengan kode "${active.session_code}".`)
  }

  const validBalance = Math.floor(openingBalance)
  if (validBalance < 0 || !Number.isFinite(validBalance)) {
    throw new Error('Saldo kas fisik awal (opening balance) tidak boleh bernilai negatif.')
  }

  const id = generateId()
  const sessionCode = generateSessionCode()
  const timestamp = now()

  await execute(
    `INSERT INTO finance_cash_sessions (
       id, session_code, operator_id, opened_at, opening_balance,
       total_cash_in, total_cash_out, expected_closing_balance,
       difference_notes, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 'OPEN', ?, ?)`,
    [id, sessionCode, operatorId, timestamp, validBalance, validBalance, notes || null, timestamp, timestamp]
  )

  const created = await queryOne<FinanceCashSession>(
    `SELECT s.*, u.full_name AS operator_name
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     WHERE s.id = ?`,
    [id]
  )

  if (!created) {
    throw new Error('Gagal membuka sesi kas baru.')
  }

  return created
}

/**
 * Menambahkan penerimaan tunai (cash-in) ke sesi kas dan mengkinikan derived cache.
 */
export async function recordCashInToSession(
  sessionId: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return

  await execute(
    `UPDATE finance_cash_sessions
     SET total_cash_in = total_cash_in + ?,
         expected_closing_balance = expected_closing_balance + ?,
         updated_at = ?
     WHERE id = ?`,
    [amount, amount, now(), sessionId]
  )
}

/**
 * Mencatat pengeluaran tunai (cash-out, misal penarikan uang jajan di loket) dari sesi kas
 * dan mengkinikan derived cache:
 * total_cash_out bertambah, expected_closing_balance berkurang.
 */
export async function recordCashOutFromSession(
  sessionId: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return

  await execute(
    `UPDATE finance_cash_sessions
     SET total_cash_out = total_cash_out + ?,
         expected_closing_balance = expected_closing_balance - ?,
         updated_at = ?
     WHERE id = ?`,
    [amount, amount, now(), sessionId]
  )
}

/**
 * Rekalkulasi Authoritatif Sesi Kas (Implementation Plan 2.1 #4 & 2.3)
 * Menghitung saldo kas fisik & penerimaan aktual dari mutasi riil:
 * - Kas Masuk authoritatif: SUM(gross_amount) dari finance_payments (channel = 'CASH', status = 'PAID')
 * - Kas Keluar authoritatif: SUM(amount) dari finance_wallet_ledger (movement_type = 'WITHDRAWAL_LOKET', direction = 'OUT')
 * expected_closing_balance = opening_balance + authoritative_cash_in - authoritative_cash_out
 */
export async function recalculateCashSession(
  sessionId: string
): Promise<FinanceCashSession> {
  const session = await queryOne<FinanceCashSession>(
    `SELECT * FROM finance_cash_sessions WHERE id = ?`,
    [sessionId]
  )
  if (!session) {
    throw new Error(`Sesi kas dengan ID "${sessionId}" tidak ditemukan.`)
  }

  // 1. Hitung kas masuk dari pembayaran tagihan kewajiban (finance_payments)
  const paymentsRes = await queryOne<{ total_payment_in: number }>(
    `SELECT COALESCE(SUM(gross_amount), 0) AS total_payment_in
     FROM finance_payments
     WHERE cash_session_id = ? AND channel = 'CASH' AND status = 'PAID' AND fund_management = 'KOPERASI'`,
    [sessionId]
  )
  const paymentCashIn = paymentsRes?.total_payment_in ?? 0

  // 2. Hitung kas masuk dari setoran uang jajan tunai (finance_wallet_ledger TOPUP_CASH)
  const topupRes = await queryOne<{ total_topup_in: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_topup_in
     FROM finance_wallet_ledger
     WHERE cash_session_id = ? AND direction = 'IN' AND movement_type = 'TOPUP_CASH'`,
    [sessionId]
  )
  const topupCashIn = topupRes?.total_topup_in ?? 0

  const authoritativeCashIn = paymentCashIn + topupCashIn

  // 3a. Hitung akumulasi tunai keluar authoritatif dari pencairan uang jajan loket (finance_wallet_ledger WITHDRAWAL_LOKET)
  const cashOutRes = await queryOne<{ total_cash_out: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_cash_out
     FROM finance_wallet_ledger
     WHERE cash_session_id = ? AND direction = 'OUT' AND movement_type = 'WITHDRAWAL_LOKET'`,
    [sessionId]
  )
  const walletCashOut = cashOutRes?.total_cash_out ?? 0

  // 3b. Hitung akumulasi tunai keluar authoritatif dari refund/koreksi tunai (finance_corrections method = 'CASH')
  let correctionCashOut = 0
  const corrTable = await queryOne<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_corrections'`
  )
  if (corrTable) {
    const correctionOutRes = await queryOne<{ total_correction_out: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_correction_out
       FROM finance_corrections
       WHERE cash_session_id = ? AND method = 'CASH'`,
      [sessionId]
    )
    correctionCashOut = correctionOutRes?.total_correction_out ?? 0
  }

  // 3c. Hitung akumulasi tunai keluar authoritatif dari penyaluran tunai (finance_distributions method = 'CASH' AND status = 'DISTRIBUTED')
  let distributionCashOut = 0
  const distTable = await queryOne<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_distributions'`
  )
  if (distTable) {
    const distOutRes = await queryOne<{ total_dist_out: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_dist_out
       FROM finance_distributions
       WHERE cash_session_id = ? AND method = 'CASH' AND status = 'DISTRIBUTED'`,
      [sessionId]
    )
    distributionCashOut = distOutRes?.total_dist_out ?? 0
  }

  // 3d. Hitung akumulasi kas fisik yang sedang dipesan / disiapkan (PROCESSING)
  let reservedCashOut = 0
  if (distTable) {
    const reservedOutRes = await queryOne<{ total_reserved: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_reserved
       FROM finance_distributions
       WHERE cash_session_id = ? AND method = 'CASH' AND status = 'PROCESSING'`,
      [sessionId]
    )
    reservedCashOut = reservedOutRes?.total_reserved ?? 0
  }

  const authoritativeCashOut = walletCashOut + correctionCashOut + distributionCashOut

  const expectedClosing = session.opening_balance + authoritativeCashIn - authoritativeCashOut

  // Jika sesi sudah ditutup dan memiliki actual_closing_balance, perbarui juga selisihnya
  const updatedDifference = session.actual_closing_balance !== null
    ? session.actual_closing_balance - expectedClosing
    : session.difference

  await execute(
    `UPDATE finance_cash_sessions
     SET total_cash_in = ?,
         total_cash_out = ?,
         expected_closing_balance = ?,
         difference = ?,
         updated_at = ?
     WHERE id = ?`,
    [authoritativeCashIn, authoritativeCashOut, expectedClosing, updatedDifference, now(), sessionId]
  )

  const updated = await queryOne<FinanceCashSession>(
    `SELECT s.*, u.full_name AS operator_name
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     WHERE s.id = ?`,
    [sessionId]
  )

  if (updated) {
    updated.reserved_cash_out = reservedCashOut
    updated.available_balance = Math.max(0, expectedClosing - reservedCashOut)
  }

  return updated!
}

/**
 * Menutup sesi kas loket secara authoritatif (PRD #23).
 * Menjamin:
 * 1. Sesi berstatus 'OPEN'.
 * 2. Input saldo fisik penutupan kasir (actual_closing_balance) divalidasi integer >= 0.
 * 3. Menghitung selisih (difference = actual_closing_balance - expected_closing_balance).
 * 4. Jika terdapat selisih (difference !== 0), catatan penjelasan selisih (notes) WAJIB diisi.
 * 5. Menyimpan status 'CLOSED', actual_closing_balance, difference, difference_notes, dan closed_at.
 * 6. Tidak ada hard delete atau perubahan historis diam-diam.
 */
export async function closeCashSession(
  sessionId: string,
  operatorId: string,
  actualClosingBalance: number,
  notes?: string
): Promise<FinanceCashSession> {
  const session = await queryOne<FinanceCashSession>(
    `SELECT * FROM finance_cash_sessions WHERE id = ?`,
    [sessionId]
  )
  if (!session) {
    throw new Error(`Sesi kas dengan ID "${sessionId}" tidak ditemukan.`)
  }
  if (session.status === 'CLOSED') {
    throw new Error(`Sesi kas dengan kode "${session.session_code}" sudah ditutup sebelumnya.`)
  }

  const validActual = Math.floor(actualClosingBalance)
  if (validActual < 0 || !Number.isFinite(validActual)) {
    throw new Error('Saldo fisik penutupan kas (actual closing balance) tidak boleh bernilai negatif.')
  }

  // 1. Cek apakah masih ada penyaluran kas fisik yang berstatus PROCESSING (uang fisik masih disiapkan di luar laci)
  const outstandingPrepared = await queryOne<{ count: number; total_amount: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount
     FROM finance_distributions
     WHERE cash_session_id = ? AND method = 'CASH' AND status = 'PROCESSING'`,
    [sessionId]
  )
  if (outstandingPrepared && outstandingPrepared.count > 0) {
    throw new Error(
      `Sesi kas tidak dapat ditutup karena masih terdapat ${outstandingPrepared.count} penyaluran kas fisik berstatus PROCESSING (total Rp${outstandingPrepared.total_amount.toLocaleString(
        'id-ID'
      )}). Selesaikan serah terima (DISTRIBUTED) atau batalkan dengan pengembalian kas (CASH_RETURNED) terlebih dahulu.`
    )
  }

  // 2. Rekalkulasi authoritatif sebelum menutup untuk menjamin integritas expected closing balance
  const recalculated = await recalculateCashSession(sessionId)
  const expectedClosing = recalculated.expected_closing_balance
  const difference = validActual - expectedClosing
  const cleanNotes = notes?.trim() || null

  // 2. PRD #23: Jika terdapat selisih fisik riil, catatan penjelasan alasan selisih WAJIB diisi
  if (difference !== 0 && !cleanNotes) {
    const diffType = difference > 0 ? 'lebih (overage)' : 'kurang (shortage)'
    const absDiff = Math.abs(difference).toLocaleString('id-ID')
    throw new Error(
      `Terdapat selisih ${diffType} kas fisik sebesar Rp${absDiff}. Catatan penjelasan alasan selisih wajib diisi.`
    )
  }

  const timestamp = now()

  await execute(
    `UPDATE finance_cash_sessions
     SET status = 'CLOSED',
         actual_closing_balance = ?,
         difference = ?,
         difference_notes = ?,
         closed_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [validActual, difference, cleanNotes, timestamp, timestamp, sessionId]
  )

  const closed = await queryOne<FinanceCashSession>(
    `SELECT s.*, u.full_name AS operator_name
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     WHERE s.id = ?`,
    [sessionId]
  )
  return closed!
}

/**
 * Mengambil ringkasan data transaksi dalam satu sesi kas.
 */
export async function getCashSessionSummary(
  sessionId: string
): Promise<CashSessionTransactionSummary | null> {
  const session = await getCashSessionById(sessionId)
  if (!session) return null

  // Agregasi pembayaran tunai
  const payRes = await queryOne<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(gross_amount), 0) AS total
     FROM finance_payments
     WHERE cash_session_id = ? AND channel = 'CASH' AND status = 'PAID'`,
    [sessionId]
  )

  // Agregasi penarikan uang jajan
  const withRes = await queryOne<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM finance_wallet_ledger
     WHERE cash_session_id = ? AND direction = 'OUT' AND movement_type = 'WITHDRAWAL_LOKET'`,
    [sessionId]
  )

  // Agregasi setoran tunai uang jajan
  const topRes = await queryOne<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM finance_wallet_ledger
     WHERE cash_session_id = ? AND direction = 'IN' AND movement_type = 'TOPUP_CASH'`,
    [sessionId]
  )

  return {
    session,
    paymentsCount: payRes?.count ?? 0,
    totalPaymentsAmount: payRes?.total ?? 0,
    withdrawalsCount: withRes?.count ?? 0,
    totalWithdrawalsAmount: withRes?.total ?? 0,
    topupsCount: topRes?.count ?? 0,
    totalTopupsAmount: topRes?.total ?? 0,
  }
}

/**
 * Mengambil histori sesi kas berpaginasi.
 */
export async function getCashSessionHistory(options?: {
  operatorId?: string
  status?: 'OPEN' | 'CLOSED'
  page?: number
  pageSize?: number
}): Promise<{ items: FinanceCashSession[]; total: number }> {
  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 20))
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['1 = 1']
  const params: unknown[] = []

  if (options?.operatorId) {
    conditions.push('s.operator_id = ?')
    params.push(options.operatorId)
  }
  if (options?.status) {
    conditions.push('s.status = ?')
    params.push(options.status)
  }

  const whereClause = conditions.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_cash_sessions s WHERE ${whereClause}`,
    params
  )
  const total = countRow?.total ?? 0

  const items = await query<FinanceCashSession>(
    `SELECT s.*, u.full_name AS operator_name
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     WHERE ${whereClause}
     ORDER BY s.opened_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return { items, total }
}
