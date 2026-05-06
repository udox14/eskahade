import { guardPage } from '@/lib/auth/guard'
import CetakPembagianTugasPage from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedCetakPembagianTugasPage() {
  await guardPage('/dashboard/master/wali-kelas')
  return <CetakPembagianTugasPage />
}
