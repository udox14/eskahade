// lib/auth/session.ts

import { cookies } from 'next/headers'

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
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('[verifyJWT] token parts invalid, count:', parts.length)
      return null
    }
    const [header, body, sig] = parts
    if (!header || !body || !sig) {
      console.error('[verifyJWT] header/body/sig kosong')
      return null
    }

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )

    // Fix TypeScript: buat ArrayBuffer eksplisit agar kompatibel dengan crypto.subtle.verify
    let sigBuffer: ArrayBuffer
    try {
      const sigDecoded = base64urlDecode(sig)
      const sigArr = new Uint8Array(sigDecoded.length)
      for (let i = 0; i < sigDecoded.length; i++) {
        sigArr[i] = sigDecoded.charCodeAt(i)
      }
      sigBuffer = sigArr.buffer as ArrayBuffer
    } catch (e: any) {
      console.error('[verifyJWT] base64urlDecode sig ERROR:', e?.message)
      return null
    }

    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, enc.encode(`${header}.${body}`))
    if (!valid) {
      console.error('[verifyJWT] signature TIDAK VALID — JWT_SECRET mungkin berbeda saat sign vs verify')
      return null
    }

    let payload: any
    try {
      payload = JSON.parse(base64urlDecode(body))
    } catch (e: any) {
      console.error('[verifyJWT] JSON.parse body ERROR:', e?.message)
      return null
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('[verifyJWT] token EXPIRED')
      return null
    }

    console.log('[verifyJWT] OK, role:', payload.role)
    return payload as SessionUser
  } catch (e: any) {
    console.error('[verifyJWT] unexpected ERROR:', e?.message)
    return null
  }
}

export async function setSession(user: SessionUser): Promise<void> {
  const token = await createJWT(user)
  console.log('[setSession] token length:', token.length, 'role:', user.role)
  const cookieStore = await cookies()
  cookieStore.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
  console.log('[setSession] cookie set OK')
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) {
      console.log('[getSession] cookie tidak ada')
      return null
    }
    console.log('[getSession] token ditemukan, length:', token.length)
    return await verifyJWT(token)
  } catch (e: any) {
    console.error('[getSession] ERROR:', e?.message)
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