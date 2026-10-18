import { getSession, getEffectiveRoles, hasFinanceMutateRole, isDemoSandboxRequest } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'

export async function authorizeFinanceFeature(path: string, mutate = false) {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED: Silakan masuk kembali.')
  const roles = getEffectiveRoles(session)
  const privileged = roles.some(role => ['admin','bendahara','pimpinan'].includes(role))
  if (!privileged && !await canAccessFeatureForSession(session, path)) throw new Error('FORBIDDEN: Tidak memiliki akses fitur keuangan.')
  if (mutate && (roles.includes('pimpinan') || !hasFinanceMutateRole(roles,isDemoSandboxRequest(session)))) throw new Error('FORBIDDEN: Akun hanya memiliki hak baca.')
  return {session,roles}
}
