import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await guardPage('/dashboard/keuangan/setoran-spp-baru')
  return <PageContent />
}
