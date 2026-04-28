import { guardPage } from '@/lib/auth/guard'
import { canCrud } from '@/lib/auth/crud'
import { redirect } from 'next/navigation'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/santri/input')
  if (!(await canCrud('/dashboard/santri', 'create'))) redirect('/dashboard/santri')
  return <PageContent />
}
