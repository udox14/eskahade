import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function NilaiHarianGuruPage() {
  await guardPage('/dashboard/guru/nilai-harian')
  return <PageContent />
}
