'use server'

import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import type { ExportFilter, SortBy, KolomExport } from './constants'

// ─── Opsi filter (untuk populate dropdown) ───────────────────────────────────
export async function getFilterOptions() {
  const session = await getSession()
  const asramaBinaan = session?.role === 'pengurus_asrama'
    ? session.asrama_binaan ?? null
    : null

  const [asramaList, sekolahList, kelasSekolahList, tahunList, kelasMarhalahList] = await Promise.all([
    // 1. Daftar asrama
    asramaBinaan
      ? Promise.resolve([asramaBinaan])
      : query<{ v: string }>(
          `SELECT DISTINCT asrama AS v FROM santri WHERE status_global='aktif' AND asrama IS NOT NULL ORDER BY asrama`
        ).then(r => r.map(x => x.v)),

    // 2. Daftar sekolah
    query<{ v: string }>(
      `SELECT DISTINCT sekolah AS v FROM santri WHERE status_global='aktif' AND sekolah IS NOT NULL ORDER BY sekolah`
    ).then(r => r.map(x => x.v)),

    // 3. Daftar kelas sekolah
    query<{ v: string }>(
      `SELECT DISTINCT kelas_sekolah AS v FROM santri WHERE status_global='aktif' AND kelas_sekolah IS NOT NULL ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah`
    ).then(r => r.map(x => x.v)),

    // 4. Daftar tahun masuk
    query<{ v: number }>(
      `SELECT DISTINCT tahun_masuk AS v FROM santri WHERE status_global='aktif' AND tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC`
    ).then(r => r.map(x => x.v)),

    // 5. Kelas + marhalah dalam 1 query
    query<{ marhalah: string; nama_kelas: string; urutan: number }>(`
      SELECT DISTINCT m.nama AS marhalah, k.nama_kelas, m.urutan
      FROM kelas k
      INNER JOIN marhalah m ON m.id = k.marhalah_id
      WHERE EXISTS (
        SELECT 1 FROM riwayat_pendidikan rp
        INNER JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
        WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
      )
      ORDER BY m.urutan, k.nama_kelas
    `),
  ])

  const marhalahUnik = [...new Set(kelasMarhalahList.map(r => r.marhalah))]
  // FIX: kelasList adalah string[] langsung, bukan object[]
  const kelasList    = kelasMarhalahList.map(r => r.nama_kelas)

  return {
    asramaList,
    sekolahList,
    kelasSekolahList,
    tahunList,
    marhalahUnik,
    kelasList,
    asramaBinaan,
  }
}

// ─── Daftar kamar per asrama (lazy — dipanggil hanya saat asrama dipilih) ─────
export async function getKamarList(asrama: string) {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama' && session.asrama_binaan !== asrama) {
    return []
  }
  const rows = await query<{ v: string }>(
    `SELECT DISTINCT kamar AS v FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.v)
}

// ─── Export data santri ───────────────────────────────────────────────────────
export async function getDataExport(
  filter: ExportFilter,
  kolom: KolomExport[],
  sortBy: SortBy
): Promise<{ rows: any[]; total: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const forceAsrama = session.role === 'pengurus_asrama' ? session.asrama_binaan : null

  // Perlu JOIN ke riwayat_pendidikan?
  const needKelas = kolom.includes('nama_kelas') || kolom.includes('marhalah')
    || !!(filter.nama_kelas?.length) || !!(filter.marhalah?.length)

  const clauses: string[] = ["s.status_global = 'aktif'"]
  const params: any[]     = []

  // ── Helper: tambah klausa IN (?, ?, ...) untuk array ──────────────────────
  // FIX: semua filter multi-select sekarang pakai IN bukan =
  const addIn = (col: string, vals?: string[] | number[]) => {
    if (!vals?.length) return
    clauses.push(`${col} IN (${vals.map(() => '?').join(', ')})`)
    params.push(...vals)
  }

  // Asrama: forceAsrama (string tunggal) menang atas filter.asrama (array)
  if (forceAsrama) {
    clauses.push('s.asrama = ?')
    params.push(forceAsrama)
  } else {
    addIn('s.asrama', filter.asrama)
  }

  addIn('s.kamar',          filter.kamar)
  addIn('s.sekolah',        filter.sekolah)
  addIn('s.kelas_sekolah',  filter.kelas_sekolah)
  addIn('k.nama_kelas',     filter.nama_kelas)
  addIn('m.nama',           filter.marhalah)
  addIn('s.tahun_masuk',    filter.tahun_masuk)

  if (filter.jenis_kelamin) {
    clauses.push('s.jenis_kelamin = ?')
    params.push(filter.jenis_kelamin)
  }
  if (filter.alamat_kata) {
    clauses.push('s.alamat LIKE ?')
    params.push(`%${filter.alamat_kata}%`)
  }

  const where = clauses.join(' AND ')

  const joinKelas = needKelas
    ? `LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       LEFT JOIN marhalah m ON m.id = k.marhalah_id`
    : ''

  const orderMap: Record<SortBy, string> = {
    nama_lengkap:    's.nama_lengkap',
    asrama:          's.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap',
    kamar:           'CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap',
    kelas_pesantren: needKelas ? 'm.urutan, k.nama_kelas, s.nama_lengkap' : 's.nama_lengkap',
    sekolah:         's.sekolah, CAST(s.kelas_sekolah AS INTEGER), s.nama_lengkap',
    tahun_masuk:     's.tahun_masuk, s.nama_lengkap',
    nis:             's.nis',
  }
  const orderBy = orderMap[sortBy] || 's.nama_lengkap'

  // SELECT hanya kolom yang dipilih — bukan SELECT *
  const selectCols = [
    's.id AS _id',
    kolom.includes('nis')           ? 's.nis'           : null,
    kolom.includes('nama_lengkap')  ? 's.nama_lengkap'  : null,
    kolom.includes('jenis_kelamin') ? 's.jenis_kelamin' : null,
    kolom.includes('nik')           ? 's.nik'           : null,
    kolom.includes('tempat_lahir')  ? 's.tempat_lahir'  : null,
    kolom.includes('tanggal_lahir') ? 's.tanggal_lahir' : null,
    kolom.includes('nama_ayah')     ? 's.nama_ayah'     : null,
    kolom.includes('nama_ibu')      ? 's.nama_ibu'      : null,
    kolom.includes('alamat')        ? 's.alamat'        : null,
    kolom.includes('asrama')        ? 's.asrama'        : null,
    kolom.includes('kamar')         ? 's.kamar'         : null,
    kolom.includes('tahun_masuk')   ? 's.tahun_masuk'   : null,
    kolom.includes('sekolah')       ? 's.sekolah'       : null,
    kolom.includes('kelas_sekolah') ? 's.kelas_sekolah' : null,
    needKelas && kolom.includes('nama_kelas') ? 'k.nama_kelas' : null,
    needKelas && kolom.includes('marhalah')   ? 'm.nama AS marhalah' : null,
  ].filter(Boolean).join(', ')

  const rawRows = await query<any>(
    `SELECT ${selectCols}
     FROM santri s
     ${joinKelas}
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT 5000`,
    params
  )

  // Dedup _id (kalau santri punya >1 riwayat aktif — edge case)
  const seen  = new Set<string>()
  const rows  = rawRows.filter(r => {
    if (seen.has(r._id)) return false
    seen.add(r._id)
    delete r._id
    return true
  })

  return { rows, total: rows.length }
}