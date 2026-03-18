// lib/cache/fitur-akses.ts
//
// CATATAN PENTING:
// unstable_cache dari Next.js TIDAK reliable di Cloudflare Workers dengan OpenNext.
// Fix: query langsung ke D1 per request, dengan try-catch defensif.
// Kalau tabel fitur_akses belum ada / query gagal → return [] bukan throw,
// supaya tidak menyebabkan redirect loop ke /login.

import { query } from '@/lib/db'

export interface FiturAkses {
  id: number
  group_name: string
  title: string
  href: string
  icon: string
  roles: string[]   // sudah di-parse dari JSON
  is_active: boolean
  urutan: number
  is_bottomnav: boolean
  bottomnav_urutan: number
}

// Raw row dari DB
interface FiturAksesRow {
  id: number
  group_name: string
  title: string
  href: string
  icon: string
  roles: string
  is_active: number
  urutan: number
  is_bottomnav: number
  bottomnav_urutan: number
}

// Ambil SEMUA fitur — query langsung ke D1, dengan fallback aman kalau DB error
export async function getCachedFiturAkses(): Promise<FiturAkses[]> {
  try {
    const rows = await query<FiturAksesRow>(
      'SELECT id, group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan FROM fitur_akses ORDER BY group_name, urutan',
      []
    )
    return rows.map(r => ({
      ...r,
      roles: (() => {
        try { return JSON.parse(r.roles) as string[] } catch { return [] }
      })(),
      is_active: r.is_active === 1,
      is_bottomnav: r.is_bottomnav === 1,
    }))
  } catch (err: any) {
    console.error('[fitur-akses] getCachedFiturAkses ERROR:', err?.message)
    return []
  }
}

// Helper: filter hanya fitur yang aktif DAN role user ada di dalamnya
export async function getFiturForRole(role: string): Promise<FiturAkses[]> {
  const all = await getCachedFiturAkses()
  return all.filter(f => f.is_active && f.roles.includes(role))
}

// Helper: cek apakah suatu href boleh diakses role tertentu
export async function canAccessHref(href: string, role: string): Promise<boolean> {
  const all = await getCachedFiturAkses()
  const fitur = all.find(f => f.href === href)
  if (!fitur) return false           // href tidak terdaftar → blokir
  if (!fitur.is_active) return false // fitur dinonaktifkan admin → blokir
  return fitur.roles.includes(role)
}