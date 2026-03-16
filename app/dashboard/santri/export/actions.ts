'use server'

import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

import type { ExportFilter, SortBy, KolomExport } from './constants'

// ─── Opsi filter (untuk populate dropdown) ───────────────────────────────────
// Hemat: 4 query ringan parallel — semua aggregate/distinct tanpa JOIN besar
export async function getFilterOptions(asramaBinaan?: string | null) {
  const asramaClause = asramaBinaan ? `WHERE asrama = '${asramaBinaan}'` : "WHERE status_global = 'aktif'"
  const baseWhere    = asramaBinaan ? `WHERE s.asrama = '${asramaBinaan}' AND s.status_global = 'aktif'` : "WHERE s.status_global = 'aktif'"

  const [asramaList, kamarList, sekolahList, kelasSekolahList, tahunList, marhalahList, kelasList] = await Promise.all([
    asramaBinaan
      ? Promise.resolve([asramaBinaan])
      : query<{ v: string }>(`SELECT DISTINCT asrama AS v FROM santri WHERE status_global='aktif' AND asrama IS NOT NULL ORDER BY asrama`)
          .then(r => r.map(x => x.v)),

    query<{ v: string }>(`SELECT DISTINCT kamar AS v FROM santri ${asramaClause} AND kamar IS NOT NULL ORDER BY CAST(kamar AS INTEGER), kamar`)
      .then(r => r.map(x => x.v)),

    query<{ v: string }>(`SELECT DISTINCT sekolah AS v FROM santri WHERE status_global='aktif' AND sekolah IS NOT NULL ORDER BY sekolah`)
      .then(r => r.map(x => x.v)),

    query<{ v: string }>(`SELECT DISTINCT kelas_sekolah AS v FROM santri WHERE status_global='aktif' AND kelas_sekolah IS NOT NULL ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah`)
      .then(r => r.map(x => x.v)),

    query<{ v: number }>(`SELECT DISTINCT tahun_masuk AS v FROM santri WHERE status_global='aktif' AND tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC`)
      .then(r => r.map(x => x.v)),

    // Marhalah + kelas pesantren — JOIN ringan ke tabel kecil
    query<{ marhalah: string; nama_kelas: string; kelas_id: string }>(`
      SELECT DISTINCT m.nama AS marhalah, k.nama_kelas, k.id AS kelas_id
      FROM riwayat_pendidikan rp
      INNER JOIN kelas k ON k.id = rp.kelas_id
      INNER JOIN marhalah m ON m.id = k.marhalah_id
      INNER JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
      WHERE rp.status_riwayat = 'aktif'
      ORDER BY m.urutan, k.nama_kelas
    `),

    query<{ nama_kelas: string; kelas_id: string }>(`
      SELECT DISTINCT k.nama_kelas, k.id AS kelas_id
      FROM riwayat_pendidikan rp
      INNER JOIN kelas k ON k.id = rp.kelas_id
      INNER JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
      WHERE rp.status_riwayat = 'aktif'
      ORDER BY k.nama_kelas
    `),
  ])

  const marhalahUnik = [...new Set(marhalahList.map(r => r.marhalah))]

  return { asramaList, kamarList, sekolahList, kelasSekolahList, tahunList, marhalahUnik, kelasList }
}

