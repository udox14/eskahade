// lib/finance/dashboard.ts
// Modul Read Model: Dashboard & KPI Keuangan Eksekutif (Fase 9: PRD Bab 33)
// Menjamin pemisahan mutlak:
// 1. Kas Operasional Pesantren vs Dana Titipan Santri (Uang Jajan)
// 2. Pembayaran Online vs Tunai
// 3. Payment PAID vs SETTLED
// 4. Dana Siap Disalurkan vs Sudah Disalurkan vs Belum Disalurkan
// 5. Indikator Selisih / Mismatch Rekonsiliasi
// 6. Transaksi Terbaru & Tren Visual Relevan

import { query, queryOne } from '@/lib/db'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import { nonBillableSantriSqlPredicate, nonBillableItemSqlPredicate } from '@/lib/finance/non-billable-santri'

export interface PesantrenKpi {
  totalPenerimaan: number
  onlinePenerimaan: number
  cashPenerimaan: number
  settledAmount: number
  pendingSettlementAmount: number
  pendingSettlementCount: number
  readyToDisburse: number
  totalDisbursed: number
  undisbursedAmount: number
  totalTunggakan: number
  santriMenunggakCount: number
}

export interface UangJajanKpi {
  totalTitipanBalance: number
  topupPeriod: number
  topupOnline: number
  topupCash: number
  withdrawalPeriod: number
  activeStudentsWithBalance: number
  notice: string
}

export interface KasirActivityKpi {
  openSessionsCount: number
  todayCashIn: number
  todayCashOut: number
  expectedDrawerBalance: number
}

export interface ReconciliationMismatchKpi {
  totalMismatchCount: number
  unallocatedTransfersCount: number
  unallocatedTransfersAmount: number
  amountMismatchCount: number
  cashDiscrepanciesCount: number
  settlementDiscrepanciesCount: number
  pendingRecoveryCasesCount: number
  hasMismatch: boolean
}

export interface OperationalQueueKpi {
  pendingTransferVerificationsCount: number
  pendingTransferVerificationsAmount: number
  activeCollectiveBatchesCount: number
  activeCollectiveBatchesAmount: number
}

export interface FinanceDashboardKpi {
  pesantren: PesantrenKpi
  uangJajan: UangJajanKpi
  kasir: KasirActivityKpi
  mismatch: ReconciliationMismatchKpi
  operations: OperationalQueueKpi
}

export interface MonthlyTrendItem {
  month: string
  monthLabel: string
  penerimaanPesantren: number
  penyaluranDana: number
  uangJajanIn: number
}

export interface ChannelComposition {
  onlineAmount: number
  onlinePercentage: number
  cashAmount: number
  cashPercentage: number
  total: number
}

export interface ItemComposition {
  itemType: string
  itemLabel: string
  amount: number
  percentage: number
}

export interface RecentTransactionItem {
  id: string
  sourceTable: 'PAYMENT' | 'WALLET' | 'DISTRIBUTION' | 'CORRECTION'
  transactionNumber: string
  category: 'PAYMENT' | 'TOPUP' | 'WITHDRAWAL' | 'DISTRIBUTION' | 'CORRECTION'
  categoryLabel: string
  fundType: 'PESANTREN' | 'TITIPAN_SANTRI'
  direction: 'IN' | 'OUT'
  amount: number
  channel: string
  method: string
  status: string
  itemType: string | null
  itemLabel: string | null
  santriName: string | null
  santriNis: string | null
  santriAsrama: string | null
  santriKamar: string | null
  recipientInfo: string | null
  operatorName: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
}

