import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Memanggil fungsi update session untuk menyegarkan token auth
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Matcher agar middleware tidak jalan di file statis
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}