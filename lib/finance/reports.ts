// lib/finance/reports.ts
// Modul Read-Model & Engine Laporan Finansial (Fase 10: PRD Bab 34, 40, 42)
// Menjamin:
// 1. Perhitungan authoritatif berbasis read-model Fase 1–9 tanpa bergantung pada stale derived cache.
// 2. Mendukung 9 jenis laporan finansial:
//    - Penerimaan (Receipts)
//    - Penyaluran (Distributions)
//    - Penunggak (Arrears / Defaulters)
//    - Santri Dibebaskan (Exemptions)
//    - Detail per Santri (Student Financial Statement)
//    - Uang Jajan (Pocket Money Ledger & Balances)
//    - Transaksi Loket (Cash Sessions & Counter Movements)
//    - Settlement (Gateway Settlements)
//    - Rekonsiliasi (Reconciliation Sessions & Discrepancies)
// 3. Mendukung multi-filter: santri, asrama, kelas, pos/item biaya, periode, tahun ajaran.
// 4. Server-side search, pagination, dan kalkulasi agregat KPI.

import { query, queryOne } from '@/lib/db'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'

// ── TYPES & INTERFACES ────────────────────────────────────────────────────────

export type ReportType =
  | 'PENERIMAAN'
  | 'PENYALURAN'
  | 'PENUNGGAK'
  | 'PEMBEBASAN'
  | 'DETAIL_SANTRI'
  | 'UANG_JAJAN'
  | 'TRANSAKSI_LOKET'
  | 'SETTLEMENT'
  | 'REKONSILIASI'

export interface BaseReportFilter {
  startDate?: string
  endDate?: string
  period?: string // YYYY-MM or YYYY
  academicYearId?: number
  asrama?: string
  kelas?: string
  santriId?: string
  search?: string
  page?: number
  pageSize?: number
}

// 1. Penerimaan Types
export interface ReceiptsReportFilter extends BaseReportFilter {
  channel?: 'ALL' | 'DUITKU' | 'CASH'
  method?: string
  itemType?: string
}

export interface ReceiptItemRow {
  id: string
  paymentNumber: string
  orderNumber: string | null
  paidAt: string
  santriId: string
  santriName: string
  santriNis: string
  santriAsrama: string | null
  santriKelas: string | null
  channel: 'DUITKU' | 'CASH'
  method: string
  grossAmount: number
  gatewayFee: number
  netAmount: number
  allocationsSummary: string
  status: 'PAID' | 'SETTLED'
  correctionStatus: string
  cashierName: string | null
}

