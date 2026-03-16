'use server'

import { execute, query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidateTag } from 'next/cache'

const ALL_ROLES = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']

async function assertAdmin() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
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
    'SELECT id, group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses ORDER BY group_name, urutan'
  )
  return rows.map((r: any) => ({
    ...r,
    roles: JSON.parse(r.roles) as string[],
    is_active: r.is_active === 1,
  }))
}
