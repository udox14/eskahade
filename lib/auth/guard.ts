// lib/auth/guard.ts
//
// Helper untuk memproteksi halaman berdasarkan konfigurasi fitur_akses di DB.
// Dipanggil di dalam Server Component (page.tsx) — bukan middleware.
//
// Cara pakai:
//   const session = await guardPage('/dashboard/akademik/absensi')
//   // lanjut gunakan session.role, session.id, dll.
//
// Catatan:
// - Kalau tidak login → redirect ke /login
// - Kalau login tapi tidak punya akses → redirect ke /dashboard
// - Admin SELALU lolos (tidak perlu dicek ke DB)
// - Halaman yang href-nya tidak terdaftar di fitur_akses → BLOKIR (kecuali admin)

import { getSession, type SessionUser } from '@/lib/auth/session'
import { canAccessHref } from '@/lib/cache/fitur-akses'
import { redirect } from 'next/navigation'

/**
 * Proteksi halaman berdasarkan DB fitur_akses.
 *
 * @param href  - Path halaman ini, contoh: '/dashboard/akademik/absensi'
 * @returns     - SessionUser yang sudah terverifikasi
 */
export async function guardPage(href: string): Promise<SessionUser> {
  const session = await getSession()

  // Belum login
  if (!session) {
    redirect('/login')
  }

  // Admin selalu boleh akses semua — tidak perlu query DB
  if (session.role === 'admin') {
    return session
  }

  // Cek akses dari cache (1 query DB, di-cache 5 menit)
  const allowed = await canAccessHref(href, session.role)
  if (!allowed) {
    redirect('/dashboard')
  }

  return session
}

/**
 * Versi tanpa cek fitur_akses — hanya pastikan sudah login dan role cocok.
 * Pakai ini untuk halaman yang aksesnya sederhana (misal: profil diri sendiri).
 *
 * @param allowedRoles - Daftar role yang diizinkan, kosongkan untuk semua role
 * @returns            - SessionUser yang sudah terverifikasi
 */
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
