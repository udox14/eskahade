// lib/auth/guard.ts
//
// Helper untuk memproteksi halaman berdasarkan konfigurasi fitur_akses di DB.
// Dipanggil di dalam Server Component (page.tsx) — bukan middleware.
//
// Catatan:
// - Kalau tidak login → redirect ke /login
// - Kalau login tapi tidak punya akses → redirect ke /dashboard
// - Admin SELALU lolos (tidak perlu dicek ke DB)
// - Kalau tabel fitur_akses belum ada / DB error → LOG + izinkan masuk
//   (fail-open agar login tidak rusak total, error terlihat di wrangler tail)

import { getSession, type SessionUser } from '@/lib/auth/session'
import { canAccessHref } from '@/lib/cache/fitur-akses'
import { redirect } from 'next/navigation'

export async function guardPage(href: string): Promise<SessionUser> {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Admin selalu boleh akses semua
  if (session.role === 'admin') {
    return session
  }

  // Cek akses dari DB
  let allowed = false
  try {
    allowed = await canAccessHref(href, session.role)
  } catch (err: any) {
    // Kalau DB error (mis. tabel belum ada), log dan izinkan masuk
    // supaya non-admin tidak ter-redirect loop secara diam-diam
    console.error('[guard] canAccessHref ERROR untuk', href, '-', err?.message)
    console.error('[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!')
    return session
  }

  console.log('[guard] href:', href, '| role:', session.role, '| allowed:', allowed)

  if (!allowed) {
    redirect('/dashboard')
  }

  return session
}

export async function guardRole(allowedRoles: string[] = []): Promise<SessionUser> {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    redirect('/dashboard')
  }

  return session
}
