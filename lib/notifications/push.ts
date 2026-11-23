// Antrian & pengiriman push per perangkat. Kegagalan push tidak pernah mengubah inbox/outbox.
// Semantik at-least-once per (notifikasi, perangkat): UNIQUE mencegah antrian ganda; crash di
// antara "provider menerima" dan "status disimpan" dapat memicu satu kirim ulang.

import { parseFcmConfig, sendFcm, type FcmConfig } from './channels/fcm'
import { parseVapidConfig, sendWebPush, type PushSendResult, type VapidConfig } from './channels/webpush'
import { readNotifSetting } from './config'
import type { NotifChannel, NotifStore } from './types'

export const MAX_PUSH_ATTEMPTS = 3
const CLAIM_MS = 2 * 60_000
const CONCURRENCY = 6
const DEVICE_FAILURE_LIMIT = 5

export interface PushRuntime {
  webpush: VapidConfig | null
  fcm?: FcmConfig | null
  fetchImpl?: typeof fetch
}

export function pushRuntimeFromEnv(env: Record<string, unknown>): PushRuntime {
  return { webpush: parseVapidConfig(env), fcm: parseFcmConfig(env) }
}

function hasAnyChannel(runtime: PushRuntime | null | undefined): runtime is PushRuntime {
  return !!(runtime?.webpush || runtime?.fcm)
}

export function enabledPushChannels(channels: NotifChannel[], runtime: PushRuntime | null | undefined): Array<'WEBPUSH' | 'FCM'> {
  const out: Array<'WEBPUSH' | 'FCM'> = []
  if (runtime?.webpush && channels.includes('webpush')) out.push('WEBPUSH')
  if (runtime?.fcm && channels.includes('fcm')) out.push('FCM')
  return out
}

/** Antrikan pengiriman untuk semua perangkat aktif milik penerima notifikasi satu outbox. */
export async function queueDeliveries(store: NotifStore, outboxId: string, deviceChannels: Array<'WEBPUSH' | 'FCM'>, mandatory: boolean) {
  if (!deviceChannels.length) return
  await store.execute(
    `INSERT OR IGNORE INTO notif_deliveries (id, notification_id, device_id, channel)
     SELECT lower(hex(randomblob(16))), n.id, d.id, d.channel
     FROM notifications n
     JOIN notif_device_links l ON l.owner_kind = n.recipient_kind AND l.owner_id = n.recipient_id
     JOIN notif_devices d ON d.id = l.device_id AND d.is_active = 1
     WHERE n.outbox_id = ? AND d.channel IN (${deviceChannels.map(() => '?').join(',')})
       AND (? = 1 OR NOT EXISTS (
         SELECT 1 FROM notif_preferences p WHERE p.owner_kind = n.recipient_kind AND p.owner_id = n.recipient_id
           AND p.category = n.category AND p.push_enabled = 0))`,
    [outboxId, ...deviceChannels, mandatory ? 1 : 0])
}

interface ClaimedDelivery {
  id: string
  notification_id: string
  device_id: string
  channel: 'WEBPUSH' | 'FCM'
  attempts: number
  claim_until: string
}

interface DeliveryContext {
  endpoint_or_token: string
  p256dh: string | null
  auth: string | null
  is_active: number
  title: string
  push_body: string | null
  body: string
  link: string | null
  level: string
  event_code: string
  recipient_kind: string
}

export interface DeliveryResult { claimed: number; sent: number; expired: number; failed: number; retried: number; skipped: number }

export function pushRetryDelayMs(attempts: number) {
  return Math.min(30 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1))
}

export function pushPayload(ctx: Pick<DeliveryContext, 'title' | 'push_body' | 'body' | 'link' | 'event_code' | 'recipient_kind'>, notificationId: string) {
  return {
    id: notificationId,
    title: ctx.title,
    body: ctx.push_body ?? ctx.body,
    url: ctx.link ?? (ctx.recipient_kind === 'SANTRI' ? '/portal-ortu/notifikasi' : '/dashboard/notifikasi'),
    tag: ctx.event_code,
  }
}

