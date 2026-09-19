'use server'

import { execute, query } from '@/lib/db'
import { getSession, isAdmin } from '@/lib/auth/session'
import { getCrudPermissionsForAdmin, type CrudAction } from '@/lib/auth/crud'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'
import { ensureSidebarGroupsReady } from '@/lib/menu/groups'


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
  'poskestren',
  'pimpinan',
  'poskestren:bendahara',
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

type FiturAdminRow = FiturRow & {
  group_name: string
  icon: string
}

type SidebarGroupAdminRow = {
  group_name: string
  label: string | null
  urutan: number
  is_active: number
  item_count: number
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
  const rows = await query<FiturAdminRow>(
    'SELECT id, group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan FROM fitur_akses ORDER BY group_name, urutan'
  )
  return rows.map(r => ({
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

// ─────────────────────────────────────────────────────────────────────────────
// Manajemen susunan sidebar (grup + urutan item) — mirror mansatas template
// config, disimpan di tabel `sidebar_groups` + kolom `urutan` fitur_akses.
// ─────────────────────────────────────────────────────────────────────────────

type SidebarGroupRow = {
  group_name: string
  label: string | null
  urutan: number
  is_active: number
}

async function renumberSidebarGroups() {
  const rows = await query<SidebarGroupRow>(
    'SELECT group_name, label, urutan, is_active FROM sidebar_groups ORDER BY urutan, group_name'
  )
  await Promise.all(
    rows.map((r, i) => execute('UPDATE sidebar_groups SET urutan = ?, updated_at = datetime(\'now\') WHERE group_name = ?', [i, r.group_name]))
  )
}

async function renumberFiturGroup(groupName: string) {
  const rows = await query<{ id: number }>(
    'SELECT id FROM fitur_akses WHERE group_name = ? ORDER BY urutan, id',
    [groupName]
  )
  await Promise.all(
    rows.map((r, i) => execute('UPDATE fitur_akses SET urutan = ?, updated_at = datetime(\'now\') WHERE id = ?', [i + 1, r.id]))
  )
}

// Ambil semua grup sidebar (dengan jumlah item) untuk panel admin
export async function getSidebarGroupsForAdmin() {
  await assertAdmin()
  await ensureSidebarGroupsReady()
  const rows = await query<SidebarGroupAdminRow>(
    `SELECT sg.group_name, sg.label, sg.urutan, sg.is_active,
            (SELECT COUNT(*) FROM fitur_akses f WHERE f.group_name = sg.group_name) AS item_count
     FROM sidebar_groups sg
     ORDER BY sg.urutan, sg.group_name`
  )
  return rows.map(r => ({
    group_name: r.group_name,
    label: r.label,
    urutan: r.urutan,
    is_active: r.is_active === 1,
    item_count: r.item_count,
  }))
}

// Buat grup baru
export async function createSidebarGroup(groupName: string, label?: string) {
  const session = await assertAdmin()
  const name = groupName.trim()
  if (!name) throw new Error('Nama grup tidak boleh kosong')
  if (name === '_standalone') throw new Error('Nama grup tidak valid')

  await ensureSidebarGroupsReady()
  const exists = await query<{ group_name: string }>(
    'SELECT group_name FROM sidebar_groups WHERE group_name = ?',
    [name]
  )
  if (exists.length > 0) throw new Error('Grup dengan nama tersebut sudah ada')

  await execute(
    'INSERT INTO sidebar_groups (group_name, label, urutan) VALUES (?, ?, (SELECT COALESCE(MAX(urutan), -1) + 1 FROM sidebar_groups))',
    [name, (label?.trim() || null)]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'create',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'create',
    entityType: 'sidebar_group',
    entityId: name,
    entityLabel: label?.trim() || name,
    summary: `Membuat grup sidebar "${label?.trim() || name}"`,
    details: { group_name: name },
  })

  return { success: true }
}

// Rename label tampilan grup (group_name tidak berubah)
export async function renameSidebarGroup(groupName: string, label: string) {
  const session = await assertAdmin()
  if (groupName === '_standalone') throw new Error('Menu Utama tidak bisa di-rename')
  await ensureSidebarGroupsReady()

  const before = await query<SidebarGroupRow>(
    'SELECT group_name, label, urutan, is_active FROM sidebar_groups WHERE group_name = ?',
    [groupName]
  )
  if (before.length === 0) throw new Error('Grup tidak ditemukan')

  const newLabel = label.trim() || null
  await execute("UPDATE sidebar_groups SET label = ?, updated_at = datetime('now') WHERE group_name = ?", [newLabel, groupName])
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'sidebar_group',
    entityId: groupName,
    entityLabel: newLabel || groupName,
    summary: `Mengubah nama grup "${before[0].label || groupName}" menjadi "${newLabel || groupName}"`,
    details: {
      changed_fields: diffWhitelistedFields(
        { label: before[0].label },
        { label: newLabel },
        ['label']
      ),
    },
  })

  return { success: true }
}

// Geser posisi grup naik/turun
export async function moveSidebarGroup(groupName: string, direction: 'up' | 'down') {
  const session = await assertAdmin()
  if (groupName === '_standalone') throw new Error('Menu Utama selalu berada paling atas')
  await ensureSidebarGroupsReady()

  const rows = await query<SidebarGroupRow>(
    'SELECT group_name, label, urutan, is_active FROM sidebar_groups ORDER BY urutan, group_name'
  )
  const idx = rows.findIndex(r => r.group_name === groupName)
  if (idx === -1) throw new Error('Grup tidak ditemukan')

  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= rows.length) return { success: true }

  await execute('UPDATE sidebar_groups SET urutan = ?, updated_at = datetime(\'now\') WHERE group_name = ?', [rows[target].urutan, rows[idx].group_name])
  await execute('UPDATE sidebar_groups SET urutan = ?, updated_at = datetime(\'now\') WHERE group_name = ?', [rows[idx].urutan, rows[target].group_name])
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'sidebar_group',
    entityId: groupName,
    entityLabel: rows[idx].label || groupName,
    summary: `Memindahkan grup "${rows[idx].label || groupName}" ke posisi ${direction === 'up' ? 'atas' : 'bawah'}`,
    details: { direction, neighbor: rows[target].group_name },
  })

  return { success: true }
}

