import { headers } from 'next/headers'

import { execute, generateId, query, queryOne } from '@/lib/db'
import type { SessionUser } from '@/lib/auth/session'

type ActivityStatus = 'success' | 'failed'
export type ActivityLogKind = 'create' | 'update' | 'delete'

type ActivityActor = {
  id?: string | null
  name?: string | null
  email?: string | null
  roles?: string[] | null
}

type ActivityRequestInfo = {
  ipAddress?: string | null
  userAgent?: string | null
}

export type ActivityLogConfigRow = {
  fitur_href: string
  group_name: string
  title: string
  log_create: number
  log_update: number
  log_delete: number
  updated_at: string | null
  updated_by: string | null
}

export type ActivityLogInput = {
  actor?: ActivityActor | null
  module: string
  action: string
  entityType?: string | null
  entityId?: string | null
  entityLabel?: string | null
  summary: string
  details?: Record<string, unknown> | null
  status?: ActivityStatus
  requestInfo?: ActivityRequestInfo | null
  fiturHref?: string | null
  logKind?: ActivityLogKind | null
}

export type ActivityLogRow = {
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
  ip_address: string | null
  user_agent: string | null
}

const SENSITIVE_DETAIL_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'cookie',
  'cookies',
  'authorization',
  'auth',
  'secret',
])

const LOG_CONFIG_CACHE_TTL_MS = 60_000

let ensureActivityLogSchemaPromise: Promise<void> | null = null
const logConfigCache = new Map<string, { expiresAt: number; values: Record<ActivityLogKind, boolean> }>()

function truncateString(value: string, limit = 500) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}...`
}

function sanitizeDetailValue(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') return truncateString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 25).map(sanitizeDetailValue)
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_DETAIL_KEYS.has(key.toLowerCase()))
      .slice(0, 50)

    return Object.fromEntries(
      entries.map(([key, innerValue]) => [key, sanitizeDetailValue(innerValue)])
    )
  }
  return String(value)
}

function stringifyRoles(roles: string[] | null | undefined) {
  if (!roles || roles.length === 0) return null
  return JSON.stringify(roles)
}

function normalizeDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) return null
  const sanitized = sanitizeDetailValue(details)
  return JSON.stringify(sanitized)
}

function toLogConfigValues(row: Pick<ActivityLogConfigRow, 'log_create' | 'log_update' | 'log_delete'>) {
  return {
    create: row.log_create === 1,
    update: row.log_update === 1,
    delete: row.log_delete === 1,
  } satisfies Record<ActivityLogKind, boolean>
}

export function actorFromSession(session: SessionUser | null | undefined): ActivityActor | null {
  if (!session) return null
  return {
    id: session.id,
    name: session.full_name,
    email: session.email,
    roles: session.roles,
  }
}

export async function getRequestAuditContext(): Promise<ActivityRequestInfo> {
  try {
    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')
    const ipAddress = headerStore.get('cf-connecting-ip')
      ?? (forwardedFor ? forwardedFor.split(',')[0]?.trim() : null)
      ?? null

    return {
      ipAddress,
      userAgent: headerStore.get('user-agent'),
    }
  } catch {
    return {
      ipAddress: null,
      userAgent: null,
    }
  }
}

export async function ensureActivityLogSchema() {
  if (!ensureActivityLogSchemaPromise) {
    ensureActivityLogSchemaPromise = (async () => {
      await execute(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id            TEXT PRIMARY KEY,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          actor_name    TEXT,
          actor_roles   TEXT,
          module        TEXT NOT NULL,
          action        TEXT NOT NULL,
          entity_type   TEXT,
          entity_id     TEXT,
          entity_label  TEXT,
          summary       TEXT NOT NULL,
          details_json  TEXT,
          status        TEXT NOT NULL DEFAULT 'success',
          ip_address    TEXT,
          user_agent    TEXT
        )
      `)

      await execute(`
        CREATE TABLE IF NOT EXISTS activity_log_config (
          fitur_href   TEXT PRIMARY KEY,
          group_name   TEXT NOT NULL,
          title        TEXT NOT NULL,
          log_create   INTEGER NOT NULL DEFAULT 1,
          log_update   INTEGER NOT NULL DEFAULT 1,
          log_delete   INTEGER NOT NULL DEFAULT 1,
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
        )
      `)

      await execute('CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)')
      await execute('CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON activity_log(actor_user_id)')
      await execute('CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module)')
      await execute('CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)')
      await execute('CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)')
      await execute('CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)')

      try {
        await execute(`
          INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
          VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9)
        `)

        await execute(`
          INSERT OR IGNORE INTO activity_log_config (
            fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
          )
          SELECT href, group_name, title, 1, 1, 1, datetime('now')
          FROM fitur_akses
          WHERE href IS NOT NULL
            AND TRIM(href) <> ''
        `)
      } catch {
        // Abaikan jika tabel fitur_akses belum tersedia di environment tertentu.
      }
    })().catch((error) => {
      ensureActivityLogSchemaPromise = null
      throw error
    })
  }

  await ensureActivityLogSchemaPromise
}

