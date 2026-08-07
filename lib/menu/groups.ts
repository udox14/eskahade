// lib/menu/groups.ts
//
// Konfigurasi grup sidebar — sumber kebenaran urutan/label/status grup ada di
// tabel `sidebar_groups` (D1). Item menu tetap di `fitur_akses`.

import { execute, query } from '@/lib/db'

export interface SidebarGroupConfig {
  group_name: string
  label: string | null
  urutan: number
  is_active: boolean
}

let groupsSchemaReady = false

// Idempoten: buat tabel kalau belum ada + sinkronkan grup baru dari fitur_akses
export async function ensureSidebarGroupsReady() {
  if (groupsSchemaReady) return

  await execute(`
    CREATE TABLE IF NOT EXISTS sidebar_groups (
      group_name TEXT PRIMARY KEY,
      label TEXT,
      urutan INTEGER NOT NULL DEFAULT 100,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Grup baru yang muncul langsung dari fitur_akses otomatis ikut terdaftar
  // (urutan default 100 → tampil setelah grup yang sudah dikonfigurasi).
  await execute(`
    INSERT OR IGNORE INTO sidebar_groups (group_name, urutan)
    SELECT DISTINCT group_name, 100 FROM fitur_akses
  `)

  groupsSchemaReady = true
}

export async function getSidebarGroups(): Promise<SidebarGroupConfig[]> {
  try {
    await ensureSidebarGroupsReady()
  } catch {
    // DB tidak tersedia / akun tester read-only → fallback ke urutan kode
    return []
  }

  try {
    const rows = await query<{ group_name: string; label: string | null; urutan: number; is_active: number }>(
      'SELECT group_name, label, urutan, is_active FROM sidebar_groups ORDER BY urutan, group_name'
    )
    return rows.map(r => ({
      group_name: r.group_name,
      label: r.label,
      urutan: r.urutan,
      is_active: r.is_active === 1,
    }))
  } catch (err: unknown) {
    console.error('[sidebar-groups] getSidebarGroups ERROR:', err instanceof Error ? err.message : err)
    return []
  }
}