export interface FinanceDashboardData {
  selectedPeriod: string
  periodList: Array<{ value: string; label: string }>
  kpi: FinanceDashboardKpi
  charts: {
    trends: MonthlyTrendItem[]
    channelComposition: ChannelComposition
    itemComposition: ItemComposition[]
  }
  recentTransactions: RecentTransactionItem[]
  generatedAt: string
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatPeriodLabel(period: string): string {
  const parts = period.split('-')
  if (parts.length === 2) {
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${BULAN_NAMES[monthIdx]} ${year}`
    }
  }
  return period
}

/**
 * Menghasilkan daftar 12 bulan terakhir sampai 2 bulan ke depan untuk filter periode
 */
export function generateDashboardPeriodList(): Array<{ value: string; label: string }> {
  const periods: Array<{ value: string; label: string }> = []
  const now = new Date()
  const baseYear = now.getFullYear()
  const baseMonth = now.getMonth() // 0-indexed

  // Ambil dari -11 bulan lalu sampai +1 bulan depan
  for (let offset = 1; offset >= -11; offset--) {
    const d = new Date(baseYear, baseMonth + offset, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const val = `${y}-${m}`
    periods.push({
      value: val,
      label: formatPeriodLabel(val),
    })
  }

  return periods
}

/**
 * Mengambil ringkasan eksekutif KPI Keuangan untuk periode yang dipilih.
 * Memisahkan kas pesantren secara mutlak dari uang jajan (titipan santri).
 */
export async function getExecutiveFinanceKpi(periodInput?: string): Promise<FinanceDashboardKpi> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const period = periodInput || currentMonth
  const periodPrefix = `${period}%`
  const todayPrefix = `${new Date().toISOString().slice(0, 10)}%`

  // Eksekusi seluruh KPI Kas Pesantren, Uang Jajan, Kasir, dan Mismatch secara paralel
  const [
    pesantrenRow,
    disbursedRow,
    readyDisburseRow,
    arrearsRow,
    walletBalanceRow,
    walletActivityRow,
    activeWalletStudentsRow,
    openSessionsRow,
    todayCashRow,
    mismatchRow,
    pendingTransferRow,
    activeCollectiveRow,
  ] = await Promise.all([
    // 1. KAS PESANTREN: Penerimaan (Online vs Tunai, Settled vs Pending Settlement)
    queryOne<{
      total_penerimaan: number
      online_penerimaan: number
      cash_penerimaan: number
      settled_amount: number
      pending_settlement_amount: number
      pending_settlement_count: number
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' THEN a.amount ELSE 0 END), 0) AS total_penerimaan,
         COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' AND p.channel IN ('BRI', 'TRANSFER') THEN a.amount ELSE 0 END), 0) AS online_penerimaan,
         COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' AND p.channel = 'CASH' THEN a.amount ELSE 0 END), 0) AS cash_penerimaan,
         COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' AND p.channel IN ('BRI', 'TRANSFER') AND p.status = 'SETTLED' THEN a.amount ELSE 0 END), 0) AS settled_amount,
         COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' AND p.channel IN ('BRI', 'TRANSFER') AND p.status = 'PAID' THEN a.amount ELSE 0 END), 0) AS pending_settlement_amount,
         COALESCE(COUNT(DISTINCT CASE WHEN p.fund_management = 'KOPERASI' AND p.channel IN ('BRI', 'TRANSFER') AND p.status = 'PAID' THEN p.id ELSE NULL END), 0) AS pending_settlement_count
       FROM finance_allocations a
       JOIN finance_payments p ON a.payment_id = p.id
       WHERE a.target_type = 'OBLIGATION'
         AND p.correction_status != 'FULLY_CORRECTED'
         AND p.paid_at LIKE ?`,
      [periodPrefix]
    ),

    // 2. KAS PESANTREN: Penyaluran (Dana Sudah Disalurkan vs Dana Siap Disalurkan di Pool)
    queryOne<{ total_disbursed: number }>(
      `SELECT COALESCE(SUM(di.amount), 0) AS total_disbursed
       FROM finance_distribution_items di
       JOIN finance_distributions d ON d.id = di.distribution_id
       WHERE d.transferred_at LIKE ?`,
      [periodPrefix]
    ),

    queryOne<{ ready_to_disburse: number }>(
      `SELECT COALESCE(SUM(
         a.amount - COALESCE((
           SELECT SUM(di.amount)
           FROM finance_distribution_items di
           WHERE di.allocation_id = a.id
         ), 0)
       ), 0) AS ready_to_disburse
       FROM finance_allocations a
       JOIN finance_payments p ON a.payment_id = p.id
       WHERE a.target_type = 'OBLIGATION'
         AND p.correction_status != 'FULLY_CORRECTED'
         AND p.fund_management = 'KOPERASI'
         AND a.amount > COALESCE((
           SELECT SUM(di.amount)
           FROM finance_distribution_items di
           WHERE di.allocation_id = a.id
         ), 0)`,
      []
    ),

    // 3. KAS PESANTREN: Tunggakan Kewajiban & Jumlah Santri Menunggak
    queryOne<{
      total_tunggakan: number
      santri_menunggak_count: number
    }>(
      `SELECT
         COALESCE(SUM(amount_expected - amount_exempted - amount_paid), 0) AS total_tunggakan,
         COUNT(DISTINCT santri_id) AS santri_menunggak_count
       FROM finance_obligations
       WHERE status IN ('UNPAID', 'PARTIALLY_PAID')
         AND (period <= ? OR period = 'LIFETIME')
         AND ${nonBillableSantriSqlPredicate(
           '(SELECT s.asrama FROM santri s WHERE s.id = finance_obligations.santri_id)'
         )}
         AND ${nonBillableItemSqlPredicate(
           '(SELECT s.asrama FROM santri s WHERE s.id = finance_obligations.santri_id)',
           '(SELECT s.kategori_santri FROM santri s WHERE s.id = finance_obligations.santri_id)',
           'finance_obligations.item_type'
         )}`,
      [period]
    ),

    // 4. DANA TITIPAN SANTRI (UANG JAJAN) — TERPISAH DARI KAS PESANTREN
    queryOne<{ total_balance: number }>(
      `SELECT COALESCE(SUM(CASE WHEN wl.direction = 'IN' THEN wl.amount ELSE -wl.amount END), 0) AS total_balance
       FROM finance_wallet_ledger wl
       JOIN santri s ON s.id = wl.santri_id
       WHERE ${nonBillableSantriSqlPredicate('s.asrama')}`,
      []
    ),

    queryOne<{
      topup_period: number
      topup_online: number
      topup_cash: number
      withdrawal_period: number
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN wl.direction = 'IN' AND wl.movement_type IN ('TOPUP_ONLINE', 'TOPUP_CASH', 'TOPUP_TRANSFER') THEN wl.amount ELSE 0 END), 0) AS topup_period,
         COALESCE(SUM(CASE WHEN wl.direction = 'IN' AND wl.movement_type IN ('TOPUP_ONLINE', 'TOPUP_TRANSFER') THEN wl.amount ELSE 0 END), 0) AS topup_online,
         COALESCE(SUM(CASE WHEN wl.direction = 'IN' AND wl.movement_type = 'TOPUP_CASH' THEN wl.amount ELSE 0 END), 0) AS topup_cash,
         COALESCE(SUM(CASE WHEN wl.direction = 'OUT' AND wl.movement_type IN ('WITHDRAWAL_LOKET', 'WITHDRAWAL_KOLEKTIF') THEN wl.amount WHEN wl.movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN' THEN -wl.amount ELSE 0 END), 0) AS withdrawal_period
       FROM finance_wallet_ledger wl
       JOIN santri s ON s.id = wl.santri_id
       WHERE wl.created_at LIKE ?
         AND ${nonBillableSantriSqlPredicate('s.asrama')}`,
      [periodPrefix]
    ),

    queryOne<{ active_count: number }>(
      `SELECT COUNT(DISTINCT wl.santri_id) AS active_count
       FROM finance_wallet_ledger wl
       JOIN santri s ON s.id = wl.santri_id
       WHERE ${nonBillableSantriSqlPredicate('s.asrama')}`,
      []
    ),

    // 5. AKTIVITAS LOKET KASIR (Hari ini & Sesi Terbuka)
    queryOne<{
      open_count: number
      expected_drawer: number
    }>(
      `SELECT
         COUNT(*) AS open_count,
         COALESCE(SUM(expected_closing_balance), 0) AS expected_drawer
       FROM finance_cash_sessions
       WHERE status = 'OPEN'`,
      []
    ),

    queryOne<{
      today_in: number
      today_out: number
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS today_in,
         COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS today_out
       FROM (
         SELECT 'IN' AS direction, p.gross_amount AS amount
         FROM finance_payments p
         WHERE p.channel = 'CASH' AND p.paid_at LIKE ?
         UNION ALL
         SELECT wl.direction, wl.amount
         FROM finance_wallet_ledger wl
         WHERE wl.cash_session_id IS NOT NULL AND wl.created_at LIKE ?
           AND (
             (wl.direction = 'IN' AND wl.movement_type = 'TOPUP_CASH'
              AND NOT EXISTS (SELECT 1 FROM finance_payments p WHERE p.id = wl.reference_id OR p.payment_number = wl.reference_id))
             OR
             (wl.direction = 'OUT' AND wl.movement_type IN ('WITHDRAWAL_LOKET', 'WITHDRAWAL_KOLEKTIF'))
             OR
             (wl.direction = 'IN' AND wl.movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN')
           )
       )`,
      [todayPrefix, todayPrefix]
    ),

    // 6. INDIKATOR SELISIH & REKONSILIASI (Mismatch Detection)
    queryOne<{
      unallocated_count: number
      unallocated_amount: number
      amount_mismatch_count: number
      cash_discrepancies: number
      settlement_discrepancies: number
      pending_recovery_cases: number
    }>(
      `SELECT
         (SELECT COUNT(*) FROM finance_reconciliation_items WHERE resolution_action = 'NONE' AND match_status = 'UNALLOCATED_TRANSFER') AS unallocated_count,
         (SELECT COALESCE(SUM(discrepancy_amount), 0) FROM finance_reconciliation_items WHERE resolution_action = 'NONE' AND match_status = 'UNALLOCATED_TRANSFER') AS unallocated_amount,
         (SELECT COUNT(*) FROM finance_reconciliation_items WHERE resolution_action = 'NONE' AND match_status IN ('AMOUNT_MISMATCH', 'UNMATCHED_INTERNAL', 'UNMATCHED_EXTERNAL')) AS amount_mismatch_count,
         (SELECT COUNT(*) FROM finance_cash_sessions WHERE difference != 0 AND difference IS NOT NULL) AS cash_discrepancies,
         (SELECT COUNT(*) FROM finance_settlements WHERE status = 'DISCREPANCY') AS settlement_discrepancies,
         (SELECT COUNT(*) FROM finance_corrections WHERE is_recovery_case = 1 AND recovery_status = 'PENDING_RECOVERY') AS pending_recovery_cases`,
      []
    ),

    // 7. ANTREAN OPERASIONAL HARIAN (Verifikasi Transfer Manual & Pencairan Kolektif Aktif)
    queryOne<{ pending_count: number; pending_amount: number }>(
      `SELECT
         COUNT(*) AS pending_count,
         COALESCE(SUM(expected_amount), 0) AS pending_amount
       FROM finance_transfer_submissions
       WHERE status = 'MENUNGGU_VERIFIKASI'`,
      []
    ).catch(() => null),

    queryOne<{ active_count: number; active_amount: number }>(
      `SELECT
         COUNT(*) AS active_count,
         COALESCE(SUM(total_amount), 0) AS active_amount
       FROM finance_wallet_payout_batches
       WHERE status = 'DIBAWA'`,
      []
    ).catch(() => null),
  ])

  const unallocatedCount = mismatchRow?.unallocated_count ?? 0
  const amountMismatchCount = mismatchRow?.amount_mismatch_count ?? 0
  const cashDiscrepancies = mismatchRow?.cash_discrepancies ?? 0
  const settlementDiscrepancies = mismatchRow?.settlement_discrepancies ?? 0
  const pendingRecoveryCases = mismatchRow?.pending_recovery_cases ?? 0
  const totalMismatchCount =
    unallocatedCount +
    amountMismatchCount +
    cashDiscrepancies +
    settlementDiscrepancies +
    pendingRecoveryCases

  return {
    pesantren: {
      totalPenerimaan: pesantrenRow?.total_penerimaan ?? 0,
      onlinePenerimaan: pesantrenRow?.online_penerimaan ?? 0,
      cashPenerimaan: pesantrenRow?.cash_penerimaan ?? 0,
      settledAmount: pesantrenRow?.settled_amount ?? 0,
      pendingSettlementAmount: pesantrenRow?.pending_settlement_amount ?? 0,
      pendingSettlementCount: pesantrenRow?.pending_settlement_count ?? 0,
      readyToDisburse: readyDisburseRow?.ready_to_disburse ?? 0,
      totalDisbursed: disbursedRow?.total_disbursed ?? 0,
      undisbursedAmount: readyDisburseRow?.ready_to_disburse ?? 0,
      totalTunggakan: arrearsRow?.total_tunggakan ?? 0,
      santriMenunggakCount: arrearsRow?.santri_menunggak_count ?? 0,
    },
    uangJajan: {
      totalTitipanBalance: walletBalanceRow?.total_balance ?? 0,
      topupPeriod: walletActivityRow?.topup_period ?? 0,
      topupOnline: walletActivityRow?.topup_online ?? 0,
      topupCash: walletActivityRow?.topup_cash ?? 0,
      withdrawalPeriod: walletActivityRow?.withdrawal_period ?? 0,
      activeStudentsWithBalance: activeWalletStudentsRow?.active_count ?? 0,
      notice: 'Dana Titipan Santri — Liabilitas Murni, Bukan Pendapatan Pesantren',
    },
    kasir: {
      openSessionsCount: openSessionsRow?.open_count ?? 0,
      todayCashIn: todayCashRow?.today_in ?? 0,
      todayCashOut: todayCashRow?.today_out ?? 0,
      expectedDrawerBalance: openSessionsRow?.expected_drawer ?? 0,
    },
    mismatch: {
      totalMismatchCount,
      unallocatedTransfersCount: unallocatedCount,
      unallocatedTransfersAmount: mismatchRow?.unallocated_amount ?? 0,
      amountMismatchCount,
      cashDiscrepanciesCount: cashDiscrepancies,
      settlementDiscrepanciesCount: settlementDiscrepancies,
      pendingRecoveryCasesCount: pendingRecoveryCases,
      hasMismatch: totalMismatchCount > 0,
    },
    operations: {
      pendingTransferVerificationsCount: pendingTransferRow?.pending_count ?? 0,
      pendingTransferVerificationsAmount: pendingTransferRow?.pending_amount ?? 0,
      activeCollectiveBatchesCount: activeCollectiveRow?.active_count ?? 0,
      activeCollectiveBatchesAmount: activeCollectiveRow?.active_amount ?? 0,
    },
  }
}

