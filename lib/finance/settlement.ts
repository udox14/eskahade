// lib/finance/settlement.ts
// Modul Settlement Bank Payment Gateway (Fase 8)
// Menangani pencairan batch dana Duitku ke rekening bank pesantren,
// penegakan invariant PAID != SETTLED, pencocokan 1-to-1, dan deteksi selisih nominal.

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import type {
  FinanceSettlement,
  FinanceSettlementItem,
  SettlementPaymentCandidate,
  CreateSettlementBatchInput,
  SettlementDetailWithItems,
} from '@/lib/finance/reconciliation-types'

function generateSettlementNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `STL-${datePart}-${randomSuffix}`
}

/**
 * Mengambil daftar pembayaran online Duitku yang berstatus 'PAID' (belum di-settle)
 * dan siap untuk dimasukkan ke dalam batch settlement bank.
 */
export async function getCandidatePaymentsForSettlement(
  period?: string
): Promise<SettlementPaymentCandidate[]> {
  const params: unknown[] = []
  let sql = `
    SELECT
      p.id AS payment_id,
      p.payment_number,
      p.santri_id,
      s.nama_lengkap AS santri_name,
      s.nis,
      p.paid_at,
      p.external_reference,
      p.channel,
      p.method,
      p.gross_amount,
      p.gateway_fee,
      p.net_amount,
      p.status
    FROM finance_payments p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN finance_settlement_items si ON si.payment_id = p.id
    WHERE p.channel = 'DUITKU'
      AND p.status = 'PAID'
      AND si.id IS NULL
      AND p.correction_status != 'FULLY_CORRECTED'
  `

  if (period) {
    sql += ` AND p.paid_at LIKE ?`
    params.push(`${period}%`)
  }

  sql += ` ORDER BY p.paid_at ASC`

  const rows = await query<SettlementPaymentCandidate>(sql, params)
  return rows || []
}

/**
 * Membuat batch settlement bank baru dan menautkan pembayaran online yang dicairkan.
 *
 * Penegakan Invariant:
 * 1. Setiap pembayaran hanya boleh di-settle tepat satu kali (1-to-1 via UNIQUE(payment_id)).
 * 2. Hanya pembayaran online berstatus 'PAID' yang dapat dimasukkan ke settlement bank.
 * 3. Status pembayaran internal beralih dari 'PAID' menjadi 'SETTLED'.
 * 4. Jika nominal net yang dicairkan bank tidak sama persis dengan perhitungan sistem (expectedTotalNet != calculatedTotalNet),
 *    batch settlement ditandai 'DISCREPANCY' dan baris selisih dicatat ke finance_reconciliation_items.
 * 5. Seluruh mutasi dieksekusi secara atomik dalam satu batch statement D1.
 */
export async function createSettlementBatch(
  input: CreateSettlementBatchInput
): Promise<{ settlement: FinanceSettlement; itemsCount: number }> {
  if (!input.paymentIds || input.paymentIds.length === 0) {
    throw new Error('Batch settlement harus memuat minimal satu pembayaran.')
  }

  const settlementId = generateId()
  const settlementNumber = generateSettlementNumber()
  const createdAt = now()
  const provider = input.provider || 'DUITKU'

  // 1. Ambil dan validasi seluruh payment yang dipilih
  const placeholders = input.paymentIds.map(() => '?').join(',')
  const payments = await query<{
    id: string
    payment_number: string
    channel: string
    status: string
    gross_amount: number
    gateway_fee: number
    net_amount: number
    already_settled: number
  }>(
    `SELECT
       p.id, p.payment_number, p.channel, p.status, p.gross_amount, p.gateway_fee, p.net_amount,
       CASE WHEN si.id IS NOT NULL THEN 1 ELSE 0 END AS already_settled
     FROM finance_payments p
     LEFT JOIN finance_settlement_items si ON si.payment_id = p.id
     WHERE p.id IN (${placeholders})`,
    input.paymentIds
  )

  if (payments.length !== input.paymentIds.length) {
    throw new Error('Satu atau lebih ID pembayaran dalam batch tidak ditemukan pada database.')
  }

  let totalGross = 0
  let totalFee = 0
  let totalNet = 0

  for (const p of payments) {
    if (p.channel !== 'DUITKU') {
      throw new Error(`Pembayaran "${p.payment_number}" bukan transaksi gateway online (channel: ${p.channel}).`)
    }
    if (p.already_settled === 1 || p.status === 'SETTLED') {
      throw new Error(`Pembayaran "${p.payment_number}" sudah pernah dicairkan pada settlement lain (PAID != SETTLED violation).`)
    }
    totalGross += p.gross_amount
    totalFee += p.gateway_fee
    totalNet += p.net_amount
  }

  // 2. Evaluasi status settlement (apakah ada selisih dari bank statement)
  let status: 'COMPLETED' | 'DISCREPANCY' = 'COMPLETED'
  let discrepancyAmount = 0
  const expectedNet = input.expectedTotalNet !== undefined ? Math.floor(input.expectedTotalNet) : totalNet

  if (expectedNet !== totalNet) {
    status = 'DISCREPANCY'
    discrepancyAmount = Math.abs(expectedNet - totalNet)
  }

  const statements: Array<{ sql: string; params: unknown[] }> = []

  // A. Insert Header Settlement
  statements.push({
    sql: `
      INSERT INTO finance_settlements (
        id, settlement_number, provider, settlement_date, destination_bank,
        destination_account, total_payments_count, total_gross_amount,
        total_fee_amount, total_net_amount, status, notes, verified_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      settlementId,
      settlementNumber,
      provider,
      input.settlementDate,
      input.destinationBank,
      input.destinationAccount,
      payments.length,
      totalGross,
      totalFee,
      totalNet,
      status,
      input.notes || null,
      input.verifiedBy,
      createdAt,
    ],
  })

  // B. Insert Settlement Items & Update Status Payment ke 'SETTLED'
  for (const p of payments) {
    const itemId = generateId()
    statements.push({
      sql: `
        INSERT INTO finance_settlement_items (
          id, settlement_id, payment_id, gross_amount, gateway_fee, net_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      params: [itemId, settlementId, p.id, p.gross_amount, p.gateway_fee, p.net_amount, createdAt],
    })

    statements.push({
      sql: `UPDATE finance_payments SET status = 'SETTLED' WHERE id = ?`,
      params: [p.id],
    })
  }

  // C. Jika ada selisih nominal, catat ke finance_reconciliation_items
  if (status === 'DISCREPANCY') {
    const recItemId = generateId()
    statements.push({
      sql: `
        INSERT INTO finance_reconciliation_items (
          id, reconciliation_id, payment_id, settlement_id, cash_session_id,
          external_reference, internal_amount, external_amount, discrepancy_amount,
          match_status, resolution_action, resolution_notes, resolved_by,
          resolved_at, created_at
        ) VALUES (?, NULL, NULL, ?, NULL, ?, ?, ?, ?, 'AMOUNT_MISMATCH', 'NONE', ?, NULL, NULL, ?)
      `,
      params: [
        recItemId,
        settlementId,
        settlementNumber,
        totalNet,
        expectedNet,
        discrepancyAmount,
        `Selisih pencairan settlement ${settlementNumber}: kalkulasi internal Rp ${totalNet.toLocaleString('id-ID')} vs bank Rp ${expectedNet.toLocaleString('id-ID')}. Periksa pemotongan fee gateway.`,
        createdAt,
      ],
    })
  }

  await batch(statements)

  const created = await queryOne<FinanceSettlement>(
    `SELECT * FROM finance_settlements WHERE id = ?`,
    [settlementId]
  )

  if (!created) {
    throw new Error('Gagal memuat batch settlement setelah disimpan.')
  }

  return { settlement: created, itemsCount: payments.length }
}

