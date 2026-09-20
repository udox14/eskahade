'use server'

import { execute, queryOne } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { requirePortalSessionAction } from '@/lib/portal/session'
import { setStudentPin } from '@/lib/finance/pins'

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
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Gagal mengganti password.' }
  }
}

export async function ubahPinUangJajanPortal(
  passwordPortal: string,
  pinBaru: string,
  konfirmasiPin: string
) {
  try {
    const session = await requirePortalSessionAction()

    const pw = String(passwordPortal ?? '').trim()
    const pin = String(pinBaru ?? '').trim()
    const konf = String(konfirmasiPin ?? '').trim()

    if (!pw) return { error: 'Password akun portal orang tua wajib diisi untuk verifikasi keamanan.' }
    if (!/^\d{6}$/.test(pin)) return { error: 'PIN santri harus terdiri dari tepat 6 digit angka numerik.' }
    if (pin !== konf) return { error: 'Konfirmasi PIN tidak cocok dengan PIN baru.' }

    // Verifikasi password portal ortu
    const cred = await queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM portal_ortu_credentials WHERE santri_id = ?`,
      [session.santri_id]
    )
    if (!cred) return { error: 'Kredensial portal tidak ditemukan. Silakan login ulang.' }

    const valid = await verifyPassword(pw, cred.password_hash)
    if (!valid) return { error: 'Password akun portal orang tua salah.' }

    // Update PIN santri (mereset failed_attempts dan locked_until, serta mencatat audit trail)
    await setStudentPin(session.santri_id, pin, null, {
      reason: 'Diubah oleh orang tua via Portal Ortu',
    })

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Gagal mengubah PIN santri.' }
  }
}

