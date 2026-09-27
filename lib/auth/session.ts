// lib/auth/session.ts

import { cookies } from 'next/headers'
import { cache } from 'react'
import { execute, queryOne } from '@/lib/db'

export const SESSION_COOKIE = 'eskahade_session'

// Sesi staf bersifat persisten. JWT tidak diberi `exp`, sehingga server tidak
// akan mengakhiri sesi hanya karena waktu berjalan. Cookie tetap diberi umur
// panjang agar login bertahan setelah browser ditutup.
export const STAFF_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10
const STAFF_SESSION_TOKEN_MAX_AGE: number | null = null
let structuralJabatanColumnReady = false
const STRUCTURAL_ROLE_VALUES = ['pengurus_asrama', 'sekpen', 'dewan_santri', 'keamanan']
const DEFAULT_STRUCTURAL_JABATAN = 'anggota'

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET tidak ditemukan di environment variables')
  return secret
}

export type SessionUser = {
  id: string
  email: string
  full_name: string
  avatar_url?: string | null
  role: string
  roles: string[]
  asrama_binaan: string | null
  structural_jabatan?: string | null
  psb_verifikasi_akses?: boolean
  psb_asrama_akses?: boolean
  psb_bayar_akses?: boolean
  upk_panitia_akses?: boolean
  /**
   * Ditandai true oleh rute login HANYA bila akun demo ini berasal dari DEMO_DB.
   * Akun ber-role 'demo' yang kebetulan ada di DB produksi tidak mendapat tanda
   * ini, sehingga tidak pernah memperoleh hak tulis ke data pesantren sebenarnya.
   */
  demoSandbox?: boolean
}

type SessionUserRow = {
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: string | null
  roles: string | null
  asrama_binaan: string | null
  structural_jabatan: string | null
  psb_verifikasi_akses: number | null
  psb_asrama_akses: number | null
  psb_bayar_akses: number | null
  upk_panitia_akses: number | null
}

export async function ensureUserStructuralJabatanColumn() {
  if (structuralJabatanColumnReady) return
  try {
    await execute('ALTER TABLE users ADD COLUMN structural_jabatan TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }
  for (const col of ['psb_verifikasi_akses', 'psb_asrama_akses', 'psb_bayar_akses', 'upk_panitia_akses']) {
    try {
      await execute(`ALTER TABLE users ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`)
    } catch (error: any) {
      if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
        throw error
      }
    }
  }
  for (const { col, type } of [{ col: 'guru_id', type: 'INTEGER' }, { col: 'santri_id', type: 'TEXT' }]) {
    try {
      await execute(`ALTER TABLE users ADD COLUMN ${col} ${type}`)
    } catch (error: any) {
      if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
        throw error
      }
    }
  }
  try {
    await execute(`UPDATE users SET guru_id = CAST(source_ref_id AS INTEGER) WHERE source_type = 'guru' AND guru_id IS NULL`)
    await execute(`UPDATE users SET santri_id = source_ref_id WHERE (source_type = 'sadesa' OR source_type = 'santri') AND santri_id IS NULL`)
  } catch (err: any) {
    console.error('Failed to backfill guru_id/santri_id', err)
  }
  structuralJabatanColumnReady = true
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

export async function createJWTToken(payload: object, maxAgeSeconds: number | null = STAFF_SESSION_TOKEN_MAX_AGE): Promise<string> {
  return createJWT(payload, maxAgeSeconds)
}

async function createJWT(payload: object, maxAgeSeconds: number | null = STAFF_SESSION_TOKEN_MAX_AGE): Promise<string> {
  const secret = getJWTSecret()
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const issuedAt = Math.floor(Date.now() / 1000)
  const bodyPayload: Record<string, unknown> = {
    ...payload,
    iat: issuedAt,
  }
  if (maxAgeSeconds !== null) {
    bodyPayload.exp = issuedAt + maxAgeSeconds
  }
  const body = base64urlEncode(JSON.stringify(bodyPayload))

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

// Verify generik (dipakai juga oleh session portal ortu di lib/portal/session.ts).
// Payload dikembalikan apa adanya — caller yang memvalidasi bentuknya.
export async function verifyJWTToken<T = Record<string, unknown>>(token: string): Promise<T | null> {
  return (await verifyJWT(token)) as T | null
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
    maxAge: STAFF_SESSION_COOKIE_MAX_AGE
  })
}

