'use server'

import { query, queryOne, execute } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

const REVALIDATE = '/dashboard/pengaturan/perpulangan-periode'

async function assertAllowed() {
  const access = await assertFeature('/dashboard/pengaturan/perpulangan-periode')
  if ('error' in access) throw new Error(access.error)
  return access
}

// ─── List semua periode ───────────────────────────────────────────────────────
export async function getAllPeriode() {
  return query<any>(
    `SELECT id, nama_periode, tgl_mulai_pulang, tgl_selesai_pulang,
            tgl_mulai_datang, tgl_selesai_datang, is_active, created_at
     FROM perpulangan_periode
     ORDER BY id DESC`
  )
}

// ─── Tambah periode baru ──────────────────────────────────────────────────────
export async function tambahPeriode(data: {
  nama_periode: string
  tgl_mulai_pulang: string
  tgl_selesai_pulang: string
  tgl_mulai_datang: string
  tgl_selesai_datang: string
}): Promise<{ success: boolean } | { error: string }> {
  const session = await assertAllowed()

  if (!data.nama_periode.trim()) return { error: 'Nama periode wajib diisi.' }
  if (data.tgl_mulai_pulang > data.tgl_selesai_pulang)
    return { error: 'Tanggal mulai pulang tidak boleh setelah tanggal selesai pulang.' }
  if (data.tgl_mulai_datang > data.tgl_selesai_datang)
    return { error: 'Tanggal mulai datang tidak boleh setelah tanggal selesai datang.' }

  await execute(
    `INSERT INTO perpulangan_periode
       (nama_periode, tgl_mulai_pulang, tgl_selesai_pulang,
        tgl_mulai_datang, tgl_selesai_datang, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      data.nama_periode.trim(),
      data.tgl_mulai_pulang, data.tgl_selesai_pulang,
      data.tgl_mulai_datang, data.tgl_selesai_datang,
      session.id,
    ]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_perpulangan_periode',
    action: 'create',
    fiturHref: REVALIDATE,
    logKind: 'create',
    entityType: 'perpulangan_periode',
    entityLabel: data.nama_periode.trim(),
    summary: `Menambahkan periode perpulangan ${data.nama_periode.trim()}`,
    details: data,
  })
  revalidatePath(REVALIDATE)
  return { success: true }
}

// ─── Aktifkan periode (nonaktifkan semua yang lain dulu) ──────────────────────
export async function aktifkanPeriode(id: number): Promise<{ success: boolean } | { error: string }> {
  const session = await assertAllowed()
  await execute('UPDATE perpulangan_periode SET is_active = 0', [])
  await execute('UPDATE perpulangan_periode SET is_active = 1 WHERE id = ?', [id])
  const periode = await queryOne<{ nama_periode: string | null }>('SELECT nama_periode FROM perpulangan_periode WHERE id = ?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_perpulangan_periode',
    action: 'update',
    fiturHref: REVALIDATE,
    logKind: 'update',
    entityType: 'perpulangan_periode',
    entityId: String(id),
    entityLabel: periode?.nama_periode || String(id),
    summary: `Mengaktifkan periode perpulangan ${periode?.nama_periode || id}`,
  })
  revalidatePath(REVALIDATE)
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Nonaktifkan periode ──────────────────────────────────────────────────────
export async function nonaktifkanPeriode(id: number): Promise<{ success: boolean } | { error: string }> {
  const session = await assertAllowed()
  await execute('UPDATE perpulangan_periode SET is_active = 0 WHERE id = ?', [id])
  const periode = await queryOne<{ nama_periode: string | null }>('SELECT nama_periode FROM perpulangan_periode WHERE id = ?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_perpulangan_periode',
    action: 'update',
    fiturHref: REVALIDATE,
    logKind: 'update',
    entityType: 'perpulangan_periode',
    entityId: String(id),
    entityLabel: periode?.nama_periode || String(id),
    summary: `Menonaktifkan periode perpulangan ${periode?.nama_periode || id}`,
  })
  revalidatePath(REVALIDATE)
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Perpanjang tanggal selesai kedatangan ────────────────────────────────────
export async function perpanjangTglDatang(
  id: number,
  tglSelesaiBaru: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await assertAllowed()

  const p = await queryOne<{ tgl_selesai_datang: string; tgl_mulai_datang: string }>(
    'SELECT tgl_mulai_datang, tgl_selesai_datang FROM perpulangan_periode WHERE id = ?',
    [id]
  )
  if (!p) return { error: 'Periode tidak ditemukan.' }
  if (tglSelesaiBaru < p.tgl_mulai_datang)
    return { error: 'Tanggal tidak boleh sebelum tanggal mulai kedatangan.' }

  await execute(
    'UPDATE perpulangan_periode SET tgl_selesai_datang = ? WHERE id = ?',
    [tglSelesaiBaru, id]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_perpulangan_periode',
    action: 'update',
    fiturHref: REVALIDATE,
    logKind: 'update',
    entityType: 'perpulangan_periode',
    entityId: String(id),
    entityLabel: String(id),
    summary: 'Memperpanjang tanggal datang periode perpulangan',
    details: {
      tgl_mulai_datang: p.tgl_mulai_datang,
      tgl_selesai_lama: p.tgl_selesai_datang,
      tgl_selesai_baru: tglSelesaiBaru,
    },
  })
  revalidatePath(REVALIDATE)
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Hapus periode (hanya jika tidak ada log) ─────────────────────────────────
export async function hapusPeriode(id: number): Promise<{ success: boolean } | { error: string }> {
  const session = await assertAllowed()
  const periode = await queryOne<{ nama_periode: string | null }>('SELECT nama_periode FROM perpulangan_periode WHERE id = ?', [id])

  const ada = await queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM perpulangan_log WHERE periode_id = ?',
    [id]
  )
  if ((ada?.n ?? 0) > 0)
    return { error: 'Tidak bisa dihapus: sudah ada data perpulangan santri di periode ini.' }

  await execute('DELETE FROM perpulangan_periode WHERE id = ?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_perpulangan_periode',
    action: 'delete',
    fiturHref: REVALIDATE,
    logKind: 'delete',
    entityType: 'perpulangan_periode',
    entityId: String(id),
    entityLabel: periode?.nama_periode || String(id),
    summary: `Menghapus periode perpulangan ${periode?.nama_periode || id}`,
  })
  revalidatePath(REVALIDATE)
  return { success: true }
}
