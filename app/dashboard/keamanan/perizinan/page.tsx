import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  const session = await guardPage('/dashboard/keamanan/perizinan')
  return (
    <PageContent
      userRoles={session.roles ?? [session.role]}
      asramaBinaan={session.asrama_binaan}
    />
  )
}
