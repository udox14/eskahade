'use server'

import { query, queryOne, execute } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath } from 'next/cache'
import { getCachedFiturAkses } from '@/lib/cache/fitur-akses'

export async function getUsersList() {
  return await query<any>(
    `SELECT
      u.id,
      u.email,
      u.full_name,
      u.role,
      u.roles,
      u.asrama_binaan,
      u.created_at,
      GROUP_CONCAT(k.nama_kelas, ', ') AS kelas_binaan
    FROM users u
    LEFT JOIN kelas k ON k.wali_kelas_id = u.id
    GROUP BY u.id, u.email, u.full_name, u.role, u.roles, u.asrama_binaan, u.created_at
    ORDER BY u.created_at DESC`
  )
}

// ── Multi-role: update roles (JSON array) + role (primary) ──────────────────
export async function updateUserRoles(
  id: string,
  newRoles: string[],
  asrama?: string
): Promise<{ success: boolean } | { error: string }> {
  if (!newRoles || newRoles.length === 0) return { error: 'Minimal satu role harus dipilih.' }

  const primaryRole = newRoles[0]
  const asramaBinaan = newRoles.includes('pengurus_asrama') ? (asrama || null) : null
  const rolesJson = JSON.stringify(newRoles)

  await execute(
    'UPDATE users SET role = ?, roles = ?, asrama_binaan = ?, updated_at = ? WHERE id = ?',
    [primaryRole, rolesJson, asramaBinaan, new Date().toISOString(), id]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

// Backward compat wrapper
export async function updateUserRole(id: string, newRole: string, asrama?: string): Promise<{ success: boolean } | { error: string }> {
  return updateUserRoles(id, [newRole], asrama)
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
  const rolesJson = JSON.stringify([role])

  await execute(
    'INSERT INTO users (id, email, password_hash, full_name, role, roles, asrama_binaan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      crypto.randomUUID(),
      email,
      passwordHash,
      fullName,
      role,
      rolesJson,
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
      const userRole = u.role || 'wali_kelas'
      const rolesJson = JSON.stringify([userRole])

      await execute(
        'INSERT INTO users (id, email, password_hash, full_name, role, roles, asrama_binaan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          email,
          passwordHash,
          u.full_name,
          userRole,
          rolesJson,
          userRole === 'pengurus_asrama' ? (u.asrama_binaan || null) : null,
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

  await execute(
    'UPDATE users SET full_name = ?, email = ?, updated_at = ? WHERE id = ?',
    [fullName, emailClean, new Date().toISOString(), userId]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean } | { error: string }> {
  const passwordHash = await hashPassword(newPassword)

  await execute(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, new Date().toISOString(), userId]
  )

  return { success: true }
}

export async function deleteUser(userId: string): Promise<{ success: boolean } | { error: string }> {
  await execute('DELETE FROM users WHERE id = ?', [userId])
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

// ── Per-user feature overrides (Grant/Revoke) ──────────────────────────────

export async function getUserOverrides(userId: string) {
  try {
    return await query<{ id: number; fitur_id: number; action: string }>(
      'SELECT id, fitur_id, action FROM user_fitur_override WHERE user_id = ?',
      [userId]
    )
  } catch {
    return []
  }
}

export async function setUserFiturOverride(
  userId: string,
  fiturId: number,
  action: 'grant' | 'revoke'
): Promise<{ success: boolean } | { error: string }> {
  await execute(
    `INSERT INTO user_fitur_override (user_id, fitur_id, action, created_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, fitur_id) DO UPDATE SET action = excluded.action, created_at = excluded.created_at`,
    [userId, fiturId, action]
  )
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function removeUserFiturOverride(
  userId: string,
  fiturId: number
): Promise<{ success: boolean } | { error: string }> {
  await execute(
    'DELETE FROM user_fitur_override WHERE user_id = ? AND fitur_id = ?',
    [userId, fiturId]
  )
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

// Expose fitur list as a server action for the client
export async function getAllActiveFitur() {
  const all = await getCachedFiturAkses()
  return all.filter(f => f.is_active)
}
