import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function HafalanGuruPage() {
  await guardPage('/dashboard/guru/hafalan')
  return <PageContent />
}
