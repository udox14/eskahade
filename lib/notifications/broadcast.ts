// Broadcast / pengumuman manual (NOTIF-6). Fan-out bertahap: setiap putaran mengklaim broadcast
// yang jatuh tempo (lease lewat updated_at), menyisipkan inbox untuk satu potong penerima
// (keyset cursor), mengantrikan push untuk potongan itu, lalu memajukan cursor.
// Idempoten: UNIQUE(broadcast_id, recipient) + compare-and-set cursor → aman dijalankan paralel.

import { readNotifSetting } from './config'
import { enabledPushChannels, type PushRuntime } from './push'
import { effectiveRolesForUser } from './recipients'
import { BODY_MAX, safeInternalLink, TITLE_MAX } from './render'
import { NOTIF_CHANNELS, type NotifChannel, type NotifStore, type RecipientKind } from './types'

export const BROADCAST_EVENT_CODE = 'BROADCAST'
export const BROADCAST_CATEGORY = 'pengumuman'
export const BROADCAST_CHUNK = 200
const LEASE_MS = 2 * 60_000
const RELEASED = '1970-01-01T00:00:00.000Z'
const MAX_SCHEDULE_DAYS = 60
const NON_OPERATIONAL_ROLES = ['tester', 'demo']
const ROLE_RE = /^[a-z_]+(:[a-z_]+)?$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export type BroadcastAudience =
  | { kind: 'PARENTS_ALL' }
  | { kind: 'PARENTS_ASRAMA'; asrama: string[] }
  | { kind: 'STAFF_ROLES'; roles: string[] }
  | { kind: 'STAFF_USERS'; userIds: string[] }

export interface BroadcastInput {
  title: string
  body: string
  link?: string | null
  audience: BroadcastAudience
  channels: NotifChannel[]
  /** ISO; kosong = kirim sekarang. */
  scheduledAt?: string | null
}

export interface NormalizedBroadcast {
  title: string
  body: string
  link: string | null
  audience: BroadcastAudience
  channels: NotifChannel[]
  scheduledAt: string
}

const clean = (text: unknown, max: number) => String(text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)

export function normalizeAudience(input: unknown): BroadcastAudience {
  const a = (input ?? {}) as Record<string, unknown>
  const list = (v: unknown, re: RegExp, max = 200) => Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(x => re.test(x)))].slice(0, max) : []
  switch (a.kind) {
    case 'PARENTS_ALL': return { kind: 'PARENTS_ALL' }
    case 'PARENTS_ASRAMA': {
      const asrama = list(a.asrama, /^[A-Za-z0-9 ._-]{1,40}$/, 30).map(x => x.toUpperCase())
      if (!asrama.length) throw new Error('Pilih minimal satu asrama.')
      return { kind: 'PARENTS_ASRAMA', asrama }
    }
    case 'STAFF_ROLES': {
      const roles = list(a.roles, ROLE_RE, 30)
      if (!roles.length) throw new Error('Pilih minimal satu role pegawai.')
      return { kind: 'STAFF_ROLES', roles }
    }
    case 'STAFF_USERS': {
      const userIds = list(a.userIds, ID_RE, 200)
      if (!userIds.length) throw new Error('Pilih minimal satu pegawai.')
      return { kind: 'STAFF_USERS', userIds }
    }
    default: throw new Error('Jenis penerima pengumuman tidak dikenal.')
  }
}

export function normalizeBroadcast(input: BroadcastInput, at = new Date()): NormalizedBroadcast {
  const title = clean(input.title, TITLE_MAX + 1)
  const body = clean(input.body, BODY_MAX + 1)
  if (title.length < 3) throw new Error('Judul pengumuman minimal 3 karakter.')
  if (title.length > TITLE_MAX) throw new Error(`Judul maksimal ${TITLE_MAX} karakter.`)
  if (body.length < 3) throw new Error('Isi pengumuman minimal 3 karakter.')
  if (body.length > BODY_MAX) throw new Error(`Isi maksimal ${BODY_MAX} karakter.`)
  const rawLink = clean(input.link, 300)
  const link = rawLink ? safeInternalLink(rawLink) : null
  if (rawLink && !link) throw new Error('Tautan harus alamat di dalam aplikasi, diawali "/" (mis. /portal-ortu/tagihan).')
  const channels = NOTIF_CHANNELS.filter(c => (input.channels ?? []).includes(c) || c === 'in_app')
  let scheduledAt = at.toISOString()
  if (input.scheduledAt) {
    const when = new Date(input.scheduledAt)
    if (Number.isNaN(when.getTime())) throw new Error('Waktu kirim tidak valid.')
    if (when.getTime() < at.getTime() - 60_000) throw new Error('Waktu kirim sudah lewat.')
    if (when.getTime() > at.getTime() + MAX_SCHEDULE_DAYS * 86400_000) throw new Error(`Jadwal maksimal ${MAX_SCHEDULE_DAYS} hari ke depan.`)
    scheduledAt = when.toISOString()
  }
  return { title, body, link, audience: normalizeAudience(input.audience), channels, scheduledAt }
}

