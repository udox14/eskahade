import { cookies } from 'next/headers'
import { queryOne } from '@/lib/db'
import { SESSION_COOKIE, getSessionFromCookieString, type SessionUser } from '@/lib/auth/session'

/** Proof-route adapter: existing JWT verifier + SELECT-only current permissions.
 * getSession() intentionally isn't used here: its hydration runs lazy schema DDL.
 * No global auth/session behavior is changed and stale JWT permissions never win.
 */
export async function readProofStaffSession(): Promise<SessionUser|null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    if (!token) return null
    const signed = await getSessionFromCookieString(`${SESSION_COOKIE}=${token}`)
    if (!signed || typeof signed.id !== 'string' || !signed.id) return null
    const row = await queryOne<{
      role:string|null; roles:string|null; asrama_binaan:string|null; structural_jabatan:string|null
    }>('SELECT role,roles,asrama_binaan,structural_jabatan FROM users WHERE id=?', [signed.id])
    if (!row) return null
    const parsed:unknown = row.roles ? JSON.parse(row.roles) : []
    if (!Array.isArray(parsed) || parsed.some(role=>typeof role !== 'string')) return null
    const roles:string[] = parsed.length ? parsed : row.role ? [row.role] : []
    if (!roles.length) return null
    return {...signed, role:roles[0], roles, asrama_binaan:row.asrama_binaan, structural_jabatan:row.structural_jabatan}
  } catch { return null }
}
