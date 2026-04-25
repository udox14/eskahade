import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const metadata: Metadata = {
  title: 'Cetak EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function CetakEhbPage() {
  await guardPage('/dashboard/ehb/cetak')
  return <PageContent />
}
