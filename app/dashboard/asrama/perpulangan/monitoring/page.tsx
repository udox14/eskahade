import { guardPage } from '@/lib/auth/guard'
import MonitoringContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/asrama/perpulangan/monitoring')
  return <MonitoringContent />
}
