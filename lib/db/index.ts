// lib/db/index.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function getDB() {
  const { env } = await getCloudflareContext({ async: true })
  return env.DB
}

// Banyak baris
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getDB()
  const { results } = await db.prepare(sql).bind(...params).all<T>()
  return results ?? []
}

// Alias queryAll = query
export const queryAll = query

// Satu baris
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const db = await getDB()
  const result = await db.prepare(sql).bind(...params).first<T>()
  return result ?? null
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