import { guardPage, guardRole } from '@/lib/auth/guard'
import { getPengaturanKeuanganData } from './actions'
import PengaturanKeuanganContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PengaturanKeuanganPage() {
  // 1. Otorisasi rute via fitur_akses (Admin, Bendahara, Pimpinan)
  try {
    await guardPage('/dashboard/keuangan/tarif')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  // 2. Muat dataset awal SPA modul pengaturan keuangan
  const initialData = await getPengaturanKeuanganData()

  return <PengaturanKeuanganContent initialData={initialData} />
}
