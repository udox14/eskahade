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

  let user: {
    id: string
    email: string
    password_hash: string
    full_name: string
    role: string
    asrama_binaan: string | null
  } | null = null

  try {
    user = await queryOne(
      'SELECT id, email, password_hash, full_name, role, asrama_binaan FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    )
  } catch (err: any) {
    console.error('DB error saat login:', err)
    return { error: 'Gagal terhubung ke database. Coba lagi nanti.' }
  }

  if (!user) {
    return { error: 'Email atau Password salah.' }
  }

  let valid = false
  try {
    valid = await verifyPassword(password, user.password_hash)
  } catch (err: any) {
    console.error('Error verifikasi password:', err)
    return { error: 'Terjadi kesalahan saat verifikasi. Coba lagi.' }
  }

  if (!valid) {
    return { error: 'Email atau Password salah.' }
  }

  // Set session DULU (masih aman di try/catch terpisah)
  try {
    await setSession({
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      asrama_binaan: user.asrama_binaan,
    })
  } catch (err: any) {
    console.error('Error set session:', err)
    return { error: 'Gagal menyimpan sesi. Coba lagi.' }
  }

  return { success: true }
}