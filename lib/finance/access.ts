import { getSession, getEffectiveRoles, type SessionUser } from '@/lib/auth/session'
import { financeQueryOne } from '@/lib/db'

export type FinancePermission = 'VIEW' | 'CREATE' | 'CHECK' | 'EXECUTE' | 'CONFIGURE' | 'AUDIT'

export async function requireFinanceAccess(permission: FinancePermission): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new Error('Sesi tidak valid.')
  const roles = getEffectiveRoles(session)
  if (roles.includes('demo')) throw new Error('Akun demo tidak boleh memproses transaksi keuangan nyata.')

  if (roles.includes('admin')) {
    const breakGlass = await financeQueryOne<{ id: string }>(`SELECT id FROM finance_break_glass
      WHERE user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') ORDER BY starts_at DESC LIMIT 1`, [session.id])
    if (!breakGlass) throw new Error('Admin teknis memerlukan akses break-glass yang masih aktif.')
    return session
  }

  const isCentral = roles.includes('bendahara')
  const isCouncilChecker = roles.includes('dewan_santri') && roles.includes('jabatan:bendahara')
  const isDorm = roles.includes('pengurus_asrama') && roles.includes('jabatan:bendahara')
  const allowed = permission === 'VIEW'
    ? isCentral || isCouncilChecker || isDorm
    : permission === 'CREATE'
      ? isCentral || isDorm
      : permission === 'CHECK' || permission === 'AUDIT'
        ? isCouncilChecker
        : isCentral
  if (!allowed) throw new Error('Anda tidak memiliki kewenangan untuk tindakan keuangan ini.')
  return session
}

export function financeAsramaScope(session: SessionUser): string | null {
  const roles = getEffectiveRoles(session)
  if (roles.includes('pengurus_asrama') && !roles.includes('bendahara') && !roles.includes('dewan_santri')) {
    return session.asrama_binaan || '__NO_SCOPE__'
  }
  return null
}
