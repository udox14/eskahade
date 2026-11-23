// Adaptor runtime app Worker (OpenNext). Jangan diimpor dari cron Worker.

import { cookies } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { batch, execute, query, queryOne } from '@/lib/db'
import { environmentDatabase } from '@/lib/db/environment'
import { unlinkDevice } from './devices'
import { processBroadcasts } from './broadcast'
import { processOutbox } from './dispatch'
import { safeNotices } from './finance-events'
import { outboxIdsOf } from './outbox'
import { processDeliveries, pushRuntimeFromEnv, type PushRuntime } from './push'
import { d1NotifStore } from './store'
import type { NotifRecipient, NotifStore, SqlStatement } from './types'

/** Cookie httpOnly berisi id perangkat push browser ini — dipakai melepas link saat logout. */
export const DEVICE_COOKIE = 'eskahade_notif_device'

/** Store yang menghormati sesi (akun tester read-only) — untuk aksi pengguna. */
export function sessionNotifStore(): NotifStore {
  return {
    query: <T>(sql: string, params?: unknown[]) => query<T>(sql, params),
    queryOne: <T>(sql: string, params?: unknown[]) => queryOne<T>(sql, params),
    execute: (sql: string, params?: unknown[]) => execute(sql, params),
    batch: statements => batch(statements),
  }
}

export async function appPushRuntime(): Promise<PushRuntime> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return pushRuntimeFromEnv(env as unknown as Record<string, unknown>)
  } catch {
    return { webpush: null }
  }
}

/**
 * Dispatch segera setelah commit, di luar jalur respons. Gagal di sini tidak memengaruhi
 * transaksi: baris outbox tetap PENDING dan disapu cron notification-dispatch.
 */
export async function kickNotificationDispatch(outboxIds?: string[]) {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true })
    const { db, environment } = environmentDatabase(env)
    const push = pushRuntimeFromEnv(env as unknown as Record<string, unknown>)
    const work = processOutbox(d1NotifStore(db), { outboxIds, limit: outboxIds?.length || 10, push })
      .then(result => {
        if (result.claimed) console.log(JSON.stringify({ event: 'notif_dispatch_inline', environment, ...result }))
      })
      .catch(error => console.error(JSON.stringify({
        event: 'notif_dispatch_inline_failed', environment,
        message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
      })))
    ctx.waitUntil(work)
  } catch {
    // Konteks Cloudflare tidak tersedia (mis. build) → biarkan cron yang mengirim.
  }
}

/** Lepas perangkat browser ini dari owner yang logout. Tidak pernah menggagalkan logout. */
export async function unlinkCurrentDevice(owner: NotifRecipient | null) {
  if (!owner) return
  try {
    const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value
    if (deviceId && /^[0-9a-f-]{36}$/i.test(deviceId)) await unlinkDevice(sessionNotifStore(), owner, deviceId)
  } catch {
    // Migration belum diterapkan / akun tester read-only → abaikan.
  }
}

/**
 * Statement notifikasi untuk disisipkan ke batch keuangan di app Worker. Skema belum siap atau
 * payload gagal dibangun → [] (transaksi uang tetap berjalan seperti tanpa notifikasi).
 */
export function financeNotices(build: () => SqlStatement[]): Promise<SqlStatement[]> {
  return safeNotices(sessionNotifStore(), build)
}

/** Alias untuk modul non-keuangan (perizinan, setoran, santri keluar). Semantik sama. */
export const appNotices = financeNotices

/**
 * Untuk tulis data yang tidak memakai batch (mis. proses massal modul lain): jalankan statement
 * notifikasi yang sudah dijaga EXISTS setelah tulis utama. Gagal → hanya dicatat.
 */
export async function emitNoticesAfterWrite(build: () => SqlStatement[]) {
  try {
    const notices = await financeNotices(build)
    if (!notices.length) return
    await batch(notices)
    await kickNotificationDispatch(outboxIdsOf(notices))
  } catch (error) {
    console.error(JSON.stringify({ event: 'notif_emit_failed', message: error instanceof Error ? error.message.slice(0, 200) : 'unknown' }))
  }
}

/** "Kirim sekarang" dari modul pengaturan: fan-out potongan awal + push di luar jalur respons. */
export async function kickBroadcastDispatch() {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true })
    const { db, environment } = environmentDatabase(env)
    const store = d1NotifStore(db)
    const push = pushRuntimeFromEnv(env as unknown as Record<string, unknown>)
    ctx.waitUntil((async () => {
      const broadcasts = await processBroadcasts(store, push, { maxChunks: 5 })
      const deliveries = await processDeliveries(store, push, { limit: 200 })
      console.log(JSON.stringify({ event: 'notif_broadcast_inline', environment, broadcasts, deliveries }))
    })().catch(error => console.error(JSON.stringify({
      event: 'notif_broadcast_inline_failed', environment, message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    }))))
  } catch {
    // Tanpa konteks Cloudflare → cron yang melanjutkan.
  }
}
