import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const metadata: Metadata = {
  title: 'Absensi Menghafal EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function AbsensiMenghafalPage() {
  await guardPage('/dashboard/ehb/absensi-menghafal')
  return <PageContent />
}