// Aktif/nonaktifkan grup (tersembunyi dari sidebar, item tidak dihapus)
export async function toggleSidebarGroupActive(groupName: string) {
  const session = await assertAdmin()
  if (groupName === '_standalone') throw new Error('Menu Utama tidak bisa dinonaktifkan')
  await ensureSidebarGroupsReady()

  const rows = await query<SidebarGroupRow>(
    'SELECT group_name, label, urutan, is_active FROM sidebar_groups WHERE group_name = ?',
    [groupName]
  )
  if (rows.length === 0) throw new Error('Grup tidak ditemukan')

  const newVal = rows[0].is_active ? 0 : 1
  await execute("UPDATE sidebar_groups SET is_active = ?, updated_at = datetime('now') WHERE group_name = ?", [newVal, groupName])
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'sidebar_group',
    entityId: groupName,
    entityLabel: rows[0].label || groupName,
    summary: `${newVal ? 'Mengaktifkan' : 'Menyembunyikan'} grup "${rows[0].label || groupName}" dari sidebar`,
    details: { group_name: groupName, is_active: newVal },
  })

  return { success: true }
}

// Hapus grup; item di dalamnya dipindahkan ke grup tujuan
export async function deleteSidebarGroup(groupName: string, moveItemsTo?: string) {
  const session = await assertAdmin()
  if (groupName === '_standalone') throw new Error('Menu Utama tidak bisa dihapus')
  await ensureSidebarGroupsReady()

  const rows = await query<SidebarGroupRow>(
    'SELECT group_name, label, urutan, is_active FROM sidebar_groups WHERE group_name = ?',
    [groupName]
  )
  if (rows.length === 0) throw new Error('Grup tidak ditemukan')

  const items = await query<{ id: number }>('SELECT id FROM fitur_akses WHERE group_name = ?', [groupName])
  if (items.length > 0) {
    if (!moveItemsTo || moveItemsTo === groupName) {
      throw new Error('Pilih grup tujuan untuk memindahkan item sebelum menghapus')
    }
    const target = await query<{ group_name: string }>('SELECT group_name FROM sidebar_groups WHERE group_name = ?', [moveItemsTo])
    if (target.length === 0) throw new Error('Grup tujuan tidak ditemukan')
    await execute('UPDATE fitur_akses SET group_name = ?, updated_at = datetime(\'now\') WHERE group_name = ?', [moveItemsTo, groupName])
    await renumberFiturGroup(moveItemsTo)
  }

  await execute('DELETE FROM sidebar_groups WHERE group_name = ?', [groupName])
  await renumberSidebarGroups()
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'delete',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'delete',
    entityType: 'sidebar_group',
    entityId: groupName,
    entityLabel: rows[0].label || groupName,
    summary: `Menghapus grup "${rows[0].label || groupName}"${moveItemsTo ? ` (item dipindah ke ${moveItemsTo})` : ''}`,
    details: { group_name: groupName, moved_to: moveItemsTo ?? null, item_count: items.length },
  })

  return { success: true }
}

