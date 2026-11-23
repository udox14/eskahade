// Kotak masuk per penerima. Semua query selalu dibatasi recipient_kind + recipient_id
// dari sesi server, bukan dari input klien.

import { NOTIF_CATEGORIES } from './catalog'
import type { NotifLevel, NotifRecipient, NotifStore } from './types'

export interface InboxItem {
  id: string
  event_code: string
  category: string
  category_label: string
  title: string
  body: string
  link: string | null
  level: NotifLevel
  read_at: string | null
  created_at: string
}

type InboxRow = Omit<InboxItem, 'category_label'>

const ID_RE = /^[0-9a-f-]{36}$/i

export async function listInbox(
  store: NotifStore,
  recipient: NotifRecipient,
  options: { limit?: number; before?: string | null; unreadOnly?: boolean; category?: string | null } = {},
): Promise<{ items: InboxItem[]; nextCursor: string | null }> {
  const limit = Math.min(50, Math.max(1, options.limit ?? 20))
  const where = ['recipient_kind = ?', 'recipient_id = ?']
  const params: unknown[] = [recipient.kind, recipient.id]
  if (options.unreadOnly) where.push('read_at IS NULL')
  if (options.category && NOTIF_CATEGORIES[options.category]) { where.push('category = ?'); params.push(options.category) }
  // Kursor gabungan created_at|id: satu putaran dispatch memberi created_at yang sama.
  const [beforeAt, beforeId] = String(options.before ?? '').split('|')
  if (/^\d{4}-\d{2}-\d{2}T/.test(beforeAt ?? '') && ID_RE.test(beforeId ?? '')) {
    where.push('(created_at < ? OR (created_at = ? AND id < ?))')
    params.push(beforeAt, beforeAt, beforeId)
  }
  const rows = await store.query<InboxRow>(
    `SELECT id, event_code, category, title, body, link, level, read_at, created_at
     FROM notifications WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ?`,
    [...params, limit + 1],
  )
  const page = rows.slice(0, limit)
  return {
    items: page.map(r => ({ ...r, category_label: NOTIF_CATEGORIES[r.category] ?? r.category })),
    nextCursor: rows.length > limit ? `${page[page.length - 1].created_at}|${page[page.length - 1].id}` : null,
  }
}

export async function countUnread(store: NotifStore, recipient: NotifRecipient): Promise<number> {
  const row = await store.queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notifications WHERE recipient_kind = ? AND recipient_id = ? AND read_at IS NULL',
    [recipient.kind, recipient.id],
  )
  return Number(row?.n ?? 0)
}

export async function markRead(store: NotifStore, recipient: NotifRecipient, ids: string[]) {
  const valid = [...new Set(ids.filter(id => typeof id === 'string' && ID_RE.test(id)))].slice(0, 100)
  if (!valid.length) return
  await store.execute(
    `UPDATE notifications SET read_at = ? WHERE recipient_kind = ? AND recipient_id = ? AND read_at IS NULL
     AND id IN (${valid.map(() => '?').join(',')})`,
    [new Date().toISOString(), recipient.kind, recipient.id, ...valid],
  )
}

export async function markAllRead(store: NotifStore, recipient: NotifRecipient) {
  await store.execute(
    'UPDATE notifications SET read_at = ? WHERE recipient_kind = ? AND recipient_id = ? AND read_at IS NULL',
    [new Date().toISOString(), recipient.kind, recipient.id],
  )
}

export interface CategoryPreference {
  category: string
  label: string
  in_app_enabled: boolean
}

/** Kategori yang relevan untuk audiens penerima. Event wajib tetap terkirim meski dimatikan. */
export async function listPreferences(store: NotifStore, recipient: NotifRecipient, categories: string[]): Promise<CategoryPreference[]> {
  const rows = await store.query<{ category: string; in_app_enabled: number }>(
    'SELECT category, in_app_enabled FROM notif_preferences WHERE owner_kind = ? AND owner_id = ?',
    [recipient.kind, recipient.id],
  )
  const map = new Map(rows.map(r => [r.category, Number(r.in_app_enabled) === 1]))
  return categories.map(c => ({ category: c, label: NOTIF_CATEGORIES[c] ?? c, in_app_enabled: map.get(c) ?? true }))
}

export async function setPreference(store: NotifStore, recipient: NotifRecipient, category: string, inAppEnabled: boolean) {
  if (!NOTIF_CATEGORIES[category]) throw new Error('Kategori notifikasi tidak dikenal.')
  await store.execute(
    `INSERT INTO notif_preferences (owner_kind, owner_id, category, in_app_enabled, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_kind, owner_id, category) DO UPDATE SET in_app_enabled = excluded.in_app_enabled, updated_at = excluded.updated_at`,
    [recipient.kind, recipient.id, category, inAppEnabled ? 1 : 0, new Date().toISOString()],
  )
}
