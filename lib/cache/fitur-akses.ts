// lib/cache/fitur-akses.ts
//
// CATATAN PENTING:
// unstable_cache dari Next.js TIDAK reliable di Cloudflare Workers dengan OpenNext.
// Penggunaan unstable_cache menyebabkan canAccessHref() selalu return false untuk
// semua non-admin → redirect loop ke /login tanpa pesan error apapun.
//
// Fix: query langsung ke D1 per request. D1 sudah sangat cepat, dan semua halaman
// dashboard sudah pakai `force-dynamic` sehingga tidak ada ISR overhead.

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
}

// Ambil SEMUA fitur — query langsung ke D1 (tanpa unstable_cache)
export async function getCachedFiturAkses(): Promise<FiturAkses[]> {
  const rows = await query<FiturAksesRow>(
    'SELECT id, group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses ORDER BY group_name, urutan',
    []
  )
  return rows.map(r => ({
    ...r,
    roles: (() => {
      try { return JSON.parse(r.roles) as string[] } catch { return [] }
    })(),
    is_active: r.is_active === 1,
  }))
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
