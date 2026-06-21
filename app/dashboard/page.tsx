import { guardRole } from '@/lib/auth/guard'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { getFiturForRoles } from '@/lib/cache/fitur-akses'
import { redirect } from 'next/navigation'
import { HomeClient } from './home-client'
import { capitalizeEachWord } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  await guardRole()
  const session = await getSession()
  if (!session) redirect('/login')

  const userName = capitalizeEachWord(session.full_name || 'Pengguna')
  const displayRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const effectiveRoles = getEffectiveRoles(session)
  const fiturAkses = await getFiturForRoles(effectiveRoles, session.id)

  return (
    <HomeClient
      userName={userName}
      userRole={session.role || 'wali_kelas'}
      userRoles={displayRoles}
      fiturAkses={fiturAkses}
    />
  )
}
