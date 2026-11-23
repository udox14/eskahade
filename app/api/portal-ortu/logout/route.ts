import { NextResponse } from 'next/server'
import { getPortalSession, PORTAL_COOKIE } from '@/lib/portal/session'
import { unlinkCurrentDevice } from '@/lib/notifications/runtime'

export async function POST() {
  // Perangkat ini berhenti menerima push untuk santri yang logout.
  const session = await getPortalSession()
  await unlinkCurrentDevice(session ? { kind: 'SANTRI', id: session.santri_id } : null)
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: PORTAL_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