async function deliverOne(store: NotifStore, runtime: PushRuntime, row: ClaimedDelivery, at: Date): Promise<keyof Omit<DeliveryResult, 'claimed'>> {
  const ctx = await store.queryOne<DeliveryContext>(
    `SELECT d.endpoint_or_token, d.p256dh, d.auth, d.is_active, n.title, n.push_body, n.body, n.link, n.level, n.event_code, n.recipient_kind
     FROM notif_deliveries x JOIN notif_devices d ON d.id = x.device_id JOIN notifications n ON n.id = x.notification_id
     WHERE x.id = ?`, [row.id])
  const nowIso = at.toISOString()
  const settle = (status: string, result: Partial<PushSendResult>, nextAttemptAt: string | null = null) => store.execute(
    `UPDATE notif_deliveries SET status = ?, http_status = ?, error_code = ?, attempted_at = ?, claim_until = NULL,
       next_attempt_at = COALESCE(?, next_attempt_at)
     WHERE id = ? AND status = 'SENDING' AND claim_until = ?`,
    [status, result.httpStatus ?? null, result.errorCode ?? null, nowIso, nextAttemptAt, row.id, row.claim_until])

  if (!ctx || Number(ctx.is_active) !== 1) { await settle('SKIPPED', { errorCode: 'DEVICE_INACTIVE' }); return 'skipped' }
  const urgency = ctx.level === 'danger' || ctx.level === 'warning' ? 'high' : 'normal'
  let result: PushSendResult
  if (row.channel === 'WEBPUSH' && runtime.webpush && ctx.p256dh && ctx.auth) {
    result = await sendWebPush(
      { endpoint: ctx.endpoint_or_token, p256dh: ctx.p256dh, auth: ctx.auth },
      pushPayload(ctx, row.notification_id), runtime.webpush, { urgency, fetchImpl: runtime.fetchImpl })
  } else if (row.channel === 'FCM' && runtime.fcm) {
    result = await sendFcm(ctx.endpoint_or_token, pushPayload(ctx, row.notification_id), runtime.fcm, { urgency, fetchImpl: runtime.fetchImpl })
  } else {
    await settle('SKIPPED', { errorCode: 'CHANNEL_NOT_CONFIGURED' }); return 'skipped'
  }

  switch (result.outcome) {
    case 'SENT':
      await settle('SENT', result)
      await store.execute('UPDATE notif_devices SET failure_count = 0, last_success_at = ? WHERE id = ?', [nowIso, row.device_id])
      return 'sent'
    case 'EXPIRED':
      await settle('EXPIRED', result)
      await store.execute(`UPDATE notif_devices SET is_active = 0, deactivated_reason = ? WHERE id = ?`,
        [result.errorCode ?? 'EXPIRED', row.device_id])
      return 'expired'
    case 'TRANSIENT':
      if (row.attempts < MAX_PUSH_ATTEMPTS) {
        await settle('PENDING', result, new Date(at.getTime() + pushRetryDelayMs(row.attempts)).toISOString())
        return 'retried'
      }
      await settle('FAILED', result)
      return 'failed'
    default:
      await settle('FAILED', result)
      if (result.errorCode !== 'VAPID_REJECTED' && result.errorCode !== 'FCM_AUTH_REJECTED') {
        // Error format berulang menandakan langganan rusak; VAPID ditolak = salah konfigurasi server.
        await store.execute(
          `UPDATE notif_devices SET failure_count = failure_count + 1,
             is_active = CASE WHEN failure_count + 1 >= ? THEN 0 ELSE is_active END,
             deactivated_reason = CASE WHEN failure_count + 1 >= ? THEN 'REPEATED_FAILURE' ELSE deactivated_reason END
           WHERE id = ?`, [DEVICE_FAILURE_LIMIT, DEVICE_FAILURE_LIMIT, row.device_id])
      }
      return 'failed'
  }
}

export async function processDeliveries(
  store: NotifStore,
  runtime: PushRuntime | null | undefined,
  options: { at?: Date; limit?: number; outboxIds?: string[] } = {},
): Promise<DeliveryResult> {
  const result: DeliveryResult = { claimed: 0, sent: 0, expired: 0, failed: 0, retried: 0, skipped: 0 }
  if (!hasAnyChannel(runtime)) return result
  if (!(await readNotifSetting(store, 'notifications_push_enabled'))) return result
  const at = options.at ?? new Date()
  const nowIso = at.toISOString()
  const dueIso = new Date(at.getTime() + 1000).toISOString()
  const scope = options.outboxIds?.length
    ? ` AND notification_id IN (SELECT id FROM notifications WHERE outbox_id IN (${options.outboxIds.map(() => '?').join(',')}))` : ''
  const rows = await store.query<ClaimedDelivery>(
    `UPDATE notif_deliveries SET status = 'SENDING', claim_until = ?, attempts = attempts + 1
     WHERE id IN (SELECT id FROM notif_deliveries
       WHERE ((status = 'PENDING' AND next_attempt_at <= ?) OR (status = 'SENDING' AND claim_until < ? AND attempts < ${MAX_PUSH_ATTEMPTS + 2}))${scope}
       ORDER BY created_at LIMIT ?)
     RETURNING id, notification_id, device_id, channel, attempts, claim_until`,
    [new Date(at.getTime() + CLAIM_MS).toISOString(), dueIso, nowIso, ...(options.outboxIds ?? []), Math.min(200, Math.max(1, options.limit ?? 50))])
  result.claimed = rows.length

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const outcomes = await Promise.all(rows.slice(i, i + CONCURRENCY).map(row => deliverOne(store, runtime, row, at).catch(async () => {
      // Kesalahan tak terduga (mis. DB) → kembalikan ke antrian, jangan tandai terkirim.
      await store.execute(`UPDATE notif_deliveries SET status = 'PENDING', claim_until = NULL, next_attempt_at = ?, error_code = 'INTERNAL'
        WHERE id = ? AND status = 'SENDING' AND claim_until = ?`,
      [new Date(at.getTime() + pushRetryDelayMs(row.attempts)).toISOString(), row.id, row.claim_until]).catch(() => undefined)
      return 'retried' as const
    })))
    for (const outcome of outcomes) result[outcome]++
  }
  return result
}

export async function isPushDispatchActive(store: NotifStore, runtime: PushRuntime | null | undefined) {
  return hasAnyChannel(runtime) && await readNotifSetting(store, 'notifications_push_enabled')
}
