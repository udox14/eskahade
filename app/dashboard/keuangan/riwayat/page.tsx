import { guardPage, guardRole } from '@/lib/auth/guard'
import { getInitialHistoryData } from './actions'
import RiwayatTransaksiContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function RiwayatTransaksiPage() {
  // 1. Otorisasi rute untuk admin, bendahara, dan pimpinan
  try {
    await guardPage('/dashboard/keuangan/riwayat')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Ambil data transaksi global awal dan opsi filter
  const initialResponse = await getInitialHistoryData()

  return (
    <RiwayatTransaksiContent
      initialHistory={initialResponse.history}
      filterOptions={initialResponse.filterOptions}
      userPermissions={initialResponse.userPermissions}
    />
  )
}
