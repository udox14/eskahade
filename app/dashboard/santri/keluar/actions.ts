'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// Default page size if not provided
const DEFAULT_PAGE_SIZE = 30


// ─── Helper asrama list ───────────────────────────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

// ─── Daftar santri aktif (untuk tab Tetapkan Keluar) ─────────────────────────
// Hemat row reads: saldo dari kolom langsung, tidak JOIN ke log
export async function getSantriAktif(params: {
  search?: string
  asrama?: string
  page?: number
  pageSize?: number
}) {
  const { search, asrama, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const offset = (page - 1) * pageSize

  const clauses = ["s.status_global = 'aktif'"]
  const baseParams: any[] = []

  if (asrama) { clauses.push('s.asrama = ?'); baseParams.push(asrama) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`, baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const rows = await query<{
    id: string; nis: string; nama_lengkap: string
    asrama: string | null; kamar: string | null
    tahun_masuk: number | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.tahun_masuk
     FROM santri s WHERE ${where}
     ORDER BY s.asrama, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

// ─── Daftar santri keluar (untuk tab Santri Keluar) ──────────────────────────
export async function getSantriKeluar(params: {
  search?: string
  asrama?: string
  page?: number
  pageSize?: number
}) {
  const { search, asrama, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const offset = (page - 1) * pageSize

  const clauses = ["s.status_global = 'keluar'"]
  const baseParams: any[] = []

  if (asrama) { clauses.push('s.asrama = ?'); baseParams.push(asrama) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`, baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const rows = await query<{
    id: string; nis: string; nama_lengkap: string
    asrama: string | null; kamar: string | null
    tanggal_keluar: string | null; alasan_keluar: string | null
    tahun_masuk: number | null; ada_surat: number
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            s.tanggal_keluar, s.alasan_keluar, s.tahun_masuk,
            -- Cek apakah ada surat BERHENTI — subquery ringan, index di santri_id
            (SELECT COUNT(*) FROM riwayat_surat rs
             WHERE rs.santri_id = s.id AND rs.jenis_surat = 'BERHENTI' LIMIT 1) AS ada_surat
     FROM santri s WHERE ${where}
     ORDER BY s.tanggal_keluar DESC, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

// ─── Tetapkan santri keluar ───────────────────────────────────────────────────
// 1 batch: update santri + update riwayat_pendidikan aktif → pindah
// + opsional: catat ke riwayat_surat jika buat surat
export async function tetapkanKeluar(params: {
  santriId: string
  tanggalKeluar: string
  alasanKeluar: string
  buatSurat: boolean
}): Promise<{ success: boolean; santriNama?: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const santri = await queryOne<{ id: string; nama_lengkap: string; status_global: string }>(
    'SELECT id, nama_lengkap, status_global FROM santri WHERE id = ?',
    [params.santriId]
  )
  if (!santri) return { error: 'Santri tidak ditemukan' }
  if (santri.status_global !== 'aktif') return { error: 'Santri sudah tidak aktif' }

  // Batch: update santri + riwayat_pendidikan — 2 writes, hemat
  await batch([
    {
      sql: `UPDATE santri
            SET status_global = 'keluar',
                tanggal_keluar = ?,
                alasan_keluar  = ?
            WHERE id = ?`,
      params: [params.tanggalKeluar, params.alasanKeluar, params.santriId],
    },
    {
      sql: `UPDATE riwayat_pendidikan
            SET status_riwayat = 'pindah'
            WHERE santri_id = ? AND status_riwayat = 'aktif'`,
      params: [params.santriId],
    },
  ])

  // Catat ke riwayat_surat (log) — 1 insert ringan
  if (params.buatSurat) {
    await execute(
      `INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at)
       VALUES (?, ?, 'BERHENTI', ?, ?, ?)`,
      [generateId(), params.santriId, `Keluar per ${params.tanggalKeluar}. ${params.alasanKeluar}`,
       session.id, now()]
    )
  }

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/dewan-santri/surat')
  return { success: true, santriNama: santri.nama_lengkap }
}

// ─── Aktifkan kembali santri ──────────────────────────────────────────────────
export async function aktifkanKembali(
  santriId: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const santri = await queryOne<{ status_global: string }>(
    'SELECT status_global FROM santri WHERE id = ?', [santriId]
  )
  if (!santri) return { error: 'Santri tidak ditemukan' }
  if (santri.status_global !== 'keluar') return { error: 'Santri bukan berstatus keluar' }

  // Kembalikan aktif + hapus tanggal/alasan keluar
  // Tidak restore riwayat_pendidikan karena perlu penempatan kelas ulang
  await execute(
    `UPDATE santri
     SET status_global  = 'aktif',
         tanggal_keluar = NULL,
         alasan_keluar  = NULL
     WHERE id = ?`,
    [santriId]
  )

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/santri')
  return { success: true }
}

// ─── Ambil data santri untuk preview surat ───────────────────────────────────
// Dipanggil hanya saat user klik "Cetak Surat" — lazy
export async function getDataSuratBerhenti(santriId: string) {
  return queryOne<{
    id: string; nama_lengkap: string; nis: string
    tempat_lahir: string | null; tanggal_lahir: string | null
    asrama: string | null; kamar: string | null
    nama_ayah: string | null; alamat: string | null
    tanggal_keluar: string | null; alasan_keluar: string | null
    tahun_masuk: number | null
  }>(
    `SELECT id, nama_lengkap, nis, tempat_lahir, tanggal_lahir,
            asrama, kamar, nama_ayah, alamat,
            tanggal_keluar, alasan_keluar, tahun_masuk
     FROM santri WHERE id = ?`,
    [santriId]
  )
}

// ─── Catat surat dari fitur ini (tanpa mengubah status lagi) ─────────────────
export async function catatSuratBerhenti(
  santriId: string,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  // Cek sudah ada surat BERHENTI belum
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM riwayat_surat WHERE santri_id = ? AND jenis_surat = 'BERHENTI' LIMIT 1`,
    [santriId]
  )
  if (existing) return { success: true } // Sudah ada, tidak perlu insert lagi

  await execute(
    `INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at)
     VALUES (?, ?, 'BERHENTI', ?, ?, ?)`,
    [generateId(), santriId, keterangan, session.id, now()]
  )
  revalidatePath('/dashboard/dewan-santri/surat')
  return { success: true }
}