const audienceKind = (a: BroadcastAudience): RecipientKind => a.kind.startsWith('PARENTS') ? 'SANTRI' : 'USER'

interface Page { ids: string[]; lastScanned: string | null; done: boolean }

/** Satu potong penerima setelah cursor (keyset by id). */
async function recipientPage(store: NotifStore, audience: BroadcastAudience, cursor: string, limit = BROADCAST_CHUNK): Promise<Page> {
  if (audience.kind === 'PARENTS_ALL' || audience.kind === 'PARENTS_ASRAMA') {
    const asrama = audience.kind === 'PARENTS_ASRAMA' ? audience.asrama : []
    const rows = await store.query<{ id: string }>(
      `SELECT id FROM santri WHERE status_global = 'aktif' AND id > ?
       ${asrama.length ? `AND UPPER(TRIM(COALESCE(asrama, ''))) IN (${asrama.map(() => '?').join(',')})` : ''}
       ORDER BY id LIMIT ?`, [cursor, ...asrama, limit])
    return { ids: rows.map(r => r.id), lastScanned: rows.at(-1)?.id ?? null, done: rows.length < limit }
  }
  const rows = await store.query<{ id: string; role: string | null; roles: string | null; structural_jabatan: string | null }>(
    `SELECT id, role, roles, structural_jabatan FROM users WHERE id > ? ORDER BY id LIMIT ?`, [cursor, limit])
  const wanted = audience.kind === 'STAFF_USERS' ? new Set(audience.userIds) : null
  const targetRoles = audience.kind === 'STAFF_ROLES' ? audience.roles : []
  const ids = rows.filter(row => {
    const roles = effectiveRolesForUser(row)
    if (!roles.length) return false
    if (wanted) return wanted.has(row.id)
    if (roles.some(r => NON_OPERATIONAL_ROLES.includes(r)) && !targetRoles.some(r => NON_OPERATIONAL_ROLES.includes(r))) return false
    return roles.some(r => targetRoles.includes(r))
  }).map(r => r.id)
  return { ids, lastScanned: rows.at(-1)?.id ?? null, done: rows.length < limit }
}

/** Perkiraan jumlah penerima untuk konfirmasi sebelum mengirim. */
export async function estimateAudience(store: NotifStore, audience: BroadcastAudience): Promise<number> {
  let total = 0
  let cursor = ''
  for (let i = 0; i < 100; i++) {
    const page = await recipientPage(store, audience, cursor, 500)
    total += page.ids.length
    if (page.done || !page.lastScanned) break
    cursor = page.lastScanned
  }
  return total
}

export async function createBroadcast(store: NotifStore, input: BroadcastInput, actorId: string, at = new Date()) {
  const b = normalizeBroadcast(input, at)
  const id = crypto.randomUUID()
  await store.execute(
    `INSERT INTO notif_broadcasts (id, title, body, link, audience_json, channels_json, scheduled_at, status, recipient_count, cursor, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 0, '', ?, ?, ?)`,
    [id, b.title, b.body, b.link, JSON.stringify(b.audience), JSON.stringify(b.channels), b.scheduledAt, actorId, at.toISOString(), at.toISOString()])
  return { id, ...b }
}

/** Batalkan hanya yang belum mulai dikirim (SENDING/SENT tidak bisa ditarik kembali). */
export async function cancelBroadcast(store: NotifStore, id: string) {
  await store.execute(`UPDATE notif_broadcasts SET status = 'CANCELLED', updated_at = ? WHERE id = ? AND status IN ('DRAFT', 'SCHEDULED')`,
    [new Date().toISOString(), id])
  const row = await store.queryOne<{ status: string }>('SELECT status FROM notif_broadcasts WHERE id = ?', [id])
  if (row?.status !== 'CANCELLED') throw new Error('Pengumuman sudah mulai dikirim sehingga tidak bisa dibatalkan.')
}

