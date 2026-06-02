import { Metadata } from 'next'
import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const metadata: Metadata = {
  title: 'Rekap Menghafal EHB | eskahade',
}

export const dynamic = 'force-dynamic'

export default async function RekapAbsensiMenghafalPage() {
  await guardPage('/dashboard/ehb/absensi-menghafal/rekap')
  return <PageContent />
}
