import { redirect } from 'next/navigation'

import { guardPage } from '@/lib/auth/guard'
import { getSession, isAdmin } from '@/lib/auth/session'
import { getPengaturanSantriBaru } from './actions'
import PengaturanSantriBaruContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PengaturanSantriBaruPage() {
  await guardPage('/dashboard/pengaturan/santri-baru')
  const session = await getSession()
  if (!session || !isAdmin(session)) redirect('/dashboard')

  const settings = await getPengaturanSantriBaru()
  if ('error' in settings) redirect('/dashboard')

  return <PengaturanSantriBaruContent {...settings} />
}