export interface ReceiptsReportResponse {
  items: ReceiptItemRow[]
  kpi: {
    totalGross: number
    totalFee: number
    totalNet: number
    totalTransactions: number
    onlineGross: number
    cashGross: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export interface DistributionsReportFilter extends BaseReportFilter {
  recipientType?: 'ALL' | 'BENDAHARA' | 'BENDAHARA_PESANTREN' | 'KATERING' | 'LAUNDRY'
  providerId?: string
  method?: 'ALL' | 'TRANSFER' | 'CASH'
}

export interface DistributionItemRow {
  id: string
  distributionNumber: string
  transferredAt: string
  recipientType: 'BENDAHARA' | 'BENDAHARA_PESANTREN' | 'KATERING' | 'LAUNDRY' | string
  recipientName: string
  method: 'TRANSFER' | 'CASH'
  destinationBank: string | null
  destinationAccount: string | null
  accountHolderName: string | null
  amount: number
  transferReference: string | null
  operatorName: string | null
  notes: string | null
  itemsCount: number
  itemsSummary: string
}

export interface DistributionsReportResponse {
  items: DistributionItemRow[]
  kpi: {
    totalDisbursed: number
    totalBendahara: number
    totalKatering: number
    totalLaundry: number
    totalDistributionsCount: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// 3. Penunggak Types
export interface ArrearsReportFilter extends BaseReportFilter {
  itemType?: string
}

export interface ArrearItemRow {
  obligationId: string
  santriId: string
  santriName: string
  santriNis: string
  santriAsrama: string | null
  santriKelas: string | null
  noWaOrtu: string | null
  academicYearName: string | null
  period: string
  itemType: string
  itemLabel: string
  amountExpected: number
  amountExempted: number
  amountPaid: number
  remaining: number
  status: string
}

export interface ArrearsReportResponse {
  items: ArrearItemRow[]
  kpi: {
    totalArrears: number
    totalObligations: number
    uniqueStudentsCount: number
    averageArrearsPerStudent: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// 4. Santri Dibebaskan Types
export interface ExemptionsReportFilter extends BaseReportFilter {
  status?: 'ACTIVE' | 'REVOKED' | 'ALL'
  itemType?: string
}

export interface ExemptionItemRow {
  id: string
  santriId: string
  santriName: string
  santriNis: string
  santriAsrama: string | null
  santriKelas: string | null
  itemType: string
  itemLabel: string
  academicYearName: string | null
  periodStart: string | null
  periodEnd: string | null
  reason: string
  notes: string | null
  status: 'ACTIVE' | 'REVOKED'
  totalExemptedAmount: number
  createdByName: string | null
  createdAt: string
  revokedAt: string | null
  revokedByName: string | null
  revocationReason: string | null
}

export interface ExemptionsReportResponse {
  items: ExemptionItemRow[]
  kpi: {
    activeExemptionsCount: number
    revokedExemptionsCount: number
    uniqueStudentsCount: number
    totalNominalExempted: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// 5. Detail per Santri Types
export interface StudentDetailReportFilter {
  santriId?: string
  academicYearId?: number
  period?: string
}

export interface StudentDetailObligationRow {
  id: string
  period: string
  itemType: string
  itemLabel: string
  amountExpected: number
  amountExempted: number
  amountPaid: number
  remaining: number
  status: string
}

export interface StudentDetailPaymentRow {
  id: string
  paymentNumber: string
  paidAt: string
  method: string
  grossAmount: number
  netAmount: number
  allocationsSummary: string
  status: string
}

export interface StudentDetailWalletRow {
  id: string
  createdAt: string
  movementType: string
  direction: 'IN' | 'OUT'
  amount: number
  balanceAfter: number
  operatorName: string | null
  notes: string | null
}

export interface StudentDetailReportResponse {
  student: {
    id: string
    nis: string
    nama: string
    asrama: string | null
    kamar: string | null
    kelas: string | null
    noWaOrtu: string | null
    fixedVa: string | null
    bankCode: string | null
    parentDailyLimit: number | null
    walletBalance: number
  } | null
  obligations: StudentDetailObligationRow[]
  payments: StudentDetailPaymentRow[]
  walletMutations: StudentDetailWalletRow[]
  summary: {
    totalExpected: number
    totalExempted: number
    totalPaid: number
    totalRemaining: number
    walletTotalIn: number
    walletTotalOut: number
    walletBalance: number
  }
}

// 6. Uang Jajan Types
export interface WalletReportFilter extends BaseReportFilter {
  mode?: 'SUMMARY' | 'MUTATION'
  movementType?: string
  direction?: 'ALL' | 'IN' | 'OUT'
}

export interface WalletSummaryRow {
  santriId: string
  santriName: string
  santriNis: string
  santriAsrama: string | null
  santriKelas: string | null
  totalIn: number
  totalOut: number
  currentBalance: number
  parentDailyLimit: number | null
  effectiveDailyLimit: number
  activeCardCode: string | null
  activeCardStatus: string | null
}

export interface WalletMutationRow {
  id: string
  createdAt: string
  santriId: string
  santriName: string
  santriNis: string
  santriAsrama: string | null
  santriKelas: string | null
  movementType: string
  direction: 'IN' | 'OUT'
  amount: number
  balanceBefore: number
  balanceAfter: number
  operatorName: string | null
  cashSessionCode: string | null
  notes: string | null
}

export interface WalletReportResponse {
  mode: 'SUMMARY' | 'MUTATION'
  summaryItems?: WalletSummaryRow[]
  mutationItems?: WalletMutationRow[]
  kpi: {
    totalDepositIn: number
    totalWithdrawalOut: number
    totalCurrentBalance: number
    totalMutationsCount: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// 7. Transaksi Loket Types
export interface CashSessionsReportFilter extends BaseReportFilter {
  operatorId?: string
  status?: 'OPEN' | 'CLOSED' | 'ALL'
  discrepancyOnly?: boolean
}

export interface CashSessionItemRow {
  id: string
  sessionCode: string
  operatorName: string
  openedAt: string
  closedAt: string | null
  openingBalance: number
  totalCashIn: number
  totalCashOut: number
  expectedClosingBalance: number
  actualClosingBalance: number | null
  difference: number | null
  differenceNotes: string | null
  status: 'OPEN' | 'CLOSED'
  paymentsCount: number
  paymentsAmount: number
  withdrawalsCount: number
  withdrawalsAmount: number
  topupsCount: number
  topupsAmount: number
  refundsCount?: number
  refundsAmount?: number
}

export interface CashSessionDetailItem {
  id: string
  referenceNumber: string
  timestamp: string
  category: 'PAYMENT' | 'TOPUP' | 'WITHDRAWAL' | 'REFUND'
  direction: 'IN' | 'OUT'
  santriName: string
  nis: string
  amount: number
  notes: string | null
}

export interface CashSessionDetailReportResponse {
  session: CashSessionItemRow
  cashPayments: Array<{
    id: string
    paymentNumber: string
    paidAt: string
    santriName: string
    nis: string
    grossAmount: number
    method: string
  }>
  cashTopups: Array<{
    id: string
    createdAt: string
    santriName: string
    nis: string
    amount: number
    notes: string | null
  }>
  cashWithdrawals: Array<{
    id: string
    createdAt: string
    santriName: string
    nis: string
    amount: number
    notes: string | null
  }>
  cashRefunds: Array<{
    id: string
    correctionNumber: string
    createdAt: string
    correctionType: string
    amount: number
    reason: string
  }>
  authoritativeSummary: {
    openingBalance: number
    cashPaymentsIn: number
    cashTopupsIn: number
    totalCashIn: number
    cashWithdrawalsOut: number
    cashRefundsOut: number
    totalCashOut: number
    expectedClosingBalance: number
    actualClosingBalance: number | null
    difference: number | null
  }
}

export interface CashSessionsReportResponse {
  items: CashSessionItemRow[]
  kpi: {
    totalSessionsCount: number
    totalCashInAllSessions: number
    totalCashOutAllSessions: number
    totalDifference: number
    discrepancySessionsCount: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// 8. Settlement Types
export interface SettlementsReportFilter extends BaseReportFilter {
  status?: 'PENDING' | 'SETTLED' | 'ALL'
}

export interface SettlementItemRow {
  id: string
  settlementNumber: string
  settlementDate: string
  destinationBank: string
  destinationAccount: string
  accountHolderName: string
  itemCount: number
  grossAmount: number
  totalFee: number
  netAmount: number
  status: 'PENDING' | 'COMPLETED' | 'DISCREPANCY' | string
  bankReference: string | null
  createdByName: string | null
  createdAt: string
  itemsPreview: string
}

export interface SettlementsReportResponse {
  items: SettlementItemRow[]
  kpi: {
    totalGrossSettled: number
    totalFeeDeducted: number
    totalNetReceived: number
    totalSettlementBatches: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// 9. Rekonsiliasi Types
export interface ReconciliationsReportFilter extends BaseReportFilter {
  matchStatus?: string
  resolutionAction?: string
}

export interface ReconciliationReportRow {
  id: string
  reconciliationId: string | null
  createdAt: string
  matchStatus: string
  externalReference: string | null
  internalAmount: number
  externalAmount: number
  discrepancyAmount: number
  resolutionAction: string
  resolutionNotes: string | null
  resolvedByName: string | null
  resolvedAt: string | null
  paymentNumber: string | null
  santriName: string | null
}

export interface ReconciliationsReportResponse {
  items: ReconciliationReportRow[]
  kpi: {
    totalMatchedItems: number
    totalDiscrepancyItems: number
    totalDiscrepancyAmount: number
    totalResolvedItems: number
  }
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

// Filter Master Options
export interface ReportFilterOptions {
  asramaList: string[]
  kelasList: string[]
  academicYears: Array<{ id: number; name: string; is_active: boolean }>
  itemTypes: Array<{ code: string; label: string }>
  operators: Array<{ id: string; name: string }>
  providers: Array<{ id: string; name: string; type: string }>
  students: Array<{ id: string; nis: string; name: string; asrama: string | null; kelas: string | null }>
}

// ── QUERY IMPLEMENTATIONS ─────────────────────────────────────────────────────

/**
 * 1. LAPORAN PENERIMAAN (Authoritative: finance_payments + allocations - corrections)
 */
export async function getReceiptsReport(
  filters: ReceiptsReportFilter
): Promise<ReceiptsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  const conditions: string[] = ["fp.status IN ('PAID', 'SETTLED')"]
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('fp.paid_at >= ?')
    params.push(`${filters.startDate} 00:00:00`)
  }
  if (filters.endDate) {
    conditions.push('fp.paid_at <= ?')
    params.push(`${filters.endDate} 23:59:59`)
  }
  if (filters.period) {
    conditions.push('fp.paid_at LIKE ?')
    params.push(`${filters.period}%`)
  }
  if (filters.channel && filters.channel !== 'ALL') {
    conditions.push('fp.channel = ?')
    params.push(filters.channel)
  }
  if (filters.method && filters.method !== 'ALL') {
    conditions.push('fp.method = ?')
    params.push(filters.method)
  }
  if (filters.asrama && filters.asrama !== 'ALL') {
    conditions.push('s.asrama = ?')
    params.push(filters.asrama)
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    conditions.push('(k.nama_kelas = ? OR s.kelas_sekolah = ?)')
    params.push(filters.kelas, filters.kelas)
  }
  if (filters.santriId) {
    conditions.push('fp.santri_id = ?')
    params.push(filters.santriId)
  }
  if (filters.itemType && filters.itemType !== 'ALL') {
    conditions.push(`EXISTS (
      SELECT 1 FROM finance_allocations fa
      WHERE fa.payment_id = fp.id AND fa.item_type = ?
    )`)
    params.push(filters.itemType)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push(`(
      fp.payment_number LIKE ? OR
      fpo.order_number LIKE ? OR
      s.nama_lengkap LIKE ? OR
      s.nis LIKE ? OR
      fp.external_reference LIKE ?
    )`)
    params.push(term, term, term, term, term)
  }

  const whereSql = conditions.join(' AND ')

  // Total KPI Calculation
  const kpiRow = await queryOne<{
    total_gross: number
    total_fee: number
    total_net: number
    total_count: number
    online_gross: number
    cash_gross: number
  }>(
    `SELECT
       COALESCE(SUM(fp.gross_amount), 0) AS total_gross,
       COALESCE(SUM(fp.gateway_fee), 0) AS total_fee,
       COALESCE(SUM(fp.net_amount), 0) AS total_net,
       COUNT(*) AS total_count,
       COALESCE(SUM(CASE WHEN fp.channel = 'DUITKU' THEN fp.gross_amount ELSE 0 END), 0) AS online_gross,
       COALESCE(SUM(CASE WHEN fp.channel = 'CASH' THEN fp.gross_amount ELSE 0 END), 0) AS cash_gross
     FROM finance_payments fp
     LEFT JOIN finance_payment_orders fpo ON fpo.id = fp.order_id
     JOIN santri s ON s.id = fp.santri_id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${whereSql}`,
    params
  )

  // Fetch Page Items
  const rows = await query<{
    id: string
    payment_number: string
    order_number: string | null
    paid_at: string
    santri_id: string
    santri_name: string
    santri_nis: string
    santri_asrama: string | null
    santri_kelas: string | null
    channel: 'DUITKU' | 'CASH'
    method: string
    gross_amount: number
    gateway_fee: number
    net_amount: number
    status: 'PAID' | 'SETTLED'
    correction_status: string
    cashier_name: string | null
    allocations_summary: string | null
  }>(
    `SELECT
       fp.id,
       fp.payment_number,
       fpo.order_number,
       fp.paid_at,
       fp.santri_id,
       s.nama_lengkap AS santri_name,
       s.nis AS santri_nis,
       s.asrama AS santri_asrama,
       COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
       fp.channel,
       fp.method,
       fp.gross_amount,
       fp.gateway_fee,
       fp.net_amount,
       fp.status,
       fp.correction_status,
       u.full_name AS cashier_name,
       (
         SELECT GROUP_CONCAT(fa.item_type || ': Rp' || fa.amount, ', ')
         FROM finance_allocations fa
         WHERE fa.payment_id = fp.id
       ) AS allocations_summary
     FROM finance_payments fp
     LEFT JOIN finance_payment_orders fpo ON fpo.id = fp.order_id
     JOIN santri s ON s.id = fp.santri_id
     LEFT JOIN users u ON u.id = fp.received_by
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${whereSql}
     ORDER BY fp.paid_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: ReceiptItemRow[] = rows.map((r) => ({
    id: r.id,
    paymentNumber: r.payment_number,
    orderNumber: r.order_number,
    paidAt: r.paid_at,
    santriId: r.santri_id,
    santriName: r.santri_name,
    santriNis: r.santri_nis,
    santriAsrama: r.santri_asrama,
    santriKelas: r.santri_kelas,
    channel: r.channel,
    method: r.method,
    grossAmount: r.gross_amount,
    gatewayFee: r.gateway_fee,
    netAmount: r.net_amount,
    allocationsSummary: r.allocations_summary || 'Uang Jajan / Standalone',
    status: r.status,
    correctionStatus: r.correction_status,
    cashierName: r.cashier_name,
  }))

  const totalRecords = kpiRow?.total_count || 0

  return {
    items,
    kpi: {
      totalGross: kpiRow?.total_gross || 0,
      totalFee: kpiRow?.total_fee || 0,
      totalNet: kpiRow?.total_net || 0,
      totalTransactions: totalRecords,
      onlineGross: kpiRow?.online_gross || 0,
      cashGross: kpiRow?.cash_gross || 0,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * 2. LAPORAN PENYALURAN (Authoritative: finance_distributions + items)
 */
export async function getDistributionsReport(
  filters: DistributionsReportFilter
): Promise<DistributionsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['1 = 1']
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('fd.transferred_at >= ?')
    params.push(`${filters.startDate} 00:00:00`)
  }
  if (filters.endDate) {
    conditions.push('fd.transferred_at <= ?')
    params.push(`${filters.endDate} 23:59:59`)
  }
  if (filters.recipientType && filters.recipientType !== 'ALL') {
    conditions.push('(fd.recipient_type = ? OR (? = "BENDAHARA_PESANTREN" AND fd.recipient_type = "BENDAHARA"))')
    params.push(filters.recipientType, filters.recipientType)
  }
  if (filters.providerId && filters.providerId !== 'ALL') {
    conditions.push('fd.recipient_id = ?')
    params.push(filters.providerId)
  }
  if (filters.method && filters.method !== 'ALL') {
    conditions.push('fd.method = ?')
    params.push(filters.method)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push(`(
      fd.distribution_number LIKE ? OR
      j.nama_jasa LIKE ? OR
      fd.notes LIKE ?
    )`)
    params.push(term, term, term)
  }

  const whereSql = conditions.join(' AND ')

  // Total KPI
  const kpiRow = await queryOne<{
    total_disbursed: number
    total_bendahara: number
    total_katering: number
    total_laundry: number
    total_count: number
  }>(
    `SELECT
       COALESCE(SUM(fd.total_amount), 0) AS total_disbursed,
       COALESCE(SUM(CASE WHEN fd.recipient_type = 'BENDAHARA' THEN fd.total_amount ELSE 0 END), 0) AS total_bendahara,
       COALESCE(SUM(CASE WHEN fd.recipient_type = 'KATERING' THEN fd.total_amount ELSE 0 END), 0) AS total_katering,
       COALESCE(SUM(CASE WHEN fd.recipient_type = 'LAUNDRY' THEN fd.total_amount ELSE 0 END), 0) AS total_laundry,
       COUNT(*) AS total_count
     FROM finance_distributions fd
     LEFT JOIN master_jasa j ON j.id = fd.recipient_id
     WHERE ${whereSql}`,
    params
  )

  const rows = await query<{
    id: string
    distribution_number: string
    transferred_at: string
    recipient_type: string
    recipient_name: string
    method: 'TRANSFER' | 'CASH'
    destination_bank: string | null
    destination_account: string | null
    account_holder_name: string | null
    total_amount: number
    operator_name: string | null
    notes: string | null
    items_count: number
    items_summary: string | null
  }>(
    `SELECT
       fd.id,
       fd.distribution_number,
       fd.transferred_at,
       fd.recipient_type,
       CASE
         WHEN fd.recipient_type = 'BENDAHARA' THEN 'Bendahara Pesantren'
         ELSE COALESCE(j.nama_jasa, fd.recipient_type)
       END AS recipient_name,
       fd.method,
       fd.destination_bank,
       fd.destination_account,
       fd.account_holder_name,
       fd.total_amount,
       u.full_name AS operator_name,
       fd.notes,
       (SELECT COUNT(*) FROM finance_distribution_items fdi WHERE fdi.distribution_id = fd.id) AS items_count,
       (
         SELECT GROUP_CONCAT(DISTINCT fa.item_type)
         FROM finance_distribution_items fdi
         JOIN finance_allocations fa ON fa.id = fdi.allocation_id
         WHERE fdi.distribution_id = fd.id
       ) AS items_summary
     FROM finance_distributions fd
     LEFT JOIN master_jasa j ON j.id = fd.recipient_id
     LEFT JOIN users u ON u.id = fd.transferred_by
     WHERE ${whereSql}
     ORDER BY fd.transferred_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: DistributionItemRow[] = rows.map((r) => ({
    id: r.id,
    distributionNumber: r.distribution_number,
    transferredAt: r.transferred_at,
    recipientType: r.recipient_type,
    recipientName: r.recipient_name,
    method: r.method,
    destinationBank: r.destination_bank,
    destinationAccount: r.destination_account,
    accountHolderName: r.account_holder_name,
    amount: r.total_amount,
    transferReference: r.distribution_number,
    operatorName: r.operator_name,
    notes: r.notes,
    itemsCount: r.items_count,
    itemsSummary: r.items_summary || '-',
  }))

  const totalRecords = kpiRow?.total_count || 0

  return {
    items,
    kpi: {
      totalDisbursed: kpiRow?.total_disbursed || 0,
      totalBendahara: kpiRow?.total_bendahara || 0,
      totalKatering: kpiRow?.total_katering || 0,
      totalLaundry: kpiRow?.total_laundry || 0,
      totalDistributionsCount: totalRecords,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * 3. LAPORAN PENUNGGAK (Authoritative: obligations - active allocations sum)
 * Menjamin tidak mengandalkan stale derived status/amount_paid.
 */
export async function getArrearsReport(
  filters: ArrearsReportFilter
): Promise<ArrearsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  // Invariant authoritatif Fase 8 & Fase 10:
  // Net Authoritative Paid = MAX(0, SUM(valid allocations) - SUM(correction_items))
  // Tunggakan riil = (amount_expected - amount_exempted) - net_authoritative_paid
  // Kewajiban masih berstatus menunggak bila tunggakan > 0 dan status != 'EXEMPTED'
  const netPaidExpr = `(CASE WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) > 0 THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) ELSE 0 END)`
  const remainingExpr = `((fo.amount_expected - fo.amount_exempted) - ${netPaidExpr})`

  const conditions: string[] = [
    "fo.status != 'EXEMPTED'",
    `${remainingExpr} > 0`,
  ]
  const params: unknown[] = []

  if (filters.period) {
    conditions.push('fo.period = ?')
    params.push(filters.period)
  }
  if (filters.academicYearId) {
    conditions.push('fo.academic_year_id = ?')
    params.push(filters.academicYearId)
  }
  if (filters.itemType && filters.itemType !== 'ALL') {
    conditions.push('fo.item_type = ?')
    params.push(filters.itemType)
  }
  if (filters.asrama && filters.asrama !== 'ALL') {
    conditions.push('s.asrama = ?')
    params.push(filters.asrama)
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    conditions.push('(k.nama_kelas = ? OR s.kelas_sekolah = ?)')
    params.push(filters.kelas, filters.kelas)
  }
  if (filters.santriId) {
    conditions.push('fo.santri_id = ?')
    params.push(filters.santriId)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    params.push(term, term)
  }

  const whereSql = conditions.join(' AND ')

  // Aggregation KPI Subquery
  const kpiRow = await queryOne<{
    total_arrears: number
    total_obligations: number
    unique_students: number
  }>(
    `SELECT
       COALESCE(SUM(${remainingExpr}), 0) AS total_arrears,
       COUNT(*) AS total_obligations,
       COUNT(DISTINCT fo.santri_id) AS unique_students
     FROM finance_obligations fo
     JOIN santri s ON s.id = fo.santri_id
     LEFT JOIN (
       SELECT fa.obligation_id, SUM(fa.amount) AS gross_paid
       FROM finance_allocations fa
       JOIN finance_payments fp ON fp.id = fa.payment_id
       WHERE fa.obligation_id IS NOT NULL
         AND fp.status IN ('PAID', 'SETTLED')
       GROUP BY fa.obligation_id
     ) alloc ON alloc.obligation_id = fo.id
     LEFT JOIN (
       SELECT fci.obligation_id, SUM(fci.amount) AS total_corrected
       FROM finance_correction_items fci
       WHERE fci.obligation_id IS NOT NULL
       GROUP BY fci.obligation_id
     ) corr ON corr.obligation_id = fo.id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${whereSql}`,
    params
  )

  const rows = await query<{
    obligation_id: string
    santri_id: string
    santri_name: string
    santri_nis: string
    santri_asrama: string | null
    santri_kelas: string | null
    no_wa_ortu: string | null
    academic_year_name: string | null
    period: string
    item_type: string
    amount_expected: number
    amount_exempted: number
    actual_paid: number
    remaining: number
    status: string
  }>(
    `SELECT
       fo.id AS obligation_id,
       fo.santri_id,
       s.nama_lengkap AS santri_name,
       s.nis AS santri_nis,
       s.asrama AS santri_asrama,
       COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
       s.no_wa_ortu,
       ta.nama AS academic_year_name,
       fo.period,
       fo.item_type,
       fo.amount_expected,
       fo.amount_exempted,
       ${netPaidExpr} AS actual_paid,
       ${remainingExpr} AS remaining,
       fo.status
     FROM finance_obligations fo
     JOIN santri s ON s.id = fo.santri_id
     LEFT JOIN tahun_ajaran ta ON ta.id = fo.academic_year_id
     LEFT JOIN (
       SELECT fa.obligation_id, SUM(fa.amount) AS gross_paid
       FROM finance_allocations fa
       JOIN finance_payments fp ON fp.id = fa.payment_id
       WHERE fa.obligation_id IS NOT NULL
         AND fp.status IN ('PAID', 'SETTLED')
       GROUP BY fa.obligation_id
     ) alloc ON alloc.obligation_id = fo.id
     LEFT JOIN (
       SELECT fci.obligation_id, SUM(fci.amount) AS total_corrected
       FROM finance_correction_items fci
       WHERE fci.obligation_id IS NOT NULL
       GROUP BY fci.obligation_id
     ) corr ON corr.obligation_id = fo.id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${whereSql}
     ORDER BY remaining DESC, s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: ArrearItemRow[] = rows.map((r) => ({
    obligationId: r.obligation_id,
    santriId: r.santri_id,
    santriName: r.santri_name,
    santriNis: r.santri_nis,
    santriAsrama: r.santri_asrama,
    santriKelas: r.santri_kelas,
    noWaOrtu: r.no_wa_ortu,
    academicYearName: r.academic_year_name,
    period: r.period,
    itemType: r.item_type,
    itemLabel: FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] || r.item_type,
    amountExpected: r.amount_expected,
    amountExempted: r.amount_exempted,
    amountPaid: r.actual_paid,
    remaining: r.remaining,
    status: r.remaining <= 0 ? 'PAID' : r.actual_paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
  }))

  const totalRecords = kpiRow?.total_obligations || 0
  const totalArrears = kpiRow?.total_arrears || 0
  const uniqueStudents = kpiRow?.unique_students || 0
  const avg = uniqueStudents > 0 ? Math.round(totalArrears / uniqueStudents) : 0

  return {
    items,
    kpi: {
      totalArrears,
      totalObligations: totalRecords,
      uniqueStudentsCount: uniqueStudents,
      averageArrearsPerStudent: avg,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * 4. LAPORAN SANTRI DIBEBASKAN (Authoritative: finance_exemptions + obligations)
 */
export async function getExemptionsReport(
  filters: ExemptionsReportFilter
): Promise<ExemptionsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['1 = 1']
  const params: unknown[] = []

  if (filters.status && filters.status !== 'ALL') {
    conditions.push('fe.status = ?')
    params.push(filters.status)
  }
  if (filters.itemType && filters.itemType !== 'ALL') {
    conditions.push('(fe.item_type = ? OR fe.item_type = "ALL")')
    params.push(filters.itemType)
  }
  if (filters.academicYearId) {
    conditions.push('(fe.academic_year_id = ? OR fe.academic_year_id IS NULL)')
    params.push(filters.academicYearId)
  }
  if (filters.asrama && filters.asrama !== 'ALL') {
    conditions.push('s.asrama = ?')
    params.push(filters.asrama)
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    conditions.push('(k.nama_kelas = ? OR s.kelas_sekolah = ?)')
    params.push(filters.kelas, filters.kelas)
  }
  if (filters.santriId) {
    conditions.push('fe.santri_id = ?')
    params.push(filters.santriId)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ? OR fe.reason LIKE ?)')
    params.push(term, term, term)
  }

  const whereSql = conditions.join(' AND ')

  // KPI Calculation
  const kpiRow = await queryOne<{
    active_count: number
    revoked_count: number
    unique_students: number
    total_exempted: number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN fe.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_count,
       COALESCE(SUM(CASE WHEN fe.status = 'REVOKED' THEN 1 ELSE 0 END), 0) AS revoked_count,
       COUNT(DISTINCT fe.santri_id) AS unique_students,
       COALESCE(SUM(
         (SELECT COALESCE(SUM(amount_exempted), 0)
          FROM finance_obligations fo
          WHERE fo.santri_id = fe.santri_id
            AND (fe.item_type = 'ALL' OR fo.item_type = fe.item_type)
            AND (fe.academic_year_id IS NULL OR fo.academic_year_id = fe.academic_year_id))
       ), 0) AS total_exempted
     FROM finance_exemptions fe
     JOIN santri s ON s.id = fe.santri_id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${whereSql}`,
    params
  )

  const rows = await query<{
    id: string
    santri_id: string
    santri_name: string
    santri_nis: string
    santri_asrama: string | null
    santri_kelas: string | null
    item_type: string
    academic_year_name: string | null
    period_start: string | null
    period_end: string | null
    reason: string
    notes: string | null
    status: 'ACTIVE' | 'REVOKED'
    created_by_name: string | null
    created_at: string
    revoked_at: string | null
    revoked_by_name: string | null
    revocation_reason: string | null
    total_exempted_amount: number
  }>(
    `SELECT
       fe.id,
       fe.santri_id,
       s.nama_lengkap AS santri_name,
       s.nis AS santri_nis,
       s.asrama AS santri_asrama,
       COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
       fe.item_type,
       ta.nama AS academic_year_name,
       fe.period_start,
       fe.period_end,
       fe.reason,
       fe.notes,
       fe.status,
       u_c.full_name AS created_by_name,
       fe.created_at,
       fe.revoked_at,
       u_r.full_name AS revoked_by_name,
       fe.revocation_reason,
       COALESCE(
         (SELECT SUM(fo.amount_exempted)
          FROM finance_obligations fo
          WHERE fo.santri_id = fe.santri_id
            AND (fe.item_type = 'ALL' OR fo.item_type = fe.item_type)
            AND (fe.academic_year_id IS NULL OR fo.academic_year_id = fe.academic_year_id)),
         0
       ) AS total_exempted_amount
     FROM finance_exemptions fe
     JOIN santri s ON s.id = fe.santri_id
     LEFT JOIN tahun_ajaran ta ON ta.id = fe.academic_year_id
     LEFT JOIN users u_c ON u_c.id = fe.created_by
     LEFT JOIN users u_r ON u_r.id = fe.revoked_by
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${whereSql}
     ORDER BY fe.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: ExemptionItemRow[] = rows.map((r) => ({
    id: r.id,
    santriId: r.santri_id,
    santriName: r.santri_name,
    santriNis: r.santri_nis,
    santriAsrama: r.santri_asrama,
    santriKelas: r.santri_kelas,
    itemType: r.item_type,
    itemLabel:
      r.item_type === 'ALL'
        ? 'Semua Pos Biaya'
        : FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] || r.item_type,
    academicYearName: r.academic_year_name,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    reason: r.reason,
    notes: r.notes,
    status: r.status,
    totalExemptedAmount: r.total_exempted_amount,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
    revokedByName: r.revoked_by_name,
    revocationReason: r.revocation_reason,
  }))

  const totalRecords = (kpiRow?.active_count || 0) + (kpiRow?.revoked_count || 0)

  return {
    items,
    kpi: {
      activeExemptionsCount: kpiRow?.active_count || 0,
      revokedExemptionsCount: kpiRow?.revoked_count || 0,
      uniqueStudentsCount: kpiRow?.unique_students || 0,
      totalNominalExempted: kpiRow?.total_exempted || 0,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * 5. LAPORAN DETAIL PER SANTRI (Authoritative Financial Statement)
 */
export async function getStudentDetailReport(
  filters: StudentDetailReportFilter
): Promise<StudentDetailReportResponse> {
  let targetSantriId = filters.santriId

  // Jika tidak diberikan santriId spesifik, ambil santri aktif pertama
  if (!targetSantriId) {
    const firstSantri = await queryOne<{ id: string }>(
      "SELECT id FROM santri WHERE status_global = 'aktif' ORDER BY nama_lengkap ASC LIMIT 1"
    )
    if (!firstSantri) {
      return {
        student: null,
        obligations: [],
        payments: [],
        walletMutations: [],
        summary: {
          totalExpected: 0,
          totalExempted: 0,
          totalPaid: 0,
          totalRemaining: 0,
          walletTotalIn: 0,
          walletTotalOut: 0,
          walletBalance: 0,
        },
      }
    }
    targetSantriId = firstSantri.id
  }

  // 1. Data Profil Santri & VA
  const student = await queryOne<{
    id: string
    nis: string
    nama: string
    asrama: string | null
    kamar: string | null
    kelas: string | null
    no_wa_ortu: string | null
    fixed_va: string | null
    bank_code: string | null
    parent_daily_limit: number | null
  }>(
    `SELECT
       s.id,
       s.nis,
       s.nama_lengkap AS nama,
       s.asrama,
       s.kamar,
       COALESCE(k.nama_kelas, s.kelas_sekolah) AS kelas,
       s.no_wa_ortu,
       sva.va_number AS fixed_va,
       sva.bank_code,
       fwl.parent_daily_limit
     FROM santri s
     LEFT JOIN finance_student_va sva ON sva.santri_id = s.id
     LEFT JOIN finance_wallet_limits fwl ON fwl.santri_id = s.id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE s.id = ?`,
    [targetSantriId]
  )

  if (!student) {
    return {
      student: null,
      obligations: [],
      payments: [],
      walletMutations: [],
      summary: {
        totalExpected: 0,
        totalExempted: 0,
        totalPaid: 0,
        totalRemaining: 0,
        walletTotalIn: 0,
        walletTotalOut: 0,
        walletBalance: 0,
      },
    }
  }

  // 2. Data Kewajiban (Authoritative: obligations + active allocations)
  const obConditions: string[] = ['fo.santri_id = ?']
  const obParams: unknown[] = [targetSantriId]

  if (filters.academicYearId) {
    obConditions.push('fo.academic_year_id = ?')
    obParams.push(filters.academicYearId)
  }
  if (filters.period) {
    obConditions.push('fo.period = ?')
    obParams.push(filters.period)
  }

  const netPaidExpr = `(CASE WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) > 0 THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) ELSE 0 END)`
  const remainingExpr = `((fo.amount_expected - fo.amount_exempted) - ${netPaidExpr})`

  const obRows = await query<{
    id: string
    period: string
    item_type: string
    amount_expected: number
    amount_exempted: number
    actual_paid: number
    remaining: number
    status: string
  }>(
    `SELECT
       fo.id,
       fo.period,
       fo.item_type,
       fo.amount_expected,
       fo.amount_exempted,
       ${netPaidExpr} AS actual_paid,
       ${remainingExpr} AS remaining,
       fo.status
     FROM finance_obligations fo
     LEFT JOIN (
       SELECT fa.obligation_id, SUM(fa.amount) AS gross_paid
       FROM finance_allocations fa
       JOIN finance_payments fp ON fp.id = fa.payment_id
       WHERE fa.obligation_id IS NOT NULL
         AND fp.status IN ('PAID', 'SETTLED')
       GROUP BY fa.obligation_id
     ) alloc ON alloc.obligation_id = fo.id
     LEFT JOIN (
       SELECT fci.obligation_id, SUM(fci.amount) AS total_corrected
       FROM finance_correction_items fci
       WHERE fci.obligation_id IS NOT NULL
       GROUP BY fci.obligation_id
     ) corr ON corr.obligation_id = fo.id
     WHERE ${obConditions.join(' AND ')}
     ORDER BY fo.period DESC, fo.item_type ASC`,
    obParams
  )

  const obligations: StudentDetailObligationRow[] = obRows.map((r) => {
    const netPaid = Math.max(0, r.actual_paid)
    const netRemaining = Math.max(0, r.remaining)
    return {
      id: r.id,
      period: r.period,
      itemType: r.item_type,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] || r.item_type,
      amountExpected: r.amount_expected,
      amountExempted: r.amount_exempted,
      amountPaid: netPaid,
      remaining: netRemaining,
      status: netRemaining <= 0 ? 'PAID' : netPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    }
  })

  // 3. Data Riwayat Pembayaran (finance_payments + allocations summary)
  const pRows = await query<{
    id: string
    payment_number: string
    paid_at: string
    method: string
    gross_amount: number
    net_amount: number
    status: string
    allocations_summary: string | null
  }>(
    `SELECT
       fp.id,
       fp.payment_number,
       fp.paid_at,
       fp.method,
       fp.gross_amount,
       fp.net_amount,
       fp.status,
       (
         SELECT GROUP_CONCAT(fa.item_type || ': Rp' || fa.amount, ', ')
         FROM finance_allocations fa
         WHERE fa.payment_id = fp.id
       ) AS allocations_summary
     FROM finance_payments fp
     WHERE fp.santri_id = ?
     ORDER BY fp.paid_at DESC
     LIMIT 50`,
    [targetSantriId]
  )

  const payments: StudentDetailPaymentRow[] = pRows.map((r) => ({
    id: r.id,
    paymentNumber: r.payment_number,
    paidAt: r.paid_at,
    method: r.method,
    grossAmount: r.gross_amount,
    netAmount: r.net_amount,
    allocationsSummary: r.allocations_summary || 'Uang Jajan / Standalone',
    status: r.status,
  }))

  // 4. Data Mutasi Uang Jajan & Authoritative Balance (SUM IN - SUM OUT)
  const walletRows = await query<{
    id: string
    created_at: string
    movement_type: string
    direction: 'IN' | 'OUT'
    amount: number
    balance_after: number
    operator_name: string | null
    notes: string | null
  }>(
    `SELECT
       fwl.id,
       fwl.created_at,
       fwl.movement_type,
       fwl.direction,
       fwl.amount,
       fwl.balance_after,
       u.full_name AS operator_name,
       fwl.notes
     FROM finance_wallet_ledger fwl
     LEFT JOIN users u ON u.id = fwl.operator_id
     WHERE fwl.santri_id = ?
     ORDER BY fwl.created_at DESC
     LIMIT 50`,
    [targetSantriId]
  )

  const walletMutations: StudentDetailWalletRow[] = walletRows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    movementType: r.movement_type,
    direction: r.direction,
    amount: r.amount,
    balanceAfter: r.balance_after,
    operatorName: r.operator_name,
    notes: r.notes,
  }))

  const walletKpi = await queryOne<{
    total_in: number
    total_out: number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out
     FROM finance_wallet_ledger
     WHERE santri_id = ?`,
    [targetSantriId]
  )

  const walletTotalIn = walletKpi?.total_in || 0
  const walletTotalOut = walletKpi?.total_out || 0
  const walletBalance = walletTotalIn - walletTotalOut

  // Totals
  const totalExpected = obligations.reduce((acc, curr) => acc + curr.amountExpected, 0)
  const totalExempted = obligations.reduce((acc, curr) => acc + curr.amountExempted, 0)
  const totalPaid = obligations.reduce((acc, curr) => acc + curr.amountPaid, 0)
  const totalRemaining = obligations.reduce((acc, curr) => acc + curr.remaining, 0)

  return {
    student: {
      id: student.id,
      nis: student.nis,
      nama: student.nama,
      asrama: student.asrama,
      kamar: student.kamar,
      kelas: student.kelas,
      noWaOrtu: student.no_wa_ortu,
      fixedVa: student.fixed_va,
      bankCode: student.bank_code,
      parentDailyLimit: student.parent_daily_limit,
      walletBalance,
    },
    obligations,
    payments,
    walletMutations,
    summary: {
      totalExpected,
      totalExempted,
      totalPaid,
      totalRemaining,
      walletTotalIn,
      walletTotalOut,
      walletBalance,
    },
  }
}

/**
 * 6. LAPORAN UANG JAJAN (Authoritative: finance_wallet_ledger SUM(IN) - SUM(OUT))
 */
export async function getWalletReport(
  filters: WalletReportFilter
): Promise<WalletReportResponse> {
  const mode = filters.mode || 'SUMMARY'
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  // KPI Utama (Total In, Total Out, Saldo Berjalan Keseluruhan)
  const kpiRow = await queryOne<{
    total_in: number
    total_out: number
    total_mutations: number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
       COUNT(*) AS total_mutations
     FROM finance_wallet_ledger`
  )

  const totalDepositIn = kpiRow?.total_in || 0
  const totalWithdrawalOut = kpiRow?.total_out || 0
  const totalCurrentBalance = totalDepositIn - totalWithdrawalOut
  const totalMutationsCount = kpiRow?.total_mutations || 0

  if (mode === 'SUMMARY') {
    // Mode Rekap Saldo Per Santri
    const conditions: string[] = ["s.status_global = 'aktif'"]
    const params: unknown[] = []

    if (filters.asrama && filters.asrama !== 'ALL') {
      conditions.push('s.asrama = ?')
      params.push(filters.asrama)
    }
    if (filters.kelas && filters.kelas !== 'ALL') {
      conditions.push('(k.nama_kelas = ? OR s.kelas_sekolah = ?)')
      params.push(filters.kelas, filters.kelas)
    }
    if (filters.santriId) {
      conditions.push('s.id = ?')
      params.push(filters.santriId)
    }
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`
      conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
      params.push(term, term)
    }

    const whereSql = conditions.join(' AND ')

    const countRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE ${whereSql}`,
      params
    )
    const totalRecords = countRow?.count || 0

    const rows = await query<{
      santri_id: string
      santri_name: string
      santri_nis: string
      santri_asrama: string | null
      santri_kelas: string | null
      total_in: number
      total_out: number
      parent_daily_limit: number | null
      card_code: string | null
      card_status: string | null
    }>(
      `SELECT
         s.id AS santri_id,
         s.nama_lengkap AS santri_name,
         s.nis AS santri_nis,
         s.asrama AS santri_asrama,
         COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
         COALESCE(wl.total_in, 0) AS total_in,
         COALESCE(wl.total_out, 0) AS total_out,
         flim.parent_daily_limit,
         fc.card_token AS card_code,
         fc.status AS card_status
       FROM santri s
       LEFT JOIN (
         SELECT
           santri_id,
           SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) AS total_in,
           SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) AS total_out
         FROM finance_wallet_ledger
         GROUP BY santri_id
       ) wl ON wl.santri_id = s.id
       LEFT JOIN finance_wallet_limits flim ON flim.santri_id = s.id
       LEFT JOIN finance_credentials fc ON fc.santri_id = s.id AND fc.status = 'ACTIVE'
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE ${whereSql}
       ORDER BY s.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    const summaryItems: WalletSummaryRow[] = rows.map((r) => ({
      santriId: r.santri_id,
      santriName: r.santri_name,
      santriNis: r.santri_nis,
      santriAsrama: r.santri_asrama,
      santriKelas: r.santri_kelas,
      totalIn: r.total_in,
      totalOut: r.total_out,
      currentBalance: r.total_in - r.total_out,
      parentDailyLimit: r.parent_daily_limit,
      effectiveDailyLimit: r.parent_daily_limit ?? 50000,
      activeCardCode: r.card_code,
      activeCardStatus: r.card_status,
    }))

    return {
      mode: 'SUMMARY',
      summaryItems,
      kpi: {
        totalDepositIn,
        totalWithdrawalOut,
        totalCurrentBalance,
        totalMutationsCount,
      },
      pagination: {
        currentPage: page,
        pageSize,
        totalRecords,
        totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
      },
    }
  } else {
    // Mode Buku Besar Mutasi (Jurnal)
    const conditions: string[] = ['1 = 1']
    const params: unknown[] = []

    if (filters.startDate) {
      conditions.push('fwl.created_at >= ?')
      params.push(`${filters.startDate} 00:00:00`)
    }
    if (filters.endDate) {
      conditions.push('fwl.created_at <= ?')
      params.push(`${filters.endDate} 23:59:59`)
    }
    if (filters.movementType && filters.movementType !== 'ALL') {
      conditions.push('fwl.movement_type = ?')
      params.push(filters.movementType)
    }
    if (filters.direction && filters.direction !== 'ALL') {
      conditions.push('fwl.direction = ?')
      params.push(filters.direction)
    }
    if (filters.asrama && filters.asrama !== 'ALL') {
      conditions.push('s.asrama = ?')
      params.push(filters.asrama)
    }
    if (filters.kelas && filters.kelas !== 'ALL') {
      conditions.push('(k.nama_kelas = ? OR s.kelas_sekolah = ?)')
      params.push(filters.kelas, filters.kelas)
    }
    if (filters.santriId) {
      conditions.push('fwl.santri_id = ?')
      params.push(filters.santriId)
    }
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`
      conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ? OR fwl.notes LIKE ?)')
      params.push(term, term, term)
    }

    const whereSql = conditions.join(' AND ')

    const countRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM finance_wallet_ledger fwl
       JOIN santri s ON s.id = fwl.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE ${whereSql}`,
      params
    )
    const totalRecords = countRow?.count || 0

    const rows = await query<{
      id: string
      created_at: string
      santri_id: string
      santri_name: string
      santri_nis: string
      santri_asrama: string | null
      santri_kelas: string | null
      movement_type: string
      direction: 'IN' | 'OUT'
      amount: number
      balance_before: number
      balance_after: number
      operator_name: string | null
      cash_session_code: string | null
      notes: string | null
    }>(
      `SELECT
         fwl.id,
         fwl.created_at,
         fwl.santri_id,
         s.nama_lengkap AS santri_name,
         s.nis AS santri_nis,
         s.asrama AS santri_asrama,
         COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
         fwl.movement_type,
         fwl.direction,
         fwl.amount,
         fwl.balance_before,
         fwl.balance_after,
         u.full_name AS operator_name,
         fcs.session_code AS cash_session_code,
         fwl.notes
       FROM finance_wallet_ledger fwl
       JOIN santri s ON s.id = fwl.santri_id
       LEFT JOIN users u ON u.id = fwl.operator_id
       LEFT JOIN finance_cash_sessions fcs ON fcs.id = fwl.cash_session_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE ${whereSql}
       ORDER BY fwl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    const mutationItems: WalletMutationRow[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      santriId: r.santri_id,
      santriName: r.santri_name,
      santriNis: r.santri_nis,
      santriAsrama: r.santri_asrama,
      santriKelas: r.santri_kelas,
      movementType: r.movement_type,
      direction: r.direction,
      amount: r.amount,
      balanceBefore: r.balance_before,
      balanceAfter: r.balance_after,
      operatorName: r.operator_name,
      cashSessionCode: r.cash_session_code,
      notes: r.notes,
    }))

    return {
      mode: 'MUTATION',
      mutationItems,
      kpi: {
        totalDepositIn,
        totalWithdrawalOut,
        totalCurrentBalance,
        totalMutationsCount,
      },
      pagination: {
        currentPage: page,
        pageSize,
        totalRecords,
        totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
      },
    }
  }
}

/**
 * 7. LAPORAN TRANSAKSI LOKET (Authoritative: finance_cash_sessions + cash movements)
 */
export async function getCashSessionsReport(
  filters: CashSessionsReportFilter
): Promise<CashSessionsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  // Invariant authoritatif Rekonstruksi Kas Loket (PRD #23 & Fase 10):
  // 1. Cash In = Pembayaran Tagihan Tunai (finance_payments status='PAID' channel='CASH')
  //             + Top-up Kasir (finance_wallet_ledger movement_type='TOPUP_CASH' direction='IN')
  // 2. Cash Out = Tarik Tunai Uang Jajan (finance_wallet_ledger movement_type='WITHDRAWAL_LOKET' direction='OUT')
  //              + Refund / Koreksi Kasir (finance_corrections method='CASH')
  // 3. Expected Closing = Opening Balance + Cash In - Cash Out
  // 4. Difference = Actual Closing - Expected Closing (bila actual_closing_balance IS NOT NULL)
  const authCashInExpr = `(COALESCE(c_pay.amount, 0) + COALESCE(c_top.amount, 0))`
  const authCashOutExpr = `(COALESCE(c_wit.amount, 0) + COALESCE(c_ref.amount, 0))`
  const authExpectedExpr = `(fcs.opening_balance + ${authCashInExpr} - ${authCashOutExpr})`
  const authDiffExpr = `(CASE WHEN fcs.actual_closing_balance IS NOT NULL THEN (fcs.actual_closing_balance - ${authExpectedExpr}) ELSE NULL END)`

  const cashJoins = `
    LEFT JOIN (
      SELECT cash_session_id, COUNT(*) AS count, SUM(gross_amount) AS amount
      FROM finance_payments
      WHERE channel = 'CASH' AND status = 'PAID' AND cash_session_id IS NOT NULL
      GROUP BY cash_session_id
    ) c_pay ON c_pay.cash_session_id = fcs.id
    LEFT JOIN (
      SELECT cash_session_id, COUNT(*) AS count, SUM(amount) AS amount
      FROM finance_wallet_ledger
      WHERE direction = 'IN' AND movement_type = 'TOPUP_CASH' AND cash_session_id IS NOT NULL
      GROUP BY cash_session_id
    ) c_top ON c_top.cash_session_id = fcs.id
    LEFT JOIN (
      SELECT cash_session_id, COUNT(*) AS count, SUM(amount) AS amount
      FROM finance_wallet_ledger
      WHERE direction = 'OUT' AND movement_type = 'WITHDRAWAL_LOKET' AND cash_session_id IS NOT NULL
      GROUP BY cash_session_id
    ) c_wit ON c_wit.cash_session_id = fcs.id
    LEFT JOIN (
      SELECT cash_session_id, COUNT(*) AS count, SUM(total_amount) AS amount
      FROM finance_corrections
      WHERE method = 'CASH' AND cash_session_id IS NOT NULL
      GROUP BY cash_session_id
    ) c_ref ON c_ref.cash_session_id = fcs.id
  `

  const conditions: string[] = ['1 = 1']
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('fcs.opened_at >= ?')
    params.push(`${filters.startDate} 00:00:00`)
  }
  if (filters.endDate) {
    conditions.push('fcs.opened_at <= ?')
    params.push(`${filters.endDate} 23:59:59`)
  }
  if (filters.operatorId && filters.operatorId !== 'ALL') {
    conditions.push('fcs.operator_id = ?')
    params.push(filters.operatorId)
  }
  if (filters.status && filters.status !== 'ALL') {
    conditions.push('fcs.status = ?')
    params.push(filters.status)
  }
  if (filters.discrepancyOnly) {
    conditions.push(`(fcs.actual_closing_balance IS NOT NULL AND ${authDiffExpr} != 0)`)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push('(fcs.session_code LIKE ? OR u.full_name LIKE ? OR fcs.difference_notes LIKE ?)')
    params.push(term, term, term)
  }

  const whereSql = conditions.join(' AND ')

  // Total KPI
  const kpiRow = await queryOne<{
    total_sessions: number
    total_cash_in: number
    total_cash_out: number
    total_difference: number
    discrepancy_count: number
  }>(
    `SELECT
       COUNT(*) AS total_sessions,
       COALESCE(SUM(${authCashInExpr}), 0) AS total_cash_in,
       COALESCE(SUM(${authCashOutExpr}), 0) AS total_cash_out,
       COALESCE(SUM(${authDiffExpr}), 0) AS total_difference,
       COALESCE(SUM(CASE WHEN ${authDiffExpr} != 0 AND ${authDiffExpr} IS NOT NULL THEN 1 ELSE 0 END), 0) AS discrepancy_count
     FROM finance_cash_sessions fcs
     LEFT JOIN users u ON u.id = fcs.operator_id
     ${cashJoins}
     WHERE ${whereSql}`,
    params
  )

  const rows = await query<{
    id: string
    session_code: string
    operator_name: string
    opened_at: string
    closed_at: string | null
    opening_balance: number
    total_cash_in: number
    total_cash_out: number
    expected_closing_balance: number
    actual_closing_balance: number | null
    difference: number | null
    difference_notes: string | null
    status: 'OPEN' | 'CLOSED'
    payments_count: number
    payments_amount: number
    withdrawals_count: number
    withdrawals_amount: number
    topups_count: number
    topups_amount: number
    refunds_count: number
    refunds_amount: number
  }>(
    `SELECT
       fcs.id,
       fcs.session_code,
       COALESCE(u.full_name, 'Kasir') AS operator_name,
       fcs.opened_at,
       fcs.closed_at,
       fcs.opening_balance,
       ${authCashInExpr} AS total_cash_in,
       ${authCashOutExpr} AS total_cash_out,
       ${authExpectedExpr} AS expected_closing_balance,
       fcs.actual_closing_balance,
       ${authDiffExpr} AS difference,
       fcs.difference_notes,
       fcs.status,
       COALESCE(c_pay.count, 0) AS payments_count,
       COALESCE(c_pay.amount, 0) AS payments_amount,
       COALESCE(c_wit.count, 0) AS withdrawals_count,
       COALESCE(c_wit.amount, 0) AS withdrawals_amount,
       COALESCE(c_top.count, 0) AS topups_count,
       COALESCE(c_top.amount, 0) AS topups_amount,
       COALESCE(c_ref.count, 0) AS refunds_count,
       COALESCE(c_ref.amount, 0) AS refunds_amount
     FROM finance_cash_sessions fcs
     LEFT JOIN users u ON u.id = fcs.operator_id
     ${cashJoins}
     WHERE ${whereSql}
     ORDER BY fcs.opened_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: CashSessionItemRow[] = rows.map((r) => ({
    id: r.id,
    sessionCode: r.session_code,
    operatorName: r.operator_name,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    openingBalance: r.opening_balance,
    totalCashIn: r.total_cash_in,
    totalCashOut: r.total_cash_out,
    expectedClosingBalance: r.expected_closing_balance,
    actualClosingBalance: r.actual_closing_balance,
    difference: r.difference,
    differenceNotes: r.difference_notes,
    status: r.status,
    paymentsCount: r.payments_count,
    paymentsAmount: r.payments_amount,
    withdrawalsCount: r.withdrawals_count,
    withdrawalsAmount: r.withdrawals_amount,
    topupsCount: r.topups_count,
    topupsAmount: r.topups_amount,
    refundsCount: r.refunds_count,
    refundsAmount: r.refunds_amount,
  }))

  const totalRecords = kpiRow?.total_sessions || 0

  return {
    items,
    kpi: {
      totalSessionsCount: totalRecords,
      totalCashInAllSessions: kpiRow?.total_cash_in || 0,
      totalCashOutAllSessions: kpiRow?.total_cash_out || 0,
      totalDifference: kpiRow?.total_difference || 0,
      discrepancySessionsCount: kpiRow?.discrepancy_count || 0,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * Mengambil rincian detail seluruh transaksi kas fisik dalam sebuah sesi kas
 * (pembayaran tunai, setoran top-up kasir, penarikan tunai, dan refund/koreksi kasir)
 * secara terpisah tanpa risiko double-counting.
 */
export async function getCashSessionDetailReport(
  sessionId: string
): Promise<CashSessionDetailReportResponse | null> {
  const sessionRes = await queryOne<{
    id: string
    session_code: string
    operator_name: string
    opened_at: string
    closed_at: string | null
    opening_balance: number
    actual_closing_balance: number | null
    difference_notes: string | null
    status: 'OPEN' | 'CLOSED'
  }>(
    `SELECT
       fcs.id,
       fcs.session_code,
       COALESCE(u.full_name, 'Kasir') AS operator_name,
       fcs.opened_at,
       fcs.closed_at,
       fcs.opening_balance,
       fcs.actual_closing_balance,
       fcs.difference_notes,
       fcs.status
     FROM finance_cash_sessions fcs
     LEFT JOIN users u ON u.id = fcs.operator_id
     WHERE fcs.id = ?`,
    [sessionId]
  )

  if (!sessionRes) return null

  // 1. Cash Payments (SPP, dsb.)
  const cashPayments = await query<{
    id: string
    payment_number: string
    paid_at: string
    santri_name: string
    nis: string
    gross_amount: number
    method: string
  }>(
    `SELECT
       fp.id,
       fp.payment_number,
       fp.paid_at,
       COALESCE(s.nama_lengkap, '-') AS santri_name,
       COALESCE(s.nis, '-') AS nis,
       fp.gross_amount,
       fp.method
     FROM finance_payments fp
     LEFT JOIN santri s ON s.id = fp.santri_id
     WHERE fp.cash_session_id = ? AND fp.channel = 'CASH' AND fp.status = 'PAID'
     ORDER BY fp.paid_at ASC`,
    [sessionId]
  )

  // 2. Cash Top-ups
  const cashTopups = await query<{
    id: string
    created_at: string
    santri_name: string
    nis: string
    amount: number
    notes: string | null
  }>(
    `SELECT
       fwl.id,
       fwl.created_at,
       COALESCE(s.nama_lengkap, '-') AS santri_name,
       COALESCE(s.nis, '-') AS nis,
       fwl.amount,
       fwl.notes
     FROM finance_wallet_ledger fwl
     LEFT JOIN santri s ON s.id = fwl.santri_id
     WHERE fwl.cash_session_id = ? AND fwl.direction = 'IN' AND fwl.movement_type = 'TOPUP_CASH'
     ORDER BY fwl.created_at ASC`,
    [sessionId]
  )

  // 3. Cash Withdrawals
  const cashWithdrawals = await query<{
    id: string
    created_at: string
    santri_name: string
    nis: string
    amount: number
    notes: string | null
  }>(
    `SELECT
       fwl.id,
       fwl.created_at,
       COALESCE(s.nama_lengkap, '-') AS santri_name,
       COALESCE(s.nis, '-') AS nis,
       fwl.amount,
       fwl.notes
     FROM finance_wallet_ledger fwl
     LEFT JOIN santri s ON s.id = fwl.santri_id
     WHERE fwl.cash_session_id = ? AND fwl.direction = 'OUT' AND fwl.movement_type = 'WITHDRAWAL_LOKET'
     ORDER BY fwl.created_at ASC`,
    [sessionId]
  )

  // 4. Cash Refunds / Corrections
  const cashRefunds = await query<{
    id: string
    correction_number: string
    created_at: string
    correction_type: string
    amount: number
    reason: string
  }>(
    `SELECT
       fc.id,
       fc.correction_number,
       fc.created_at,
       fc.correction_type,
       fc.total_amount AS amount,
       fc.reason
     FROM finance_corrections fc
     WHERE fc.cash_session_id = ? AND fc.method = 'CASH'
     ORDER BY fc.created_at ASC`,
    [sessionId]
  )

  const cashPaymentsIn = cashPayments.reduce((acc, curr) => acc + curr.gross_amount, 0)
  const cashTopupsIn = cashTopups.reduce((acc, curr) => acc + curr.amount, 0)
  const totalCashIn = cashPaymentsIn + cashTopupsIn

  const cashWithdrawalsOut = cashWithdrawals.reduce((acc, curr) => acc + curr.amount, 0)
  const cashRefundsOut = cashRefunds.reduce((acc, curr) => acc + curr.amount, 0)
  const totalCashOut = cashWithdrawalsOut + cashRefundsOut

  const expectedClosingBalance = sessionRes.opening_balance + totalCashIn - totalCashOut
  const difference = sessionRes.actual_closing_balance !== null
    ? sessionRes.actual_closing_balance - expectedClosingBalance
    : null

  const sessionRow: CashSessionItemRow = {
    id: sessionRes.id,
    sessionCode: sessionRes.session_code,
    operatorName: sessionRes.operator_name,
    openedAt: sessionRes.opened_at,
    closedAt: sessionRes.closed_at,
    openingBalance: sessionRes.opening_balance,
    totalCashIn,
    totalCashOut,
    expectedClosingBalance,
    actualClosingBalance: sessionRes.actual_closing_balance,
    difference,
    differenceNotes: sessionRes.difference_notes,
    status: sessionRes.status,
    paymentsCount: cashPayments.length,
    paymentsAmount: cashPaymentsIn,
    withdrawalsCount: cashWithdrawals.length,
    withdrawalsAmount: cashWithdrawalsOut,
    topupsCount: cashTopups.length,
    topupsAmount: cashTopupsIn,
    refundsCount: cashRefunds.length,
    refundsAmount: cashRefundsOut,
  }

  return {
    session: sessionRow,
    cashPayments: cashPayments.map((p) => ({
      id: p.id,
      paymentNumber: p.payment_number,
      paidAt: p.paid_at,
      santriName: p.santri_name,
      nis: p.nis,
      grossAmount: p.gross_amount,
      method: p.method,
    })),
    cashTopups: cashTopups.map((t) => ({
      id: t.id,
      createdAt: t.created_at,
      santriName: t.santri_name,
      nis: t.nis,
      amount: t.amount,
      notes: t.notes,
    })),
    cashWithdrawals: cashWithdrawals.map((w) => ({
      id: w.id,
      createdAt: w.created_at,
      santriName: w.santri_name,
      nis: w.nis,
      amount: w.amount,
      notes: w.notes,
    })),
    cashRefunds: cashRefunds.map((r) => ({
      id: r.id,
      correctionNumber: r.correction_number,
      createdAt: r.created_at,
      correctionType: r.correction_type,
      amount: r.amount,
      reason: r.reason,
    })),
    authoritativeSummary: {
      openingBalance: sessionRes.opening_balance,
      cashPaymentsIn,
      cashTopupsIn,
      totalCashIn,
      cashWithdrawalsOut,
      cashRefundsOut,
      totalCashOut,
      expectedClosingBalance,
      actualClosingBalance: sessionRes.actual_closing_balance,
      difference,
    },
  }
}

/**
 * 8. LAPORAN SETTLEMENT (Authoritative: finance_settlements + items)
 */
export async function getSettlementsReport(
  filters: SettlementsReportFilter
): Promise<SettlementsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['1 = 1']
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('fs.settlement_date >= ?')
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push('fs.settlement_date <= ?')
    params.push(filters.endDate)
  }
  if (filters.status && filters.status !== 'ALL') {
    conditions.push('fs.status = ?')
    params.push(filters.status)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push('(fs.settlement_number LIKE ? OR fs.destination_bank LIKE ? OR fs.destination_account LIKE ?)')
    params.push(term, term, term)
  }

  const whereSql = conditions.join(' AND ')

  // KPI
  const kpiRow = await queryOne<{
    total_gross: number
    total_fee: number
    total_net: number
    total_batches: number
  }>(
    `SELECT
       COALESCE(SUM(fs.total_gross_amount), 0) AS total_gross,
       COALESCE(SUM(fs.total_fee_amount), 0) AS total_fee,
       COALESCE(SUM(fs.total_net_amount), 0) AS total_net,
       COUNT(*) AS total_batches
     FROM finance_settlements fs
     WHERE ${whereSql}`,
    params
  )

  const rows = await query<{
    id: string
    settlement_number: string
    settlement_date: string
    destination_bank: string
    destination_account: string
    total_payments_count: number
    total_gross_amount: number
    total_fee_amount: number
    total_net_amount: number
    status: string
    notes: string | null
    verifier_name: string | null
    created_at: string
  }>(
    `SELECT
       fs.id,
       fs.settlement_number,
       fs.settlement_date,
       fs.destination_bank,
       fs.destination_account,
       fs.total_payments_count,
       fs.total_gross_amount,
       fs.total_fee_amount,
       fs.total_net_amount,
       fs.status,
       fs.notes,
       u.full_name AS verifier_name,
       fs.created_at
     FROM finance_settlements fs
     LEFT JOIN users u ON u.id = fs.verified_by
     WHERE ${whereSql}
     ORDER BY fs.settlement_date DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: SettlementItemRow[] = rows.map((r) => ({
    id: r.id,
    settlementNumber: r.settlement_number,
    settlementDate: r.settlement_date,
    destinationBank: r.destination_bank,
    destinationAccount: r.destination_account,
    accountHolderName: 'Pondok Pesantren Eskahade',
    itemCount: r.total_payments_count,
    grossAmount: r.total_gross_amount,
    totalFee: r.total_fee_amount,
    netAmount: r.total_net_amount,
    status: r.status,
    bankReference: r.notes,
    createdByName: r.verifier_name,
    createdAt: r.created_at,
    itemsPreview: `${r.total_payments_count} pembayaran Duitku`,
  }))

  const totalRecords = kpiRow?.total_batches || 0

  return {
    items,
    kpi: {
      totalGrossSettled: kpiRow?.total_gross || 0,
      totalFeeDeducted: kpiRow?.total_fee || 0,
      totalNetReceived: kpiRow?.total_net || 0,
      totalSettlementBatches: totalRecords,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * 9. LAPORAN REKONSILIASI (Authoritative: finance_reconciliations + items)
 */
export async function getReconciliationsReport(
  filters: ReconciliationsReportFilter
): Promise<ReconciliationsReportResponse> {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25))
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['1 = 1']
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('fri.created_at >= ?')
    params.push(`${filters.startDate} 00:00:00`)
  }
  if (filters.endDate) {
    conditions.push('fri.created_at <= ?')
    params.push(`${filters.endDate} 23:59:59`)
  }
  if (filters.matchStatus && filters.matchStatus !== 'ALL') {
    conditions.push('fri.match_status = ?')
    params.push(filters.matchStatus)
  }
  if (filters.resolutionAction && filters.resolutionAction !== 'ALL') {
    conditions.push('fri.resolution_action = ?')
    params.push(filters.resolutionAction)
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    conditions.push('(fri.external_reference LIKE ? OR fri.resolution_notes LIKE ? OR s.nama_lengkap LIKE ?)')
    params.push(term, term, term)
  }

  const whereSql = conditions.join(' AND ')

  // KPI Calculation
  const kpiRow = await queryOne<{
    matched_count: number
    discrepancy_count: number
    total_discrepancy_amount: number
    resolved_count: number
    total_count: number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN fri.match_status = 'MATCHED' THEN 1 ELSE 0 END), 0) AS matched_count,
       COALESCE(SUM(CASE WHEN fri.match_status != 'MATCHED' THEN 1 ELSE 0 END), 0) AS discrepancy_count,
       COALESCE(SUM(fri.discrepancy_amount), 0) AS total_discrepancy_amount,
       COALESCE(SUM(CASE WHEN fri.resolution_action != 'NONE' THEN 1 ELSE 0 END), 0) AS resolved_count,
       COUNT(*) AS total_count
     FROM finance_reconciliation_items fri
     LEFT JOIN finance_payments fp ON fp.id = fri.payment_id
     LEFT JOIN santri s ON s.id = fp.santri_id
     WHERE ${whereSql}`,
    params
  )

  const rows = await query<{
    id: string
    reconciliation_id: string | null
    created_at: string
    match_status: string
    external_reference: string | null
    internal_amount: number
    external_amount: number
    discrepancy_amount: number
    resolution_action: string
    resolution_notes: string | null
    resolved_by_name: string | null
    resolved_at: string | null
    payment_number: string | null
    santri_name: string | null
  }>(
    `SELECT
       fri.id,
       fri.reconciliation_id,
       fri.created_at,
       fri.match_status,
       fri.external_reference,
       fri.internal_amount,
       fri.external_amount,
       fri.discrepancy_amount,
       fri.resolution_action,
       fri.resolution_notes,
       u.full_name AS resolved_by_name,
       fri.resolved_at,
       fp.payment_number,
       s.nama_lengkap AS santri_name
     FROM finance_reconciliation_items fri
     LEFT JOIN finance_payments fp ON fp.id = fri.payment_id
     LEFT JOIN santri s ON s.id = fp.santri_id
     LEFT JOIN users u ON u.id = fri.resolved_by
     WHERE ${whereSql}
     ORDER BY fri.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const items: ReconciliationReportRow[] = rows.map((r) => ({
    id: r.id,
    reconciliationId: r.reconciliation_id,
    createdAt: r.created_at,
    matchStatus: r.match_status,
    externalReference: r.external_reference,
    internalAmount: r.internal_amount,
    externalAmount: r.external_amount,
    discrepancyAmount: r.discrepancy_amount,
    resolutionAction: r.resolution_action,
    resolutionNotes: r.resolution_notes,
    resolvedByName: r.resolved_by_name,
    resolvedAt: r.resolved_at,
    paymentNumber: r.payment_number,
    santriName: r.santri_name,
  }))

  const totalRecords = kpiRow?.total_count || 0

  return {
    items,
    kpi: {
      totalMatchedItems: kpiRow?.matched_count || 0,
      totalDiscrepancyItems: kpiRow?.discrepancy_count || 0,
      totalDiscrepancyAmount: kpiRow?.total_discrepancy_amount || 0,
      totalResolvedItems: kpiRow?.resolved_count || 0,
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  }
}

/**
 * 10. FILTER OPTIONS HELPER (Master data untuk dropdown filter laporan)
 */
export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  const [asramaRows, kelasRows, taRows, operatorRows, providerRows, studentRows] =
    await Promise.all([
      query<{ asrama: string }>(
        "SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL AND asrama != '' ORDER BY asrama ASC"
      ),
      query<{ nama_kelas: string }>(
        "SELECT DISTINCT nama_kelas FROM kelas WHERE nama_kelas IS NOT NULL AND nama_kelas != '' ORDER BY nama_kelas ASC"
      ),
      query<{ id: number; nama: string; is_active: number }>(
        'SELECT id, nama, is_active FROM tahun_ajaran ORDER BY is_active DESC, nama DESC'
      ),
      query<{ id: string; full_name: string }>(
        "SELECT DISTINCT u.id, u.full_name FROM users u JOIN finance_cash_sessions fcs ON fcs.operator_id = u.id ORDER BY u.full_name ASC"
      ),
      query<{ id: string; nama_jasa: string; jenis: string }>(
        'SELECT id, nama_jasa, jenis FROM master_jasa ORDER BY nama_jasa ASC'
      ),
      query<{ id: string; nis: string; nama_lengkap: string; asrama: string | null; kelas_sekolah: string | null }>(
        "SELECT id, nis, nama_lengkap, asrama, kelas_sekolah FROM santri WHERE status_global = 'aktif' ORDER BY nama_lengkap ASC LIMIT 500"
      ),
    ])

  const itemTypes: Array<{ code: string; label: string }> = [
    { code: 'SPP', label: 'SPP (Iuran Bulanan)' },
    { code: 'UANG_MAKAN', label: 'Uang Makan' },
    { code: 'UANG_NYUCI', label: 'Uang Nyuci (Laundry)' },
    { code: 'USPP', label: 'USPP (Uang Pangkal Bangunan)' },
    { code: 'EHB', label: 'EHB (Evaluasi Hasil Belajar)' },
    { code: 'EKSKUL', label: 'Ekstrakurikuler' },
    { code: 'KESEHATAN', label: 'Iuran Kesehatan' },
  ]

  return {
    asramaList: asramaRows.map((r) => r.asrama),
    kelasList: kelasRows.map((r) => r.nama_kelas),
    academicYears: taRows.map((r) => ({
      id: r.id,
      name: r.nama,
      is_active: r.is_active === 1,
    })),
    itemTypes,
    operators: operatorRows.map((r) => ({
      id: r.id,
      name: r.full_name || 'Kasir',
    })),
    providers: providerRows.map((r) => ({
      id: r.id,
      name: r.nama_jasa,
      type: r.jenis,
    })),
    students: studentRows.map((r) => ({
      id: r.id,
      nis: r.nis,
      name: r.nama_lengkap,
      asrama: r.asrama,
      kelas: r.kelas_sekolah,
    })),
  }
}
