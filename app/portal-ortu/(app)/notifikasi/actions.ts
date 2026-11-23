'use server'

import { requirePortalSessionAction } from '@/lib/portal/session'
import { NOTIF_EVENTS } from '@/lib/notifications/catalog'
import {
  countUnread, listInbox, listPreferences, markAllRead, markRead, setPreference,
  type CategoryPreference, type InboxItem,
} from '@/lib/notifications/inbox'
import { sessionNotifStore } from '@/lib/notifications/runtime'
import type { NotifRecipient } from '@/lib/notifications/types'

const PARENT_CATEGORIES = [...new Set(NOTIF_EVENTS.filter(e => e.audience === 'PARENT').map(e => e.category))]

async function recipient(): Promise<NotifRecipient> {
  const session = await requirePortalSessionAction()
  if (session.must_change_password) throw new Error('Silakan ganti password terlebih dahulu.')
  return { kind: 'SANTRI', id: session.santri_id }
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memuat notifikasi.' }
  }
}

export async function getPortalNotifications(options: { before?: string | null; unreadOnly?: boolean; limit?: number } = {}) {
  return run<{ items: InboxItem[]; nextCursor: string | null; unread: number }>(async () => {
    const r = await recipient()
    const store = sessionNotifStore()
    const [page, unread] = await Promise.all([
      listInbox(store, r, { before: options.before, unreadOnly: options.unreadOnly, limit: options.limit }),
      countUnread(store, r),
    ])
    return { ...page, unread }
  })
}

export async function markPortalNotificationsRead(ids: string[]) {
  return run(async () => {
    const r = await recipient()
    await markRead(sessionNotifStore(), r, Array.isArray(ids) ? ids : [])
    return countUnread(sessionNotifStore(), r)
  })
}

export async function markAllPortalNotificationsRead() {
  return run(async () => {
    await markAllRead(sessionNotifStore(), await recipient())
    return 0
  })
}

export async function getPortalNotificationPreferences() {
  return run<CategoryPreference[]>(async () => listPreferences(sessionNotifStore(), await recipient(), PARENT_CATEGORIES))
}

export async function setPortalNotificationPreference(category: string, inAppEnabled: boolean) {
  return run(async () => {
    if (!PARENT_CATEGORIES.includes(category)) throw new Error('Kategori notifikasi tidak dikenal.')
    await setPreference(sessionNotifStore(), await recipient(), category, inAppEnabled === true)
    return true
  })
}