async function shouldWriteFeatureLog(fiturHref: string | null | undefined, logKind: ActivityLogKind | null | undefined) {
  if (!fiturHref || !logKind) return true

  const cacheKey = `${fiturHref}:${logKind}`
  const cached = logConfigCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.values[logKind]
  }

  await ensureActivityLogSchema()

  const row = await queryOne<Pick<ActivityLogConfigRow, 'log_create' | 'log_update' | 'log_delete'>>(
    `SELECT log_create, log_update, log_delete
     FROM activity_log_config
     WHERE fitur_href = ?`,
    [fiturHref]
  )

  const values = row ? toLogConfigValues(row) : { create: true, update: true, delete: true }
  const expiresAt = Date.now() + LOG_CONFIG_CACHE_TTL_MS

  logConfigCache.set(`${fiturHref}:create`, { expiresAt, values })
  logConfigCache.set(`${fiturHref}:update`, { expiresAt, values })
  logConfigCache.set(`${fiturHref}:delete`, { expiresAt, values })

  return values[logKind]
}

export async function getActivityLogConfigs() {
  await ensureActivityLogSchema()

  return query<ActivityLogConfigRow>(
    `SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     ORDER BY group_name ASC, title ASC`
  )
}

export async function updateActivityLogConfig(
  fiturHref: string,
  patch: Partial<Record<ActivityLogKind, boolean>>,
  updatedBy: string | null
) {
  await ensureActivityLogSchema()

  const current = await queryOne<ActivityLogConfigRow>(
    `SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     WHERE fitur_href = ?`,
    [fiturHref]
  )

  if (!current) {
    throw new Error('Konfigurasi log fitur tidak ditemukan.')
  }

  const nextValues = {
    create: patch.create ?? (current.log_create === 1),
    update: patch.update ?? (current.log_update === 1),
    delete: patch.delete ?? (current.log_delete === 1),
  }

  await execute(
    `UPDATE activity_log_config
     SET log_create = ?, log_update = ?, log_delete = ?, updated_at = datetime('now'), updated_by = ?
     WHERE fitur_href = ?`,
    [nextValues.create ? 1 : 0, nextValues.update ? 1 : 0, nextValues.delete ? 1 : 0, updatedBy, fiturHref]
  )

  const expiresAt = Date.now() + LOG_CONFIG_CACHE_TTL_MS
  const values = {
    create: nextValues.create,
    update: nextValues.update,
    delete: nextValues.delete,
  }
  logConfigCache.set(`${fiturHref}:create`, { expiresAt, values })
  logConfigCache.set(`${fiturHref}:update`, { expiresAt, values })
  logConfigCache.set(`${fiturHref}:delete`, { expiresAt, values })
}

export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    await ensureActivityLogSchema()

    if (!(await shouldWriteFeatureLog(input.fiturHref, input.logKind))) {
      return
    }

    const requestInfo = input.requestInfo ?? await getRequestAuditContext()
    const actor = input.actor ?? null

    await execute(
      `INSERT INTO activity_log (
        id, created_at, actor_user_id, actor_name, actor_roles, module, action,
        entity_type, entity_id, entity_label, summary, details_json, status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        new Date().toISOString(),
        actor?.id ?? null,
        actor?.name ?? actor?.email ?? null,
        stringifyRoles(actor?.roles),
        input.module,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.entityLabel ?? null,
        truncateString(input.summary, 300),
        normalizeDetails(input.details),
        input.status ?? 'success',
        requestInfo.ipAddress ?? null,
        requestInfo.userAgent ?? null,
      ]
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[activity-log] gagal menulis log:', message)
  }
}

export function diffWhitelistedFields<TBefore extends Record<string, unknown>, TAfter extends Record<string, unknown>>(
  before: TBefore,
  after: TAfter,
  allowedFields: string[]
) {
  const changes: Record<string, { before: unknown; after: unknown }> = {}

  for (const field of allowedFields) {
    const beforeValue = before[field]
    const afterValue = after[field]

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = {
        before: sanitizeDetailValue(beforeValue),
        after: sanitizeDetailValue(afterValue),
      }
    }
  }

  return changes
}

export async function getActivityTargetLabel(
  entityType: 'user' | 'santri' | 'fitur',
  entityId: string | number
) {
  if (entityType === 'user') {
    const row = await queryOne<{ full_name: string | null; email: string | null }>(
      'SELECT full_name, email FROM users WHERE id = ?',
      [entityId]
    )
    return row?.full_name || row?.email || String(entityId)
  }

  if (entityType === 'santri') {
    const row = await queryOne<{ nama_lengkap: string | null; nis: string | null }>(
      'SELECT nama_lengkap, nis FROM santri WHERE id = ?',
      [entityId]
    )
    return row?.nama_lengkap || row?.nis || String(entityId)
  }

  const row = await queryOne<{ title: string | null; href: string | null }>(
    'SELECT title, href FROM fitur_akses WHERE id = ?',
    [entityId]
  )
  return row?.title || row?.href || String(entityId)
}

export async function cleanupExpiredActivityLogs(retentionMonths = 6) {
  await ensureActivityLogSchema()
  await execute(
    `DELETE FROM activity_log
     WHERE created_at < datetime('now', ?)`,
    [`-${retentionMonths} months`]
  )
}
