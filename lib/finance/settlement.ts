// lib/finance/settlement.ts
// Modul Settlement Bank Payment Gateway (Fase 8 / BRI-1)
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

function generateSettlementNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `STL-${datePart}-${randomSuffix}`
}

/**
 * Mengambil daftar pembayaran online untuk batch settlement bank.
 * Pada Fase BRI-1, flow settlement online BRI dinonaktifkan hingga integrasi Rekening Koran BRIAPI (BRI-4) aktif.
 * Mengembalikan array kosong untuk mencegah repurposing settlement manual legacy menjadi transaksi BRI palsu.
 */
export async function getCandidatePaymentsForSettlement(
  _period?: string
): Promise<SettlementPaymentCandidate[]> {
  return []
}

/**
 * Membuat batch settlement bank baru.
 * Dinonaktifkan pada Fase BRI-1 sesuai invariant PAID != SETTLED hingga Rekening Koran BRIAPI (BRI-4) aktif.
 */
export async function createSettlementBatch(
  _input: CreateSettlementBatchInput
): Promise<{ settlement: FinanceSettlement; itemsCount: number }> {
  throw new Error('Pencatatan settlement online dinonaktifkan hingga integrasi Rekening Koran BRIAPI (BRI-4) aktif.')
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
       COALESCE(p.bri_trx_id, p.bri_payment_request_id) AS external_reference,
       p.method,
       san.nama_lengkap AS santri_name,
       san.nis
     FROM finance_settlement_items si
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