// Rename judul menu item
export async function updateFiturTitle(id: number, title: string) {
  const session = await assertAdmin()
  const fitur = await getFiturById(id)
  const newTitle = title.trim()
  if (!newTitle) throw new Error('Judul menu tidak boleh kosong')

  await execute("UPDATE fitur_akses SET title = ?, updated_at = datetime('now') WHERE id = ?", [newTitle, id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: String(id),
    entityLabel: newTitle,
    summary: `Mengubah nama menu "${fitur.title}" menjadi "${newTitle}"`,
    details: {
      href: fitur.href,
      changed_fields: diffWhitelistedFields(
        { title: fitur.title },
        { title: newTitle },
        ['title']
      ),
    },
  })

  return { success: true }
}

// Pindahkan item ke grup lain (ditaruh di urutan terakhir grup tujuan)
export async function moveFiturToGroup(id: number, groupName: string) {
  const session = await assertAdmin()
  const fitur = await getFiturById(id)
  await ensureSidebarGroupsReady()

  const target = await query<{ group_name: string }>('SELECT group_name FROM sidebar_groups WHERE group_name = ?', [groupName])
  if (target.length === 0) throw new Error('Grup tujuan tidak ditemukan')

  const sourceGroup = await query<{ group_name: string }>('SELECT group_name FROM fitur_akses WHERE id = ?', [id])
  const fromGroup = sourceGroup[0]?.group_name ?? ''

  await execute(
    "UPDATE fitur_akses SET group_name = ?, urutan = (SELECT COALESCE(MAX(urutan), 0) + 1 FROM fitur_akses WHERE group_name = ?), updated_at = datetime('now') WHERE id = ?",
    [groupName, groupName, id]
  )
  if (fromGroup && fromGroup !== groupName) await renumberFiturGroup(fromGroup)
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'fitur',
    entityId: String(id),
    entityLabel: fitur.title,
    summary: `Memindahkan menu "${fitur.title}" ke grup "${groupName}"`,
    details: { href: fitur.href, from_group: fromGroup, to_group: groupName },
  })

  return { success: true }
}

// Urutkan ulang item dalam satu grup (daftar id dari atas ke bawah)
export async function reorderFiturItems(groupName: string, orderedIds: number[]) {
  const session = await assertAdmin()
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) throw new Error('Urutan tidak valid')

  const rows = await query<{ id: number }>('SELECT id FROM fitur_akses WHERE group_name = ?', [groupName])
  const validIds = new Set(rows.map(r => r.id))
  const ids = orderedIds.filter(id => validIds.has(id))
  if (ids.length !== rows.length) throw new Error('Daftar urutan tidak lengkap')

  await Promise.all(
    ids.map((id, i) => execute('UPDATE fitur_akses SET urutan = ?, updated_at = datetime(\'now\') WHERE id = ?', [i + 1, id]))
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'fitur_akses',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/fitur-akses',
    logKind: 'update',
    entityType: 'sidebar_group',
    entityId: groupName,
    entityLabel: groupName,
    summary: `Mengubah urutan menu di grup "${groupName}"`,
    details: { group_name: groupName, ordered_ids: ids },
  })

  return { success: true }
}
