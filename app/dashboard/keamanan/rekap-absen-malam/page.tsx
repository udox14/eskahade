import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/keamanan/rekap-absen-malam')
  return <PageContent />
}
