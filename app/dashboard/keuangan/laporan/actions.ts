'use server'

import { authorizeFinanceFeature } from '@/lib/finance/authorization'

// app/dashboard/keuangan/laporan/actions.ts
// Server Actions untuk Modul Laporan & Cetak Ekspor Keuangan (Fase 10: PRD Bab 34)

import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import {
  collectAllReportPages,
  type ReportExportPayload,
} from '@/lib/finance/report-export-paging'
import {
  getReceiptsReport,
  getDistributionsReport,
  getArrearsReport,
  getExemptionsReport,
  getStudentDetailReport,
  getWalletReport,
  getCashSessionsReport,
  getCashSessionDetailReport,
  getSettlementsReport,
  getReconciliationsReport,
  getReportFilterOptions,
  type ReceiptItemRow,
  type DistributionItemRow,
  type ArrearItemRow,
  type ExemptionItemRow,
  type WalletSummaryRow,
  type WalletMutationRow,
  type CashSessionItemRow,
  type SettlementItemRow,
  type ReconciliationReportRow,
  type ReceiptsReportFilter,
  type DistributionsReportFilter,
  type ArrearsReportFilter,
  type ExemptionsReportFilter,
  type StudentDetailReportFilter,
  type WalletReportFilter,
  type CashSessionsReportFilter,
  type SettlementsReportFilter,
  type ReconciliationsReportFilter,
} from '@/lib/finance/reports'

async function assertReportPermission(): Promise<void> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
  }

  const roles = getEffectiveRoles(session)
  const isPrivileged =
    roles.includes('admin') ||
    roles.includes('bendahara') ||
    roles.includes('pimpinan') ||
    roles.includes('demo')

  const hasFeatureAccess = await canAccessFeatureForSession(
    session,
    '/dashboard/keuangan/laporan'
  ).catch(() => false)

  if (!isPrivileged && !hasFeatureAccess) {
    throw new Error('Anda tidak memiliki izin untuk mengakses Laporan Keuangan.')
  }
}

export async function fetchReceiptsReport(filters: ReceiptsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getReceiptsReport(filters)
}

export async function fetchDistributionsReport(filters: DistributionsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getDistributionsReport(filters)
}

export async function fetchArrearsReport(filters: ArrearsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getArrearsReport(filters)
}

export async function fetchExemptionsReport(filters: ExemptionsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getExemptionsReport(filters)
}

export async function fetchStudentDetailReport(filters: StudentDetailReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getStudentDetailReport(filters)
}

export async function fetchWalletReport(filters: WalletReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getWalletReport(filters)
}

export async function fetchCashSessionsReport(filters: CashSessionsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getCashSessionsReport(filters)
}

export async function fetchSettlementsReport(filters: SettlementsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getSettlementsReport(filters)
}

export async function fetchReconciliationsReport(filters: ReconciliationsReportFilter) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getReconciliationsReport(filters)
}

export async function fetchCashSessionDetailReport(sessionId: string) {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getCashSessionDetailReport(sessionId)
}

export async function fetchReportFilterOptions() {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await getReportFilterOptions()
}

// ── EKSPOR EXCEL: SELURUH BARIS SESUAI FILTER ───────────────────────────────
// PRD Bab 34: berkas Excel harus memuat seluruh data hasil filter, bukan hanya
// baris yang sedang tampil di satu halaman tabel.
// Logika penelusuran halaman ada di lib/finance/report-export-paging.ts (teruji murni).

export async function fetchReceiptsForExport(
  filters: ReceiptsReportFilter
): Promise<ReportExportPayload<ReceiptItemRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getReceiptsReport({ ...filters, page, pageSize })
  )
}

export async function fetchDistributionsForExport(
  filters: DistributionsReportFilter
): Promise<ReportExportPayload<DistributionItemRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getDistributionsReport({ ...filters, page, pageSize })
  )
}

export async function fetchArrearsForExport(
  filters: ArrearsReportFilter
): Promise<ReportExportPayload<ArrearItemRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getArrearsReport({ ...filters, page, pageSize })
  )
}

export async function fetchExemptionsForExport(
  filters: ExemptionsReportFilter
): Promise<ReportExportPayload<ExemptionItemRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getExemptionsReport({ ...filters, page, pageSize })
  )
}

export async function fetchWalletForExport(
  filters: WalletReportFilter
): Promise<ReportExportPayload<WalletSummaryRow | WalletMutationRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages<WalletSummaryRow | WalletMutationRow>(
    async (page, pageSize) => {
      const res = await getWalletReport({ ...filters, page, pageSize })
      return {
        items: res.mode === 'SUMMARY' ? res.summaryItems ?? [] : res.mutationItems ?? [],
        pagination: res.pagination,
      }
    }
  )
}

export async function fetchCashSessionsForExport(
  filters: CashSessionsReportFilter
): Promise<ReportExportPayload<CashSessionItemRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getCashSessionsReport({ ...filters, page, pageSize })
  )
}

export async function fetchSettlementsForExport(
  filters: SettlementsReportFilter
): Promise<ReportExportPayload<SettlementItemRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getSettlementsReport({ ...filters, page, pageSize })
  )
}

export async function fetchReconciliationsForExport(
  filters: ReconciliationsReportFilter
): Promise<ReportExportPayload<ReconciliationReportRow>> {
  await authorizeFinanceFeature('/dashboard/keuangan/laporan', false)

  await assertReportPermission()
  return await collectAllReportPages((page, pageSize) =>
    getReconciliationsReport({ ...filters, page, pageSize })
  )
}
