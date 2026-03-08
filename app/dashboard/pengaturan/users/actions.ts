'use server'

import { query, queryOne } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath } from 'next/cache'

export async function getUsersList() {
  return await query<any>(
    'SELECT id, email, full_name, role, asrama_binaan, created_at FROM users ORDER BY created_at DESC'
  )
}

export async function updateUserRole(id: string, newRole: string, asrama?: string): Promise<{ success: boolean } | { error: string }> {
  const asramaBinaan = newRole === 'pengurus_asrama' ? (asrama || null) : null

  await query(
    'UPDATE users SET role = ?, asrama_binaan = ?, updated_at = ? WHERE id = ?',
    [newRole, asramaBinaan, new Date().toISOString(), id]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function createUser(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const email = (formData.get('email') as string).toLowerCase().trim()
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as string
  const asrama = formData.get('asrama_binaan') as string

  // Cek email duplikat
  const exist = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (exist) return { error: 'Email sudah digunakan.' }

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  await query(
    'INSERT INTO users (id, email, password_hash, full_name, role, asrama_binaan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      crypto.randomUUID(),
      email,
      passwordHash,
      fullName,
      role,
      role === 'pengurus_asrama' ? asrama : null,
      now,
      now
    ]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function createUsersBatch(usersData: any[]) {
  let successCount = 0
  const errors: string[] = []

  for (const u of usersData) {
    if (!u.email || !u.password || !u.full_name) {
      errors.push(`Data tidak lengkap untuk ${u.full_name || 'Tanpa Nama'}`)
      continue
    }

    const email = String(u.email).toLowerCase().trim()

    // Cek duplikat
    const exist = await queryOne('SELECT id FROM users WHERE email = ?', [email])
    if (exist) {
      errors.push(`Email ${email} sudah digunakan.`)
      continue
    }

    try {
      const passwordHash = await hashPassword(String(u.password))
      const now = new Date().toISOString()

      await query(
        'INSERT INTO users (id, email, password_hash, full_name, role, asrama_binaan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          email,
          passwordHash,
          u.full_name,
          u.role || 'wali_kelas',
          u.role === 'pengurus_asrama' ? (u.asrama_binaan || null) : null,
          now,
          now
        ]
      )
      successCount++
    } catch (err: any) {
      errors.push(`Gagal buat user ${email}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true, count: successCount, errors: errors.length > 0 ? errors : null }
}

export async function updateUserDetails(userId: string, fullName: string, email: string): Promise<{ success: boolean } | { error: string }> {
  const emailClean = email.toLowerCase().trim()

  // Cek email duplikat (kecuali user itu sendiri)
  const exist = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [emailClean, userId])
  if (exist) return { error: 'Email sudah digunakan user lain.' }

  await query(
    'UPDATE users SET full_name = ?, email = ?, updated_at = ? WHERE id = ?',
    [fullName, emailClean, new Date().toISOString(), userId]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean } | { error: string }> {
  const passwordHash = await hashPassword(newPassword)

  await query(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, new Date().toISOString(), userId]
  )

  return { success: true }
}

export async function deleteUser(userId: string): Promise<{ success: boolean } | { error: string }> {
  await query('DELETE FROM users WHERE id = ?', [userId])
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}