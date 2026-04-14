'use server'

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 30

// ─── CARI SANTRI ─────────────────────────────────────────────────────────────
export async function cariSantriSurat(keyword: string) {
  return query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            s.nama_ayah, s.alamat,
            k.nama_kelas,
            COUNT(p.id) AS jumlah_pelanggaran
     FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     LEFT JOIN pelanggaran p ON p.santri_id = s.id
     WHERE s.status_global = 'aktif'
       AND (s.nama_lengkap LIKE ? OR s.nis = ?)
     GROUP BY s.id
     LIMIT 8`,
    [`%${keyword}%`, keyword]
  )
}

// ─── AMBIL PELANGGARAN SANTRI (untuk pilih di form pernyataan) ───────────────
export async function getPelanggaranSantri(santriId: string) {
  return query<any>(
    `SELECT p.id, p.tanggal, p.deskripsi, p.jenis, p.poin
     FROM pelanggaran p
     WHERE p.santri_id = ?
     ORDER BY p.tanggal DESC`,
    [santriId]
  )
}

// ─── SUGGEST LEVEL SP ────────────────────────────────────────────────────────
export async function getSuggestLevel(santriId: string) {
  const last = await queryOne<{ level: string }>(
    `SELECT level FROM surat_perjanjian WHERE santri_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [santriId]
  )
  if (!last) return 'SP1'
  const next: Record<string, string> = { SP1: 'SP2', SP2: 'SP3', SP3: 'SK', SK: 'SK' }
  return next[last.level] ?? 'SP1'
}

// ─── SIMPAN SURAT PERNYATAAN ─────────────────────────────────────────────────
export async function simpanSuratPernyataan(
  santriId: string,
  pelanggaranIds: string[],
  tanggal: string
): Promise<{ success: boolean; id: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  if (pelanggaranIds.length === 0) return { error: 'Pilih minimal 1 pelanggaran' }
  const id = generateId()
  await execute(
    `INSERT INTO surat_pernyataan (id, santri_id, pelanggaran_ids, tanggal, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, santriId, JSON.stringify(pelanggaranIds), tanggal, session.id, now()]
  )
  revalidatePath('/dashboard/surat-santri')
  return { success: true, id }
}

// ─── SIMPAN SURAT PERJANJIAN (SP/SK) ─────────────────────────────────────────
export async function simpanSuratPerjanjian(
  santriId: string,
  level: 'SP1' | 'SP2' | 'SP3' | 'SK',
  tanggal: string,
  catatan?: string
): Promise<{ success: boolean; id: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  const id = generateId()
  await execute(
    `INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, santriId, level, tanggal, catatan || null, session.id, now()]
  )
  revalidatePath('/dashboard/surat-santri')
  return { success: true, id }
}

// ─── DAFTAR SURAT (unified, lazy load) ───────────────────────────────────────
// Satu query UNION supaya hemat round-trip — pernyataan + perjanjian sekaligus
export async function getDaftarSurat(params: {
  search?: string
  asrama?: string
  jenis?: string   // 'pernyataan' | 'SP1' | 'SP2' | 'SP3' | 'SK' | ''
  page?: number
}) {
  const { search, asrama, jenis, page = 1 } = params
  const offset = (page - 1) * PAGE_SIZE

  // Build WHERE clauses shared untuk kedua tabel
  const baseWhere: string[] = []
  const baseParams: any[] = []
  if (search) { baseWhere.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); baseParams.push(`%${search}%`, `%${search}%`) }
  if (asrama) { baseWhere.push('s.asrama = ?'); baseParams.push(asrama) }

  const baseWhereStr = baseWhere.length ? `AND ${baseWhere.join(' AND ')}` : ''

  // Query pernyataan
  const pernyataanFilter = (!jenis || jenis === 'pernyataan') ? '' : 'AND 0=1'
  const perjanjianFilter = (!jenis || ['SP1','SP2','SP3','SK'].includes(jenis))
    ? (jenis && jenis !== 'pernyataan' ? `AND sp.level = '${jenis}'` : '')
    : 'AND 0=1'

  const unionSql = `
    SELECT
      'pernyataan' AS tipe,
      sp.id, sp.tanggal, sp.created_at,
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
      sp.pelanggaran_ids AS detail,
      NULL AS level,
      NULL AS catatan,
      u.full_name AS dibuat_oleh_nama
    FROM surat_pernyataan sp
    JOIN santri s ON s.id = sp.santri_id
    LEFT JOIN users u ON u.id = sp.dibuat_oleh
    WHERE 1=1 ${baseWhereStr} ${pernyataanFilter}

    UNION ALL

    SELECT
      'perjanjian' AS tipe,
      sp.id, sp.tanggal, sp.created_at,
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
      NULL AS detail,
      sp.level,
      sp.catatan,
      u.full_name AS dibuat_oleh_nama
    FROM surat_perjanjian sp
    JOIN santri s ON s.id = sp.santri_id
    LEFT JOIN users u ON u.id = sp.dibuat_oleh
    WHERE 1=1 ${baseWhereStr} ${perjanjianFilter}
  `

  // Count total (cheaply)
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM (${unionSql}) t`,
    [...baseParams, ...baseParams]
  )
  const total = countRow?.total ?? 0

  const rows = await query<any>(
    `SELECT * FROM (${unionSql}) t ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...baseParams, ...baseParams, PAGE_SIZE, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / PAGE_SIZE) }
}

// ─── DATA DETAIL UNTUK PREVIEW SURAT ─────────────────────────────────────────
// Satu fungsi untuk kedua jenis surat — hemat duplikasi
export async function getDataPreviewSurat(suratId: string, tipe: 'pernyataan' | 'perjanjian') {
  if (tipe === 'pernyataan') {
    const surat = await queryOne<any>(
      `SELECT sp.id, sp.tanggal, sp.pelanggaran_ids,
              s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM surat_pernyataan sp
       JOIN santri s ON s.id = sp.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE sp.id = ?`,
      [suratId]
    )
    if (!surat) return null
    const ids: string[] = JSON.parse(surat.pelanggaran_ids || '[]')
    const pelanggaran = ids.length
      ? await query<any>(
          `SELECT id, tanggal, deskripsi, jenis, poin FROM pelanggaran
           WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY tanggal ASC`,
          ids
        )
      : []
    return { tipe: 'pernyataan' as const, surat, pelanggaran }
  } else {
    const surat = await queryOne<any>(
      `SELECT sp.id, sp.tanggal, sp.level, sp.catatan,
              s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM surat_perjanjian sp
       JOIN santri s ON s.id = sp.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE sp.id = ?`,
      [suratId]
    )
    if (!surat) return null
    return { tipe: 'perjanjian' as const, surat, pelanggaran: [] }
  }
}

// ─── HAPUS SURAT ─────────────────────────────────────────────────────────────
export async function hapusSurat(
  suratId: string,
  tipe: 'pernyataan' | 'perjanjian'
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'keamanan', 'dewan_santri']))
    return { error: 'Akses ditolak' }
  const tabel = tipe === 'pernyataan' ? 'surat_pernyataan' : 'surat_perjanjian'
  await execute(`DELETE FROM ${tabel} WHERE id = ?`, [suratId])
  revalidatePath('/dashboard/surat-santri')
  return { success: true }
}

// ─── DAFTAR ASRAMA (untuk filter dropdown) ───────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}