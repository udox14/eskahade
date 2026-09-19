import { guardPage, guardRole } from '@/lib/auth/guard'
import { getStatusPembayaranData, getStatusPembayaranFilterOptions } from './actions'
import StatusPembayaranContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function StatusPembayaranPage() {
  // 1. Otorisasi rute untuk admin, bendahara, dan pimpinan
  try {
    await guardPage('/dashboard/keuangan/status-pembayaran')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Ambil opsi filter awal dan dataset default
  const filterOptions = await getStatusPembayaranFilterOptions()
  const initialData = await getStatusPembayaranData({
    period: filterOptions.currentPeriod,
    pageSize: 20,
    page: 1,
  })

  return (
    <StatusPembayaranContent
      initialData={initialData}
      filterOptions={filterOptions}
    />
  )
}
