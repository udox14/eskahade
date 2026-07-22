// lib/db/index.ts
import { cookies } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const SESSION_COOKIE = 'eskahade_session'
const READ_ONLY_ERROR = 'Akun tester hanya boleh membaca data.'
const WRITE_SQL_RE = /^\s*(insert|update|delete|replace|create|alter|drop|truncate|merge|grant|revoke|vacuum|pragma\s+\w+\s*=)/i
const SCHEMA_MAINTENANCE_SQL_RE = /^\s*(create\s+(table|index)\s+if\s+not\s+exists|alter\s+table\s+[\w"[\]`]+\s+add\s+column)\b/i

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const pad = (4 - (value.length % 4)) % 4
    const base64 = (value + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as T
  } catch {
    return null
  }
}

function parseRoles(rolesJson: string | null | undefined, fallbackRole: string | null | undefined): string[] {
  try {
    if (rolesJson) {
      const parsed = JSON.parse(rolesJson)
      if (Array.isArray(parsed)) return parsed.filter((role): role is string => typeof role === 'string' && role.length > 0)
    }
  } catch {}
  return fallbackRole ? [fallbackRole] : []
}

async function getRequestUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const payload = token ? decodeBase64UrlJson<{ id?: unknown }>(token.split('.')[1] || '') : null
    return typeof payload?.id === 'string' ? payload.id : null
  } catch {
    return null
  }
}

async function isTesterRequest(db: any): Promise<boolean> {
  const userId = await getRequestUserId()
  if (!userId) return false
  try {
    const user = await db.prepare('SELECT role, roles FROM users WHERE id = ?').bind(userId).first() as { role: string | null; roles: string | null } | null
    const roles = parseRoles(user?.roles, user?.role)
    return roles.includes('tester') && !roles.includes('admin') && !roles.includes('demo')
  } catch {
    return false
  }
}

function isWriteSql(sql: unknown): boolean {
  return typeof sql === 'string' && WRITE_SQL_RE.test(sql) && !SCHEMA_MAINTENANCE_SQL_RE.test(sql)
}

function denyTesterWrite() {
  throw new Error(READ_ONLY_ERROR)
}

function wrapReadOnlyStatement(statement: any, writeSql: boolean): any {
  return new Proxy(statement, {
    get(target, prop, receiver) {
      if (prop === '__eskahadeWriteSql') return writeSql
      if (prop === '__eskahadeRawStatement') return target

      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      if (prop === 'bind') {
        return (...args: unknown[]) => wrapReadOnlyStatement(value.apply(target, args), writeSql)
      }

      if (writeSql && (prop === 'run' || prop === 'all' || prop === 'first' || prop === 'raw')) {
        return denyTesterWrite
      }

      return value.bind(target)
    },
  })
}

function wrapReadOnlyDB(db: any): any {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'prepare') {
        return (sql: string) => wrapReadOnlyStatement(target.prepare(sql), isWriteSql(sql))
      }

      if (prop === 'batch') {
        return (statements: any[]) => {
          if (statements.some((statement) => statement?.__eskahadeWriteSql)) denyTesterWrite()
          return target.batch(statements.map((statement) => statement?.__eskahadeRawStatement ?? statement))
        }
      }

      if (prop === 'exec') {
        return (sql: string) => {
          if (isWriteSql(sql)) denyTesterWrite()
          return target.exec(sql)
        }
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export async function getDB() {
  const { env } = await getCloudflareContext({ async: true })
  // Session role 'demo' → arahkan SEMUA query ke DB sandbox (data dummy),
  // sehingga tidak pernah menyentuh data asli.
  const { isDemoRequest } = await import('@/lib/auth/demo-context')
  if (await isDemoRequest()) return env.DEMO_DB
  if (await isTesterRequest(env.DB)) return wrapReadOnlyDB(env.DB)
  return env.DB
}

/**
 * Database khusus domain keuangan. Seluruh mutasi yang memengaruhi uang wajib
 * selesai dalam satu transaksi/batch pada binding ini; jangan membuat batch
 * yang mencampur statement DB utama dan FINANCE_DB.
 */
export async function getFinanceDB() {
  const { env } = await getCloudflareContext({ async: true })
  const { isDemoRequest } = await import('@/lib/auth/demo-context')
  if (await isDemoRequest()) return env.DEMO_FINANCE_DB
  if (await isTesterRequest(env.DB)) return wrapReadOnlyDB(env.FINANCE_DB)
  return env.FINANCE_DB
}

// Banyak baris
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getDB()
  const { results } = await db.prepare(sql).bind(...params).all()
  return (results ?? []) as T[]
}

// Alias queryAll = query
export const queryAll = query

export async function financeQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getFinanceDB()
  const { results } = await db.prepare(sql).bind(...params).all()
  return (results ?? []) as T[]
}

// Satu baris
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const db = await getDB()
  const result = await db.prepare(sql).bind(...params).first()
  return (result ?? null) as T | null
}

export async function financeQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const db = await getFinanceDB()
  const result = await db.prepare(sql).bind(...params).first()
  return (result ?? null) as T | null
}

// INSERT / UPDATE / DELETE
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ success: boolean }> {
  const db = await getDB()
  const result = await db.prepare(sql).bind(...params).run()
  return { success: result.success }
}

export async function financeExecute(
  sql: string,
  params: unknown[] = []
): Promise<{ success: boolean }> {
  const db = await getFinanceDB()
  const result = await db.prepare(sql).bind(...params).run()
  return { success: result.success }
}

// Batch statements
export async function batch(
  statements: { sql: string; params?: unknown[] }[]
): Promise<void> {
  const db = await getDB()
  const prepared = statements.map(({ sql, params = [] }) =>
    db.prepare(sql).bind(...params)
  )
  await db.batch(prepared)
}

export async function financeBatch(
  statements: { sql: string; params?: unknown[] }[]
): Promise<void> {
  const db = await getFinanceDB()
  const prepared = statements.map(({ sql, params = [] }) =>
    db.prepare(sql).bind(...params)
  )
  await db.batch(prepared)
}

// Utils
export function generateId(): string {
  return crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}