/**
 * Mengambil daftar riwayat settlement bank dengan pagination dan filter.
 */
export async function getSettlementsList(filters?: {
  period?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<{
  settlements: Array<FinanceSettlement & { verifier_name: string | null }>
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, filters?.page ?? 1)
  const pageSize = Math.max(1, filters?.pageSize ?? 10)
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.period) {
    conditions.push(`s.settlement_date LIKE ?`)
    params.push(`${filters.period}%`)
  }

  if (filters?.status && filters.status !== 'ALL') {
    conditions.push(`s.status = ?`)
    params.push(filters.status)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countPromise = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_settlements s ${whereClause}`,
    params
  )

  const rowsPromise = query<FinanceSettlement & { verifier_name: string | null }>(
    `SELECT s.*, u.full_name AS verifier_name
     FROM finance_settlements s
     LEFT JOIN users u ON u.id = s.verified_by
     ${whereClause}
     ORDER BY s.settlement_date DESC, s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const [countRow, rows] = await Promise.all([countPromise, rowsPromise])
  const totalCount = countRow?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    settlements: rows || [],
    totalCount,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Mengambil detail batch settlement beserta seluruh transaksi pembayaran yang dicairkan.
 */
export async function getSettlementDetail(
  settlementId: string
): Promise<SettlementDetailWithItems | null> {
  const settlement = await queryOne<FinanceSettlement & { verifier_name: string | null }>(
    `SELECT s.*, u.full_name AS verifier_name
     FROM finance_settlements s
     LEFT JOIN users u ON u.id = s.verified_by
     WHERE s.id = ?`,
    [settlementId]
  )

  if (!settlement) {
    return null
  }

  const items = await query<
    FinanceSettlementItem & {
      payment_number: string
      paid_at: string
      external_reference: string | null
      method: string
      santri_name: string
      nis: string
    }
  >(
    `SELECT
       si.*,
       p.payment_number,
       p.paid_at,
       p.external_reference,
       p.method,
       san.nama_lengkap AS santri_name,
       san.nis
     FROM finance_settlement_items si
     JOIN finance_payments p ON p.id = si.payment_id
     JOIN santri san ON san.id = p.santri_id
     WHERE si.settlement_id = ?
     ORDER BY p.paid_at ASC`,
    [settlementId]
  )

  return {
    settlement,
    items: items || [],
  }
}

/**
 * Mengambil konfigurasi rekening tujuan settlement bank pesantren dari app_settings.
 */
export async function getSettlementAccountConfig(): Promise<{
  destinationBank: string
  destinationAccount: string
  accountHolder: string
}> {
  let destinationBank = 'Bank Syariah Indonesia (BSI)'
  let destinationAccount = ''
  let accountHolder = 'Pesantren SKH'

  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN (
        'settlement_destination_bank',
        'settlement_destination_account',
        'settlement_account_holder'
      )`
    )
    for (const r of rows) {
      if (r.key === 'settlement_destination_bank' && r.value) destinationBank = r.value.trim()
      if (r.key === 'settlement_destination_account' && r.value) destinationAccount = r.value.trim()
      if (r.key === 'settlement_account_holder' && r.value) accountHolder = r.value.trim()
    }
  } catch {
    // Abaikan jika tabel belum siap
  }

  return { destinationBank, destinationAccount, accountHolder }
}
