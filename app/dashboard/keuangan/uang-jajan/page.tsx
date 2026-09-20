import { guardPage, guardRole } from '@/lib/auth/guard'
import { getUangJajanData } from './actions'
import UangJajanContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function UangJajanPage() {
  // 1. Otorisasi rute untuk finance & koperasi roles via fitur_akses
  try {
    await guardPage('/dashboard/keuangan/uang-jajan')
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
  const initialData = await getUangJajanData({
    page: 1,
    pageSize: 50,
  })

  return <UangJajanContent initialData={initialData} />
}
