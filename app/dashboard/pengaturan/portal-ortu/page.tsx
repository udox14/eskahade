import { guardPage } from '@/lib/auth/guard'
import { getPaymentChannels } from '@/lib/portal/data'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/pengaturan/portal-ortu')
  const channels = await getPaymentChannels()
  return <PageContent initialChannels={channels} />
}
