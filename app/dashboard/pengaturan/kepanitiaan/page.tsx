import { guardPage } from '@/lib/auth/guard'
import { isAdmin } from '@/lib/auth/session'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function KepanitiaanPage() {
  const session = await guardPage('/dashboard/pengaturan/kepanitiaan')
  return <PageContent canManageSupervisi={isAdmin(session)} />
}
