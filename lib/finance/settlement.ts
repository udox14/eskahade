// lib/finance/settlement.ts
// Modul Settlement Bank Payment Gateway (Fase BRI-4)
// Menangani pencairan batch dana online BRI ke rekening bank pesantren,
// penegakan invariant PAID != SETTLED, pencocokan 1-to-1, dan deteksi selisih nominal.

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { nonBillableSantriSqlPredicate } from '@/lib/finance/non-billable-santri'
import type {
  FinanceSettlement,
  FinanceSettlementItem,
  SettlementPaymentCandidate,
  CreateSettlementBatchInput,
  SettlementDetailWithItems,
} from '@/lib/finance/reconciliation-types'
import { executeSettlementTransition } from './bri/settlement-service'

/**
 * Mengambil daftar pembayaran online BRI yang berstatus PAID dan menunggu settlement terhadap Rekening Koran BRI.
 */
export async function getCandidatePaymentsForSettlement(
  period?: string
): Promise<SettlementPaymentCandidate[]> {
  const conditions: string[] = [
    `p.channel = 'BRI'`,
    `p.status = 'PAID'`,
    `p.correction_status != 'FULLY_CORRECTED'`,
    nonBillableSantriSqlPredicate('san.asrama'),
  ]
  const params: unknown[] = []

  if (period) {
    conditions.push(`p.paid_at LIKE ?`)
    params.push(`${period}%`)
  }

  const whereSql = conditions.join(' AND ')

  const rows = await query<
    SettlementPaymentCandidate & {
      santri_name: string
      nis: string
    }
  >(
    `SELECT
       p.id AS payment_id,
       p.payment_number,
       p.santri_id,
       san.nama_lengkap AS santri_name,
       san.nis,
       p.paid_at,
       COALESCE(p.bri_trx_id, p.bri_payment_request_id, p.external_reference) AS external_reference,
       p.channel,
       p.method,
       p.gross_amount,
       p.cooperative_admin_fee AS gateway_fee,
       p.net_amount,
       p.status
     FROM finance_payments p
     JOIN santri san ON san.id = p.santri_id
     WHERE ${whereSql}
     ORDER BY p.paid_at ASC
     LIMIT 200`,
    params
  )

  return rows || []
}

/**
 * Membuat batch settlement bank baru.
 * Sesuai invariant PAID != SETTLED dan aturan BRI-4:
 * Transisi ke SETTLED wajib melalui pencocokan terhadap transaksi Rekening Koran (Bank Statement).
 */
export async function createSettlementBatch(
  input: CreateSettlementBatchInput
): Promise<{ settlement: FinanceSettlement; itemsCount: number }> {
  throw new Error(
    'Pencatatan settlement online BRI wajib melalui pencocokan bukti Rekening Koran Bank Statement (BRI-4). Gunakan modul Sinkronisasi Rekening Koran.'
  )
}

/**
 * Mengambil daftar riwayat settlement bank BRI dengan pagination dan filter.
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
    `SELECT COUNT(*) AS total FROM finance_bri_settlements s ${whereClause}`,
    params
  )

  const rowsPromise = query<{
    id: string
    settlement_number: string
    account_no: string
    settlement_date: string
    total_payments_count: number
    total_gross_amount: number
    total_cooperative_admin_fee: number
    total_net_amount: number
    status: string
    notes: string | null
    verified_by: string | null
    created_at: string
    verifier_name: string | null
  }>(
    `SELECT s.*, u.full_name AS verifier_name
     FROM finance_bri_settlements s
     LEFT JOIN users u ON u.id = s.verified_by
     ${whereClause}
     ORDER BY s.settlement_date DESC, s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const [countRow, rows] = await Promise.all([countPromise, rowsPromise])
  const totalCount = countRow?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const mappedSettlements: Array<FinanceSettlement & { verifier_name: string | null }> = (rows || []).map((r) => ({
    id: r.id,
    settlement_number: r.settlement_number,
    provider: 'BRI',
    settlement_date: r.settlement_date,
    destination_bank: 'BRI',
    destination_account: r.account_no,
    total_payments_count: r.total_payments_count,
    total_gross_amount: r.total_gross_amount,
    total_fee_amount: r.total_cooperative_admin_fee,
    total_net_amount: r.total_net_amount,
    status: r.status as FinanceSettlement['status'],
    notes: r.notes,
    verified_by: r.verified_by,
    verifier_name: r.verifier_name,
    created_at: r.created_at,
  }))

  return {
    settlements: mappedSettlements,
    totalCount,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Mengambil detail batch settlement BRI beserta seluruh transaksi pembayaran yang dicairkan.
 */
export async function getSettlementDetail(
  settlementId: string
): Promise<SettlementDetailWithItems | null> {
  const settlementRow = await queryOne<{
    id: string
    settlement_number: string
    account_no: string
    settlement_date: string
    total_payments_count: number
    total_gross_amount: number
    total_cooperative_admin_fee: number
    total_net_amount: number
    status: string
    notes: string | null
    verified_by: string | null
    created_at: string
    verifier_name: string | null
  }>(
    `SELECT s.*, u.full_name AS verifier_name
     FROM finance_bri_settlements s
     LEFT JOIN users u ON u.id = s.verified_by
     WHERE s.id = ?`,
    [settlementId]
  )

  if (!settlementRow) {
    return null
  }

  const settlement: FinanceSettlement & { verifier_name: string | null } = {
    id: settlementRow.id,
    settlement_number: settlementRow.settlement_number,
    provider: 'BRI',
    settlement_date: settlementRow.settlement_date,
    destination_bank: 'BRI',
    destination_account: settlementRow.account_no,
    total_payments_count: settlementRow.total_payments_count,
    total_gross_amount: settlementRow.total_gross_amount,
    total_fee_amount: settlementRow.total_cooperative_admin_fee,
    total_net_amount: settlementRow.total_net_amount,
    status: settlementRow.status as FinanceSettlement['status'],
    notes: settlementRow.notes,
    verified_by: settlementRow.verified_by,
    verifier_name: settlementRow.verifier_name,
    created_at: settlementRow.created_at,
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
       si.id,
       si.settlement_id,
       si.payment_id,
       si.gross_amount,
       si.cooperative_admin_fee AS gateway_fee,
       si.net_amount,
       si.created_at,
       p.payment_number,
       p.paid_at,
       COALESCE(p.bri_trx_id, p.bri_payment_request_id) AS external_reference,
       p.method,
       san.nama_lengkap AS santri_name,
       san.nis
     FROM finance_bri_settlement_items si
     JOIN finance_payments p ON p.id = si.payment_id
     JOIN santri san ON san.id = p.santri_id
     WHERE si.settlement_id = ?
       AND ${nonBillableSantriSqlPredicate('san.asrama')}
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
  let destinationBank = 'Bank Rakyat Indonesia (BRI)'
  let destinationAccount = ''
  let accountHolder = 'Koperasi Pesantren'

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
