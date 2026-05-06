import { guardRole } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardRole(['admin', 'pengurus_asrama', 'dewan_santri'])
  return <PageContent />
}
