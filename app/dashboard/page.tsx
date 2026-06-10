import { guardRole } from '@/lib/auth/guard'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { getFiturForRoles } from '@/lib/cache/fitur-akses'
import { redirect } from 'next/navigation'
import { HomeClient } from './home-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  await guardRole()
  const session = await getSession()
  if (!session) redirect('/login')

  const userName = session.full_name || 'Pengguna'
  const userRoles = getEffectiveRoles(session)
  const fiturAkses = await getFiturForRoles(userRoles, session.id)

  return (
    <HomeClient
      userName={userName}
      userRole={session.role || 'wali_kelas'}
      userRoles={userRoles}
      fiturAkses={fiturAkses}
    />
  )
}
