import { type SessionUser, hasRole, isAdmin } from '@/lib/auth/session'
import { isAsramaTanpaKamar, ROOM_REQUIRED_ASRAMA_LIST } from '@/lib/asrama'

export const SADESA_UNIT = 'SADESA'
export const SADESA_CATEGORY = 'SADESA'
export const REGULER_CATEGORY = 'REGULER'
export const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST

export type SppScopeKind = 'ASRAMA' | 'SADESA' | 'ADMIN'

export type SppScope = {
  kind: SppScopeKind
  lockedUnit: string | null
  defaultUnit: string
}

export function getSppScope(session: SessionUser | null): SppScope | null {
  if (!session) return null
  if (isAdmin(session)) {
    return { kind: 'ADMIN', lockedUnit: null, defaultUnit: ASRAMA_LIST[0] }
  }
  if (hasRole(session, 'pengurus_asrama') && session.asrama_binaan) {
    if (isAsramaTanpaKamar(session.asrama_binaan)) return null
    return { kind: 'ASRAMA', lockedUnit: session.asrama_binaan, defaultUnit: session.asrama_binaan }
  }
  if (hasRole(session, 'dewan_santri')) {
    return { kind: 'SADESA', lockedUnit: SADESA_UNIT, defaultUnit: SADESA_UNIT }
  }
  return null
}

export function isSadesaUnit(unit: string | null | undefined) {
  return String(unit ?? '').trim().toUpperCase() === SADESA_UNIT
}

export function isSadesaCategory(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase() === SADESA_CATEGORY
}
