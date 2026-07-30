import { canFeatureForSession, type FeatureAction } from '@/lib/auth/feature'
import { getEffectiveRoles, getSession, isSuperAccess, type SessionUser } from '@/lib/auth/session'

import type { PoskestrenJabatan } from './types'

export class PoskestrenAccessError extends Error {
  constructor(message = 'Akses POSKESTREN ditolak.') {
    super(message)
    this.name = 'PoskestrenAccessError'
  }
}

export function getPoskestrenJabatan(session: SessionUser | null): PoskestrenJabatan | null {
  const roles = getEffectiveRoles(session)
  if (roles.includes('poskestren:bendahara')) return 'bendahara'
  if (roles.includes('poskestren:ketua')) return 'ketua'
  if (roles.includes('poskestren:sekretaris')) return 'sekretaris'
  return null
}

export function isPoskestrenBendahara(session: SessionUser | null) {
  return Boolean(session && (isSuperAccess(session) || getEffectiveRoles(session).includes('poskestren:bendahara')))
}

export async function requirePoskestrenFeature(
  href: string,
  action: FeatureAction = 'read'
): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new PoskestrenAccessError('Tidak terautentikasi.')

  const allowed = await canFeatureForSession(session, href, action)
  if (!allowed) throw new PoskestrenAccessError()
  return session
}

