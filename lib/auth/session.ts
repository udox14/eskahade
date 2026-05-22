// lib/auth/session.ts

import { cookies } from 'next/headers'
import { queryOne } from '@/lib/db'

const SESSION_COOKIE = 'eskahade_session'

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET tidak ditemukan di environment variables')
  return secret
}

export type SessionUser = {
  id: string
  email: string
  full_name: string
  role: string
  roles: string[]
  asrama_binaan: string | null
}

type SessionUserRow = {
  email: string | null
  full_name: string | null
  role: string | null
  roles: string | null
  asrama_binaan: string | null
}

function base64urlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(data: string): string {
  // FIX: padding yang benar untuk base64url
  // Formula lama '=='.slice((data.length + 3) % 4) salah untuk panjang non-kelipatan 4
  const pad = (4 - (data.length % 4)) % 4
  const padded = data + '='.repeat(pad)
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
}

export async function createJWTToken(payload: object): Promise<string> {
  return createJWT(payload)
}

async function createJWT(payload: object): Promise<string> {
  const secret = getJWTSecret()
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10 // 10 tahun
  }))

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`))
  const sigB64 = base64urlEncode(String.fromCharCode(...new Uint8Array(sig)))
  return `${header}.${body}.${sigB64}`
}

async function verifyJWT(token: string): Promise<SessionUser | null> {
  try {
    const secret = getJWTSecret()
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )

    const sigDecoded = base64urlDecode(sig)
    const sigArr = new Uint8Array(sigDecoded.length)
    for (let i = 0; i < sigDecoded.length; i++) {
      sigArr[i] = sigDecoded.charCodeAt(i)
    }
    const sigBuffer = sigArr.buffer as ArrayBuffer

    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, enc.encode(`${header}.${body}`))
    if (!valid) return null

    const payload = JSON.parse(base64urlDecode(body))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload as SessionUser
  } catch {
    return null
  }
}

export async function setSession(user: SessionUser): Promise<void> {
  const token = await createJWT(user)
  const cookieStore = await cookies()
  cookieStore.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365 * 10 // 10 tahun
  })
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    const session = await verifyJWT(token)
    if (!session) return null
    return await hydrateSessionFromDb(session)
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionFromCookieString(cookieString: string): Promise<SessionUser | null> {
  const match = cookieString.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!match) return null
  return await verifyJWT(match[1])
}

// ── Multi-role helpers ────────────────────────────────────────
// Backward-compatible: jika session.roles belum ada (JWT lama),
// fallback ke [session.role].

function getRoles(session: SessionUser): string[] {
  if (session.roles && Array.isArray(session.roles) && session.roles.length > 0) {
    return session.roles
  }
  return session.role ? [session.role] : []
}

function parseRoles(rolesJson: string | null | undefined, fallbackRole: string | null | undefined): string[] {
  try {
    if (rolesJson) {
      const parsed = JSON.parse(rolesJson)
      if (Array.isArray(parsed)) {
        const roles = parsed.filter((role): role is string => typeof role === 'string' && role.length > 0)
        if (roles.length > 0) return roles
      }
    }
  } catch {}

  return fallbackRole ? [fallbackRole] : []
}

async function hydrateSessionFromDb(session: SessionUser): Promise<SessionUser | null> {
  try {
    const user = await queryOne<SessionUserRow>(
      'SELECT email, full_name, role, roles, asrama_binaan FROM users WHERE id = ?',
      [session.id]
    )

    if (!user) return null

    const roles = parseRoles(user.roles, user.role || session.role)
    return {
      ...session,
      email: user.email || session.email,
      full_name: user.full_name || session.full_name,
      role: roles[0] || user.role || session.role,
      roles,
      asrama_binaan: user.asrama_binaan ?? null,
    }
  } catch (err: any) {
    console.error('[session] hydrateSessionFromDb ERROR:', err?.message)
    return {
      ...session,
      roles: getRoles(session),
    }
  }
}

export function hasRole(session: SessionUser | null, role: string): boolean {
  if (!session) return false
  return getRoles(session).includes(role)
}

export function hasAnyRole(session: SessionUser | null, roles: string[]): boolean {
  if (!session) return false
  const userRoles = getRoles(session)
  return roles.some(r => userRoles.includes(r))
}

export function isAdmin(session: SessionUser | null): boolean {
  return hasRole(session, 'admin')
}

export function getEffectiveRoles(session: SessionUser | null): string[] {
  if (!session) return []
  return getRoles(session)
}
