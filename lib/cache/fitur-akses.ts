// lib/cache/fitur-akses.ts
//
// Multi-role aware permission engine.
// Supports: multi-role checks + per-user grant/revoke overrides.

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
    // Coba query dengan kolom bottomnav dulu (setelah migration 0016)
    // Kalau kolom belum ada, fallback ke query tanpa kolom bottomnav
    let rows: FiturAksesRow[] = []
    try {
      rows = await query<FiturAksesRow>(
        'SELECT id, group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan FROM fitur_akses ORDER BY group_name, urutan',
        []
      )
    } catch {
      // Kolom bottomnav belum ada (migration belum dijalankan) — fallback
      const fallbackRows = await query<Omit<FiturAksesRow, 'is_bottomnav' | 'bottomnav_urutan'>>(
        'SELECT id, group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses ORDER BY group_name, urutan',
        []
      )
      rows = fallbackRows.map(r => ({ ...r, is_bottomnav: 0, bottomnav_urutan: 0 }))
    }
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

// ── Per-user overrides ──────────────────────────────────────────
interface OverrideRow {
  fitur_id: number
  action: string // 'grant' | 'revoke'
}

async function getUserOverrides(userId: string): Promise<OverrideRow[]> {
  try {
    return await query<OverrideRow>(
      'SELECT fitur_id, action FROM user_fitur_override WHERE user_id = ?',
      [userId]
    )
  } catch {
    // Tabel belum ada (migration belum jalan) → kosong
    return []
  }
}

// ── Multi-role helpers ──────────────────────────────────────────

// Helper: filter fitur yang aktif DAN salah satu role user ada di dalamnya,
// PLUS apply per-user overrides (grant/revoke)
export async function getFiturForRoles(roles: string[], userId?: string): Promise<FiturAkses[]> {
  const all = await getCachedFiturAkses()
  const overrides = userId ? await getUserOverrides(userId) : []

  const grantedIds = new Set(overrides.filter(o => o.action === 'grant').map(o => o.fitur_id))
  const revokedIds = new Set(overrides.filter(o => o.action === 'revoke').map(o => o.fitur_id))

  return all.filter(f => {
    if (!f.is_active) return false
    if (revokedIds.has(f.id)) return false              // revoked → blokir
    if (grantedIds.has(f.id)) return true                // granted → izinkan
    return f.roles.some(r => roles.includes(r))          // cek role biasa
  })
}

// Backward compat wrapper — single role
export async function getFiturForRole(role: string): Promise<FiturAkses[]> {
  return getFiturForRoles([role])
}

// Helper: cek apakah bottom nav diaktifkan secara global oleh admin
export async function getBottomNavGlobalEnabled(): Promise<boolean> {
  try {
    const rows = await query<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'bottomnav_enabled'",
      []
    )
    return rows[0]?.value === '1'
  } catch {
    return true // default aktif kalau tabel belum ada
  }
}

// Helper: cek apakah suatu href boleh diakses user dengan multi-role + overrides
export async function canAccessHref(href: string, roles: string[], userId?: string): Promise<boolean> {
  const all = await getCachedFiturAkses()
  const fitur = all.find(f => f.href === href)
  if (!fitur) return false           // href tidak terdaftar → blokir
  if (!fitur.is_active) return false // fitur dinonaktifkan admin → blokir

  // Cek per-user overrides
  if (userId) {
    const overrides = await getUserOverrides(userId)
    const override = overrides.find(o => o.fitur_id === fitur.id)
    if (override) {
      return override.action === 'grant' // grant → true, revoke → false
    }
  }

  // Cek role biasa (multi-role)
  return fitur.roles.some(r => roles.includes(r))
}
