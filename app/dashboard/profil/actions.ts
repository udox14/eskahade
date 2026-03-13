'use server'

import { query, execute } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { uploadToR2, deleteFromR2 } from '@/lib/r2/upload'
import { revalidatePath } from 'next/cache'

export async function getProfilData() {
  const session = await getSession()
  if (!session) return null

  const user = await query<any>(
    'SELECT id, email, full_name, role, asrama_binaan, avatar_url, phone FROM users WHERE id = ?',
    [session.id]
  )
  return user[0] || null
}

export async function updateProfil(data: { full_name: string; phone: string }) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (!data.full_name.trim()) return { error: 'Nama tidak boleh kosong' }

  await execute(
    'UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?',
    [data.full_name.trim(), data.phone.trim() || null, new Date().toISOString(), session.id]
  )

  revalidatePath('/dashboard/profil')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updatePassword(data: { current: string; new: string; confirm: string }) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (data.new.length < 6) return { error: 'Password baru minimal 6 karakter' }
  if (data.new !== data.confirm) return { error: 'Konfirmasi password tidak cocok' }

  // Verify current password
  const user = await query<any>('SELECT password_hash FROM users WHERE id = ?', [session.id])
  if (!user[0]) return { error: 'User tidak ditemukan' }

  const encoder = new TextEncoder()
  const data2 = encoder.encode(data.current)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data2)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  if (currentHash !== user[0].password_hash) return { error: 'Password saat ini salah' }

  // Hash new password
  const newData = encoder.encode(data.new)
  const newHashBuffer = await crypto.subtle.digest('SHA-256', newData)
  const newHashArray = Array.from(new Uint8Array(newHashBuffer))
  const newHash = newHashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  await execute(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [newHash, new Date().toISOString(), session.id]
  )

  return { success: true }
}

export async function uploadAvatar(formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { error: 'File tidak valid' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Ukuran file maksimal 2MB' }

  // Hapus avatar lama
  const existing = await query<any>('SELECT avatar_url FROM users WHERE id = ?', [session.id])
  const avatarLama = existing[0]?.avatar_url
  if (avatarLama) {
    try { await deleteFromR2(avatarLama) } catch (_) {}
  }

  // Upload ke R2 — pakai session.id sebagai identifier
  const result = await uploadToR2(file, `avatar-${session.id}`)
  if ('error' in result) return { error: 'Gagal upload: ' + (result as any).error }

  await execute(
    'UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?',
    [result.url, new Date().toISOString(), session.id]
  )

  revalidatePath('/dashboard/profil')
  revalidatePath('/dashboard')
  return { success: true, url: result.url }
}
