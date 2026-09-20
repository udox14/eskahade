import { guardPage, guardRole } from '@/lib/auth/guard'
import { getReportFilterOptions, getReceiptsReport } from '@/lib/finance/reports'
import LaporanKeuanganContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function LaporanKeuanganPage() {
  // 1. Guard otorisasi rute
  try {
    await guardPage('/dashboard/keuangan/laporan')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Muat data inisial filter options dan laporan penerimaan default
  const [filterOptions, initialReceipts] = await Promise.all([
    getReportFilterOptions(),
    getReceiptsReport({ page: 1, pageSize: 50 }),
  ])

  return (
    <LaporanKeuanganContent
      filterOptions={filterOptions}
      initialReceipts={initialReceipts}
    />
  )
}
