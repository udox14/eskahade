import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const metadata: Metadata = {
  title: 'Kepanitiaan EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function KepanitiaanEhbPage() {
  await guardPage('/dashboard/ehb/kepanitiaan')
  return <PageContent />
}
