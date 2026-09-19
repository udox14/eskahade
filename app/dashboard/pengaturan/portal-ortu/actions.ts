'use server'

import { revalidatePath } from 'next/cache'
import { execute, generateId, query, queryOne } from '@/lib/db'
import { getSession, isSuperAccess, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { hashPassword } from '@/lib/auth/password'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/upload'
import { getPaymentChannels, type PortalBank } from '@/lib/portal/data'

const PATH = '/dashboard/pengaturan/portal-ortu'
const SETTINGS_KEY = 'portal_payment_channels'

function assertAdmin(session: SessionUser | null) {
  if (!isSuperAccess(session)) throw new Error('Hanya admin yang boleh mengubah pengaturan portal.')
}

async function saveChannels(channels: { banks: PortalBank[]; qris_url: string | null }) {
  await execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [SETTINGS_KEY, JSON.stringify(channels)]
  )
}

export async function getPortalChannels() {
  return getPaymentChannels()
}

export async function savePortalBanks(banks: PortalBank[]): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAdmin(session)

    const cleaned: PortalBank[] = []
    for (const bank of banks || []) {
      const nama = String(bank?.bank || '').trim()
      const nomor = String(bank?.nomor || '').trim()
      const atasNama = String(bank?.atas_nama || '').trim()
      if (!nama || !nomor || !atasNama) return { error: 'Nama bank, nomor rekening, dan atas nama wajib diisi.' }
      cleaned.push({ id: String(bank?.id || '').trim() || generateId(), bank: nama, nomor, atas_nama: atasNama })
    }

    const channels = await getPaymentChannels()
    await saveChannels({ ...channels, banks: cleaned })

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'update_channels',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'app_settings',
      entityLabel: SETTINGS_KEY,
      summary: `Memperbarui daftar rekening portal ortu (${cleaned.length} rekening)`,
      details: { banks: cleaned },
    })

    revalidatePath(PATH)
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan rekening.' }
  }
}

export async function uploadQris(formData: FormData): Promise<{ success: true; url: string } | { error: string }> {
  try {
    const session = await getSession()
    assertAdmin(session)

    const file = formData.get('qris')
    if (!(file instanceof File) || file.size === 0) return { error: 'Pilih gambar QRIS.' }
    if (!file.type.startsWith('image/')) return { error: 'QRIS harus berupa gambar.' }
    if (file.size > 3 * 1024 * 1024) return { error: 'Ukuran gambar QRIS maksimal 3MB.' }

    const uploaded = await uploadToR2(file, 'portal-qris', 'qris')
    if ('error' in uploaded) return { error: uploaded.error }

    const channels = await getPaymentChannels()
    if (channels.qris_url) await deleteFromR2(channels.qris_url)
    await saveChannels({ ...channels, qris_url: uploaded.url })

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'upload_qris',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'app_settings',
      entityLabel: SETTINGS_KEY,
      summary: 'Mengunggah gambar QRIS portal ortu',
      details: { url: uploaded.url },
    })

    revalidatePath(PATH)
    return { success: true, url: uploaded.url }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mengunggah QRIS.' }
  }
}

export async function hapusQris(): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAdmin(session)

    const channels = await getPaymentChannels()
    if (channels.qris_url) await deleteFromR2(channels.qris_url)
    await saveChannels({ ...channels, qris_url: null })

    revalidatePath(PATH)
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menghapus QRIS.' }
  }
}

// ── Kredensial ortu ──────────────────────────────────────────

export type PortalCredentialRow = {
  santri_id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  punya_kredensial: number
  is_active: number | null
  must_change_password: number | null
  last_login_at: string | null
}

export async function searchPortalCredential(keyword: string) {
  try {
    const session = await getSession()
    assertAdmin(session)

    const like = `%${String(keyword || '').trim()}%`
    const rows = await query<PortalCredentialRow>(`
      SELECT s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
             CASE WHEN c.santri_id IS NULL THEN 0 ELSE 1 END AS punya_kredensial,
             c.is_active, c.must_change_password, c.last_login_at
      FROM santri s
      LEFT JOIN portal_ortu_credentials c ON c.santri_id = s.id
      WHERE s.status_global = 'aktif' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
      ORDER BY s.nama_lengkap
      LIMIT 20
    `, [like, like])
    return { rows }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mencari santri.' }
  }
}

// Reset = hapus row kredensial → login berikutnya memakai password default
// (NIS / tanggal lahir) dan otomatis diminta ganti password.
export async function resetPortalPassword(santriId: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAdmin(session)

    const santri = await queryOne<{ id: string; nama_lengkap: string }>(
      `SELECT id, nama_lengkap FROM santri WHERE id = ?`, [santriId])
    if (!santri) return { error: 'Santri tidak ditemukan.' }

    await execute(`DELETE FROM portal_ortu_credentials WHERE santri_id = ?`, [santriId])

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'reset_password',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_ortu_credentials',
      entityId: santriId,
      entityLabel: santri.nama_lengkap,
      summary: `Reset password portal ortu ${santri.nama_lengkap}`,
      details: { santri_id: santriId },
    })

    revalidatePath(PATH)
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal reset password.' }
  }
}

export async function setPortalActive(santriId: string, active: boolean): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAdmin(session)

    const santri = await queryOne<{ id: string; nis: string; nama_lengkap: string }>(
      `SELECT id, nis, nama_lengkap FROM santri WHERE id = ?`, [santriId])
    if (!santri) return { error: 'Santri tidak ditemukan.' }

    const existing = await queryOne<{ santri_id: string }>(
      `SELECT santri_id FROM portal_ortu_credentials WHERE santri_id = ?`, [santriId])

    if (existing) {
      await execute(
        `UPDATE portal_ortu_credentials SET is_active = ?, updated_at = datetime('now') WHERE santri_id = ?`,
        [active ? 1 : 0, santriId]
      )
    } else {
      // Blokir santri yang belum pernah login: buat row (password default NIS) dengan is_active sesuai
      await execute(
        `INSERT INTO portal_ortu_credentials (santri_id, password_hash, must_change_password, is_active)
         VALUES (?, ?, 1, ?)`,
        [santriId, await hashPassword(santri.nis), active ? 1 : 0]
      )
    }

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: active ? 'unblock_login' : 'block_login',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_ortu_credentials',
      entityId: santriId,
      entityLabel: santri.nama_lengkap,
      summary: `${active ? 'Membuka' : 'Memblokir'} akses portal ortu ${santri.nama_lengkap}`,
      details: { santri_id: santriId, active },
    })

    revalidatePath(PATH)
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mengubah status akses.' }
  }
}
