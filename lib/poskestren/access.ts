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

/** Hak hapus data POSKESTREN: admin sistem, atau ketua/sekretaris/bendahara POSKESTREN. */
export function canPoskestrenDelete(session: SessionUser | null): boolean {
  if (!session) return false
  if (isSuperAccess(session)) return true
  const roles = getEffectiveRoles(session)
  return (
    roles.includes('poskestren:ketua') ||
    roles.includes('poskestren:sekretaris') ||
    roles.includes('poskestren:bendahara')
  )
}

export type PoskestrenHealthAccess = {
  session: SessionUser
  mode: 'FULL' | 'SUMMARY_ALL' | 'SUMMARY_ASRAMA'
  asrama: string | null
  canWriteOutsideTreatment: boolean
}

function hasPoskestrenRole(session: SessionUser) {
  const roles = getEffectiveRoles(session)
  return roles.includes('poskestren') || roles.some(role => role.startsWith('poskestren:'))
}

export async function requirePoskestrenHealthRead(): Promise<PoskestrenHealthAccess> {
  const session = await getSession()
  if (!session) throw new PoskestrenAccessError('Tidak terautentikasi.')
  if (isSuperAccess(session) || hasPoskestrenRole(session)) {
    return { session, mode: 'FULL', asrama: null, canWriteOutsideTreatment: true }
  }
  const roles = getEffectiveRoles(session)
  if (roles.includes('dewan_santri')) {
    return { session, mode: 'SUMMARY_ALL', asrama: null, canWriteOutsideTreatment: false }
  }
  if (roles.includes('pengurus_asrama')) {
    if (!session.asrama_binaan) {
      throw new PoskestrenAccessError('Akun pengurus belum memiliki asrama binaan.')
    }
    return {
      session,
      mode: 'SUMMARY_ASRAMA',
      asrama: session.asrama_binaan,
      canWriteOutsideTreatment: true,
    }
  }
  throw new PoskestrenAccessError()
}

export async function requirePoskestrenClinicalWrite(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new PoskestrenAccessError('Tidak terautentikasi.')
  if (!isSuperAccess(session) && !hasPoskestrenRole(session)) {
    throw new PoskestrenAccessError('Hanya petugas POSKESTREN yang dapat mengubah data klinis.')
  }
  return session
}

export async function requireOutsideTreatmentWrite(): Promise<PoskestrenHealthAccess> {
  const access = await requirePoskestrenHealthRead()
  if (!access.canWriteOutsideTreatment) {
    throw new PoskestrenAccessError('Akses input Berobat Keluar ditolak.')
  }
  return access
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

