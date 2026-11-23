import type { NotifStore } from './types'

/** Akses D1 eksplisit untuk dispatcher (app Worker via waitUntil maupun cron Worker). */
export function d1NotifStore(db: D1Database): NotifStore {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => {
      const result = await db.prepare(sql).bind(...params).all<T>()
      if (!result.success) throw new Error('Pembacaan database notifikasi gagal.')
      return result.results ?? []
    },
    queryOne: <T>(sql: string, params: unknown[] = []) => db.prepare(sql).bind(...params).first<T>(),
    execute: async (sql: string, params: unknown[] = []) => {
      const result = await db.prepare(sql).bind(...params).run()
      if (!result.success) throw new Error('Penyimpanan notifikasi gagal.')
      return { success: true }
    },
    batch: async statements => {
      if (!statements.length) return
      await db.batch(statements.map(s => db.prepare(s.sql).bind(...s.params)))
    },
  }
}
