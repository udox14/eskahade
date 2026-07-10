import { NextResponse } from 'next/server'
import { PORTAL_COOKIE } from '@/lib/portal/session'

export async function POST() {
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
