import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from '../_page-content'

export const metadata: Metadata = {
  title: 'Rincian Honor EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function HonorKeuanganEhbPage() {
  await guardPage('/dashboard/ehb/keuangan')
  return <PageContent activeTab="honor_detail" />
}

