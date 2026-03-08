import { type NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookieString } from '@/lib/auth/session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookieHeader = request.headers.get('cookie') || ''

  // Proteksi semua halaman dashboard
  if (pathname.startsWith('/dashboard')) {
    const user = await getSessionFromCookieString(cookieHeader)

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Kalau sudah login, redirect dari /login ke /dashboard
  if (pathname === '/login') {
    const user = await getSessionFromCookieString(cookieHeader)
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}