'use server'

import { cookies } from 'next/headers'
import { execute, queryOne } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createPortalToken, portalCookieOptions, requirePortalSessionAction } from '@/lib/portal/session'
import { syncGuardianPasswordHash } from '@/lib/finance/portal-guardian-sync'

export async function gantiPasswordPortal(passwordLama: string, passwordBaru: string) {
  try {
    const session = await requirePortalSessionAction()

    const lama = String(passwordLama ?? '').trim()
    const baru = String(passwordBaru ?? '').trim()
    if (baru.length < 6) return { error: 'Password baru minimal 6 karakter.' }
    if (baru === session.nis) return { error: 'Password baru tidak boleh sama dengan NIS.' }

    const cred = await queryOne<{ password_hash: string; token_version: number | null }>(
      `SELECT password_hash, token_version FROM portal_ortu_credentials WHERE santri_id = ?`,
      [session.santri_id]
    )
    if (!cred) return { error: 'Kredensial tidak ditemukan. Silakan login ulang.' }

    const valid = await verifyPassword(lama, cred.password_hash)
    if (!valid) return { error: 'Password lama salah.' }

    const newHash = await hashPassword(baru)
    const nextTokenVersion = Number(cred.token_version ?? 1) + 1

    // Password ini berlaku untuk akun login NIS session.nis (santri yang
    // sedang aktif di sesi ini) — lihat peringatan konteks di halaman Akun.
    await execute(
      `UPDATE portal_ortu_credentials
       SET password_hash = ?, must_change_password = 0, token_version = ?, updated_at = datetime('now')
       WHERE santri_id = ?`,
      [newHash, nextTokenVersion, session.santri_id]
    )
    await syncGuardianPasswordHash(session.santri_id, newHash).catch(() => {})

    // token_version dinaikkan supaya sesi lain (mis. HP lama yang masih login)
    // otomatis logout. Tab yang sedang dipakai tetap login dengan menerbitkan
    // cookie baru yang membawa token_version terbaru.
    const token = await createPortalToken({
      kind: 'portal_ortu',
      ...(session.guardian_id ? { guardian_id: session.guardian_id } : {}),
      santri_id: session.santri_id,
      nis: session.nis,
      nama: session.nama,
      token_version: nextTokenVersion,
    })
    ;(await cookies()).set({ ...portalCookieOptions(), value: token })

    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Gagal mengganti password.' }
  }
}
