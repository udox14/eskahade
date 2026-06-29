// lib/auth/demo-context.ts
//
// Deteksi apakah request saat ini berasal dari session role 'demo'.
// PENTING: file ini TIDAK boleh meng-import '@/lib/db' (dipakai oleh getDB()
// di lib/db/index.ts). Mengimport lib/db akan membuat circular import.
//
// Verifikasi JWT dilakukan murni dengan Web Crypto + JWT_SECRET (tanpa DB).
// Helper base64url + verify HMAC sengaja diduplikasi dari lib/auth/session.ts.

import { cookies } from 'next/headers'

const SESSION_COOKIE = 'eskahade_session'

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET tidak ditemukan di environment variables')
  return secret
}

function base64urlDecode(data: string): string {
  const pad = (4 - (data.length % 4)) % 4
  const padded = data + '='.repeat(pad)
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
}

async function verifyAndDecode(token: string): Promise<Record<string, unknown> | null> {
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
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

function payloadHasDemoRole(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false
  const roles = payload.roles
  if (Array.isArray(roles) && roles.includes('demo')) return true
  if (typeof payload.role === 'string' && payload.role === 'demo') return true
  return false
}

// Dipakai getDB() untuk memilih binding DB. Aman: JWT ber-HMAC,
// tidak bisa dipalsukan tanpa JWT_SECRET.
export async function isDemoRequest(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return false
    const payload = await verifyAndDecode(token)
    return payloadHasDemoRole(payload)
  } catch {
    return false
  }
}
