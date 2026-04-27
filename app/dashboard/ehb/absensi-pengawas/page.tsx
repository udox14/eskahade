import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const metadata: Metadata = {
  title: 'Absensi Pengawas EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function AbsensiPengawasEhbPage() {
  await guardPage('/dashboard/ehb/absensi-pengawas')
  return <PageContent />
}

