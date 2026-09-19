import { guardRole } from '@/lib/auth/guard'
import { getLoketInitialData } from './actions'
import LoketContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function LoketPage() {
  // 1. Otorisasi rute untuk finance & koperasi roles
  await guardRole([
    'admin',
    'bendahara',
    'admin_koperasi',
    'petugas_koperasi',
    'pimpinan',
    'tester',
  ])

  // 2. Ambil state awal loket (sesi kas aktif & operator)
  const initialData = await getLoketInitialData()

  return <LoketContent initialData={initialData} />
}
