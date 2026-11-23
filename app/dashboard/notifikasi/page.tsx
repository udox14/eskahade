import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { NOTIF_EVENTS } from '@/lib/notifications/catalog'
import { countUnread, listInbox, listPreferences } from '@/lib/notifications/inbox'
import { sessionNotifStore } from '@/lib/notifications/runtime'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

// Kotak masuk pribadi: tidak didaftarkan di fitur_akses, semua akun pegawai boleh membuka.
export default async function NotifikasiPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const recipient = { kind: 'USER' as const, id: session.id }
  const store = sessionNotifStore()
  const categories = [...new Set(NOTIF_EVENTS.filter(e => e.audience === 'STAFF').map(e => e.category))]

  const [page, unread, preferences] = await Promise.all([
    listInbox(store, recipient, { limit: 20 }).catch(() => null),
    countUnread(store, recipient).catch(() => 0),
    listPreferences(store, recipient, categories).catch(() => null),
  ])

  return (
    <PageContent
      initialItems={page?.items ?? []}
      initialCursor={page?.nextCursor ?? null}
      initialUnread={unread}
      preferences={preferences}
      unavailable={page === null}
      ownerKey={session.id}
    />
  )
}
