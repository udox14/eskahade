'use client'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { InboxList, PreferenceList, type InboxActions } from '@/components/notifications/inbox-list'
import { PushToggleCard } from '@/components/notifications/push-cards'
import type { CategoryPreference, InboxItem } from '@/lib/notifications/inbox'
import { getMyNotifications, markAllMyNotificationsRead, markMyNotificationsRead, setMyNotificationPreference } from './actions'

const actions: InboxActions = {
  load: options => getMyNotifications(options),
  markRead: ids => markMyNotificationsRead(ids),
  markAll: () => markAllMyNotificationsRead(),
  setPreference: (category, enabled) => setMyNotificationPreference(category, enabled),
}

export default function PageContent({
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
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Notifikasi"
        description="Pemberitahuan tugas dan kejadian yang perlu Anda ketahui."
      />
      {unavailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Notifikasi belum tersedia. Hubungi admin untuk mengaktifkan modul notifikasi.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <InboxList
            initialItems={initialItems}
            initialCursor={initialCursor}
            initialUnread={initialUnread}
            actions={actions}
          />
          <div className="space-y-6">
            <PushToggleCard audience="staff" ownerKey={ownerKey} />
            {preferences && preferences.length > 0 && (
              <PreferenceList
                initial={preferences}
                onChange={actions.setPreference}
                note="Matikan jenis yang tidak relevan. Notifikasi penting yang ditandai wajib oleh admin tetap dikirim."
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
