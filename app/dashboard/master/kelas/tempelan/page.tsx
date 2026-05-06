import { guardPage } from '@/lib/auth/guard'
import TempelanKelasPage from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedTempelanKelasPage() {
  await guardPage('/dashboard/master/kelas')
  return <TempelanKelasPage />
}
