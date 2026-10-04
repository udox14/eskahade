'use server'

import { query } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { getSantriKelasScopeForSession } from '@/lib/akademik/guru-access'
import type { ExportFilter, SortBy, KolomExport } from './constants'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'

// ─── Opsi filter (untuk populate form filter) ─────────────────────────────────
export async function getFilterOptions() {
  const session = await getSession()
  const asramaBinaan = session && hasRole(session, 'pengurus_asrama')
    ? session.asrama_binaan ?? null
    : null

  // Guru/wali_kelas: dropdown hanya untuk santri dari kelas yang ia ajar
  const scope = await getSantriKelasScopeForSession(session, 'santri')
  const scopeSql = scope.condition ? ` AND ${scope.condition}` : ''
  const scopeParams = scope.params

  const hasKelasScope = scope.kelasIds && scope.kelasIds.length > 0
  const isNoKelasScope = scope.kelasIds !== null && scope.kelasIds.length === 0

  const [
    asramaList,
    sekolahList,
    kelasSekolahList,
    tahunList,
    kelasMarhalahList,
    jasaList,
    kabKotaList,
    provinsiList,
    golDarahList,
    jemaahList,
  ] = await Promise.all([
    // 1. Daftar asrama
    asramaBinaan
      ? Promise.resolve([asramaBinaan])
      : query<{ v: string }>(
          `SELECT DISTINCT asrama AS v FROM santri WHERE asrama IS NOT NULL AND asrama <> ''${scopeSql} ORDER BY asrama`,
          scopeParams
        ).then(r => r.map(x => x.v)),

    // 2. Daftar sekolah
    query<{ v: string }>(
      `SELECT DISTINCT sekolah AS v FROM santri WHERE sekolah IS NOT NULL AND sekolah <> ''${scopeSql} ORDER BY sekolah`,
      scopeParams
    ).then(r => r.map(x => x.v)),

    // 3. Daftar kelas sekolah
    query<{ v: string }>(
      `SELECT DISTINCT kelas_sekolah AS v FROM santri WHERE kelas_sekolah IS NOT NULL AND kelas_sekolah <> ''${scopeSql} ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah`,
      scopeParams
    ).then(r => r.map(x => x.v)),

    // 4. Daftar tahun masuk
    query<{ v: number }>(
      `SELECT DISTINCT tahun_masuk AS v FROM santri WHERE tahun_masuk IS NOT NULL${scopeSql} ORDER BY tahun_masuk DESC`,
      scopeParams
    ).then(r => r.map(x => x.v)),

    // 5. Kelas + marhalah dalam 1 query
    query<{ marhalah: string; nama_kelas: string; urutan: number }>(
      `SELECT DISTINCT m.nama AS marhalah, k.nama_kelas, m.urutan
       FROM kelas k
       INNER JOIN marhalah m ON m.id = k.marhalah_id
       WHERE EXISTS (
         SELECT 1 FROM riwayat_pendidikan rp
         INNER JOIN santri s ON s.id = rp.santri_id
         WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
       )
       ${hasKelasScope ? `AND k.id IN (${scope.kelasIds!.map(() => '?').join(',')})` : isNoKelasScope ? 'AND 1 = 0' : ''}
       ORDER BY m.urutan, k.nama_kelas`,
      hasKelasScope ? scope.kelasIds! : []
    ),

    // 6. Daftar master jasa katering/laundry
    query<{ id: string; nama_jasa: string; jenis: 'Makan' | 'Cuci' }>(
      `SELECT id, nama_jasa, jenis FROM master_jasa ORDER BY jenis, nama_jasa`
    ),

    // 7. Daftar Kab/Kota
    query<{ v: string }>(
      `SELECT DISTINCT kab_kota AS v FROM santri WHERE kab_kota IS NOT NULL AND kab_kota <> ''${scopeSql} ORDER BY kab_kota`,
      scopeParams
    ).then(r => r.map(x => x.v)),

    // 8. Daftar Provinsi
    query<{ v: string }>(
      `SELECT DISTINCT provinsi AS v FROM santri WHERE provinsi IS NOT NULL AND provinsi <> ''${scopeSql} ORDER BY provinsi`,
      scopeParams
    ).then(r => r.map(x => x.v)),

    // 9. Daftar Gol Darah
    query<{ v: string }>(
      `SELECT DISTINCT gol_darah AS v FROM santri WHERE gol_darah IS NOT NULL AND gol_darah <> ''${scopeSql} ORDER BY gol_darah`,
      scopeParams
    ).then(r => r.map(x => x.v)),

    // 10. Daftar Jemaah
    query<{ v: string }>(
      `SELECT DISTINCT jemaah AS v FROM santri WHERE jemaah IS NOT NULL AND jemaah <> ''${scopeSql} ORDER BY jemaah`,
      scopeParams
    ).then(r => r.map(x => x.v)),
  ])

  const marhalahUnik = [...new Set(kelasMarhalahList.map(r => r.marhalah))]
  const kelasList    = kelasMarhalahList.map(r => r.nama_kelas)
  const jasaMakanList = jasaList.filter(j => j.jenis === 'Makan')
  const jasaCuciList = jasaList.filter(j => j.jenis === 'Cuci')

  return {
    asramaList,
    sekolahList,
    kelasSekolahList,
    tahunList,
    marhalahUnik,
    kelasList,
    jasaMakanList,
    jasaCuciList,
    kabKotaList,
    provinsiList,
    golDarahList,
    jemaahList,
    asramaBinaan,
  }
}

