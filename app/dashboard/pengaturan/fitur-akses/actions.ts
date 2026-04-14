'use server'

import { execute, query } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidateTag } from 'next/cache'

const ALL_ROLES = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']

async function assertAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) {
    throw new Error('Akses ditolak')
  }
}

// Toggle aktif/nonaktif suatu fitur
export async function toggleFiturActive(id: number, currentActive: boolean) {
  await assertAdmin()
  const newVal = currentActive ? 0 : 1
  await execute('UPDATE fitur_akses SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?', [newVal, id])
  revalidateTag('fitur-akses', 'everything')
  return { success: true }
}

// Tambah role ke fitur
export async function addRoleToFitur(id: number, role: string) {
  await assertAdmin()
  if (!ALL_ROLES.includes(role)) throw new Error('Role tidak valid')

  const row = await query<{ roles: string }>('SELECT roles FROM fitur_akses WHERE id = ?', [id])
  if (!row[0]) throw new Error('Fitur tidak ditemukan')

  const roles: string[] = JSON.parse(row[0].roles)
  if (!roles.includes(role)) {
    roles.push(role)
    await execute(
      'UPDATE fitur_akses SET roles = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(roles), id]
    )
    revalidateTag('fitur-akses', 'everything')
  }
  return { success: true }
}

// Hapus role dari fitur
export async function removeRoleFromFitur(id: number, role: string) {
  await assertAdmin()
  if (role === 'admin') return { success: false, message: 'Role admin tidak bisa dihapus dari fitur apapun' }

  const row = await query<{ roles: string }>('SELECT roles FROM fitur_akses WHERE id = ?', [id])
  if (!row[0]) throw new Error('Fitur tidak ditemukan')

  const roles: string[] = JSON.parse(row[0].roles)
  const newRoles = roles.filter(r => r !== role)
  await execute(
    'UPDATE fitur_akses SET roles = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [JSON.stringify(newRoles), id]
  )
  revalidateTag('fitur-akses', 'everything')
  return { success: true }
}

// Ambil semua fitur untuk panel admin (tanpa cache — realtime)
export async function getAllFiturForAdmin() {
  await assertAdmin()
  const rows = await query<any>(
    'SELECT id, group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan FROM fitur_akses ORDER BY group_name, urutan'
  )
  return rows.map((r: any) => ({
    ...r,
    roles: JSON.parse(r.roles) as string[],
    is_active: r.is_active === 1,
    is_bottomnav: r.is_bottomnav === 1,
  }))
}

// Toggle bottom nav secara global (admin only)
export async function toggleBottomNavGlobal(currentEnabled: boolean) {
  await assertAdmin()
  const newVal = currentEnabled ? '0' : '1'
  await execute(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('bottomnav_enabled', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [newVal]
  )
  revalidateTag('fitur-akses', 'everything')
  return { success: true }
}

// Ambil status global bottom nav
export async function getBottomNavGlobalStatus() {
  await assertAdmin()
  const rows = await query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'bottomnav_enabled'"
  )
  return rows[0]?.value === '1'
}

// Toggle is_bottomnav suatu fitur
export async function toggleFiturBottomNav(id: number, currentVal: boolean) {
  await assertAdmin()
  const newVal = currentVal ? 0 : 1
  await execute(
    "UPDATE fitur_akses SET is_bottomnav = ?, updated_at = datetime('now') WHERE id = ?",
    [newVal, id]
  )
  revalidateTag('fitur-akses', 'everything')
  return { success: true }
}

// Update urutan bottom nav suatu fitur (1–4)
export async function setBottomNavUrutan(id: number, urutan: number) {
  await assertAdmin()
  if (urutan < 1 || urutan > 4) throw new Error('Urutan harus antara 1 dan 4')
  await execute(
    "UPDATE fitur_akses SET bottomnav_urutan = ?, updated_at = datetime('now') WHERE id = ?",
    [urutan, id]
  )
  revalidateTag('fitur-akses', 'everything')
  return { success: true }
}
