import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function DendaBukuPribadiPage() {
  await guardPage('/dashboard/keamanan/denda-buku-pribadi')
  return <PageContent />
}