// ─── Daftar kamar per asrama (lazy — dipanggil saat asrama dipilih) ───────────
export async function getKamarList(asrama: string) {
  const session = await getSession()
  if (session && hasRole(session, 'pengurus_asrama') && session.asrama_binaan !== asrama) {
    return []
  }
  const rows = await query<{ v: string }>(
    `SELECT DISTINCT kamar AS v FROM santri
     WHERE asrama = ? AND kamar IS NOT NULL AND kamar <> ''
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
): Promise<{ rows: Record<string, unknown>[]; total: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  // Enforce asrama untuk pengurus_asrama
  const forceAsrama = hasRole(session, 'pengurus_asrama') ? session.asrama_binaan : null
  const scope = await getSantriKelasScopeForSession(session, 's')
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')

  const clauses: string[] = []
  const params: unknown[] = []

  // Status Filter
  if (filter.status && filter.status !== 'all') {
    clauses.push('s.status_global = ?')
    params.push(filter.status)
  } else if (!filter.status) {
    clauses.push("s.status_global = 'aktif'")
  }

  // Scope guru/wali_kelas: batasi ke santri kelas yang ia ajar
  if (scope.condition) {
    clauses.push(scope.condition)
    params.push(...scope.params)
  }

  // Helper: build IN clause untuk array filter
  const addInClause = (col: string, arr: unknown[] | undefined | null) => {
    if (!arr || arr.length === 0) return
    clauses.push(`${col} IN (${arr.map(() => '?').join(', ')})`)
    params.push(...arr)
  }

  const addJasaClause = (col: string, arr: string[] | undefined | null) => {
    if (!arr || arr.length === 0) return

    const realIds = arr.filter(v => v !== '__NULL__')
    const allowEmpty = arr.includes('__NULL__')
    const parts: string[] = []

    if (realIds.length > 0) {
      parts.push(`${col} IN (${realIds.map(() => '?').join(', ')})`)
      params.push(...realIds)
    }
    if (allowEmpty) parts.push(`${col} IS NULL`)

    if (parts.length > 0) clauses.push(`(${parts.join(' OR ')})`)
  }

  // Effective asrama
  const effectiveAsrama: string[] | null = forceAsrama
    ? [forceAsrama]
    : (filter.asrama && filter.asrama.length > 0 ? filter.asrama : null)

  addInClause('s.asrama', effectiveAsrama)
  addInClause('s.kamar', filter.kamar)
  addJasaClause('s.tempat_makan_id', filter.tempat_makan_id)
  addJasaClause('s.tempat_mencuci_id', filter.tempat_mencuci_id)
  if (filter.jenis_kelamin) {
    clauses.push('s.jenis_kelamin = ?')
    params.push(filter.jenis_kelamin)
  }
  addInClause('s.sekolah', filter.sekolah)
  addInClause('s.kelas_sekolah', filter.kelas_sekolah)
  addInClause('s.tahun_masuk', filter.tahun_masuk)
  addInClause('s.gol_darah', filter.gol_darah)
  addInClause('s.kab_kota', filter.kab_kota)
  addInClause('s.provinsi', filter.provinsi)
  addInClause('s.jemaah', filter.jemaah)

  if (filter.kategori_santri && filter.kategori_santri.length > 0) {
    const inList = filter.kategori_santri.map(() => '?').join(', ')
    clauses.push(`(${kategoriEfektifSql}) IN (${inList})`)
    params.push(...filter.kategori_santri)
  }

  // Pencarian Cepat Nama / NIS
  if (filter.q) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    params.push(`%${filter.q}%`, `%${filter.q}%`)
  }

  if (filter.alamat_kata) {
    clauses.push('(s.alamat LIKE ? OR s.alamat_lengkap LIKE ? OR s.kecamatan LIKE ? OR s.kab_kota LIKE ? OR s.provinsi LIKE ?)')
    params.push(
      `%${filter.alamat_kata}%`,
      `%${filter.alamat_kata}%`,
      `%${filter.alamat_kata}%`,
      `%${filter.alamat_kata}%`,
      `%${filter.alamat_kata}%`
    )
  }

  addInClause('k.nama_kelas', filter.nama_kelas)
  addInClause('m.nama', filter.marhalah)

  const where = clauses.length > 0 ? clauses.join(' AND ') : '1 = 1'

  // Perlu JOIN ke riwayat_pendidikan?
  const needKelas =
    kolom.includes('nama_kelas') ||
    kolom.includes('marhalah') ||
    (Boolean(filter.nama_kelas) && filter.nama_kelas!.length > 0) ||
    (Boolean(filter.marhalah) && filter.marhalah!.length > 0)

  const needJasa =
    kolom.includes('tempat_makan') ||
    kolom.includes('tempat_mencuci') ||
    (Boolean(filter.tempat_makan_id) && filter.tempat_makan_id!.length > 0) ||
    (Boolean(filter.tempat_mencuci_id) && filter.tempat_mencuci_id!.length > 0)

  const joinKelas = needKelas
    ? `LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       LEFT JOIN marhalah m ON m.id = k.marhalah_id`
    : ''

  const joinJasa = needJasa
    ? `LEFT JOIN master_jasa jm ON jm.id = s.tempat_makan_id
       LEFT JOIN master_jasa jc ON jc.id = s.tempat_mencuci_id`
    : ''

  const orderMap: Record<SortBy, string> = {
    nama_lengkap:    's.nama_lengkap ASC',
    asrama:          's.asrama ASC, CAST(s.kamar AS INTEGER) ASC, s.kamar ASC, s.nama_lengkap ASC',
    kamar:           'CAST(s.kamar AS INTEGER) ASC, s.kamar ASC, s.nama_lengkap ASC',
    kelas_pesantren: needKelas ? 'm.urutan ASC, k.nama_kelas ASC, s.nama_lengkap ASC' : 's.nama_lengkap ASC',
    sekolah:         's.sekolah ASC, CAST(s.kelas_sekolah AS INTEGER) ASC, s.nama_lengkap ASC',
    tahun_masuk:     's.tahun_masuk DESC, s.nama_lengkap ASC',
    tanggal_masuk:   's.tanggal_masuk DESC, s.nama_lengkap ASC',
    nis:             's.nis ASC',
  }
  const orderBy = orderMap[sortBy] || 's.nama_lengkap ASC'

  // SELECT hanya kolom yang dipilih
  const selectCols = [
    's.id AS _id',
    kolom.includes('nis')             ? 's.nis'             : null,
    kolom.includes('nama_lengkap')    ? 's.nama_lengkap'    : null,
    kolom.includes('jenis_kelamin')   ? 's.jenis_kelamin'   : null,
    kolom.includes('nik')             ? 's.nik'             : null,
    kolom.includes('tempat_lahir')    ? 's.tempat_lahir'    : null,
    kolom.includes('tanggal_lahir')   ? 's.tanggal_lahir'   : null,
    kolom.includes('gol_darah')       ? 's.gol_darah'       : null,
    kolom.includes('status_global')   ? 's.status_global'   : null,
    kolom.includes('nama_ayah')       ? 's.nama_ayah'       : null,
    kolom.includes('nama_ibu')        ? 's.nama_ibu'        : null,
    kolom.includes('no_wa_ortu')      ? 's.no_wa_ortu'      : null,
    kolom.includes('alamat')          ? "COALESCE(NULLIF(s.alamat, ''), s.alamat_lengkap) AS alamat" : null,
    kolom.includes('alamat_lengkap')  ? 's.alamat_lengkap'  : null,
    kolom.includes('kecamatan')       ? 's.kecamatan'       : null,
    kolom.includes('kab_kota')        ? 's.kab_kota'        : null,
    kolom.includes('provinsi')        ? 's.provinsi'        : null,
    kolom.includes('jemaah')          ? 's.jemaah'          : null,
    kolom.includes('asrama')          ? 's.asrama'          : null,
    kolom.includes('kamar')           ? 's.kamar'           : null,
    kolom.includes('tahun_masuk')     ? 's.tahun_masuk'     : null,
    kolom.includes('tanggal_masuk')   ? 's.tanggal_masuk'   : null,
    kolom.includes('tanggal_keluar')  ? 's.tanggal_keluar'  : null,
    kolom.includes('kategori_santri') ? `${kategoriEfektifSql} AS kategori_santri` : null,
    needJasa && kolom.includes('tempat_makan') ? `CASE
      WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
      WHEN jm.id IS NULL THEN 'Penyedia terhapus'
      ELSE jm.nama_jasa
    END AS tempat_makan` : null,
    needJasa && kolom.includes('tempat_mencuci') ? `CASE
      WHEN s.tempat_mencuci_id IS NULL THEN 'Belum diatur'
      WHEN jc.id IS NULL THEN 'Penyedia terhapus'
      ELSE jc.nama_jasa
    END AS tempat_mencuci` : null,
    kolom.includes('sekolah')         ? 's.sekolah'         : null,
    kolom.includes('kelas_sekolah')   ? 's.kelas_sekolah'   : null,
    needKelas && kolom.includes('nama_kelas') ? 'k.nama_kelas' : null,
    needKelas && kolom.includes('marhalah')   ? 'm.nama AS marhalah' : null,
  ].filter(Boolean).join(', ')

  const rawRows = await query<Record<string, unknown>>(
    `SELECT ${selectCols}
     FROM santri s
     ${joinKelas}
     ${joinJasa}
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT 5000`,
    params
  )

  const seen = new Set<unknown>()
  const rows = rawRows.filter(r => {
    if (seen.has(r._id)) return false
    seen.add(r._id)
    delete r._id
    return true
  })

  return { rows, total: rows.length }
}
