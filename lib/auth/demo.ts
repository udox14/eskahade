import type { SessionUser } from '@/lib/auth/session'

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export function isDemoLoginEnabled(): boolean {
  return isTruthy(process.env.DEMO_LOGIN_ENABLED)
}

export function getDemoCredentials() {
  return {
    email: process.env.DEMO_USER_EMAIL?.trim().toLowerCase() ?? 'demo@eskahade.local',
    password: process.env.DEMO_USER_PASSWORD ?? '',
  }
}

export function getDemoSessionUser(): SessionUser {
  const rawRoles = process.env.DEMO_USER_ROLES
  let roles: string[] = []

  try {
    if (rawRoles) {
      const parsed = JSON.parse(rawRoles)
      if (Array.isArray(parsed)) {
        roles = parsed.map((role) => String(role))
      }
    }
  } catch {
    roles = []
  }

  const primaryRole = process.env.DEMO_USER_ROLE ?? roles[0] ?? 'wali_kelas'
  if (roles.length === 0) roles = [primaryRole]

  return {
    id: process.env.DEMO_USER_ID ?? 'demo-user',
    email: getDemoCredentials().email,
    full_name: process.env.DEMO_USER_NAME ?? 'Akun Demo',
    role: primaryRole,
    roles,
    asrama_binaan: process.env.DEMO_USER_ASRAMA_BINAAN ?? null,
    is_demo: true,
  }
}

export function validateDemoLogin(password: string) {
  const credentials = getDemoCredentials()
  if (!isDemoLoginEnabled()) {
    return { ok: false, error: 'Login demo belum diaktifkan.' as const }
  }

  if (!credentials.password) {
    return { ok: false, error: 'Password akun demo belum dikonfigurasi.' as const }
  }

  if (password !== credentials.password) {
    return { ok: false, error: 'Email atau Password salah.' as const }
  }

  return { ok: true as const }
}
