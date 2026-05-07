import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function BendaharaOperasionalPage() {
  await guardPage('/dashboard/keuangan/operasional')
  return <PageContent initialTab="monitoring" />
}
