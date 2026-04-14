'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ─── Helper: cek jenis pulang dari alamat ────────────────────────────────────
function autoJenisPulang(kab_kota: string | null, alamat: string | null): 'ROMBONGAN' | 'DIJEMPUT' {
  const src = (kab_kota || alamat || '').toLowerCase().trim()
  if (!src) return 'DIJEMPUT'
  return src.includes('tasikmalaya') ? 'DIJEMPUT' : 'ROMBONGAN'
}

// ─── Session info ────────────────────────────────────────────────────────────
export async function getSessionInfo() {
  const session = await getSession()
  if (!session) return null
  return {
    role: session.role,
    asrama_binaan: session.asrama_binaan ?? null,
  }
}

// ─── Periode aktif (ringan, dipanggil saat halaman dibuka) ───────────────────
export async function getPeriodeAktif() {
  return queryOne<{
    id: number
    nama_periode: string
    tgl_mulai_pulang: string
    tgl_selesai_pulang: string
    tgl_mulai_datang: string
    tgl_selesai_datang: string
  }>(`
    SELECT id, nama_periode,
           tgl_mulai_pulang, tgl_selesai_pulang,
           tgl_mulai_datang, tgl_selesai_datang
    FROM perpulangan_periode
    WHERE is_active = 1
    LIMIT 1
  `)
}

// ─── Daftar kamar per asrama (ringan) ────────────────────────────────────────
export async function getKamarsPerpulangan(asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

// ─── Load santri 1 kamar + status log dari DB ─────────────────────────────────
// Dipanggil lazy hanya saat kamar dipilih.
// Auto-insert row perpulangan_log untuk santri yang belum punya record di periode ini.
export async function getDataKamarPerpulangan(
  asrama: string,
  kamar: string,
  periodeId: number
) {
  const session = await getSession()
  if (!session) return []

  // Ambil santri + log perpulangan (LEFT JOIN — santri bisa belum punya log)
  const rows = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           s.kab_kota, s.alamat,
           pl.id         AS log_id,
           pl.jenis_pulang,
           pl.status_pulang,
           pl.keterangan,
           pl.tgl_pulang,
           pl.status_datang,
           pl.tgl_datang
    FROM santri s
    LEFT JOIN perpulangan_log pl
      ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [periodeId, asrama, kamar])

  // Auto-insert row untuk santri yang belum punya log di periode ini
  const belumAda = rows.filter((r: any) => r.log_id === null)
  if (belumAda.length > 0) {
    await batch(belumAda.map((r: any) => ({
      sql: `INSERT OR IGNORE INTO perpulangan_log
              (id, santri_id, periode_id, jenis_pulang, status_pulang, status_datang, created_by)
            VALUES (?, ?, ?, ?, 'BELUM', 'BELUM', ?)`,
      params: [
        generateId(),
        r.id,
        periodeId,
        autoJenisPulang(r.kab_kota, r.alamat),
        session.id,
      ],
    })))

    // Re-fetch setelah insert agar log_id dan jenis_pulang terisi
    const refreshed = await query<any>(`
      SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
             pl.id         AS log_id,
             pl.jenis_pulang,
             pl.status_pulang,
             pl.keterangan,
             pl.tgl_pulang,
             pl.status_datang,
             pl.tgl_datang
      FROM santri s
      LEFT JOIN perpulangan_log pl
        ON pl.santri_id = s.id AND pl.periode_id = ?
      WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
      ORDER BY s.nama_lengkap
    `, [periodeId, asrama, kamar])
    return refreshed
  }

  return rows
}

// ─── Guard: cek apakah sekarang dalam periode pulang ────────────────────────
async function assertDalamPeriodePulang(periodeId: number): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10)
  const p = await queryOne<{ tgl_mulai_pulang: string; tgl_selesai_pulang: string }>(
    'SELECT tgl_mulai_pulang, tgl_selesai_pulang FROM perpulangan_periode WHERE id = ? AND is_active = 1',
    [periodeId]
  )
  if (!p) return 'Tidak ada periode aktif.'
  if (today < p.tgl_mulai_pulang || today > p.tgl_selesai_pulang)
    return `Di luar periode perpulangan (${p.tgl_mulai_pulang} s/d ${p.tgl_selesai_pulang}).`
  return null
}

async function assertDalamPeriodeDatang(periodeId: number): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10)
  const p = await queryOne<{ tgl_mulai_datang: string; tgl_selesai_datang: string }>(
    'SELECT tgl_mulai_datang, tgl_selesai_datang FROM perpulangan_periode WHERE id = ? AND is_active = 1',
    [periodeId]
  )
  if (!p) return 'Tidak ada periode aktif.'
  if (today < p.tgl_mulai_datang || today > p.tgl_selesai_datang)
    return `Di luar periode kedatangan (${p.tgl_mulai_datang} s/d ${p.tgl_selesai_datang}).`
  return null
}

