import { guardPage, guardRole } from '@/lib/auth/guard'
import { getReconciliationPageData } from './actions'
import RekonsiliasiContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function RekonsiliasiPage() {
  // 1. Otorisasi rute untuk admin, bendahara, dan pimpinan
  try {
    await guardPage('/dashboard/keuangan/rekonsiliasi')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Ambil data awal untuk tab default (SETTLEMENT)
  const initialData = await getReconciliationPageData({
    tab: 'SETTLEMENT',
  })

  return <RekonsiliasiContent initialData={initialData} />
}
