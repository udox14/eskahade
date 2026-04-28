import { query, queryOne } from '@/lib/db'
import { getSession, getEffectiveRoles, isAdmin, type SessionUser } from '@/lib/auth/session'

export type CrudAction = 'create' | 'update' | 'delete'

export interface CrudPermission {
  fitur_href: string
  role: string
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

type CrudPermissionRow = {
  fitur_href: string
  role: string
  can_create: number
  can_update: number
  can_delete: number
}

function actionColumn(action: CrudAction): 'can_create' | 'can_update' | 'can_delete' {
  if (action === 'create') return 'can_create'
  if (action === 'update') return 'can_update'
  return 'can_delete'
}

function parseRow(row: CrudPermissionRow): CrudPermission {
  return {
    fitur_href: row.fitur_href,
    role: row.role,
    can_create: row.can_create === 1,
    can_update: row.can_update === 1,
    can_delete: row.can_delete === 1,
  }
}

export async function getCrudPermissionsForAdmin(): Promise<CrudPermission[]> {
  try {
    const rows = await query<CrudPermissionRow>(
      `SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`
    )
    return rows.map(parseRow)
  } catch (err: any) {
    console.error('[crud] getCrudPermissionsForAdmin ERROR:', err?.message)
    return []
  }
}

export async function canCrudForSession(
  session: SessionUser | null,
  fiturHref: string,
  action: CrudAction
): Promise<boolean> {
  if (!session) return false
  if (isAdmin(session)) return true

  const roles = getEffectiveRoles(session)
  if (roles.length === 0) return false

  const column = actionColumn(action)
  const placeholders = roles.map(() => '?').join(',')

  try {
    const row = await queryOne<{ allowed: number }>(
      `SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${placeholders})
         AND ${column} = 1
       LIMIT 1`,
      [fiturHref, ...roles]
    )
    return row?.allowed === 1
  } catch (err: any) {
    console.error('[crud] canCrudForSession ERROR:', err?.message)
    return false
  }
}

export async function canCrud(fiturHref: string, action: CrudAction): Promise<boolean> {
  const session = await getSession()
  return canCrudForSession(session, fiturHref, action)
}

export async function assertCrud(
  fiturHref: string,
  action: CrudAction
): Promise<SessionUser | { error: string }> {
  const session = await getSession()
  const allowed = await canCrudForSession(session, fiturHref, action)
  if (!session) return { error: 'Tidak terautentikasi' }
  if (!allowed) return { error: 'Akses ditolak' }
  return session
}

export async function getCrudForRoles(
  fiturHref: string,
  roles: string[]
): Promise<{ canCreate: boolean; canUpdate: boolean; canDelete: boolean }> {
  if (roles.includes('admin')) {
    return { canCreate: true, canUpdate: true, canDelete: true }
  }
  if (roles.length === 0) {
    return { canCreate: false, canUpdate: false, canDelete: false }
  }

  const placeholders = roles.map(() => '?').join(',')
  try {
    const rows = await query<CrudPermissionRow>(
      `SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${placeholders})`,
      [fiturHref, ...roles]
    )
    return {
      canCreate: rows.some(r => r.can_create === 1),
      canUpdate: rows.some(r => r.can_update === 1),
      canDelete: rows.some(r => r.can_delete === 1),
    }
  } catch (err: any) {
    console.error('[crud] getCrudForRoles ERROR:', err?.message)
    return { canCreate: false, canUpdate: false, canDelete: false }
  }
}
