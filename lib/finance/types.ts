// lib/finance/types.ts
// Tipe data fondasi Sistem Keuangan Baru (Fase 2A: Tarif & Tagihan)

export type FinanceItemType =
  | 'SPP'
  | 'UANG_MAKAN'
  | 'UANG_NYUCI'
  | 'EHB'
  | 'EKSKUL'
  | 'KESEHATAN'
  | 'USPP'

export type FinanceExemptionItemType = FinanceItemType | 'ALL'

export type FinanceInstallmentRule = 'DISALLOWED' | 'ALLOWED'

export type FinanceObligationStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'EXEMPTED'

/**
 * Menghitung status kewajiban secara konsisten:
 * status selalu dihitung dari amount_paid dibanding effective_expected = amount_expected - amount_exempted.
 * 1. Jika amount_exempted >= amount_expected dan amount_paid == 0 -> 'EXEMPTED'
 * 2. Jika amount_paid >= effective_expected -> 'PAID' (kewajiban terpenuhi)
 * 3. Jika amount_paid > 0 -> 'PARTIALLY_PAID'
 * 4. Selain itu -> 'UNPAID'
 */
export function computeObligationStatus(
  amountExpected: number,
  amountExempted: number,
  amountPaid: number
): FinanceObligationStatus {
  const effectiveExpected = Math.max(0, amountExpected - amountExempted)
  if (effectiveExpected === 0 && amountPaid === 0) {
    return 'EXEMPTED'
  }
  if (amountPaid >= effectiveExpected) {
    return 'PAID'
  }
  if (amountPaid > 0) {
    return 'PARTIALLY_PAID'
  }
  return 'UNPAID'
}

export interface FinanceTariff {
  id: string
  item_type: FinanceItemType
  academic_year_id: number | null
  nominal: number
  installment_rule: FinanceInstallmentRule
  effective_from: string // YYYY-MM-DD
  effective_until: string | null // YYYY-MM-DD
  created_by: string | null
  created_at: string
}

export interface FinanceTariffOverride {
  id: string
  item_type: FinanceItemType
  period: string // YYYY-MM
  nominal: number
  academic_year_id: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FinanceExemption {
  id: string
  santri_id: string
  item_type: FinanceExemptionItemType
  academic_year_id: number | null
  period_start: string | null // YYYY-MM or YYYY-MM-DD
  period_end: string | null   // YYYY-MM or YYYY-MM-DD
  reason: string
  notes: string | null
  status: 'ACTIVE' | 'REVOKED'
  revoked_at: string | null
  revoked_by: string | null
  revocation_reason: string | null
  created_by: string | null
  created_at: string
}

export interface RevokeExemptionOptions {
  revokedBy?: string | null
  reason?: string | null
}

export interface FinanceObligation {
  id: string
  santri_id: string
  item_type: FinanceItemType
  academic_year_id: number | null
  period: string // YYYY-MM for monthly, YYYY for annual, 'LIFETIME' for USPP
  tariff_id: string | null // Snapshot referensi tarif
  amount_expected: number  // Snapshot nominal tarif
  amount_exempted: number  // Potongan pembebasan
  amount_paid: number      // Derived cache pembayaran teralokasi
  status: FinanceObligationStatus
  provider_id: string | null // Snapshot vendor katering/laundry
  created_at: string
  updated_at: string
}

export const FINANCE_ITEM_LABELS: Record<FinanceItemType, string> = {
  SPP: 'SPP Bulanan',
  UANG_MAKAN: 'Uang Makan (Katering)',
  UANG_NYUCI: 'Uang Nyuci (Laundry)',
  EHB: 'EHB (Evaluasi Hasil Belajar)',
  EKSKUL: 'Ekstrakurikuler',
  KESEHATAN: 'Kesehatan (Poskestren)',
  USPP: 'USPP / Uang Pangkal Bangunan',
} as const

export interface CreateTariffInput {
  item_type: FinanceItemType
  academic_year_id?: number | null
  nominal: number
  installment_rule?: FinanceInstallmentRule
  effective_from: string // YYYY-MM-DD
  effective_until?: string | null
  created_by?: string | null
}

export interface CreateExemptionInput {
  santri_id: string
  item_type: FinanceExemptionItemType
  academic_year_id?: number | null
  period_start?: string | null
  period_end?: string | null
  reason: string
  notes?: string | null
  created_by?: string | null
}

export interface EnsureObligationOptions {
  academicYearId?: number | null
}

export interface StudentObligationsFilter {
  period?: string
  itemType?: FinanceItemType
  status?: FinanceObligationStatus
  autoEnsure?: boolean // if true, ensure obligations for given period
}

export interface BatchGenerationError {
  santriId: string
  namaSantri: string
  itemType: FinanceItemType
  error: string
}

export interface BatchGenerationResult {
  period: string
  totalStudents: number
  processedCount: number
  createdCount: number
  alreadyExistsCount: number
  exemptedCount: number
  skippedLegacyCount?: number
  failedCount: number
  errors: BatchGenerationError[]
}

export interface BatchGrantExemptionResult {
  totalRequested: number
  grantedCount: number
  failedCount: number
  errors: Array<{
    santriId: string
    error: string
  }>
}

export interface ObligationItemSummary {
  obligationId: string | null
  itemType: FinanceItemType
  amountExpected: number
  amountExempted: number
  amountPaid: number
  remaining: number
  status: FinanceObligationStatus | 'NOT_MATERIALIZED'
  providerId: string | null
  providerName: string | null
}

export interface StudentObligationMatrixItem {
  santriId: string
  nis: string
  namaLengkap: string
  asrama: string | null
  kamar: string | null
  tempatMakanId: string | null
  tempatMencuciId: string | null
  period: string
  spp: ObligationItemSummary
  uangMakan: ObligationItemSummary
  uangNyuci: ObligationItemSummary
  tahunan: ObligationItemSummary[]
  uspp: ObligationItemSummary
  totalExpected: number
  totalPaid: number
  totalRemaining: number
  overallStatus: 'LUNAS' | 'BELUM_LUNAS' | 'CICILAN' | 'BEBAS'
}

export interface StudentObligationMatrixFilter {
  asrama?: string
  status?: 'LUNAS' | 'BELUM_LUNAS' | 'CICILAN' | 'BEBAS'
  search?: string
  limit?: number
  offset?: number
}

// Re-export tipe data pembayaran Fase 3
export * from '@/lib/finance/payment-types'


