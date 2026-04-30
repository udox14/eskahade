// lib/auth/guard.ts
//
// Helper untuk memproteksi halaman berdasarkan konfigurasi fitur_akses di DB.
// Dipanggil di dalam Server Component (page.tsx) — bukan middleware.
//
// Multi-role aware:
// - Cek semua role user (session.roles[])
// - Admin SELALU lolos
// - Support per-user grant/revoke overrides

import { getSession, type SessionUser, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { redirect } from 'next/navigation'

export async function guardPage(href: string): Promise<SessionUser> {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const roles = getEffectiveRoles(session)

  // Admin selalu boleh akses semua
  if (roles.includes('admin')) {
    return session
  }

  // Cek akses dari DB (multi-role + per-user overrides)
  let allowed = false
  try {
    allowed = await canAccessFeatureForSession(session, href)
  } catch (err: any) {
    // Kalau DB error (mis. tabel belum ada), log dan izinkan masuk
    // supaya non-admin tidak ter-redirect loop secara diam-diam
    console.error('[guard] canAccessHref ERROR untuk', href, '-', err?.message)
    console.error('[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!')
    return session
  }

  console.log('[guard] href:', href, '| roles:', roles, '| allowed:', allowed)

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

  if (allowedRoles.length > 0) {
    const userRoles = getEffectiveRoles(session)
    const hasAccess = userRoles.some(r => allowedRoles.includes(r))
    if (!hasAccess) {
      redirect('/dashboard')
    }
  }

  return session
}
