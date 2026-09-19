'use server'

// app/dashboard/keuangan/laporan/actions.ts
// Server Actions untuk Modul Laporan & Cetak Ekspor Keuangan (Fase 10: PRD Bab 34)

import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
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
    roles.includes('demo') ||
    roles.includes('tester')

  const hasFeatureAccess = await canAccessFeatureForSession(
    session,
    '/dashboard/keuangan/laporan'
  ).catch(() => false)

  if (!isPrivileged && !hasFeatureAccess) {
    throw new Error('Anda tidak memiliki izin untuk mengakses Laporan Keuangan.')
  }
}

export async function fetchReceiptsReport(filters: ReceiptsReportFilter) {
  await assertReportPermission()
  return await getReceiptsReport(filters)
}

export async function fetchDistributionsReport(filters: DistributionsReportFilter) {
  await assertReportPermission()
  return await getDistributionsReport(filters)
}

export async function fetchArrearsReport(filters: ArrearsReportFilter) {
  await assertReportPermission()
  return await getArrearsReport(filters)
}

export async function fetchExemptionsReport(filters: ExemptionsReportFilter) {
  await assertReportPermission()
  return await getExemptionsReport(filters)
}

export async function fetchStudentDetailReport(filters: StudentDetailReportFilter) {
  await assertReportPermission()
  return await getStudentDetailReport(filters)
}

export async function fetchWalletReport(filters: WalletReportFilter) {
  await assertReportPermission()
  return await getWalletReport(filters)
}

export async function fetchCashSessionsReport(filters: CashSessionsReportFilter) {
  await assertReportPermission()
  return await getCashSessionsReport(filters)
}

export async function fetchSettlementsReport(filters: SettlementsReportFilter) {
  await assertReportPermission()
  return await getSettlementsReport(filters)
}

export async function fetchReconciliationsReport(filters: ReconciliationsReportFilter) {
  await assertReportPermission()
  return await getReconciliationsReport(filters)
}

export async function fetchCashSessionDetailReport(sessionId: string) {
  await assertReportPermission()
  return await getCashSessionDetailReport(sessionId)
}

export async function fetchReportFilterOptions() {
  await assertReportPermission()
  return await getReportFilterOptions()
}
