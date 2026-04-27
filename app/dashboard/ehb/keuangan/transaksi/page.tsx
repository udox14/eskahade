import { Metadata } from 'next'
import { Suspense } from 'react'
import { guardPage } from '@/lib/auth/guard'
import PageContent from '../_page-content'
import KeuanganLoadingSkeleton from '../_loading-skeleton'

export const metadata: Metadata = {
  title: 'Transaksi Keuangan EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function TransaksiKeuanganEhbPage() {
  await guardPage('/dashboard/ehb/keuangan')
  return (
    <Suspense fallback={<KeuanganLoadingSkeleton />}>
      <PageContent activeTab="transaksi" />
    </Suspense>
  )
}
