// Retensi data notifikasi (BUKAN riwayat finansial — lihat migration 0202). Sekali sehari (WIB),
// dihapus bertahap maks. BATCH baris per tabel per putaran; bila masih tersisa, putaran berikutnya
// melanjutkan sebelum penanda hari diset.
//
// Tidak pernah menyentuh tabel keuangan, audit transfer, atau activity_log.

import { notificationSchemaReady } from './finance-events'
import type { NotifStore } from './types'

export const RETENTION_DEFAULTS = { inboxDays: 180, logDays: 60, inactiveDeviceDays: 90 }
const BATCH = 2000
const MARKER = 'retention'

export interface RetentionResult { ran: boolean; deleted: Record<string, number>; complete: boolean }

async function settingDays(store: NotifStore, key: string, fallback: number, min: number, max: number) {
  const row = await store.queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key])
  const value = Number.parseInt(row?.value ?? '', 10)
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

async function purge(store: NotifStore, table: string, where: string, params: unknown[], key = 'id'): Promise<number> {
  const before = await store.queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
  await store.execute(`DELETE FROM ${table} WHERE ${key} IN (SELECT ${key} FROM ${table} WHERE ${where} LIMIT ${BATCH})`, params)
  const after = await store.queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
  return Number(before?.n ?? 0) - Number(after?.n ?? 0)
}

export async function runRetention(store: NotifStore, at = new Date()): Promise<RetentionResult> {
  // Migration 0202 belum diterapkan → tidak ada yang perlu dibersihkan.
  if (!(await notificationSchemaReady(store))) return { ran: false, deleted: {}, complete: true }
  const today = new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
  const marker = await store.queryOne<{ cursor: string }>('SELECT cursor FROM notif_source_cursors WHERE source = ?', [MARKER])
  if (marker?.cursor === today) return { ran: false, deleted: {}, complete: true }

  const inboxDays = await settingDays(store, 'notifications_retention_days', RETENTION_DEFAULTS.inboxDays, 30, 730)
  const cutoff = (days: number) => new Date(at.getTime() - days * 86400_000).toISOString()
  const deleted: Record<string, number> = {}

  // Log pengiriman push lebih pendek; inbox & outbox mengikuti pengaturan admin.
  deleted.notif_deliveries = await purge(store, 'notif_deliveries',
    `created_at < ? AND status NOT IN ('PENDING', 'SENDING')`, [cutoff(RETENTION_DEFAULTS.logDays)])
  deleted.notifications = await purge(store, 'notifications', 'created_at < ?', [cutoff(inboxDays)])
  deleted.notif_outbox = await purge(store, 'notif_outbox',
    `created_at < ? AND status IN ('DONE', 'SKIPPED', 'FAILED')`, [cutoff(inboxDays)])
  // Perangkat yang sudah mati (token/endpoint kedaluwarsa) lama: lepas link lalu hapus perangkatnya.
  const deadDevice = `SELECT id FROM notif_devices WHERE is_active = 0 AND last_seen_at < ?`
  deleted.notif_device_links = await purge(store, 'notif_device_links', `device_id IN (${deadDevice})`,
    [cutoff(RETENTION_DEFAULTS.inactiveDeviceDays)], 'device_id')
  deleted.notif_devices = await purge(store, 'notif_devices',
    `is_active = 0 AND last_seen_at < ? AND NOT EXISTS (SELECT 1 FROM notif_device_links l WHERE l.device_id = notif_devices.id)`,
    [cutoff(RETENTION_DEFAULTS.inactiveDeviceDays)])

  const complete = Object.values(deleted).every(n => n < BATCH)
  if (complete) {
    await store.execute(
      `INSERT INTO notif_source_cursors (source, cursor, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
      [MARKER, today, at.toISOString()])
  }
  return { ran: true, deleted, complete }
}
