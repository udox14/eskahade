import { getSession, getEffectiveRoles, type SessionUser } from '@/lib/auth/session'
import { financeQueryOne } from '@/lib/db'

export type FinancePermission = 'VIEW' | 'CREATE' | 'CHECK' | 'EXECUTE' | 'CONFIGURE' | 'AUDIT'

export async function requireCashierOperator(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new Error('Sesi tidak valid.')
  const roles = getEffectiveRoles(session)
  // Role demo selalu diarahkan ke DEMO_FINANCE_DB oleh getFinanceDB().
  // Izinkan seluruh alur operasional agar sandbox dapat diuji end-to-end.
  if (roles.includes('demo')) return session
  if (!roles.includes('operator_loket')) {
    throw new Error('Akun belum memiliki role Operator Loket.')
  }
  return session
}

export function canConfigureCashUnits(session: SessionUser): boolean {
  const roles = getEffectiveRoles(session)
  return roles.includes('bendahara') || roles.includes('demo')
}

export async function requireFinanceAccess(permission: FinancePermission): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new Error('Sesi tidak valid.')
  const roles = getEffectiveRoles(session)
  if (roles.includes('demo')) return session

  const isCentral = roles.includes('bendahara')
  const isCouncilChecker = roles.includes('dewan_santri') && roles.includes('jabatan:bendahara')
  const isDorm = roles.includes('pengurus_asrama') && roles.includes('jabatan:bendahara')
  const hasNativeFinanceRole = isCentral || isCouncilChecker || isDorm

  // Break-glass hanya untuk admin teknis yang tidak mempunyai role operasional
  // keuangan. Pengguna multi-role admin+bendahara masuk sebagai bendahara biasa.
  if (roles.includes('admin') && !hasNativeFinanceRole) {
    const breakGlass = await financeQueryOne<{ id: string }>(`SELECT id FROM finance_break_glass
      WHERE user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') ORDER BY starts_at DESC LIMIT 1`, [session.id])
    if (!breakGlass) throw new Error('Admin teknis memerlukan akses break-glass yang masih aktif.')
    return session
  }

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

export type FinanceCapabilities = Record<Lowercase<FinancePermission>, boolean> & { breakGlass: boolean }

/**
 * Satu sumber kebenaran untuk tombol yang ditampilkan UI. Sebelumnya tiap
 * halaman menyusun flag-nya sendiri dengan `roles.includes('admin')`, padahal
 * `requireFinanceAccess` menolak admin polos tanpa break-glass aktif — admin
 * melihat tombol yang selalu gagal. Logika di sini mengikuti aturan yang sama
 * persis dengan `requireFinanceAccess`.
 */
export async function financeCapabilities(session: SessionUser): Promise<FinanceCapabilities> {
  const roles = getEffectiveRoles(session)
  const all = (value: boolean): FinanceCapabilities =>
    ({ view: value, create: value, check: value, execute: value, configure: value, audit: value, breakGlass: false })

  if (roles.includes('demo')) return all(true)

  const isCentral = roles.includes('bendahara')
  const isCouncilChecker = roles.includes('dewan_santri') && roles.includes('jabatan:bendahara')
  const isDorm = roles.includes('pengurus_asrama') && roles.includes('jabatan:bendahara')
  const hasNativeFinanceRole = isCentral || isCouncilChecker || isDorm

  if (roles.includes('admin') && !hasNativeFinanceRole) {
    const breakGlass = await financeQueryOne<{ id: string }>(`SELECT id FROM finance_break_glass
      WHERE user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') ORDER BY starts_at DESC LIMIT 1`, [session.id])
    return { ...all(Boolean(breakGlass)), breakGlass: Boolean(breakGlass) }
  }

  return {
    view: isCentral || isCouncilChecker || isDorm,
    create: isCentral || isDorm,
    check: isCouncilChecker,
    audit: isCouncilChecker,
    execute: isCentral,
    configure: isCentral,
    breakGlass: false,
  }
}

export function financeAsramaScope(session: SessionUser): string | null {
  const roles = getEffectiveRoles(session)
  if (roles.includes('pengurus_asrama') && !roles.includes('bendahara') && !roles.includes('dewan_santri')) {
    return session.asrama_binaan || '__NO_SCOPE__'
  }
  return null
}
