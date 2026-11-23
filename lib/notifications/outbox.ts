// Outbox: event bisnis menyisipkan statement ini ke DALAM batch transaksi yang sama.
// INSERT OR IGNORE + dedupe_key UNIQUE → replay/duplikat tidak menghasilkan notifikasi ganda,
// dan transaksi yang gagal tidak meninggalkan notifikasi.

import { requireEventDefinition } from './catalog'
import type { NotifPayload, NotifStore, SqlStatement } from './types'

const PAYLOAD_MAX = 4000
const DEDUPE_RE = /^[A-Za-z0-9:_.\-]{3,200}$/

function sanitizePayload(payload: NotifPayload): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(key) || value === undefined) continue
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Payload notifikasi ${key} bukan angka valid.`)
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`Payload notifikasi ${key} harus bernilai primitif.`)
    }
    out[key] = typeof value === 'string' ? value.slice(0, 500) : value
  }
  return out
}

export const TEST_RECIPIENT_KEY = '__test_user_id'

/** Komponen kunci deduplikasi dari teks/waktu bebas (spasi, huruf non-ASCII) → karakter aman. */
export function dedupeKeyPart(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9:_.-]/g, '_').slice(0, 80) || '_'
}

/**
 * guard: kondisi EXISTS yang harus benar di dalam batch yang sama (mis. baris audit/pembayaran yang
 * baru dibuat). Tanpa guard, UPDATE bersyarat yang mengenai 0 baris (balapan antar-petugas) tetap
 * commit dan notifikasi palsu ikut tersimpan.
 */
export interface NotifyGuard {
  sql: string
  params: unknown[]
}

export function notifyStatement(eventCode: string, dedupeKey: string, payload: NotifPayload, guard?: NotifyGuard): SqlStatement {
  // Kunci uji hanya boleh dipasang lewat testNotifyStatement (modul pengaturan, admin).
  const { [TEST_RECIPIENT_KEY]: _ignored, ...business } = payload
  void _ignored
  const statement = buildStatement(eventCode, dedupeKey, business)
  if (!guard) return statement
  if (!/^\s*SELECT\s/i.test(guard.sql)) throw new Error('Guard notifikasi harus berupa SELECT.')
  return {
    sql: `INSERT OR IGNORE INTO notif_outbox (id, event_code, dedupe_key, payload_json) SELECT ?, ?, ?, ? WHERE EXISTS (${guard.sql})`,
    params: [...statement.params, ...guard.params],
  }
}

/** Id baris outbox dari statement notifikasi (untuk dispatch segera setelah commit). */
export function outboxIdsOf(statements: SqlStatement[]): string[] {
  return statements.filter(s => s.sql.includes('notif_outbox')).map(s => String(s.params[0]))
}

export function testNotifyStatement(eventCode: string, adminUserId: string, payload: NotifPayload): SqlStatement {
  return buildStatement(eventCode, `TEST:${eventCode}:${crypto.randomUUID()}`, { ...payload, [TEST_RECIPIENT_KEY]: adminUserId })
}

function buildStatement(eventCode: string, dedupeKey: string, payload: NotifPayload): SqlStatement {
  requireEventDefinition(eventCode)
  if (!DEDUPE_RE.test(dedupeKey)) throw new Error('Kunci deduplikasi notifikasi tidak valid.')
  const json = JSON.stringify(sanitizePayload(payload))
  if (json.length > PAYLOAD_MAX) throw new Error('Payload notifikasi terlalu besar.')
  return {
    sql: `INSERT OR IGNORE INTO notif_outbox (id, event_code, dedupe_key, payload_json) VALUES (?, ?, ?, ?)`,
    params: [crypto.randomUUID(), eventCode, dedupeKey, json],
  }
}

/** Untuk event yang tidak berada di dalam batch finansial (mis. scan berkala). */
export async function enqueueNotification(store: NotifStore, eventCode: string, dedupeKey: string, payload: NotifPayload) {
  const statement = notifyStatement(eventCode, dedupeKey, payload)
  await store.execute(statement.sql, statement.params)
  const row = await store.queryOne<{ id: string }>('SELECT id FROM notif_outbox WHERE dedupe_key = ?', [dedupeKey])
  return row?.id ?? null
}
