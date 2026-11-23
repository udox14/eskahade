// Pengingat terjadwal (dijalankan cron notification-dispatch). Hanya MEMBACA data keuangan dan
// menulis notif_outbox / notif_source_cursors — tidak pernah mengubah tagihan atau pembayaran.

import { collectibleBillingSql } from '../finance/billing-legacy'
import { getEffectiveConfig } from './config'
import { notificationSchemaReady } from './finance-events'
import type { NotifStore } from './types'

export const TRANSFER_REMIND_BEFORE_HOURS = 3
/** Order dengan masa berlaku pendek tidak diingatkan (pengingat akan datang tepat setelah dibuat). */
export const TRANSFER_REMIND_MIN_LIFETIME_HOURS = 6
const ARREARS_DAY_KEY = 'notifications_arrears_day'
const ARREARS_CURSOR = 'reminder_arrears'
const MONTHLY_ITEMS = ['SPP', 'UANG_MAKAN', 'UANG_NYUCI']

function wib(at: Date) {
  const shifted = new Date(at.getTime() + 7 * 3600_000)
  return { month: shifted.toISOString().slice(0, 7), day: shifted.getUTCDate(), hour: shifted.getUTCHours() }
}

export interface ReminderResult { transferExpiring: number; arrears: number; arrearsMonth: string | null }

/** Wali yang belum mengunggah bukti transfer saat batas waktu tinggal ≤ 3 jam. Sekali per order. */
async function remindExpiringTransfers(store: NotifStore, at: Date): Promise<number> {
  const config = await getEffectiveConfig(store, 'PORTAL_TRANSFER_AKAN_KEDALUWARSA')
  if (!config.enabled) return 0
  const before = await store.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM notif_outbox WHERE event_code = ?', ['PORTAL_TRANSFER_AKAN_KEDALUWARSA'])
  await store.execute(
    `INSERT OR IGNORE INTO notif_outbox (id, event_code, dedupe_key, payload_json)
     SELECT lower(hex(randomblob(16))), 'PORTAL_TRANSFER_AKAN_KEDALUWARSA', 'TRF_EXPIRING:' || s.id,
            json_object('santri_id', s.santri_id, 'nama_santri', st.nama_lengkap, 'nomor', s.submission_number, 'batas_waktu', o.expires_at)
     FROM finance_transfer_submissions s
     JOIN finance_payment_orders o ON o.id = s.order_id
     JOIN santri st ON st.id = s.santri_id
     WHERE s.status = 'MENUNGGU_BUKTI' AND o.status = 'PENDING' AND o.payment_method = 'MANUAL_TRANSFER'
       AND o.expires_at > ? AND o.expires_at <= ?
       AND (julianday(o.expires_at) - julianday(o.created_at)) * 24 >= ?`,
    [at.toISOString(), new Date(at.getTime() + TRANSFER_REMIND_BEFORE_HOURS * 3600_000).toISOString(), TRANSFER_REMIND_MIN_LIFETIME_HOURS],
  )
  const after = await store.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM notif_outbox WHERE event_code = ?', ['PORTAL_TRANSFER_AKAN_KEDALUWARSA'])
  return Number(after?.n ?? 0) - Number(before?.n ?? 0)
}

/**
 * Pengingat tunggakan bulanan: tagihan bulanan (SPP, makan, cuci) periode sebelum bulan berjalan
 * yang masih bisa ditagih dan belum lunas. Sekali per santri per bulan, mulai tanggal yang diatur
 * (app_settings notifications_arrears_day, default 10) pukul 08.00 WIB. Default jenis notifikasi
 * ini NONAKTIF — admin menyalakannya di Pengaturan Notifikasi.
 */
async function remindArrears(store: NotifStore, at: Date): Promise<{ count: number; month: string | null }> {
  const config = await getEffectiveConfig(store, 'PORTAL_PENGINGAT_TUNGGAKAN')
  if (!config.enabled) return { count: 0, month: null }
  const { month, day, hour } = wib(at)
  const setting = await store.queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [ARREARS_DAY_KEY])
  const startDay = Math.min(28, Math.max(1, Number.parseInt(setting?.value ?? '10', 10) || 10))
  if (day < startDay || hour < 8) return { count: 0, month: null }
  const cursor = await store.queryOne<{ cursor: string }>('SELECT cursor FROM notif_source_cursors WHERE source = ?', [ARREARS_CURSOR])
  if (cursor?.cursor === month) return { count: 0, month: null }

  const before = await store.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM notif_outbox WHERE event_code = ?', ['PORTAL_PENGINGAT_TUNGGAKAN'])
  const items = MONTHLY_ITEMS.map(() => '?').join(',')
  await store.batch([
    {
      // Tandai bulan ini selesai (compare-and-set) lalu sisipkan pengingat bila penanda milik putaran ini.
      sql: `INSERT INTO notif_source_cursors (source, cursor, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at
            WHERE notif_source_cursors.cursor <> excluded.cursor`,
      params: [ARREARS_CURSOR, month, at.toISOString()],
    },
    {
      sql: `INSERT OR IGNORE INTO notif_outbox (id, event_code, dedupe_key, payload_json)
            SELECT lower(hex(randomblob(16))), 'PORTAL_PENGINGAT_TUNGGAKAN', 'ARREARS:' || a.santri_id || ':' || ?,
                   json_object('santri_id', a.santri_id, 'nama_santri', a.nama_lengkap, 'jumlah', a.n, 'total', a.total)
            FROM (
              SELECT o.santri_id, st.nama_lengkap, COUNT(*) AS n,
                     SUM(MAX(0, o.amount_expected - COALESCE(o.amount_exempted, 0) - o.amount_paid)) AS total
              FROM finance_obligations o JOIN santri st ON st.id = o.santri_id
              WHERE st.status_global = 'aktif' AND o.status IN ('UNPAID', 'PARTIALLY_PAID')
                AND o.item_type IN (${items}) AND o.period < ? AND ${collectibleBillingSql('o')}
              GROUP BY o.santri_id
            ) a
            WHERE a.total > 0`,
      params: [month, ...MONTHLY_ITEMS, month],
    },
  ])
  const after = await store.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM notif_outbox WHERE event_code = ?', ['PORTAL_PENGINGAT_TUNGGAKAN'])
  return { count: Number(after?.n ?? 0) - Number(before?.n ?? 0), month }
}

export async function runReminders(store: NotifStore, at = new Date()): Promise<ReminderResult> {
  const result: ReminderResult = { transferExpiring: 0, arrears: 0, arrearsMonth: null }
  if (!(await notificationSchemaReady(store))) return result
  try { result.transferExpiring = await remindExpiringTransfers(store, at) } catch { /* tabel keuangan belum ada di environment ini */ }
  try {
    const arrears = await remindArrears(store, at)
    result.arrears = arrears.count
    result.arrearsMonth = arrears.month
  } catch { /* idem */ }
  return result
}
