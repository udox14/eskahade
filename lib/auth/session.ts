// lib/auth/session.ts

import { cookies } from 'next/headers'

const SESSION_COOKIE = 'eskahade_session'

// Di Cloudflare Workers (via OpenNext), secrets yang di-set via `wrangler secret put`
// langsung tersedia di process.env — tidak perlu getCloudflareContext()
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
  asrama_binaan: string | null
}

function base64urlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(data: string): string {
  const padded = data + '=='.slice((data.length + 3) % 4)
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
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
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
    const sigBytes = Uint8Array.from(base64urlDecode(sig).split('').map(c => c.charCodeAt(0)))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`))
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    return await verifyJWT(token)
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