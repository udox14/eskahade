import { guardPage, guardRole } from '@/lib/auth/guard'
import { getKredensialData } from './actions'
import KredensialContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function KredensialPage() {
  // 1. Otorisasi rute untuk finance & koperasi roles via fitur_akses
  try {
    await guardPage('/dashboard/keuangan/kredensial')
  } catch {
    await guardRole([
      'admin',
      'bendahara',
      'admin_koperasi',
      'petugas_koperasi',
      'pimpinan',
      'tester',
    ])
  }

  // 2. Ambil dataset awal
  const initialData = await getKredensialData({
    page: 1,
    pageSize: 50,
  })

  return <KredensialContent initialData={initialData} />
}
