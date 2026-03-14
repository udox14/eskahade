import { guardRole } from '@/lib/auth/guard'
import { getSession } from '@/lib/auth/session'
import { queryOne } from '@/lib/db'
import { getFiturForRole } from '@/lib/cache/fitur-akses'
import { redirect } from 'next/navigation'
import { HomeClient } from './home-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  await guardRole()
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await queryOne<{ full_name: string }>(
    'SELECT full_name FROM users WHERE id = ?',
    [session.id]
  )

  const userName = user?.full_name || 'Pengguna'
  const userRole = session.role || 'wali_kelas'

  // Ambil dari cache — sudah di-fetch di layout.tsx, tidak double query
  const fiturAkses = await getFiturForRole(userRole)

  return (
    <HomeClient
      userName={userName}
      userRole={userRole}
      fiturAkses={fiturAkses}
    />
  )
}
