import { guardPage } from '@/lib/auth/guard'
import { hasAnyRole } from '@/lib/auth/session'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  const session = await guardPage('/dashboard/akademik/grading')
  const isSekpen = hasAnyRole(session, ['admin', 'sekpen'])
  return <PageContent isSekpen={isSekpen} />
}
