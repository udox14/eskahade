'use client'

import { InboxList, PreferenceList, type InboxActions } from '@/components/notifications/inbox-list'
import { PushToggleCard } from '@/components/notifications/push-cards'
import type { CategoryPreference, InboxItem } from '@/lib/notifications/inbox'
import {
  getPortalNotifications, markAllPortalNotificationsRead, markPortalNotificationsRead, setPortalNotificationPreference,
} from './actions'

const actions: InboxActions = {
  load: options => getPortalNotifications(options),
  markRead: ids => markPortalNotificationsRead(ids),
  markAll: () => markAllPortalNotificationsRead(),
  setPreference: (category, enabled) => setPortalNotificationPreference(category, enabled),
}

export function PortalNotifikasiClient({
  initialItems,
  initialCursor,
  initialUnread,
  preferences,
  unavailable,
  ownerKey,
}: {
  initialItems: InboxItem[]
  initialCursor: string | null
  initialUnread: number
  preferences: CategoryPreference[] | null
  unavailable: boolean
  ownerKey: string
}) {
  if (unavailable) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Notifikasi belum tersedia. Silakan coba lagi nanti.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <PushToggleCard audience="portal" ownerKey={ownerKey} />
      <InboxList
        initialItems={initialItems}
        initialCursor={initialCursor}
        initialUnread={initialUnread}
        actions={actions}
        emptyText="Belum ada notifikasi. Kabar pembayaran dan tagihan akan muncul di sini."
      />
      {preferences && preferences.length > 0 && (
        <PreferenceList
          initial={preferences}
          onChange={actions.setPreference}
          note="Notifikasi penting seperti pembayaran diterima atau bukti transfer ditolak tetap dikirim walau dimatikan."
        />
      )}
    </div>
  )
}
