'use server'

import { execute, query } from '@/lib/db'
import { getSession, isAdmin } from '@/lib/auth/session'
import { getCrudPermissionsForAdmin, type CrudAction } from '@/lib/auth/crud'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'


const ALL_ROLES = [
  'admin',
  'demo',
  'tester',
  'keamanan',
  'sekpen',
  'dewan_santri',
  'pengurus_asrama',
  'wali_kelas',
  'guru',
  'bendahara',
  'operator_loket',
  'jabatan:anggota',
  'jabatan:ketua',
  'jabatan:sekretaris',
  'jabatan:bendahara',
]

type FiturRow = {
  id: number
  title: string
  href: string
  roles: string
  is_active: number
  urutan: number
  is_bottomnav: number
  bottomnav_urutan: number
}

async function assertAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) {
    throw new Error('Akses ditolak')
  }
  return session
}

async function getFiturById(id: number) {
  const rows = await query<FiturRow>(
    `SELECT id, title, href, roles, is_active, urutan, is_bottomnav, bottomnav_urutan
     FROM fitur_akses
     WHERE id = ?`,
    [id]
  )

  const row = rows[0]
  if (!row) throw new Error('Fitur tidak ditemukan')

  return {
    ...row,
    roles: JSON.parse(row.roles) as string[],
  }
}

// Toggle aktif/nonaktif suatu fitur
export async function toggleFiturActive(id: number, currentActive: boolean) {
  const session = await assertAdmin()
  const fitur = await getFiturById(id)
  const newVal = currentActive ? 0 : 1

  await execute('UPDATE fitur_akses SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?', [newVal, id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: String(id),
    entityLabel: fitur.title,
    summary: `${newVal ? 'Mengaktifkan' : 'Menonaktifkan'} fitur ${fitur.title}`,
    details: {
      href: fitur.href,
      changed_fields: diffWhitelistedFields(
        { is_active: currentActive ? 1 : 0 },
        { is_active: newVal },
        ['is_active']
      ),
    },
  })
  
  return { success: true }
}

// Tambah role ke fitur
export async function addRoleToFitur(id: number, role: string) {
  const session = await assertAdmin()
  if (!ALL_ROLES.includes(role)) throw new Error('Role tidak valid')

  const fitur = await getFiturById(id)
  const roles = [...fitur.roles]

  if (!roles.includes(role)) {
    roles.push(role)
    await execute(
      'UPDATE fitur_akses SET roles = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(roles), id]
    )
    await logActivity({
      actor: actorFromSession(session),
      module: 'fitur_akses',
      action: 'access_change',
      fiturHref: '/dashboard/pengaturan/fitur-akses',
      logKind: 'update',
      entityType: 'fitur',
      entityId: String(id),
      entityLabel: fitur.title,
      summary: `Menambah role ${role} ke fitur ${fitur.title}`,
      details: {
        href: fitur.href,
        changed_fields: diffWhitelistedFields(
          { roles: fitur.roles },
          { roles },
          ['roles']
        ),
      },
    })
    
  }
  return { success: true }
}

// Hapus role dari fitur
export async function removeRoleFromFitur(id: number, role: string) {
  const session = await assertAdmin()
  if (role === 'admin') return { success: false, message: 'Role admin tidak bisa dihapus dari fitur apapun' }

  const fitur = await getFiturById(id)
  const newRoles = fitur.roles.filter(r => r !== role)

  await execute(
    'UPDATE fitur_akses SET roles = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [JSON.stringify(newRoles), id]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: String(id),
    entityLabel: fitur.title,
    summary: `Menghapus role ${role} dari fitur ${fitur.title}`,
    details: {
      href: fitur.href,
      changed_fields: diffWhitelistedFields(
        { roles: fitur.roles },
        { roles: newRoles },
        ['roles']
      ),
    },
  })
  
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

export async function getAllCrudPermissionsForAdmin() {
  await assertAdmin()
  return getCrudPermissionsForAdmin()
}

export async function toggleCrudPermission(
  fiturHref: string,
  role: string,
  action: CrudAction,
  currentValue: boolean
) {
  const session = await assertAdmin()
  if (!ALL_ROLES.includes(role)) throw new Error('Role tidak valid')
  if (role === 'admin') return { success: false, message: 'Admin selalu full CRUD' }
  if (role === 'tester') return { success: false, message: 'Tester hanya punya akses read-only' }
  if (!['create', 'update', 'delete'].includes(action)) throw new Error('Aksi tidak valid')

  const column =
    action === 'create' ? 'can_create' :
    action === 'update' ? 'can_update' :
    'can_delete'
  const newVal = currentValue ? 0 : 1

  await execute(
    `INSERT INTO role_fitur_crud_permission
       (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
     VALUES (?, ?, 0, 0, 0, datetime('now'), datetime('now'))
     ON CONFLICT(fitur_href, role) DO NOTHING`,
    [fiturHref, role]
  )
  await execute(
    `UPDATE role_fitur_crud_permission
     SET ${column} = ?, updated_at = datetime('now')
     WHERE fitur_href = ? AND role = ?`,
    [newVal, fiturHref, role]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: fiturHref,
    entityLabel: fiturHref,
    summary: `Mengubah izin ${action} role ${role} pada ${fiturHref}`,
    details: {
      role,
      permission: action,
      before: currentValue,
      after: Boolean(newVal),
    },
  })

  return { success: true }
}

// Toggle bottom nav secara global (admin only)
export async function toggleBottomNavGlobal(currentEnabled: boolean) {
  const session = await assertAdmin()
  const newVal = currentEnabled ? '0' : '1'
  await execute(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('bottomnav_enabled', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [newVal]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'app_setting',
    entityId: 'bottomnav_enabled',
    entityLabel: 'Bottom navigation global',
    summary: `${newVal === '1' ? 'Mengaktifkan' : 'Menonaktifkan'} bottom nav global`,
    details: {
      before: currentEnabled,
      after: newVal === '1',
    },
  })
  
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
  const session = await assertAdmin()
  const fitur = await getFiturById(id)
  const newVal = currentVal ? 0 : 1
  await execute(
    "UPDATE fitur_akses SET is_bottomnav = ?, updated_at = datetime('now') WHERE id = ?",
    [newVal, id]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: String(id),
    entityLabel: fitur.title,
    summary: `${newVal ? 'Menambahkan' : 'Menghapus'} ${fitur.title} dari bottom nav`,
    details: {
      href: fitur.href,
      changed_fields: diffWhitelistedFields(
        { is_bottomnav: currentVal ? 1 : 0 },
        { is_bottomnav: newVal },
        ['is_bottomnav']
      ),
    },
  })
  
  return { success: true }
}

// Update urutan bottom nav suatu fitur (1-4)
export async function setBottomNavUrutan(id: number, urutan: number) {
  const session = await assertAdmin()
  if (urutan < 1 || urutan > 4) throw new Error('Urutan harus antara 1 dan 4')

  const fitur = await getFiturById(id)
  await execute(
    "UPDATE fitur_akses SET bottomnav_urutan = ?, updated_at = datetime('now') WHERE id = ?",
    [urutan, id]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: String(id),
    entityLabel: fitur.title,
    summary: `Mengubah urutan bottom nav ${fitur.title} menjadi ${urutan}`,
    details: {
      href: fitur.href,
      changed_fields: diffWhitelistedFields(
        { bottomnav_urutan: fitur.bottomnav_urutan },
        { bottomnav_urutan: urutan },
        ['bottomnav_urutan']
      ),
    },
  })
  
  return { success: true }
}
