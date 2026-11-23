import { requirePortalSessionStrict } from '@/lib/portal/session'
import { NOTIF_EVENTS } from '@/lib/notifications/catalog'
import { countUnread, listInbox, listPreferences } from '@/lib/notifications/inbox'
import { sessionNotifStore } from '@/lib/notifications/runtime'
import { PortalNotifikasiClient } from './_notifikasi-client'

export const dynamic = 'force-dynamic'

export default async function PortalNotifikasiPage() {
  const session = await requirePortalSessionStrict()
  const recipient = { kind: 'SANTRI' as const, id: session.santri_id }
  const store = sessionNotifStore()
  const categories = [...new Set(NOTIF_EVENTS.filter(e => e.audience === 'PARENT').map(e => e.category))]

  const [page, unread, preferences] = await Promise.all([
    listInbox(store, recipient, { limit: 20 }).catch(() => null),
    countUnread(store, recipient).catch(() => 0),
    listPreferences(store, recipient, categories).catch(() => null),
  ])

  return (
    <div className="px-5 pt-5 pb-32 space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Notifikasi</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kabar pembayaran, tagihan, dan uang jajan {session.nama}.</p>
      </div>
      <PortalNotifikasiClient
        initialItems={page?.items ?? []}
        initialCursor={page?.nextCursor ?? null}
        initialUnread={unread}
        preferences={preferences}
        unavailable={page === null}
        ownerKey={session.santri_id}
      />
    </div>
  )
}
