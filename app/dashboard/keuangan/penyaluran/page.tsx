import { guardPage, guardRole } from '@/lib/auth/guard'
import { getPenyaluranPageData } from './actions'
import PenyaluranContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PenyaluranPage() {
  // 1. Otorisasi rute untuk admin, bendahara, dan pimpinan
  try {
    await guardPage('/dashboard/keuangan/penyaluran')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Ambil dataset awal untuk tab default (Bendahara)
  const initialData = await getPenyaluranPageData({
    tab: 'BENDAHARA',
  })

  return <PenyaluranContent initialData={initialData} />
}
