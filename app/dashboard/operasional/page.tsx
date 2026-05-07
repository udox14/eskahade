import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function OperasionalRecipientPage() {
  await guardPage('/dashboard/operasional')
  return <PageContent initialTab="ledger" />
}
