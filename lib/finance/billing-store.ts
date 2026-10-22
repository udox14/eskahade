/** Explicit database access. No session, request context, or environment fallback. */
export interface BillingStore {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
  execute(sql: string, params?: unknown[]): Promise<{ success: boolean }>
  batch?(statements: Array<{ sql: string; params: unknown[] }>): Promise<void>
}

export function billingStore(db: D1Database): BillingStore {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => {
      const result = await db.prepare(sql).bind(...params).all<T>()
      if (!result.success) throw new Error('Pembacaan database tagihan gagal.')
      return result.results ?? []
    },
    queryOne: <T>(sql: string, params: unknown[] = []) => db.prepare(sql).bind(...params).first<T>(),
    execute: async (sql: string, params: unknown[] = []) => {
      const result = await db.prepare(sql).bind(...params).run()
      if (!result.success) throw new Error('Penyimpanan penerbitan tagihan gagal.')
      return { success: true }
    },
    batch: async statements => { await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.params))) },
  }
}
