import { redirect } from 'next/navigation'

import { guardPage } from '@/lib/auth/guard'
import { getSession, isAdmin } from '@/lib/auth/session'
import { getKalenderBulan } from './actions'
import KalenderPendidikanContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function KalenderPendidikanPage() {
  await guardPage('/dashboard/akademik/kalender-pendidikan')
  const session = await getSession()
  if (!session || !isAdmin(session)) redirect('/dashboard')

  const now = new Date()
  const tahun = now.getFullYear()
  const bulan = now.getMonth() + 1
  const rows = await getKalenderBulan(tahun, bulan)

  return <KalenderPendidikanContent tahunAwal={tahun} bulanAwal={bulan} rowsAwal={rows} />
}
