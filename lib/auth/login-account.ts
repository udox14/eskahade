import { getCloudflareContext } from '@opennextjs/cloudflare'
import { environmentDatabase, type AppEnvironment } from '@/lib/db/environment'
import { storedUserRoles } from '@/lib/auth/stored-roles'

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

/** Authentication uses this Worker's sole DB, independent of any old cookie. */
export async function findLoginAccount(email: string): Promise<{ user: LoginUserRow; demoSandbox: boolean; environment: AppEnvironment } | null> {
  const { env } = await getCloudflareContext({ async: true })
  const { db, environment } = environmentDatabase(env)
  const sql = 'SELECT id, email, password_hash, full_name, role, roles, asrama_binaan, structural_jabatan FROM users WHERE email = ?'
  const user = await db.prepare(sql).bind(email).first<LoginUserRow>()
  if (!user) return null
  const roles = storedUserRoles(user.role, user.roles)
  if (!roles || (environment === 'production' && roles.includes('demo'))) return null
  return { user: { ...user, roles: JSON.stringify(roles) }, demoSandbox: environment === 'sandbox' && roles.includes('demo'), environment }
}
