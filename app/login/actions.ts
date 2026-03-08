'use server'

import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { setSession } from '@/lib/auth/session'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' }
  }

  try {
    // Cari user di D1
    const user = await queryOne<{
      id: string
      email: string
      password_hash: string
      full_name: string
      role: string
      asrama_binaan: string | null
    }>(
      'SELECT id, email, password_hash, full_name, role, asrama_binaan FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    )

    if (!user) {
      return { error: 'Email atau Password salah.' }
    }

    // Verifikasi password
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return { error: 'Email atau Password salah.' }
    }

    // Set JWT session cookie
    await setSession({
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      asrama_binaan: user.asrama_binaan,
    })

    return { success: true }

  } catch (err: any) {
    console.error('Login error:', err)

    if (err.message?.includes('fetch failed') || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return { error: 'Koneksi ke server database terputus. Periksa internet Anda.' }
    }

    return { error: 'Terjadi kesalahan sistem. Coba lagi nanti.' }
  }
}