import { guardPage } from '@/lib/auth/guard'
import { getSession, hasRole } from '@/lib/auth/session'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/asrama/layanan')
  const session = await getSession()
  const canManageMasterJasa = hasRole(session, 'admin') || hasRole(session, 'dewan_santri')
  return <PageContent canManageMasterJasa={canManageMasterJasa} />
}
