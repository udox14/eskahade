import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function MasterHafalanPage() {
  await guardPage('/dashboard/master/hafalan')
  return <PageContent />
}