// ─── Konfirmasi pulang (1 santri) ────────────────────────────────────────────
export async function konfirmasiPulang(
  logId: string,
  periodeId: number,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const err = await assertDalamPeriodePulang(periodeId)
  if (err) return { error: err }

  await execute(
    `UPDATE perpulangan_log
     SET status_pulang = 'PULANG', keterangan = ?, tgl_pulang = ?, updated_by = ?
     WHERE id = ? AND status_pulang = 'BELUM'`,
    [keterangan || null, now(), session.id, logId]
  )
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Batalkan pulang (1 santri) ───────────────────────────────────────────────
export async function batalPulang(
  logId: string,
  periodeId: number
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const err = await assertDalamPeriodePulang(periodeId)
  if (err) return { error: err }

  await execute(
    `UPDATE perpulangan_log
     SET status_pulang = 'BELUM', keterangan = NULL, tgl_pulang = NULL, updated_by = ?
     WHERE id = ? AND status_datang = 'BELUM'`,
    [session.id, logId]
  )
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Bulk konfirmasi rombongan (semua yang ROMBONGAN di kamar ini) ────────────
export async function konfirmasiRombonganKamar(
  periodeId: number,
  asrama: string,
  kamar: string,
  keterangan: string
): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const err = await assertDalamPeriodePulang(periodeId)
  if (err) return { error: err }

  const logs = await query<{ id: string }>(
    `SELECT pl.id
     FROM perpulangan_log pl
     JOIN santri s ON s.id = pl.santri_id
     WHERE pl.periode_id = ?
       AND pl.jenis_pulang = 'ROMBONGAN'
       AND pl.status_pulang = 'BELUM'
       AND s.asrama = ? AND s.kamar = ?`,
    [periodeId, asrama, kamar]
  )
  if (!logs.length) return { success: true, count: 0 }

  const tglPulang = now()
  await batch(logs.map(l => ({
    sql: `UPDATE perpulangan_log
          SET status_pulang = 'PULANG', keterangan = ?, tgl_pulang = ?, updated_by = ?
          WHERE id = ?`,
    params: [keterangan || 'Rombongan', tglPulang, session.id, l.id],
  })))

  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true, count: logs.length }
}

// ─── Update jenis pulang (toggle ROMBONGAN ↔ DIJEMPUT) ──────────────────────
export async function updateJenisPulang(
  logId: string,
  jenisBaru: 'ROMBONGAN' | 'DIJEMPUT'
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute(
    `UPDATE perpulangan_log SET jenis_pulang = ?, updated_by = ? WHERE id = ?`,
    [jenisBaru, session.id, logId]
  )
  return { success: true }
}

// ─── Update keterangan saja (tanpa ubah status) ──────────────────────────────
export async function updateKeterangan(
  logId: string,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute(
    `UPDATE perpulangan_log SET keterangan = ?, updated_by = ? WHERE id = ?`,
    [keterangan || null, session.id, logId]
  )
  return { success: true }
}

// ─── Konfirmasi datang (1 santri) ────────────────────────────────────────────
export async function konfirmasiDatang(
  logId: string,
  periodeId: number
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const err = await assertDalamPeriodeDatang(periodeId)
  if (err) return { error: err }

  await execute(
    `UPDATE perpulangan_log
     SET status_datang = 'SUDAH', tgl_datang = ?, updated_by = ?
     WHERE id = ? AND status_pulang = 'PULANG' AND status_datang = 'BELUM'`,
    [now(), session.id, logId]
  )
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Batalkan datang ─────────────────────────────────────────────────────────
export async function batalDatang(
  logId: string,
  periodeId: number
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const err = await assertDalamPeriodeDatang(periodeId)
  if (err) return { error: err }

  await execute(
    `UPDATE perpulangan_log
     SET status_datang = 'BELUM', tgl_datang = NULL, updated_by = ?
     WHERE id = ? AND status_datang = 'SUDAH'`,
    [session.id, logId]
  )
  revalidatePath('/dashboard/asrama/perpulangan')
  return { success: true }
}

// ─── Tandai telat (dipanggil oleh admin/keamanan/dewan_santri) ───────────────
// Batch: santri yang PULANG tapi belum DATANG setelah periode selesai
export async function tandaiTelatMassal(
  periodeId: number
): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'keamanan', 'dewan_santri']))
    return { error: 'Akses ditolak' }

  const p = await queryOne<{ tgl_selesai_datang: string }>(
    'SELECT tgl_selesai_datang FROM perpulangan_periode WHERE id = ?',
    [periodeId]
  )
  if (!p) return { error: 'Periode tidak ditemukan.' }

  const today = new Date().toISOString().slice(0, 10)
  if (today <= p.tgl_selesai_datang)
    return { error: 'Periode kedatangan belum selesai.' }

  const targets = await query<{ id: string }>(
    `SELECT id FROM perpulangan_log
     WHERE periode_id = ? AND status_pulang = 'PULANG' AND status_datang = 'BELUM'`,
    [periodeId]
  )
  if (!targets.length) return { success: true, count: 0 }

  await batch(targets.map(t => ({
    sql: `UPDATE perpulangan_log SET status_datang = 'TELAT', updated_by = ? WHERE id = ?`,
    params: [session.id, t.id],
  })))

  revalidatePath('/dashboard/asrama/perpulangan/monitoring')
  return { success: true, count: targets.length }
}