// ─── Export data santri ───────────────────────────────────────────────────────
// Hemat row reads:
// - Hanya 1-2 query ke DB (santri + opsional JOIN riwayat_pendidikan)
// - Kolom kelas/marhalah hanya di-JOIN kalau user memilihnya
// - Tidak ada subquery per baris
export async function getDataExport(
  filter: ExportFilter,
  kolom: KolomExport[],
  sortBy: SortBy,
  asramaBinaan?: string | null
): Promise<{ rows: any[]; total: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  // Role pengurus_asrama dipaksa pakai asrama binaannya
  const forceAsrama = session.role === 'pengurus_asrama' ? session.asrama_binaan : null
  const effectiveAsrama = forceAsrama || filter.asrama || null

  // Apakah perlu JOIN ke riwayat_pendidikan?
  const needKelas = kolom.includes('nama_kelas') || kolom.includes('marhalah')
    || filter.nama_kelas || filter.marhalah

  const clauses: string[] = ["s.status_global = 'aktif'"]
  const params: any[] = []

  if (effectiveAsrama) { clauses.push('s.asrama = ?'); params.push(effectiveAsrama) }
  if (filter.kamar)          { clauses.push('s.kamar = ?');          params.push(filter.kamar) }
  if (filter.jenis_kelamin)  { clauses.push('s.jenis_kelamin = ?');  params.push(filter.jenis_kelamin) }
  if (filter.sekolah)        { clauses.push('s.sekolah = ?');        params.push(filter.sekolah) }
  if (filter.kelas_sekolah)  { clauses.push('s.kelas_sekolah = ?');  params.push(filter.kelas_sekolah) }
  if (filter.tahun_masuk)    { clauses.push('s.tahun_masuk = ?');    params.push(filter.tahun_masuk) }
  if (filter.alamat_kata)    { clauses.push('s.alamat LIKE ?');      params.push(`%${filter.alamat_kata}%`) }
  if (filter.nama_kelas)     { clauses.push('k.nama_kelas = ?');     params.push(filter.nama_kelas) }
  if (filter.marhalah)       { clauses.push('m.nama = ?');           params.push(filter.marhalah) }

  const where  = clauses.join(' AND ')
  const joinKelas = needKelas
    ? `LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       LEFT JOIN marhalah m ON m.id = k.marhalah_id`
    : ''

  // ORDER BY
  const orderMap: Record<SortBy, string> = {
    nama_lengkap:   's.nama_lengkap',
    asrama:         's.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap',
    kamar:          'CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap',
    kelas_pesantren:needKelas ? 'm.urutan, k.nama_kelas, s.nama_lengkap' : 's.nama_lengkap',
    sekolah:        's.sekolah, CAST(s.kelas_sekolah AS INTEGER), s.nama_lengkap',
    tahun_masuk:    's.tahun_masuk, s.nama_lengkap',
    nis:            's.nis',
  }
  const orderBy = orderMap[sortBy] || 's.nama_lengkap'

  // SELECT hanya kolom yang dipilih — tidak ambil semua
  const selectCols = [
    'ROW_NUMBER() OVER (ORDER BY ' + orderBy + ') AS no',
    kolom.includes('nis')           ? 's.nis' : null,
    kolom.includes('nama_lengkap')  ? 's.nama_lengkap' : null,
    kolom.includes('jenis_kelamin') ? 's.jenis_kelamin' : null,
    kolom.includes('nik')           ? 's.nik' : null,
    kolom.includes('tempat_lahir')  ? 's.tempat_lahir' : null,
    kolom.includes('tanggal_lahir') ? 's.tanggal_lahir' : null,
    kolom.includes('nama_ayah')     ? 's.nama_ayah' : null,
    kolom.includes('nama_ibu')      ? 's.nama_ibu' : null,
    kolom.includes('alamat')        ? 's.alamat' : null,
    kolom.includes('asrama')        ? 's.asrama' : null,
    kolom.includes('kamar')         ? 's.kamar' : null,
    kolom.includes('tahun_masuk')   ? 's.tahun_masuk' : null,
    kolom.includes('sekolah')       ? 's.sekolah' : null,
    kolom.includes('kelas_sekolah') ? 's.kelas_sekolah' : null,
    needKelas && kolom.includes('nama_kelas') ? 'k.nama_kelas' : null,
    needKelas && kolom.includes('marhalah')   ? 'm.nama AS marhalah' : null,
  ].filter(Boolean).join(', ')

  // Batasi 5000 baris — proteksi
  const rows = await query<any>(
    `SELECT ${selectCols}
     FROM santri s
     ${joinKelas}
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT 5000`,
    params
  )

  return { rows, total: rows.length }
}
