import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const metadata: Metadata = {
  title: 'Susulan EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function SusulanEhbPage() {
  await guardPage('/dashboard/ehb/susulan')
  return <PageContent />
}
