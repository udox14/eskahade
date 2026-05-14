// lib/cache/fitur-akses.ts
//
// Multi-role aware permission engine.
// Supports: multi-role checks + per-user grant/revoke overrides.

import { execute, query } from '@/lib/db'

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

let fiturSchemaReady = false

async function ensureFiturAksesReady() {
  if (fiturSchemaReady) return

  await execute(`
    CREATE TABLE IF NOT EXISTS fitur_akses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_name TEXT NOT NULL,
      title TEXT NOT NULL,
      href TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT '',
      roles TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      urutan INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute('CREATE INDEX IF NOT EXISTS idx_fitur_akses_active ON fitur_akses(is_active)')
  await execute('CREATE INDEX IF NOT EXISTS idx_fitur_akses_href ON fitur_akses(href)')

  const columns = await query<{ name: string }>('PRAGMA table_info(fitur_akses)')
  if (!columns.some(col => col.name === 'is_bottomnav')) {
    await execute('ALTER TABLE fitur_akses ADD COLUMN is_bottomnav INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.some(col => col.name === 'bottomnav_urutan')) {
    await execute('ALTER TABLE fitur_akses ADD COLUMN bottomnav_urutan INTEGER NOT NULL DEFAULT 0')
  }

  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES
      ('_standalone', 'Dashboard', '/dashboard', 'LayoutDashboard', '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]', 1, 0),
      ('Asrama', 'Kamar', '/dashboard/asrama/kamar', 'DoorOpen', '["admin","pengurus_asrama"]', 1, 5),
      ('Asrama', 'Perpindahan Kamar', '/dashboard/asrama/perpindahan-kamar', 'ArrowLeftRight', '["admin","pengurus_asrama"]', 1, 6),
      ('Asrama', 'Plotting Kamar Manual', '/dashboard/asrama/plotting-kamar-manual', 'DoorOpen', '["admin","pengurus_asrama"]', 1, 7),
      ('Master Data', 'Masa Santri Baru', '/dashboard/pengaturan/santri-baru', 'CalendarDays', '["admin"]', 1, 7),
      ('Master Data', 'Manajemen Fitur', '/dashboard/pengaturan/fitur-akses', 'ToggleRight', '["admin"]', 1, 8)
  `)

  fiturSchemaReady = true
}

// Ambil SEMUA fitur — query langsung ke D1, dengan fallback aman kalau DB error
export async function getCachedFiturAkses(): Promise<FiturAkses[]> {
  try {
    await ensureFiturAksesReady()
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
  } catch (err: unknown) {
    console.error('[fitur-akses] getCachedFiturAkses ERROR:', err instanceof Error ? err.message : err)
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
