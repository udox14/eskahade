// lib/finance/cash-session.ts
// Modul Fondasi Minimum Sesi Kas (Fase 4C & PRD #23)
// Menjamin setiap penerimaan tunai terhubung ke sesi kas aktif (non-orphan),
// saldo awal (opening balance) merepresentasikan kas fisik riil,
// dan dapat direkonsiliasi secara authoritatif.

import { queryOne, execute, generateId, now } from '@/lib/db'

export interface FinanceCashSession {
  id: string
  session_code: string
  operator_id: string
  opened_at: string
  opening_balance: number
  total_cash_in: number
  total_cash_out: number
  expected_closing_balance: number
  actual_closing_balance: number | null
  difference: number | null
  difference_notes: string | null
  closed_at: string | null
  status: 'OPEN' | 'CLOSED'
  created_at: string
  updated_at: string
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
    `SELECT * FROM finance_cash_sessions
     WHERE operator_id = ? AND status = 'OPEN'
     ORDER BY opened_at DESC
     LIMIT 1`,
    [operatorId]
  )

  return existing || null
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
    `SELECT * FROM finance_cash_sessions WHERE id = ?`,
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
 * Rekalkulasi Authoritatif Sesi Kas (Implementation Plan 2.1 #4 & 2.3)
 * Menghitung saldo kas fisik & penerimaan aktual dari mutasi riil finance_payments.
 * expected_closing_balance = opening_balance + authoritative_cash_in - total_cash_out
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

  // Hitung akumulasi tunai masuk authoritatif dari finance_payments
  const cashInRes = await queryOne<{ total_cash_in: number }>(
    `SELECT COALESCE(SUM(gross_amount), 0) AS total_cash_in
     FROM finance_payments
     WHERE cash_session_id = ? AND channel = 'CASH' AND status = 'PAID'`,
    [sessionId]
  )

  const authoritativeCashIn = cashInRes?.total_cash_in ?? 0
  const expectedClosing = session.opening_balance + authoritativeCashIn - session.total_cash_out

  await execute(
    `UPDATE finance_cash_sessions
     SET total_cash_in = ?,
         expected_closing_balance = ?,
         updated_at = ?
     WHERE id = ?`,
    [authoritativeCashIn, expectedClosing, now(), sessionId]
  )

  const updated = await queryOne<FinanceCashSession>(
    `SELECT * FROM finance_cash_sessions WHERE id = ?`,
    [sessionId]
  )
  return updated!
}
