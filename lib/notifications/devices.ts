// Registrasi perangkat push. Kepemilikan selalu dari sesi server (owner), bukan dari klien.
// Satu endpoint = satu device; satu device dapat ter-link ke beberapa owner (kakak-adik).

import { isValidFcmToken } from './channels/fcm'
import { isAllowedPushEndpoint, isValidSubscriptionKeys } from './channels/webpush'
import type { NotifRecipient, NotifStore } from './types'

export const MAX_LINKS_PER_OWNER = 10

export class DeviceConflictError extends Error {}

interface DeviceRow {
  id: string
  channel: string
  p256dh: string | null
  auth: string | null
}

export interface WebPushSubscriptionInput {
  endpoint: unknown
  keys?: { p256dh?: unknown; auth?: unknown } | null
}

function clip(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

export function validateWebPushSubscription(sub: WebPushSubscriptionInput) {
  if (!sub || !isAllowedPushEndpoint(sub.endpoint)) throw new Error('Alamat langganan push tidak didukung.')
  if (!isValidSubscriptionKeys(sub.keys?.p256dh, sub.keys?.auth)) throw new Error('Kunci langganan push tidak valid.')
  return { endpoint: sub.endpoint, p256dh: String(sub.keys!.p256dh), auth: String(sub.keys!.auth) }
}

async function isLinked(store: NotifStore, deviceId: string, owner: NotifRecipient) {
  return !!(await store.queryOne('SELECT 1 AS ok FROM notif_device_links WHERE device_id = ? AND owner_kind = ? AND owner_id = ?',
    [deviceId, owner.kind, owner.id]))
}

async function linkOwner(store: NotifStore, deviceId: string, owner: NotifRecipient, at: string) {
  await store.execute(
    `INSERT INTO notif_device_links (device_id, owner_kind, owner_id, linked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(device_id, owner_kind, owner_id) DO UPDATE SET linked_at = excluded.linked_at`,
    [deviceId, owner.kind, owner.id, at])
  // Batasi jumlah perangkat per owner: lepaskan yang paling lama tidak diperbarui.
  await store.execute(
    `DELETE FROM notif_device_links WHERE owner_kind = ? AND owner_id = ? AND device_id IN (
       SELECT device_id FROM notif_device_links WHERE owner_kind = ? AND owner_id = ?
       ORDER BY linked_at DESC LIMIT -1 OFFSET ?)`,
    [owner.kind, owner.id, owner.kind, owner.id, MAX_LINKS_PER_OWNER])
}

export async function registerWebPushDevice(
  store: NotifStore,
  owner: NotifRecipient,
  input: WebPushSubscriptionInput,
  meta: { platform?: unknown; userAgent?: unknown } = {},
): Promise<{ deviceId: string }> {
  const sub = validateWebPushSubscription(input)
  const at = new Date().toISOString()
  const existing = await store.queryOne<DeviceRow>('SELECT id, channel, p256dh, auth FROM notif_devices WHERE endpoint_or_token = ?', [sub.endpoint])

  if (existing) {
    if (existing.channel !== 'WEBPUSH') throw new DeviceConflictError('Perangkat tidak cocok.')
    const sameKeys = existing.p256dh === sub.p256dh && existing.auth === sub.auth
    if (!sameKeys) {
      // Mengganti kunci perangkat milik orang lain akan membuat notifikasinya tak terbaca.
      const links = await store.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM notif_device_links WHERE device_id = ?', [existing.id])
      if (Number(links?.n ?? 0) > 0 && !(await isLinked(store, existing.id, owner))) {
        throw new DeviceConflictError('Perangkat ini terdaftar untuk akun lain.')
      }
    }
    await store.execute(
      `UPDATE notif_devices SET p256dh = ?, auth = ?, is_active = 1, deactivated_reason = NULL, failure_count = 0,
         platform = COALESCE(?, platform), user_agent = COALESCE(?, user_agent), last_seen_at = ? WHERE id = ?`,
      [sub.p256dh, sub.auth, clip(meta.platform, 40), clip(meta.userAgent, 300), at, existing.id])
    await linkOwner(store, existing.id, owner, at)
    return { deviceId: existing.id }
  }

  const deviceId = crypto.randomUUID()
  await store.execute(
    `INSERT INTO notif_devices (id, channel, endpoint_or_token, p256dh, auth, platform, user_agent, last_seen_at, created_at)
     VALUES (?, 'WEBPUSH', ?, ?, ?, ?, ?, ?, ?)`,
    [deviceId, sub.endpoint, sub.p256dh, sub.auth, clip(meta.platform, 40), clip(meta.userAgent, 300), at, at])
  await linkOwner(store, deviceId, owner, at)
  return { deviceId }
}

/**
 * Token FCM dari APK. Token bukan rahasia kriptografis seperti kunci Web Push, jadi tidak ada
 * kunci yang bisa "dibajak"; satu HP boleh ter-link ke beberapa akun (kakak-adik).
 */
export async function registerFcmDevice(
  store: NotifStore,
  owner: NotifRecipient,
  token: unknown,
  meta: { platform?: unknown; userAgent?: unknown } = {},
): Promise<{ deviceId: string }> {
  if (!isValidFcmToken(token)) throw new Error('Token perangkat Android tidak valid.')
  const at = new Date().toISOString()
  const existing = await store.queryOne<DeviceRow>('SELECT id, channel, p256dh, auth FROM notif_devices WHERE endpoint_or_token = ?', [token])
  if (existing) {
    if (existing.channel !== 'FCM') throw new DeviceConflictError('Perangkat tidak cocok.')
    await store.execute(
      `UPDATE notif_devices SET is_active = 1, deactivated_reason = NULL, failure_count = 0,
         platform = COALESCE(?, platform), user_agent = COALESCE(?, user_agent), last_seen_at = ? WHERE id = ?`,
      [clip(meta.platform, 40), clip(meta.userAgent, 300), at, existing.id])
    await linkOwner(store, existing.id, owner, at)
    return { deviceId: existing.id }
  }
  const deviceId = crypto.randomUUID()
  await store.execute(
    `INSERT INTO notif_devices (id, channel, endpoint_or_token, platform, user_agent, last_seen_at, created_at)
     VALUES (?, 'FCM', ?, ?, ?, ?, ?)`,
    [deviceId, token, clip(meta.platform, 40) ?? 'android', clip(meta.userAgent, 300), at, at])
  await linkOwner(store, deviceId, owner, at)
  return { deviceId }
}

/** Lepas link owner dari perangkat; mengembalikan sisa owner lain di perangkat itu. */
export async function unlinkDevice(store: NotifStore, owner: NotifRecipient, deviceId: string): Promise<number> {
  await store.execute('DELETE FROM notif_device_links WHERE device_id = ? AND owner_kind = ? AND owner_id = ?', [deviceId, owner.kind, owner.id])
  const row = await store.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM notif_device_links WHERE device_id = ?', [deviceId])
  return Number(row?.n ?? 0)
}

export async function unlinkByEndpoint(store: NotifStore, owner: NotifRecipient, endpoint: unknown): Promise<number> {
  if (typeof endpoint !== 'string') return 0
  const device = await store.queryOne<{ id: string }>('SELECT id FROM notif_devices WHERE endpoint_or_token = ?', [endpoint])
  return device ? unlinkDevice(store, owner, device.id) : 0
}

/**
 * pushsubscriptionchange: browser mengganti endpoint. Hanya owner yang sudah ter-link ke
 * perangkat lama (dibuktikan dengan sesinya) yang dipindahkan ke langganan baru.
 */
export async function renewWebPushDevice(
  store: NotifStore,
  owners: NotifRecipient[],
  oldEndpoint: unknown,
  input: WebPushSubscriptionInput,
): Promise<{ deviceId: string; moved: number } | null> {
  if (typeof oldEndpoint !== 'string') return null
  const old = await store.queryOne<{ id: string }>('SELECT id FROM notif_devices WHERE endpoint_or_token = ?', [oldEndpoint])
  if (!old) return null
  const linked: NotifRecipient[] = []
  for (const owner of owners) if (await isLinked(store, old.id, owner)) linked.push(owner)
  if (!linked.length) return null
  let deviceId = ''
  for (const owner of linked) {
    deviceId = (await registerWebPushDevice(store, owner, input)).deviceId
    await unlinkDevice(store, owner, old.id)
  }
  await store.execute(`UPDATE notif_devices SET is_active = 0, deactivated_reason = 'RENEWED' WHERE id = ? AND id <> ?`, [old.id, deviceId])
  return { deviceId, moved: linked.length }
}
