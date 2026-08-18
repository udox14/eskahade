import { getSession, getEffectiveRoles, type SessionUser } from '@/lib/auth/session'

/**
 * Kewenangan keuangan. Peran EXECUTE dihapus bersama pola maker-checker-executor:
 * pencairan kini cukup dua peran, yang mengajukan (CREATE) dan yang menyetujui
 * (CHECK). Break-glass admin teknis juga dihapus - admin tanpa peran keuangan
 * memang tidak boleh membuka panel keuangan, titik.
 */
export type FinancePermission = 'VIEW' | 'CREATE' | 'CHECK' | 'CONFIGURE' | 'AUDIT'

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

function peran(session: SessionUser) {
  const roles = getEffectiveRoles(session)
  return {
    demo: roles.includes('demo'),
    pusat: roles.includes('bendahara'),
    pemeriksa: roles.includes('dewan_santri') && roles.includes('jabatan:bendahara'),
    asrama: roles.includes('pengurus_asrama') && roles.includes('jabatan:bendahara'),
  }
}

function boleh(p: ReturnType<typeof peran>, permission: FinancePermission): boolean {
  if (permission === 'VIEW') return p.pusat || p.pemeriksa || p.asrama
  if (permission === 'CREATE') return p.pusat || p.asrama
  if (permission === 'CHECK' || permission === 'AUDIT') return p.pemeriksa
  return p.pusat
}

export async function requireFinanceAccess(permission: FinancePermission): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new Error('Sesi tidak valid.')
  const p = peran(session)
  if (p.demo) return session
  if (!boleh(p, permission)) throw new Error('Anda tidak memiliki kewenangan untuk tindakan keuangan ini.')
  return session
}

export type FinanceCapabilities = Record<Lowercase<FinancePermission>, boolean>

/**
 * Satu sumber kebenaran untuk tombol yang ditampilkan UI, mengikuti aturan yang
 * sama persis dengan requireFinanceAccess. Sebelumnya tiap halaman menyusun
 * flag-nya sendiri dan menampilkan tombol yang selalu gagal saat ditekan.
 */
export async function financeCapabilities(session: SessionUser): Promise<FinanceCapabilities> {
  const p = peran(session)
  if (p.demo) return { view: true, create: true, check: true, configure: true, audit: true }
  return {
    view: boleh(p, 'VIEW'),
    create: boleh(p, 'CREATE'),
    check: boleh(p, 'CHECK'),
    configure: boleh(p, 'CONFIGURE'),
    audit: boleh(p, 'AUDIT'),
  }
}

export function financeAsramaScope(session: SessionUser): string | null {
  const roles = getEffectiveRoles(session)
  if (roles.includes('pengurus_asrama') && !roles.includes('bendahara') && !roles.includes('dewan_santri')) {
    return session.asrama_binaan || '__NO_SCOPE__'
  }
  return null
}
