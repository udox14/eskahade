import { guardPage } from '@/lib/auth/guard'
import CetakTesKlasifikasiPage from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedCetakTesKlasifikasiPage() {
  await guardPage('/dashboard/santri/tes-klasifikasi')
  return <CetakTesKlasifikasiPage />
}
