import { guardPage, guardRole } from '@/lib/auth/guard'
import { getDashboardData } from './actions'
import DashboardKeuanganContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function DashboardKeuanganPage() {
  // 1. Otorisasi rute untuk admin, bendahara, dan pimpinan
  try {
    await guardPage('/dashboard/keuangan')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Ambil data dashboard keuangan awal
  const initialResponse = await getDashboardData()

  return (
    <DashboardKeuanganContent
      initialData={initialResponse.data}
      userPermissions={initialResponse.userPermissions}
    />
  )
}