export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
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
})

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
    await ensureUserStructuralJabatanColumn()
    const user = await queryOne<SessionUserRow>(
      'SELECT email, full_name, avatar_url, role, roles, asrama_binaan, structural_jabatan, psb_verifikasi_akses, psb_asrama_akses, psb_bayar_akses, upk_panitia_akses FROM users WHERE id = ?',
      [session.id]
    )

    if (!user) return null

    const roles = parseRoles(user.roles, user.role || session.role)
    return {
      ...session,
      email: user.email || session.email,
      full_name: user.full_name || session.full_name,
      avatar_url: user.avatar_url ?? null,
      role: roles[0] || user.role || session.role,
      roles,
      asrama_binaan: user.asrama_binaan ?? null,
      structural_jabatan: user.structural_jabatan ?? null,
      psb_verifikasi_akses: Number(user.psb_verifikasi_akses ?? 0) === 1,
      psb_asrama_akses: Number(user.psb_asrama_akses ?? 0) === 1,
      psb_bayar_akses: Number(user.psb_bayar_akses ?? 0) === 1,
      upk_panitia_akses: Number(user.upk_panitia_akses ?? 0) === 1,
    }
  } catch (err: any) {
    console.error('[session] hydrateSessionFromDb ERROR:', err?.message)
    return {
      ...session,
      roles: getRoles(session),
      structural_jabatan: session.structural_jabatan ?? null,
    }
  }
}

export function hasRole(session: SessionUser | null, role: string): boolean {
  if (!session) return false
  return getEffectiveRoles(session).includes(role)
}

export function hasAnyRole(session: SessionUser | null, roles: string[]): boolean {
  if (!session) return false
  const userRoles = getEffectiveRoles(session)
  return roles.some(r => userRoles.includes(r))
}

export function isAdmin(session: SessionUser | null): boolean {
  return hasRole(session, 'admin')
}

// Grant khusus per-user (bukan berbasis role) untuk step-step PSB, diberikan ke
// petugas tertentu (mis. pengurus_asrama yang ditunjuk). User bertindak penuh
// seperti admin pada step tsb & melihat seluruh santri PSB (tak di-scope asrama).
export function hasPsbVerifikasiAkses(session: SessionUser | null): boolean {
  return Boolean(session?.psb_verifikasi_akses)
}

export function hasPsbAsramaAkses(session: SessionUser | null): boolean {
  return Boolean(session?.psb_asrama_akses)
}

export function hasPsbBayarAkses(session: SessionUser | null): boolean {
  return Boolean(session?.psb_bayar_akses)
}

export function hasAnyPsbAkses(session: SessionUser | null): boolean {
  return hasPsbVerifikasiAkses(session) || hasPsbAsramaAkses(session) || hasPsbBayarAkses(session)
}

export function hasUpkPanitiaAkses(session: SessionUser | null): boolean {
  return Boolean(session?.upk_panitia_akses)
}

// Role AKUN DEMO: setara super admin (bypass gate fitur). Data sudah disandbox
// ke DEMO_DB lewat getDB(), jadi akses penuh ini aman terhadap data asli.
export function isDemo(session: SessionUser | null): boolean {
  return hasRole(session, 'demo')
}

/**
 * True hanya bila request ini adalah sesi demo yang BENAR-BENAR login dari
 * database sandbox (DEMO_DB).
 *
 * Dipakai sebagai syarat tambahan sebelum memberi hak tulis ke role 'demo'.
 *
 * Kenapa tidak sekadar mencocokkan nama role: sebuah database produksi bisa saja
 * ikut memiliki akun ber-role 'demo' (contoh nyata: demo@sukahideng.or.id ada di
 * DB produksi). Akun seperti itu TIDAK boleh mendapat akses tulis ke data
 * pesantren sebenarnya. Karena itu penanda `demoSandbox` diisi oleh rute login
 * hanya ketika akun ditemukan di DEMO_DB.
 *
 * Catatan: menjaga kompatibilitas sesi lama -> bila penanda tidak ada, hasilnya
 * false (read-only), yang merupakan default paling aman.
 */