interface ClaimedBroadcast {
  id: string; title: string; body: string; link: string | null
  audience_json: string; channels_json: string; cursor: string | null; updated_at: string
}

export interface BroadcastRunResult { claimed: number; inserted: number; completed: number }

export async function processBroadcasts(
  store: NotifStore,
  push: PushRuntime | null | undefined,
  options: { at?: Date; maxChunks?: number } = {},
): Promise<BroadcastRunResult> {
  const result: BroadcastRunResult = { claimed: 0, inserted: 0, completed: 0 }
  if (!(await readNotifSetting(store, 'notifications_enabled'))) return result
  const pushActive = !!(push && (push.webpush || push.fcm)) && await readNotifSetting(store, 'notifications_push_enabled')
  const at = options.at ?? new Date()

  for (let chunk = 0; chunk < (options.maxChunks ?? 10); chunk++) {
    const now = new Date(Math.max(at.getTime(), Date.now())).toISOString()
    const stale = new Date(Date.parse(now) - LEASE_MS).toISOString()
    // Klaim satu broadcast: jatuh tempo, atau SENDING yang lease-nya habis. updated_at = token lease.
    const [claimed] = await store.query<ClaimedBroadcast>(
      `UPDATE notif_broadcasts SET status = 'SENDING', updated_at = ?
       WHERE id = (SELECT id FROM notif_broadcasts
         WHERE (status = 'SCHEDULED' AND scheduled_at <= ?) OR (status = 'SENDING' AND updated_at < ?)
         ORDER BY scheduled_at LIMIT 1)
       RETURNING id, title, body, link, audience_json, channels_json, cursor, updated_at`,
      [now, new Date(Date.parse(now) + 1000).toISOString(), stale])
    if (!claimed) break
    result.claimed++

    let audience: BroadcastAudience
    let channels: NotifChannel[]
    try {
      audience = normalizeAudience(JSON.parse(claimed.audience_json))
      channels = JSON.parse(claimed.channels_json) as NotifChannel[]
    } catch {
      await store.execute(`UPDATE notif_broadcasts SET status = 'CANCELLED', updated_at = ? WHERE id = ? AND updated_at = ?`, [now, claimed.id, claimed.updated_at])
      continue
    }
    const kind = audienceKind(audience)
    const cursor = claimed.cursor ?? ''
    const page = await recipientPage(store, audience, cursor)
    const nextCursor = page.lastScanned ?? cursor
    const link = safeInternalLink(claimed.link)

    const statements: Array<{ sql: string; params: unknown[] }> = page.ids.map(recipientId => ({
      sql: `INSERT OR IGNORE INTO notifications (id, recipient_kind, recipient_id, event_code, category, broadcast_id,
              title, body, push_body, link, level, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'info', ?)`,
      params: [crypto.randomUUID(), kind, recipientId, BROADCAST_EVENT_CODE, BROADCAST_CATEGORY, claimed.id,
        claimed.title, claimed.body, claimed.body, link, now],
    }))
    const deviceChannels = pushActive ? enabledPushChannels(channels, push) : []
    if (deviceChannels.length && page.ids.length) {
      statements.push({
        sql: `INSERT OR IGNORE INTO notif_deliveries (id, notification_id, device_id, channel)
              SELECT lower(hex(randomblob(16))), n.id, d.id, d.channel
              FROM notifications n
              JOIN notif_device_links l ON l.owner_kind = n.recipient_kind AND l.owner_id = n.recipient_id
              JOIN notif_devices d ON d.id = l.device_id AND d.is_active = 1
              WHERE n.broadcast_id = ? AND n.recipient_id > ? AND n.recipient_id <= ?
                AND d.channel IN (${deviceChannels.map(() => '?').join(',')})`,
        params: [claimed.id, cursor, nextCursor, ...deviceChannels],
      })
    }
    // Cursor & hitungan maju hanya bila lease masih milik putaran ini.
    statements.push({
      sql: `UPDATE notif_broadcasts SET cursor = ?, status = ?, updated_at = ?,
              recipient_count = (SELECT COUNT(*) FROM notifications WHERE broadcast_id = ?)
            WHERE id = ? AND status = 'SENDING' AND updated_at = ?`,
      // Potongan berikutnya langsung bisa diklaim (updated_at epoch = lease dilepas).
      params: [nextCursor, page.done ? 'SENT' : 'SENDING', page.done ? now : RELEASED, claimed.id, claimed.id, claimed.updated_at],
    })
    await store.batch(statements)
    result.inserted += page.ids.length
    if (page.done) result.completed++
  }
  return result
}
