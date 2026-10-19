import { getCloudflareContext } from '@opennextjs/cloudflare'

export type LoginUserRow = {
  id: string
  email: string
  password_hash: string
  full_name: string
  role: string
  roles: string | null
  asrama_binaan: string | null
  structural_jabatan: string | null
}

function isDemoAccount(user: LoginUserRow): boolean {
  if (user.role === 'demo') return true
  try {
    const roles: unknown = user.roles ? JSON.parse(user.roles) : []
    return Array.isArray(roles) && roles.includes('demo')
  } catch { return false }
}

/** Authentication always chooses bindings explicitly, independent of the
 * existing session cookie. A demo session must never use DEMO_DB credentials
 * to mint a production admin token with a matching user ID. */
export async function findLoginAccount(email: string): Promise<{ user: LoginUserRow; demoSandbox: boolean } | null> {
  const { env } = await getCloudflareContext({ async: true })
  const sql = 'SELECT id, email, password_hash, full_name, role, roles, asrama_binaan, structural_jabatan FROM users WHERE email = ?'
  const primary = await env.DB.prepare(sql).bind(email).first<LoginUserRow>()
  if (primary && !isDemoAccount(primary)) return { user: primary, demoSandbox: false }
  if (!env.DEMO_DB) return null
  const demo = await env.DEMO_DB.prepare(sql).bind(email).first<LoginUserRow>()
  return demo && isDemoAccount(demo) ? { user: demo, demoSandbox: true } : null
}
