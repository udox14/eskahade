import { guardPage } from '@/lib/auth/guard'

import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PoskestrenKeuanganPage() {
  await guardPage('/dashboard/poskestren/keuangan')
  return <PageContent />
}
