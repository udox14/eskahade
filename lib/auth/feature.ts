import { getSession, getEffectiveRoles, isAdmin, type SessionUser } from '@/lib/auth/session'
import { canAccessHref } from '@/lib/cache/fitur-akses'
import { canCrudForSession, type CrudAction } from '@/lib/auth/crud'

export type FeatureAction = 'read' | CrudAction

export async function canAccessFeatureForSession(
  session: SessionUser | null,
  href: string
): Promise<boolean> {
  if (!session) return false
  if (isAdmin(session)) return true

  const roles = getEffectiveRoles(session)
  if (roles.length === 0) return false

  try {
    return await canAccessHref(href, roles, session.id)
  } catch (err: any) {
    console.error('[feature] canAccessFeatureForSession ERROR untuk', href, '-', err?.message)
    return false
  }
}

export async function canFeatureForSession(
  session: SessionUser | null,
  href: string,
  action: FeatureAction = 'read'
): Promise<boolean> {
  if (action === 'read') {
    return canAccessFeatureForSession(session, href)
  }

  return canCrudForSession(session, href, action)
}

export async function canFeature(
  href: string,
  action: FeatureAction = 'read'
): Promise<boolean> {
  const session = await getSession()
  return canFeatureForSession(session, href, action)
}

export async function assertFeature(
  href: string,
  action: FeatureAction = 'read'
): Promise<SessionUser | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const allowed = await canFeatureForSession(session, href, action)
  if (!allowed) return { error: 'Akses ditolak' }

  return session
}
