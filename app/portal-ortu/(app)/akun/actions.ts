'use server'

import { execute, queryOne } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { requirePortalSessionAction } from '@/lib/portal/session'

export async function gantiPasswordPortal(passwordLama: string, passwordBaru: string) {
  try {
    const session = await requirePortalSessionAction()

    const lama = String(passwordLama ?? '').trim()
    const baru = String(passwordBaru ?? '').trim()
    if (baru.length < 6) return { error: 'Password baru minimal 6 karakter.' }
    if (baru === session.nis) return { error: 'Password baru tidak boleh sama dengan NIS.' }

    const cred = await queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM portal_ortu_credentials WHERE santri_id = ?`,
      [session.santri_id]
    )
    if (!cred) return { error: 'Kredensial tidak ditemukan. Silakan login ulang.' }

    const valid = await verifyPassword(lama, cred.password_hash)
    if (!valid) return { error: 'Password lama salah.' }

    await execute(
      `UPDATE portal_ortu_credentials
       SET password_hash = ?, must_change_password = 0, updated_at = datetime('now')
       WHERE santri_id = ?`,
      [await hashPassword(baru), session.santri_id]
    )

    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Gagal mengganti password.' }
  }
}
