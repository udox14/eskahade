import { guardRole } from '@/lib/auth/guard'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { queryOne } from '@/lib/db'
import { getFiturForRoles } from '@/lib/cache/fitur-akses'
import { redirect } from 'next/navigation'
import { HomeClient } from './home-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  await guardRole()
  const session = await getSession()
  if (!session) redirect('/login')

  let user: { full_name: string; roles: string | null } | null = null
  try {
    user = await queryOne<{ full_name: string; roles: string | null }>(
      'SELECT full_name, roles FROM users WHERE id = ?',
      [session.id]
    )
  } catch {
    const fallback = await queryOne<{ full_name: string; role: string }>(
      'SELECT full_name, role FROM users WHERE id = ?',
      [session.id]
    )
    user = fallback ? { full_name: fallback.full_name, roles: fallback.role ? JSON.stringify([fallback.role]) : null } : null
  }

  const userName = user?.full_name || 'Pengguna'
  
  // Parse multi-role
  let userRoles = getEffectiveRoles(session)
  try {
    if (user?.roles) {
      const parsed = JSON.parse(user.roles)
      if (Array.isArray(parsed) && parsed.length > 0) userRoles = parsed
    }
  } catch {}

  // Ambil dari cache — sudah di-fetch di layout.tsx, tidak double query
  const fiturAkses = await getFiturForRoles(userRoles, session.id)

  return (
    <HomeClient
      userName={userName}
      userRole={userRoles[0] || 'wali_kelas'}
      userRoles={userRoles}
      fiturAkses={fiturAkses}
    />
  )
}
