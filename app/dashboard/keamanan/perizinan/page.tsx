import { guardPage } from '@/lib/auth/guard'
import { getCrudForRoles } from '@/lib/auth/crud'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  const session = await guardPage('/dashboard/keamanan/perizinan')
  const crud = await getCrudForRoles('/dashboard/keamanan/perizinan', session.roles ?? [session.role])
  return (
    <PageContent
      userRoles={session.roles ?? [session.role]}
      asramaBinaan={session.asrama_binaan}
      canCreate={crud.canCreate}
      canUpdate={crud.canUpdate}
      canDelete={crud.canDelete}
    />
  )
}