export function isDemoSandboxRequest(session: SessionUser | null): boolean {
  return isDemo(session) && session?.demoSandbox === true
}

// Akses super: admin asli ATAU akun demo. Dipakai di titik bypass akses fitur.
export function isSuperAccess(session: SessionUser | null): boolean {
  return isAdmin(session) || isDemo(session)
}

/**
 * Role yang boleh MENGUBAH data keuangan: admin, bendahara, pengelola koperasi,
 * atau akun demo **yang benar-benar berjalan di sandbox**.
 *
 * PENTING soal akun demo:
 * Role 'demo' hanya boleh menulis bila query-nya diarahkan ke DEMO_DB. Ada
 * kemungkinan nyata sebuah database produksi ikut memiliki akun ber-role 'demo'
 * (mis. demo@sukahideng.or.id pernah dibuat di DB produksi). Akun seperti itu
 * TIDAK boleh mendapat akses tulis ke data pesantren sebenarnya, sehingga
 * pemanggil wajib memverifikasi konteks sandbox lebih dulu lewat
 * isDemoSandboxRequest(), bukan hanya mencocokkan nama role.
 *
 * Helper ini ada supaya aturan tersebut tidak ditulis ulang secara manual di
 * tiap modul (sebelumnya beberapa modul lupa menyertakan 'demo' sehingga akun
 * demo malah terkunci read-only).
 */
export const FINANCE_MUTATE_ROLES: readonly string[] = [
  'admin',
  'bendahara',
  'admin_koperasi',
  'petugas_koperasi',
]

/**
 * @param roles  role efektif pengguna
 * @param demoRunsInSandbox  true hanya bila request demo sudah dipastikan
 *        diarahkan ke DEMO_DB. Default false = paling aman (demo read-only).
 */
export function hasFinanceMutateRole(
  roles: readonly string[],
  demoRunsInSandbox = false
): boolean {
  return roles.some((role) => {
    if (role === 'demo') return demoRunsInSandbox
    return FINANCE_MUTATE_ROLES.includes(role)
  })
}

/** Role yang hanya boleh MELIHAT data keuangan. */
export function isFinanceViewOnlyRole(
  roles: readonly string[],
  demoRunsInSandbox = false
): boolean {
  return !hasFinanceMutateRole(roles, demoRunsInSandbox)
}

/** Role finance utama untuk ditampilkan di UI (bukan label teknis 'demo'). */
export function getPrimaryFinanceRole(roles: readonly string[]): string {
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('bendahara')) return 'bendahara'
  if (roles.includes('admin_koperasi')) return 'admin_koperasi'
  if (roles.includes('petugas_koperasi')) return 'petugas_koperasi'
  if (roles.includes('demo')) return 'demo'
  if (roles.includes('pimpinan')) return 'pimpinan'
  return roles[0] || 'viewer'
}

export function getEffectiveRoles(session: SessionUser | null): string[] {
  if (!session) return []
  const baseRoles = getRoles(session)
  const expandedRoles = new Set<string>()

  // Ekspansi role lama yang menggunakan format "baseRole:jabatan" 
  // agar baseRole tetap dikenali oleh hasRole()
  for (const role of baseRoles) {
    expandedRoles.add(role)
    const parts = role.split(':')
    if (parts.length === 2 && STRUCTURAL_ROLE_VALUES.includes(parts[0]) && parts[1] !== '') {
      expandedRoles.add(parts[0])
      expandedRoles.add(`jabatan:${parts[1]}`)
    }
  }

  const needsStructuralJabatan = Array.from(expandedRoles).some(role => STRUCTURAL_ROLE_VALUES.includes(role))
  const structuralJabatan = needsStructuralJabatan ? (session.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : session.structural_jabatan

  if (structuralJabatan) {
    expandedRoles.add(`jabatan:${structuralJabatan}`)
    for (const role of Array.from(expandedRoles)) {
      if (STRUCTURAL_ROLE_VALUES.includes(role)) {
        expandedRoles.add(`${role}:${structuralJabatan}`)
      }
    }
  }

  if (session.upk_panitia_akses) {
    expandedRoles.add('panitia_upk')
  }

  return Array.from(expandedRoles)
}
