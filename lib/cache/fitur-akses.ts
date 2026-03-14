// lib/cache/fitur-akses.ts
// Cache terpusat untuk konfigurasi fitur akses per role.
// TTL 5 menit — cukup responsif setelah admin ubah, tanpa hammering DB.
// Invalidasi: panggil revalidateTag('fitur-akses') di action update.

import { unstable_cache } from 'next/cache'
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

// Ambil SEMUA fitur — satu query, di-cache, lalu filter di memory per kebutuhan
export const getCachedFiturAkses = unstable_cache(
  async (): Promise<FiturAkses[]> => {
    const rows = await query<FiturAksesRow>(
      'SELECT id, group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses ORDER BY group_name, urutan',
      []
    )
    return rows.map(r => ({
      ...r,
      roles: JSON.parse(r.roles) as string[],
      is_active: r.is_active === 1,
    }))
  },
  ['fitur-akses-all'],
  { tags: ['fitur-akses'], revalidate: 300 } // 5 menit
)

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
