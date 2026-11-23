import { guardPage } from '@/lib/auth/guard'
import { loadNotificationSettings } from './actions'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/pengaturan/notifikasi')
  const data = await loadNotificationSettings().catch(() => null)
  return <PageContent data={data} />
}
