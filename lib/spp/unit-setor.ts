import { type SessionUser, hasRole, isAdmin } from '@/lib/auth/session'

export const SADESA_UNIT = 'SADESA'
export const SADESA_CATEGORY = 'SADESA'
export const REGULER_CATEGORY = 'REGULER'
export const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"] as const

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
