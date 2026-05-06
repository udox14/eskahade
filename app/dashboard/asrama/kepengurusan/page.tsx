import { guardPage } from '@/lib/auth/guard'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function KepengurusanAsramaPage() {
  await guardPage('/dashboard/asrama/kepengurusan')
  const session = await getSession()
  if (!session) redirect('/dashboard')

  return <PageContent userRole={session.role} asramaBinaan={session.asrama_binaan ?? null} />
}