/**
 * Mengambil data visual grafik (tren bulanan dan komposisi kanal/pos tagihan).
 */
export async function getDashboardChartsData(periodInput?: string): Promise<{
  trends: MonthlyTrendItem[]
  channelComposition: ChannelComposition
  itemComposition: ItemComposition[]
}> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const period = periodInput || currentMonth
  const periodPrefix = `${period}%`

  // 1. Tren Bulanan (6 bulan berakhir pada periode yang dipilih)
  const now = new Date()
  const periodMatch = /^(\d{4})-(\d{2})$/.exec(period)
  const baseYear = periodMatch ? parseInt(periodMatch[1], 10) : now.getFullYear()
  const baseMonth = periodMatch ? parseInt(periodMatch[2], 10) - 1 : now.getMonth()
  const monthList: string[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(baseYear, baseMonth - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    monthList.push(`${y}-${m}`)
  }

  // Eksekusi tren 6 bulan, komposisi kanal, dan komposisi item secara paralel
  const trendPromises = monthList.map(async (m) => {
    const mPrefix = `${m}%`
    const row = await queryOne<{
      penerimaan: number
      disbursed: number
      uang_jajan_in: number
    }>(
      `SELECT
          (SELECT COALESCE(SUM(a.amount), 0)
           FROM finance_allocations a
           JOIN finance_payments p ON a.payment_id = p.id
           WHERE a.target_type = 'OBLIGATION'
             AND p.correction_status != 'FULLY_CORRECTED'
             AND p.fund_management = 'KOPERASI'
             AND p.paid_at LIKE ?) AS penerimaan,
          (SELECT COALESCE(SUM(di.amount), 0)
           FROM finance_distribution_items di
           JOIN finance_distributions d ON d.id = di.distribution_id
           WHERE d.transferred_at LIKE ?) AS disbursed,
          (SELECT COALESCE(SUM(amount), 0)
           FROM finance_wallet_ledger
           WHERE direction = 'IN'
             AND movement_type IN ('TOPUP_ONLINE', 'TOPUP_CASH', 'TOPUP_TRANSFER')
             AND created_at LIKE ?) AS uang_jajan_in`,
      [mPrefix, mPrefix, mPrefix]
    )

    return {
      month: m,
      monthLabel: formatPeriodLabel(m),
      penerimaanPesantren: row?.penerimaan ?? 0,
      penyaluranDana: row?.disbursed ?? 0,
      uangJajanIn: row?.uang_jajan_in ?? 0,
    }
  })

  const channelPromise = queryOne<{
    online_sum: number
    cash_sum: number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' AND p.channel IN ('BRI', 'TRANSFER') THEN a.amount ELSE 0 END), 0) AS online_sum,
       COALESCE(SUM(CASE WHEN p.fund_management = 'KOPERASI' AND p.channel = 'CASH' THEN a.amount ELSE 0 END), 0) AS cash_sum
     FROM finance_allocations a
     JOIN finance_payments p ON a.payment_id = p.id
     WHERE a.target_type = 'OBLIGATION'
       AND p.correction_status != 'FULLY_CORRECTED'
       AND p.paid_at LIKE ?`,
    [periodPrefix]
  )

  const itemPromise = query<{
    item_type: string
    total_amount: number
  }>(
    `SELECT
       a.item_type,
       COALESCE(SUM(a.amount), 0) AS total_amount
     FROM finance_allocations a
     JOIN finance_payments p ON a.payment_id = p.id
     WHERE a.target_type = 'OBLIGATION'
       AND p.correction_status != 'FULLY_CORRECTED'
       AND p.fund_management = 'KOPERASI'
       AND p.paid_at LIKE ?
     GROUP BY a.item_type
     ORDER BY total_amount DESC`,
    [periodPrefix]
  )

  const [trends, channelRow, itemRows] = await Promise.all([
    Promise.all(trendPromises),
    channelPromise,
    itemPromise,
  ])

  const onlineAmount = channelRow?.online_sum ?? 0
  const cashAmount = channelRow?.cash_sum ?? 0
  const totalChannel = onlineAmount + cashAmount
  const channelComposition: ChannelComposition = {
    onlineAmount,
    onlinePercentage: totalChannel > 0 ? Math.round((onlineAmount / totalChannel) * 100) : 0,
    cashAmount,
    cashPercentage: totalChannel > 0 ? Math.round((cashAmount / totalChannel) * 100) : 0,
    total: totalChannel,
  }

  const totalItemAmount = itemRows.reduce((acc, r) => acc + r.total_amount, 0)
  const itemComposition: ItemComposition[] = itemRows.map((r) => ({
    itemType: r.item_type,
    itemLabel: FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] || r.item_type,
    amount: r.total_amount,
    percentage: totalItemAmount > 0 ? Math.round((r.total_amount / totalItemAmount) * 100) : 0,
  }))

  return {
    trends,
    channelComposition,
    itemComposition,
  }
}

/**
 * Mengambil 8 transaksi paling baru lintas kategori (pembayaran tagihan, topup, penarikan, penyaluran, koreksi).
 */
export async function getRecentTransactions(limit = 8): Promise<RecentTransactionItem[]> {
  const rows = await query<{
    id: string
    source_table: 'PAYMENT' | 'WALLET' | 'DISTRIBUTION' | 'CORRECTION'
    transaction_number: string
    category: string
    category_label_override: string | null
    fund_type: string
    direction: string
    amount: number
    channel: string
    method: string
    status: string
    item_type: string | null
    santri_name: string | null
    santri_nis: string | null
    santri_asrama: string | null
    santri_kamar: string | null
    recipient_info: string | null
    operator_name: string | null
    external_reference: string | null
    notes: string | null
    created_at: string
  }>(
    `
    -- 1. Payments (Obligations & Top-Ups)
    SELECT
      p.id,
      'PAYMENT' AS source_table,
      p.payment_number AS transaction_number,
      CASE
        WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TOPUP'
        ELSE 'PAYMENT'
      END AS category,
      NULL AS category_label_override,
      CASE
        WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TITIPAN_SANTRI'
        ELSE 'PESANTREN'
      END AS fund_type,
      'IN' AS direction,
      p.gross_amount AS amount,
      p.channel,
      p.method,
      CASE
        WHEN p.channel IN ('BRI', 'TRANSFER') AND p.status = 'SETTLED' THEN 'SETTLED'
        ELSE p.status
      END AS status,
      (SELECT GROUP_CONCAT(DISTINCT a.item_type) FROM finance_allocations a WHERE a.payment_id = p.id) AS item_type,
      s.nama_lengkap AS santri_name,
      s.nis AS santri_nis,
      s.asrama AS santri_asrama,
      s.kamar AS santri_kamar,
      NULL AS recipient_info,
      u.full_name AS operator_name,
      COALESCE(p.bri_trx_id, p.bri_payment_request_id, p.external_reference) AS external_reference,
      NULL AS notes,
      p.paid_at AS created_at
    FROM finance_payments p
    LEFT JOIN santri s ON s.id = p.santri_id
    LEFT JOIN users u ON u.id = p.received_by

    UNION ALL

    -- 2. Wallet Ledger Movements (Withdrawals, Standalone Top-Up, & Wallet Reversals)
    SELECT
      wl.id,
      'WALLET' AS source_table,
      COALESCE(wl.reference_id, 'WLT-' || SUBSTR(wl.id, 1, 8)) AS transaction_number,
      CASE
        WHEN wl.movement_type IN ('WITHDRAWAL_LOKET', 'WITHDRAWAL_KOLEKTIF') THEN 'WITHDRAWAL'
        WHEN wl.movement_type IN ('REVERSAL', 'WITHDRAWAL_KOLEKTIF_RETURN') THEN 'CORRECTION'
        ELSE 'TOPUP'
      END AS category,
      CASE
        WHEN wl.movement_type = 'WITHDRAWAL_KOLEKTIF' THEN 'Pencairan Kolektif'
        WHEN wl.movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN' THEN 'Pengembalian Kolektif'
        ELSE NULL
      END AS category_label_override,
      'TITIPAN_SANTRI' AS fund_type,
      wl.direction,
      wl.amount,
      CASE wl.movement_type WHEN 'TOPUP_ONLINE' THEN 'BRI' WHEN 'TOPUP_TRANSFER' THEN 'TRANSFER' ELSE 'CASH' END AS channel,
      CASE wl.movement_type WHEN 'TOPUP_ONLINE' THEN 'BRI_VA' WHEN 'TOPUP_TRANSFER' THEN 'MANUAL_TRANSFER' ELSE 'CASH' END AS method,
      CASE
        WHEN wl.movement_type = 'REVERSAL' THEN 'REVERSAL'
        ELSE 'COMPLETED'
      END AS status,
      'UANG_JAJAN' AS item_type,
      s.nama_lengkap AS santri_name,
      s.nis AS santri_nis,
      s.asrama AS santri_asrama,
      s.kamar AS santri_kamar,
      NULL AS recipient_info,
      u.full_name AS operator_name,
      wl.reference_id AS external_reference,
      wl.notes AS notes,
      wl.created_at
    FROM finance_wallet_ledger wl
    LEFT JOIN santri s ON s.id = wl.santri_id
    LEFT JOIN users u ON u.id = wl.operator_id
    WHERE ${nonBillableSantriSqlPredicate('s.asrama')}
      AND (
        (wl.direction = 'OUT' AND wl.movement_type IN ('WITHDRAWAL_LOKET', 'WITHDRAWAL_KOLEKTIF'))
        OR
        (wl.direction = 'IN' AND wl.movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN')
        OR
        (wl.direction = 'IN' AND wl.movement_type IN ('TOPUP_CASH', 'TOPUP_ONLINE', 'TOPUP_TRANSFER')
         AND NOT EXISTS (SELECT 1 FROM finance_payments p WHERE p.id = wl.reference_id OR p.payment_number = wl.reference_id))
        OR
        (wl.movement_type = 'REVERSAL'
         AND NOT EXISTS (SELECT 1 FROM finance_corrections c WHERE c.id = wl.reference_id OR c.correction_number = wl.reference_id))
      )

    UNION ALL

    -- 3. Distributions to Vendors / Bendahara
    SELECT
      d.id,
      'DISTRIBUTION' AS source_table,
      d.distribution_number AS transaction_number,
      'DISTRIBUTION' AS category,
      NULL AS category_label_override,
      'PESANTREN' AS fund_type,
      'OUT' AS direction,
      d.total_amount AS amount,
      d.method AS channel,
      d.method,
      'COMPLETED' AS status,
      d.item_type,
      NULL AS santri_name,
      NULL AS santri_nis,
      NULL AS santri_asrama,
      NULL AS santri_kamar,
      COALESCE(j.nama_jasa, d.recipient_type) AS recipient_info,
      u.full_name AS operator_name,
      d.destination_account AS external_reference,
      d.notes AS notes,
      d.transferred_at AS created_at
    FROM finance_distributions d
    LEFT JOIN master_jasa j ON j.id = d.recipient_id
    LEFT JOIN users u ON u.id = d.transferred_by

    UNION ALL

    -- 4. Financial Corrections (Void, Reversal, Refund)
    SELECT
      c.id,
      'CORRECTION' AS source_table,
      c.correction_number AS transaction_number,
      'CORRECTION' AS category,
      NULL AS category_label_override,
      'PESANTREN' AS fund_type,
      'OUT' AS direction,
      c.total_amount AS amount,
      COALESCE(c.method, 'SYSTEM') AS channel,
      COALESCE(c.method, 'SYSTEM') AS method,
      c.correction_type AS status,
      'KOREKSI' AS item_type,
      s.nama_lengkap AS santri_name,
      s.nis AS santri_nis,
      s.asrama AS santri_asrama,
      s.kamar AS santri_kamar,
      NULL AS recipient_info,
      u.full_name AS operator_name,
      p.payment_number AS external_reference,
      c.reason AS notes,
      c.created_at
    FROM finance_corrections c
    JOIN finance_payments p ON p.id = c.target_payment_id
    LEFT JOIN santri s ON s.id = p.santri_id
    LEFT JOIN users u ON u.id = c.created_by

    ORDER BY created_at DESC
    LIMIT ?
    `,
    [limit]
  )

  const CATEGORY_LABELS: Record<string, string> = {
    PAYMENT: 'Pembayaran Tagihan',
    TOPUP: 'Top-Up Uang Jajan',
    WITHDRAWAL: 'Penarikan Loket',
    DISTRIBUTION: 'Penyaluran Dana',
    CORRECTION: 'Koreksi Finansial',
  }

  return rows.map((r) => ({
    id: r.id,
    sourceTable: r.source_table,
    transactionNumber: r.transaction_number,
    category: r.category as RecentTransactionItem['category'],
    categoryLabel: r.category_label_override || CATEGORY_LABELS[r.category] || r.category,
    fundType: r.fund_type as RecentTransactionItem['fundType'],
    direction: r.direction as RecentTransactionItem['direction'],
    amount: r.amount,
    channel: r.channel,
    method: r.method,
    status: r.status,
    itemType: r.item_type,
    itemLabel: r.item_type ? (FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] || r.item_type) : null,
    santriName: r.santri_name,
    santriNis: r.santri_nis,
    santriAsrama: r.santri_asrama,
    santriKamar: r.santri_kamar,
    recipientInfo: r.recipient_info,
    operatorName: r.operator_name,
    externalReference: r.external_reference,
    notes: r.notes,
    createdAt: r.created_at,
  }))
}

/**
 * Mengambil seluruh paket data Dashboard Keuangan terpadu untuk periode tertentu.
 */
export async function getFinanceDashboardFullData(periodInput?: string): Promise<FinanceDashboardData> {
  const periodList = generateDashboardPeriodList()
  const currentPeriod = periodInput || (periodList[1]?.value || new Date().toISOString().slice(0, 7))

  const [kpi, charts, recentTransactions] = await Promise.all([
    getExecutiveFinanceKpi(currentPeriod),
    getDashboardChartsData(currentPeriod),
    getRecentTransactions(8),
  ])

  return {
    selectedPeriod: currentPeriod,
    periodList,
    kpi,
    charts,
    recentTransactions,
    generatedAt: new Date().toISOString(),
  }
}
