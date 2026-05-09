'use server'

import { query, queryOne } from '@/lib/db'
import { getSession, isAdmin } from '@/lib/auth/session'
import {
  ensureActivityLogSchema,
  getActivityLogConfigs,
  updateActivityLogConfig,
  type ActivityLogKind,
} from '@/lib/activity-log'

export type ActivityLogFilters = {
  page?: number
  pageSize?: number
  module?: string
  action?: string
  actor?: string
  q?: string
  startDate?: string
  endDate?: string
}

export type ActivityLogItem = {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_name: string | null
  actor_roles: string[]
  module: string
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  summary: string
  details: Record<string, unknown> | null
  status: string
}

export type ActivityLogConfigItem = {
  fitur_href: string
  group_name: string
  title: string
  log_create: boolean
  log_update: boolean
  log_delete: boolean
}

async function assertAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) {
    throw new Error('Akses ditolak')
  }
}

function parseJsonObject(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeFilters(input: ActivityLogFilters) {
  return {
    page: Math.max(1, Number(input.page || 1)),
    pageSize: Math.min(100, Math.max(10, Number(input.pageSize || 20))),
    module: String(input.module || '').trim(),
    action: String(input.action || '').trim(),
    actor: String(input.actor || '').trim(),
    q: String(input.q || '').trim(),
    startDate: String(input.startDate || '').trim(),
    endDate: String(input.endDate || '').trim(),
  }
}

function buildWhereClause(filters: ReturnType<typeof normalizeFilters>) {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.module) {
    conditions.push('module = ?')
    params.push(filters.module)
  }

  if (filters.action) {
    conditions.push('action = ?')
    params.push(filters.action)
  }

  if (filters.actor) {
    conditions.push('(actor_name LIKE ? OR actor_user_id LIKE ?)')
    params.push(`%${filters.actor}%`, `%${filters.actor}%`)
  }

  if (filters.q) {
    conditions.push('(entity_label LIKE ? OR entity_id LIKE ? OR summary LIKE ?)')
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`)
  }

  if (filters.startDate) {
    conditions.push('date(created_at) >= date(?)')
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('date(created_at) <= date(?)')
    params.push(filters.endDate)
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export async function getActivityLogPage(input: ActivityLogFilters) {
  await assertAdmin()
  await ensureActivityLogSchema()

  const filters = normalizeFilters(input)
  const { sql: whereSql, params } = buildWhereClause(filters)
  const offset = (filters.page - 1) * filters.pageSize

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM activity_log
     ${whereSql}`,
    params
  )

  const rows = await query<{
    id: string
    created_at: string
    actor_user_id: string | null
    actor_name: string | null
    actor_roles: string | null
    module: string
    action: string
    entity_type: string | null
    entity_id: string | null
    entity_label: string | null
    summary: string
    details_json: string | null
    status: string
  }>(
    `SELECT
       id, created_at, actor_user_id, actor_name, actor_roles, module, action,
       entity_type, entity_id, entity_label, summary, details_json, status
     FROM activity_log
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.pageSize, offset]
  )

  const modules = await query<{ module: string }>(
    `SELECT DISTINCT module
     FROM activity_log
     ORDER BY module ASC`
  )
  const actions = await query<{ action: string }>(
    `SELECT DISTINCT action
     FROM activity_log
     ORDER BY action ASC`
  )

  const total = Number(totalRow?.total || 0)
  const configRows = await getActivityLogConfigs()

  return {
    rows: rows.map((row) => {
      const parsedRoles = parseJsonObject(row.actor_roles)
      return {
        ...row,
        actor_roles: Array.isArray(parsedRoles) ? (parsedRoles as string[]) : [],
        details: parseJsonObject(row.details_json),
      }
    }) as ActivityLogItem[],
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters,
    modules: modules.map(item => item.module).filter(Boolean),
    actions: actions.map(item => item.action).filter(Boolean),
    configs: configRows.map((row) => ({
      fitur_href: row.fitur_href,
      group_name: row.group_name,
      title: row.title,
      log_create: row.log_create === 1,
      log_update: row.log_update === 1,
      log_delete: row.log_delete === 1,
    })) as ActivityLogConfigItem[],
  }
}

export async function toggleFeatureLogConfig(
  fiturHref: string,
  kind: ActivityLogKind,
  nextValue: boolean
) {
  await assertAdmin()
  const session = await getSession()

  await updateActivityLogConfig(
    fiturHref,
    { [kind]: nextValue },
    session?.id ?? null
  )

  return { success: true }
}
