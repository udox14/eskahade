import { guardPage } from '@/lib/auth/guard'
import PenjadwalanTesKlasifikasiPage from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPenjadwalanPage() {
  await guardPage('/dashboard/santri/tes-klasifikasi')
  return <PenjadwalanTesKlasifikasiPage />
}
