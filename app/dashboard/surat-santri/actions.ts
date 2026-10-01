'use server'

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { assertFeature } from '@/lib/auth/feature'
import { revalidatePath } from 'next/cache'
import { getStudentIncidents, resolveLetterIncidents, saveIncidentLetter } from '@/lib/discipline/data'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'

const PAGE_SIZE = 30

// ─── CARI SANTRI ─────────────────────────────────────────────────────────────
export async function cariSantriSurat(keyword: string) {
  const access=await assertFeature('/dashboard/surat-santri');if('error' in access) throw new Error(access.error)
  return query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            s.nama_ayah, s.alamat,
            k.nama_kelas,
            (SELECT COALESCE(SUM(d.jumlah_kejadian),0) FROM discipline_incidents d WHERE d.santri_id=s.id AND d.status='active') AS jumlah_pelanggaran
     FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE s.status_global = 'aktif'
       AND (s.nama_lengkap LIKE ? OR s.nis = ?)
     GROUP BY s.id
     LIMIT 8`,
    [`%${keyword}%`, keyword]
  )
}

// ─── AMBIL PELANGGARAN SANTRI (untuk pilih di form pernyataan) ───────────────
export async function getPelanggaranSantri(santriId: string) {
  const access=await assertFeature('/dashboard/surat-santri');if('error' in access) throw new Error(access.error)
  return (await getStudentIncidents(santriId)).filter(r=>!r.perlu_verifikasi)
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
  const access = await assertFeature('/dashboard/surat-santri', 'create')
  if ('error' in access) return access
  const session = access
  if (pelanggaranIds.length === 0) return { error: 'Pilih minimal 1 pelanggaran' }
  let id: string
  try { id=await saveIncidentLetter(santriId,pelanggaranIds,tanggal,session.id) }
  catch { return { error: 'Pilihan pelanggaran tidak valid atau sudah berubah. Muat ulang sebelum menyimpan.' } }
  revalidateDiscipline(santriId)
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
  const access = await assertFeature('/dashboard/surat-santri', 'create')
  if ('error' in access) return access
  const session = access
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
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
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
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
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
  const access=await assertFeature('/dashboard/surat-santri');if('error' in access) throw new Error(access.error)
  if (tipe === 'pernyataan') {
    const surat = await queryOne<any>(
      `SELECT sp.id, sp.santri_id, sp.tanggal, sp.pelanggaran_ids, sp.incident_snapshot,
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
    const pelanggaran = surat.incident_snapshot ? JSON.parse(surat.incident_snapshot) : ids.length ? await resolveLetterIncidents(surat.santri_id,ids,false) : []
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
  const access = await assertFeature('/dashboard/surat-santri', 'delete')
  if ('error' in access) return access
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
