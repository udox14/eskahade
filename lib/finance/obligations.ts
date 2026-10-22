import { checkLegacyUsppStatus } from './legacy'
import { createObligationEngine } from './obligation-engine'
// lib/finance/obligations.ts
// Obligation Engine - Sistem Keuangan Baru Pesantren (Fase 2B)

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { computeObligationStatus } from '@/lib/finance/types'
import type {
  FinanceObligation,
  FinanceItemType,
  EnsureObligationOptions,
  StudentObligationsFilter,
} from '@/lib/finance/types'

const MONTHLY_ITEM_TYPES: readonly FinanceItemType[] = [
  'SPP',
  'UANG_MAKAN',
  'UANG_NYUCI',
] as const

const ANNUAL_ITEM_TYPES: readonly FinanceItemType[] = [
  'EHB',
  'EKSKUL',
  'KESEHATAN',
] as const

const obligationEngine = createObligationEngine({ query, queryOne, execute })
export const validateAndMapPeriod = obligationEngine.validateAndMapPeriod
export async function ensureObligation(santriId: string, itemType: FinanceItemType, period: string, options?: EnsureObligationOptions): Promise<FinanceObligation> {
  return obligationEngine.ensureObligation(santriId,itemType,period,options)
}

/**
 * Memastikan paket tagihan bulanan (SPP, Uang Makan, Uang Nyuci) telah terbentuk untuk santri.
 */
export async function ensureMonthlyObligations(
  santriId: string,
  period: string, // YYYY-MM
  options?: EnsureObligationOptions
): Promise<FinanceObligation[]> {
  const results: FinanceObligation[] = []
  for (const itemType of MONTHLY_ITEM_TYPES) {
    const obligation = await ensureObligation(santriId, itemType, period, options)
    results.push(obligation)
  }
  return results
}

/**
 * Memastikan paket tagihan tahunan (EHB, Ekskul, Kesehatan) telah terbentuk untuk santri.
 */
export async function ensureAnnualObligations(
  santriId: string,
  period: string, // YYYY
  options?: EnsureObligationOptions
): Promise<FinanceObligation[]> {
  const results: FinanceObligation[] = []
  for (const itemType of ANNUAL_ITEM_TYPES) {
    const obligation = await ensureObligation(santriId, itemType, period, options)
    results.push(obligation)
  }
  return results
}

/**
 * Memastikan tagihan USPP (Uang Pangkal Bangunan) dengan periode 'LIFETIME' telah terbentuk.
 */
export async function ensureLifetimeObligations(
  santriId: string,
  options?: EnsureObligationOptions
): Promise<FinanceObligation> {
  return ensureObligation(santriId, 'USPP', 'LIFETIME', options)
}

/**
 * Mengambil daftar kewajiban santri dengan filter opsional.
 * Jika opsi autoEnsure aktif dan filter.period diberikan, kewajiban otomatis dimaterialisasikan.
 */
export async function getStudentObligations(
  santriId: string,
  filter?: StudentObligationsFilter
): Promise<FinanceObligation[]> {
  if (filter?.autoEnsure && filter?.period) {
    if (/^\d{4}-\d{2}$/.test(filter.period)) {
      await ensureMonthlyObligations(santriId, filter.period)
    } else if (/^\d{4}$/.test(filter.period)) {
      await ensureAnnualObligations(santriId, filter.period)
    }
  }

  const conditions: string[] = ['santri_id = ?']
  const params: unknown[] = [santriId]

  if (filter?.period) {
    conditions.push('period = ?')
    params.push(filter.period)
  }

  if (filter?.itemType) {
    conditions.push('item_type = ?')
    params.push(filter.itemType)
  }

  if (filter?.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }

  return query<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE ${conditions.join(' AND ')}
     ORDER BY period DESC, item_type ASC`,
    params
  )
}

/**
 * Menghitung ulang saldo terbayar (amount_paid) dan status kewajiban
 * dari akumulasi alokasi pembayaran aktif (PRD Section 5.1 & Implementation Plan 2.1).
 *
 * PENTING: Dilarang dipanggil sebelum tabel finance_allocations tersedia di database.
 */
export async function recalculateObligation(
  obligationId: string
): Promise<FinanceObligation> {
  // Cegah pemanggilan sebelum tabel finance_allocations tersedia di database
  const allocationTable = await queryOne<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_allocations'`
  )

  if (!allocationTable) {
    throw new Error(
      'recalculateObligation tidak dapat dijalankan sebelum tabel finance_allocations tersedia di database.'
    )
  }

  const obligation = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE id = ?`,
    [obligationId]
  )

  if (!obligation) {
    throw new Error(`Kewajiban dengan ID "${obligationId}" tidak ditemukan.`)
  }

  const sumResult = await queryOne<{ total: number | null }>(
    `SELECT SUM(amount) AS total
     FROM finance_allocations
     WHERE obligation_id = ?`,
    [obligationId]
  )
  const grossAllocations = sumResult?.total ?? 0

  // Periksa akumulasi koreksi (VOID / REVERSAL / REFUND) pada finance_correction_items jika tabel tersedia
  let totalCorrections = 0
  const corrTable = await queryOne<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_correction_items'`
  )
  if (corrTable) {
    const corrResult = await queryOne<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM finance_correction_items
       WHERE obligation_id = ?`,
      [obligationId]
    )
    totalCorrections = corrResult?.total ?? 0
  }

  const netAllocationsPaid = Math.max(0, grossAllocations - totalCorrections)

  // Periksa apakah ada pembayaran legacy yang terbawa pada kewajiban ini (khusus USPP)
  let legacyPaid = 0
  if (obligation.item_type === 'USPP') {
    const usppStatus = await checkLegacyUsppStatus(obligation.santri_id)
    if (!usppStatus.isFullySettled && usppStatus.legacyPaid > 0) {
      legacyPaid = usppStatus.legacyPaid
    }
  }

  const totalPaid = legacyPaid + netAllocationsPaid

  // Hitung status derived baru
  const newStatus = computeObligationStatus(
    obligation.amount_expected,
    obligation.amount_exempted,
    totalPaid
  )

  const timestamp = now()
  await execute(
    `UPDATE finance_obligations
     SET amount_paid = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [totalPaid, newStatus, timestamp, obligationId]
  )

  const updated = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE id = ?`,
    [obligationId]
  )

  if (!updated) {
    throw new Error('Gagal mengambil data kewajiban setelah rekalkulasi.')
  }

  return updated
}
