// lib/portal/session.ts
// Session Portal Orang Tua — JWT terpisah dari session staff.
//
// Cookie: eskahade_portal_session (staff memakai eskahade_session). Karena beda
// cookie, guardPage/getSession staf & routing DEMO_DB/tester di getDB() tidak
// tersentuh sama sekali oleh login ortu.
//
// Edge yang diterima: bila di browser yang sama ada staf ber-role `demo` yang
// sedang login, getDB() mengarahkan SEMUA query request tsb ke DEMO_DB
// (routing membaca eskahade_session). Santri produksi tidak ada di sana →
// hidrasi di getPortalSession() gagal → ortu di-bounce ke halaman login.
// Kegagalan aman, bukan kebocoran data.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { createJWTToken, verifyJWTToken } from '@/lib/auth/session'

export const PORTAL_COOKIE = 'eskahade_portal_session'
const PORTAL_MAX_AGE = 60 * 60 * 24 * 30 // 30 hari (cookie yang membatasi umur session)

export type PortalTokenPayload = {
  kind: 'portal_ortu'
  santri_id: string
  nis: string
  nama: string
}

export type PortalSession = PortalTokenPayload & {
  asrama: string | null
  kamar: string | null
  bebas_spp: boolean
  kategori_santri: string
  foto_url: string | null
  must_change_password: boolean
}

export async function createPortalToken(payload: PortalTokenPayload): Promise<string> {
  return createJWTToken(payload)
}

export function portalCookieOptions() {
  return {
    name: PORTAL_COOKIE,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: PORTAL_MAX_AGE,
  }
}

export async function getPortalSession(): Promise<PortalSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(PORTAL_COOKIE)?.value
    if (!token) return null

    const payload = await verifyJWTToken<Partial<PortalTokenPayload>>(token)
    if (!payload || payload.kind !== 'portal_ortu' || typeof payload.santri_id !== 'string') return null

    const santri = await queryOne<{
      id: string
      nis: string
      nama_lengkap: string
      status_global: string
      asrama: string | null
      kamar: string | null
      bebas_spp: number | null
      kategori_santri: string | null
      foto_url: string | null
    }>(
      `SELECT id, nis, nama_lengkap, status_global, asrama, kamar,
              COALESCE(bebas_spp, 0) AS bebas_spp,
              COALESCE(kategori_santri, 'REGULER') AS kategori_santri,
              foto_url
       FROM santri WHERE id = ?`,
      [payload.santri_id]
    )
    if (!santri || santri.status_global !== 'aktif') return null

    const cred = await queryOne<{ is_active: number; must_change_password: number }>(
      `SELECT is_active, must_change_password FROM portal_ortu_credentials WHERE santri_id = ?`,
      [santri.id]
    )
    if (cred && Number(cred.is_active) === 0) return null

    return {
      kind: 'portal_ortu',
      santri_id: santri.id,
      nis: santri.nis,
      nama: santri.nama_lengkap,
      asrama: santri.asrama,
      kamar: santri.kamar,
      bebas_spp: Number(santri.bebas_spp) === 1,
      kategori_santri: santri.kategori_santri || 'REGULER',
      foto_url: santri.foto_url,
      must_change_password: Number(cred?.must_change_password ?? 0) === 1,
    }
  } catch {
    return null
  }
}

// Guard untuk page.tsx portal (Server Component)
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession()
  if (!session) redirect('/portal-ortu/login')
  return session
}

// Guard halaman + paksa ganti password default sebelum memakai fitur lain
export async function requirePortalSessionStrict(): Promise<PortalSession> {
  const session = await requirePortalSession()
  if (session.must_change_password) redirect('/portal-ortu/akun?wajib=1')
  return session
}

// Guard untuk server actions (throw, bukan redirect)
export async function requirePortalSessionAction(): Promise<PortalSession> {
  const session = await getPortalSession()
  if (!session) throw new Error('Sesi portal tidak valid. Silakan login ulang.')
  return session
}
