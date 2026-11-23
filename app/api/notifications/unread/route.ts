import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getPortalSession } from '@/lib/portal/session'
import { countUnread } from '@/lib/notifications/inbox'
import { sessionNotifStore } from '@/lib/notifications/runtime'
import type { NotifRecipient } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

// Polling ringan jumlah notifikasi belum dibaca. Penerima selalu dari sesi server.
export async function GET(request: Request) {
  const audience = new URL(request.url).searchParams.get('audience')
  let recipient: NotifRecipient | null = null
  if (audience === 'portal') {
    const portal = await getPortalSession()
    if (portal && !portal.must_change_password) recipient = { kind: 'SANTRI', id: portal.santri_id }
  } else {
    const session = await getSession()
    if (session) recipient = { kind: 'USER', id: session.id }
  }
  if (!recipient) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  try {
    const count = await countUnread(sessionNotifStore(), recipient)
    return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Tabel belum ada (migration 0202 belum diterapkan) → tampilkan 0, jangan error di header.
    return NextResponse.json({ count: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
