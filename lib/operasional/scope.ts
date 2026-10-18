import { hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'

export const asramaUnitId = (asrama: string) => `ASRAMA:${asrama.trim().toUpperCase()}`

/** Same unit policy as the ledger. No DB access, initialization or writes. */
export function operationalUnitIds(session: SessionUser): string[] | null {
  if (isAdmin(session) || hasRole(session, 'bendahara') || hasRole(session, 'tester')) return null
  const ids: string[] = []
  if (hasRole(session, 'sekpen')) ids.push('SEKPEN')
  if (hasRole(session, 'keamanan')) ids.push('KEAMANAN')
  if (hasRole(session, 'pengurus_asrama') && session.asrama_binaan) ids.push(asramaUnitId(session.asrama_binaan))
  return ids
}
