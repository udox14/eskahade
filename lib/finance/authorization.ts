import { getSession, getEffectiveRoles, hasFinanceMutateRole, isDemoSandboxRequest } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { queryOne } from '@/lib/db'

export async function authorizeFinanceFeature(path: string, mutate = false) {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED: Silakan masuk kembali.')
  const roles = getEffectiveRoles(session)
  const privileged = roles.some(role => ['admin','bendahara','pimpinan'].includes(role))
  if (!privileged && !await canAccessFeatureForSession(session, path)) throw new Error('FORBIDDEN: Tidak memiliki akses fitur keuangan.')
  if (mutate && (roles.includes('pimpinan') || !hasFinanceMutateRole(roles,isDemoSandboxRequest(session)))) throw new Error('FORBIDDEN: Akun hanya memiliki hak baca.')
  return {session,roles}
}

export async function storedFinanceRoles(userId:string):Promise<string[]> {
  const user=await queryOne<{role:string;roles:string|null}>('SELECT role,roles FROM users WHERE id=?',[userId])
  if(!user)throw new Error('FORBIDDEN: Operator tidak terdaftar dalam database.')
  const additional:unknown=user.roles ? JSON.parse(user.roles) : []
  if(!Array.isArray(additional)||additional.some(role=>typeof role!=='string'))throw new Error('Konfigurasi role operator tidak valid.')
  return [...new Set([user.role,...additional])]
}

export async function assertStoredFinanceRole(userId:string,allowed:readonly string[]):Promise<string>{
  const roles=await storedFinanceRoles(userId)
  const role=allowed.find(value=>roles.includes(value))
  if(!role||roles.includes('pimpinan'))throw new Error('FORBIDDEN: Operator hanya memiliki hak baca.')
  return role
}
