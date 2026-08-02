import { guardPage } from '@/lib/auth/guard'
import { getCrudForRoles } from '@/lib/auth/crud'
import { getEffectiveRoles } from '@/lib/auth/session'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  const session = await guardPage('/dashboard/keamanan/perizinan')
  const userRoles = getEffectiveRoles(session)
  const crud = await getCrudForRoles('/dashboard/keamanan/perizinan', userRoles)
  return (
    <PageContent
      userRoles={userRoles}
      asramaBinaan={session.asrama_binaan}
      canCreate={crud.canCreate}
      canUpdate={crud.canUpdate}
      canDelete={crud.canDelete}
    />
  )
}
