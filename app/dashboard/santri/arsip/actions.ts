'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { assertCrud } from '@/lib/auth/crud'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 30
const ARCHIVE_STATUS = 'arsip'

export type FilterSantri = {
  search?: string
  asrama?: string
  sekolah?: string
  kelas_sekolah?: string
  kelas_pesantren?: string
  tahun_masuk?: number
  page?: number
}

type ArchiveGroupFilter = {
  angkatan: number | null
  catatan: string | null
  tanggal_arsip: string
}

type TableInfo = { name: string }
type Row = Record<string, any>

function inClause(values: unknown[]) {
  return values.map(() => '?').join(',')
}

function archiveBatchKey(angkatan: number | null, catatan: string | null, tanggalArsip: string) {
  return `${angkatan ?? 'null'}__${catatan ?? ''}__${tanggalArsip}`
}

function getAngkatan(profil: Row) {
  const fromNis = profil.nis ? parseInt(String(profil.nis).substring(0, 4), 10) : NaN
  if (!Number.isNaN(fromNis)) return fromNis
  const fromTahunMasuk = Number(profil.tahun_masuk)
  return Number.isFinite(fromTahunMasuk) ? fromTahunMasuk : null
}

async function getBySantriId<T = Row>(table: string, santriId: string) {
  return query<T>(`SELECT * FROM ${table} WHERE santri_id = ?`, [santriId])
}

async function getByIds<T = Row>(table: string, column: string, ids: unknown[]) {
  if (ids.length === 0) return []
  return query<T>(`SELECT * FROM ${table} WHERE ${column} IN (${inClause(ids)})`, ids)
}

async function getTableColumns(table: string) {
  const rows = await query<TableInfo>(`PRAGMA table_info(${table})`)
  return rows.map(r => r.name)
}

async function insertSnapshotRow(table: string, row: Row, overrides: Row = {}) {
  const columns = await getTableColumns(table)
  const data = { ...row, ...overrides }
  const insertColumns = columns.filter(col => Object.prototype.hasOwnProperty.call(data, col) && data[col] !== undefined)
  if (insertColumns.length === 0) return

  await execute(
    `INSERT OR IGNORE INTO ${table} (${insertColumns.join(', ')}) VALUES (${inClause(insertColumns)})`,
    insertColumns.map(col => data[col])
  )
}

async function restoreSnapshotRows(table: string, rows: Row[] = [], overrides: Row = {}) {
  for (const row of rows) {
    await insertSnapshotRow(table, row, overrides)
  }
}

async function buildSantriSnapshot(profil: Row) {
  const santriId = profil.id

  const riwayatPendidikan = await query<Row>(`
    SELECT rp.*, k.nama_kelas, k.tahun_ajaran_id, k.marhalah_id
    FROM riwayat_pendidikan rp
    LEFT JOIN kelas k ON rp.kelas_id = k.id
    WHERE rp.santri_id = ?
  `, [santriId])
  const riwayatIds = riwayatPendidikan.map(r => r.id)

  const nilaiAkademik = await getByIds('nilai_akademik', 'riwayat_pendidikan_id', riwayatIds)
  const nilaiAkhlak = await getByIds('nilai_akhlak', 'riwayat_pendidikan_id', riwayatIds)
  const ranking = await getByIds('ranking', 'riwayat_pendidikan_id', riwayatIds)
  const absensiHarian = await getByIds('absensi_harian', 'riwayat_pendidikan_id', riwayatIds)

  const upkTransaksi = await getBySantriId<Row>('upk_transaksi', santriId)
  const upkItems = await getByIds('upk_item', 'transaksi_id', upkTransaksi.map(t => t.id))

  const upkAntrian = await getBySantriId<Row>('upk_antrian', santriId)
  const upkAntrianIds = upkAntrian.map(a => a.id)
  const upkAntrianItems = await getByIds('upk_antrian_item', 'antrian_id', upkAntrianIds)
  const upkStokMutasi = await getByIds('upk_stok_mutasi', 'antrian_id', upkAntrianIds)

  const akademik = {
    riwayat_pendidikan: riwayatPendidikan,
    nilai_akademik: nilaiAkademik,
    nilai_akhlak: nilaiAkhlak,
    ranking,
    absensi_harian: absensiHarian,
    hasil_tes_klasifikasi: await getBySantriId('hasil_tes_klasifikasi', santriId),
  }

  const asrama = {
    absen_asrama: await getBySantriId('absen_asrama', santriId),
    absen_sakit: await getBySantriId('absen_sakit', santriId),
    absen_malam_v2: await getBySantriId('absen_malam_v2', santriId),
    absen_berjamaah: await getBySantriId('absen_berjamaah', santriId),
    kamar_draft: await getBySantriId('kamar_draft', santriId),
    kamar_ketua: await getBySantriId('kamar_ketua', santriId),
    mutasi_asrama_log: await getBySantriId('mutasi_asrama_log', santriId),
    perpulangan_log: await getBySantriId('perpulangan_log', santriId),
    santri_nonaktif_log: await getBySantriId('santri_nonaktif_log', santriId),
  }

  const disiplin = {
    pelanggaran: await getBySantriId('pelanggaran', santriId),
    surat_pernyataan: await getBySantriId('surat_pernyataan', santriId),
    surat_perjanjian: await getBySantriId('surat_perjanjian', santriId),
    perizinan: await getBySantriId('perizinan', santriId),
    riwayat_surat: await getBySantriId('riwayat_surat', santriId),
    denda_buku_pribadi: await getBySantriId('denda_buku_pribadi', santriId),
  }

  const keuangan = {
    spp_log: await getBySantriId('spp_log', santriId),
    spp_setoran_detail: await getBySantriId('spp_setoran_detail', santriId),
    spp_tunggakan_alasan: await getBySantriId('spp_tunggakan_alasan', santriId),
    pembayaran_tahunan: await getBySantriId('pembayaran_tahunan', santriId),
    tabungan_log: await getBySantriId('tabungan_log', santriId),
  }

  const upk = {
    upk_transaksi: upkTransaksi,
    upk_item: upkItems,
    upk_antrian: upkAntrian,
    upk_antrian_item: upkAntrianItems,
    upk_stok_mutasi: upkStokMutasi,
  }

  const ehb = {
    ehb_plotting_santri: await getBySantriId('ehb_plotting_santri', santriId),
    ehb_absensi: await getBySantriId('ehb_absensi', santriId),
  }

  return {
    schema_version: 2,
    mode: 'soft_archive',
    archived_at: now(),
    profil,
    akademik,
    asrama,
    disiplin,
    keuangan,
    upk,
    ehb,

    // Legacy aliases so older download/restore tooling can still read common keys.
    riwayat_pendidikan: akademik.riwayat_pendidikan,
    absensi: akademik.absensi_harian,
    pelanggaran: disiplin.pelanggaran,
    spp: keuangan.spp_log,
    nilai: akademik.nilai_akademik,
  }
}

async function restoreHardDeletedArchive(arsip: Row, snap: Row) {
  const profil = { ...(snap.profil ?? {}) }
  if (!profil.nis || !profil.nama_lengkap) throw new Error('Snapshot profil tidak lengkap')

  const idAsli = arsip.santri_id_asli || profil.id || generateId()
  const timestamp = now()

  await insertSnapshotRow('santri', profil, {
    id: idAsli,
    status_global: 'aktif',
    created_at: profil.created_at ?? timestamp,
    updated_at: timestamp,
  })

  const akademik = snap.akademik ?? {}
  const asrama = snap.asrama ?? {}
  const disiplin = snap.disiplin ?? {}
  const keuangan = snap.keuangan ?? {}
  const upk = snap.upk ?? {}
  const ehb = snap.ehb ?? {}

  await restoreSnapshotRows('riwayat_pendidikan', akademik.riwayat_pendidikan ?? snap.riwayat_pendidikan ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('nilai_akademik', akademik.nilai_akademik ?? snap.nilai ?? [])
  await restoreSnapshotRows('nilai_akhlak', akademik.nilai_akhlak ?? [])
  await restoreSnapshotRows('ranking', akademik.ranking ?? [])
  await restoreSnapshotRows('absensi_harian', akademik.absensi_harian ?? snap.absensi ?? [])
  await restoreSnapshotRows('hasil_tes_klasifikasi', akademik.hasil_tes_klasifikasi ?? [], { santri_id: idAsli })

  await restoreSnapshotRows('absen_asrama', asrama.absen_asrama ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('absen_sakit', asrama.absen_sakit ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('absen_malam_v2', asrama.absen_malam_v2 ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('absen_berjamaah', asrama.absen_berjamaah ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('kamar_draft', asrama.kamar_draft ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('kamar_ketua', asrama.kamar_ketua ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('mutasi_asrama_log', asrama.mutasi_asrama_log ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('perpulangan_log', asrama.perpulangan_log ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('santri_nonaktif_log', asrama.santri_nonaktif_log ?? [], { santri_id: idAsli })

  await restoreSnapshotRows('pelanggaran', disiplin.pelanggaran ?? snap.pelanggaran ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('surat_pernyataan', disiplin.surat_pernyataan ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('surat_perjanjian', disiplin.surat_perjanjian ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('perizinan', disiplin.perizinan ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('riwayat_surat', disiplin.riwayat_surat ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('denda_buku_pribadi', disiplin.denda_buku_pribadi ?? [], { santri_id: idAsli })

  await restoreSnapshotRows('spp_log', keuangan.spp_log ?? snap.spp ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('spp_setoran_detail', keuangan.spp_setoran_detail ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('spp_tunggakan_alasan', keuangan.spp_tunggakan_alasan ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('pembayaran_tahunan', keuangan.pembayaran_tahunan ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('tabungan_log', keuangan.tabungan_log ?? [], { santri_id: idAsli })

  await restoreSnapshotRows('upk_transaksi', upk.upk_transaksi ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('upk_item', upk.upk_item ?? [])
  await restoreSnapshotRows('upk_antrian', upk.upk_antrian ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('upk_antrian_item', upk.upk_antrian_item ?? [])
  await restoreSnapshotRows('upk_stok_mutasi', upk.upk_stok_mutasi ?? [])

  await restoreSnapshotRows('ehb_plotting_santri', ehb.ehb_plotting_santri ?? [], { santri_id: idAsli })
  await restoreSnapshotRows('ehb_absensi', ehb.ehb_absensi ?? [], { santri_id: idAsli })
}

export async function getSantriAktifUntukArsip(filter: FilterSantri = {}) {
  const { search, asrama, sekolah, kelas_sekolah, kelas_pesantren, tahun_masuk, page = 1 } = filter
  const offset = (page - 1) * PAGE_SIZE

  const clauses = ["s.status_global = 'aktif'"]
  const params: any[] = []

  if (search) { clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (asrama) { clauses.push('s.asrama = ?'); params.push(asrama) }
  if (sekolah) { clauses.push('s.sekolah = ?'); params.push(sekolah) }
  if (kelas_sekolah) { clauses.push('s.kelas_sekolah LIKE ?'); params.push(`%${kelas_sekolah}%`) }
  if (kelas_pesantren) { clauses.push('LOWER(k.nama_kelas) = LOWER(?)'); params.push(kelas_pesantren) }
  if (tahun_masuk) { clauses.push('s.tahun_masuk = ?'); params.push(tahun_masuk) }

  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON rp.kelas_id = k.id
     WHERE ${where}`,
    params
  )
  const total = countRow?.total ?? 0

  const data = await query<any>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            s.sekolah, s.kelas_sekolah, s.tahun_masuk,
            k.nama_kelas AS kelas_pesantren_nama
     FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON rp.kelas_id = k.id
     WHERE ${where}
     ORDER BY s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  )

  return { data, total, page, hasMore: offset + PAGE_SIZE < total }
}

export async function getFilterOptionsSantri() {
  const [asramaRows, sekolahRows, kelasRows, tahunRows] = await Promise.all([
    query<{ asrama: string }>(`SELECT DISTINCT asrama FROM santri WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`),
    query<{ sekolah: string }>(`SELECT DISTINCT sekolah FROM santri WHERE status_global = 'aktif' AND sekolah IS NOT NULL ORDER BY sekolah`),
    query<{ nama_kelas: string }>('SELECT DISTINCT nama_kelas FROM kelas ORDER BY nama_kelas'),
    query<{ tahun_masuk: number }>(`SELECT DISTINCT tahun_masuk FROM santri WHERE status_global = 'aktif' AND tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC`),
  ])

  return {
    asramaList: asramaRows.map(r => r.asrama),
    sekolahList: sekolahRows.map(r => r.sekolah),
    kelasList: kelasRows.map(r => r.nama_kelas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    tahunList: tahunRows.map(r => r.tahun_masuk),
  }
}

export async function getGrupArsip() {
  const rows = await query<{
    angkatan: number | null
    catatan: string | null
    tanggal_arsip: string
    jumlah: number
    asrama_list: string
  }>(`
    SELECT
      angkatan,
      catatan,
      DATE(tanggal_arsip) AS tanggal_arsip,
      COUNT(*) AS jumlah,
      GROUP_CONCAT(DISTINCT asrama) AS asrama_list
    FROM santri_arsip
    GROUP BY angkatan, catatan, DATE(tanggal_arsip)
    ORDER BY tanggal_arsip DESC
  `)

  return rows.map(r => ({
    key: archiveBatchKey(r.angkatan, r.catatan, r.tanggal_arsip),
    angkatan: r.angkatan,
    catatan: r.catatan,
    tanggal_arsip: r.tanggal_arsip,
    jumlah: r.jumlah,
    asramaList: r.asrama_list ? r.asrama_list.split(',').filter(Boolean) : [],
  }))
}

export type FilterSantriArsip = { search?: string; asrama?: string; page?: number }

export async function getSantriDalamGrup(
  angkatan: number | null,
  catatan: string | null,
  tanggalArsip: string,
  filter: FilterSantriArsip = {}
) {
  const { search, asrama, page = 1 } = filter
  const offset = (page - 1) * PAGE_SIZE

  const clauses = ['DATE(a.tanggal_arsip) = ?']
  const params: any[] = [tanggalArsip]

  if (angkatan !== null) { clauses.push('a.angkatan = ?'); params.push(angkatan) }
  else clauses.push('a.angkatan IS NULL')

  if (catatan) { clauses.push('a.catatan = ?'); params.push(catatan) }
  else clauses.push('a.catatan IS NULL')

  if (search) { clauses.push('(a.nama_lengkap LIKE ? OR a.nis LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (asrama) { clauses.push('a.asrama = ?'); params.push(asrama) }

  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri_arsip a WHERE ${where}`, params
  )
  const total = countRow?.total ?? 0

  const data = await query<any>(
    `SELECT a.id, a.santri_id_asli, a.nis, a.nama_lengkap, a.asrama,
            a.tanggal_arsip, a.catatan, a.angkatan,
            s.status_global AS status_santri,
            CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS santri_masih_ada
     FROM santri_arsip a
     LEFT JOIN santri s ON s.id = a.santri_id_asli
     WHERE ${where}
     ORDER BY a.nama_lengkap LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  )

  return { data, total, page, hasMore: offset + PAGE_SIZE < total }
}

export async function arsipkanSantri(santriIds: string[], catatan: string): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  if (!santriIds || santriIds.length === 0) return { error: 'Pilih minimal 1 santri' }

  let berhasil = 0
  let gagal = 0
  const errorList: string[] = []

  for (const santriId of santriIds) {
    try {
      const profil = await queryOne<Row>('SELECT * FROM santri WHERE id = ?', [santriId])
      if (!profil) { gagal++; errorList.push(`ID ${santriId}: Data tidak ditemukan`); continue }
      if (profil.status_global !== 'aktif') {
        gagal++
        errorList.push(`${profil.nama_lengkap ?? santriId}: status saat ini ${profil.status_global}, bukan aktif`)
        continue
      }

      const timestamp = now()
      const snapshot = JSON.stringify(await buildSantriSnapshot(profil))
      const angkatan = getAngkatan(profil)
      const existing = await queryOne<{ id: string }>('SELECT id FROM santri_arsip WHERE santri_id_asli = ? LIMIT 1', [santriId])

      const statements = existing
        ? [
          {
            sql: `UPDATE santri_arsip
                  SET nis = ?, nama_lengkap = ?, angkatan = ?, asrama = ?, catatan = ?, snapshot = ?, tanggal_arsip = ?
                  WHERE id = ?`,
            params: [profil.nis, profil.nama_lengkap, angkatan, profil.asrama, catatan || null, snapshot, timestamp, existing.id],
          },
          {
            sql: `UPDATE santri SET status_global = ?, updated_at = ? WHERE id = ?`,
            params: [ARCHIVE_STATUS, timestamp, santriId],
          },
        ]
        : [
          {
            sql: `INSERT INTO santri_arsip (id, santri_id_asli, nis, nama_lengkap, angkatan, asrama, catatan, snapshot, tanggal_arsip)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [generateId(), santriId, profil.nis, profil.nama_lengkap, angkatan, profil.asrama, catatan || null, snapshot, timestamp],
          },
          {
            sql: `UPDATE santri SET status_global = ?, updated_at = ? WHERE id = ?`,
            params: [ARCHIVE_STATUS, timestamp, santriId],
          },
        ]

      await batch(statements)
      berhasil++
    } catch (err: any) {
      gagal++
      errorList.push(`ID ${santriId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')
  return { success: true, berhasil, gagal, errors: errorList }
}

export async function restoreSantri(arsipIds: string[]): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  if (!arsipIds || arsipIds.length === 0) return { error: 'Pilih minimal 1 data untuk direstore' }

  let berhasil = 0
  let gagal = 0
  const errorList: string[] = []

  for (const arsipId of arsipIds) {
    try {
      const arsip = await queryOne<Row>('SELECT * FROM santri_arsip WHERE id = ?', [arsipId])
      if (!arsip) { gagal++; errorList.push(`Arsip ID ${arsipId}: Tidak ditemukan`); continue }

      const existingSantri = await queryOne<{ id: string; status_global: string }>(
        'SELECT id, status_global FROM santri WHERE id = ?',
        [arsip.santri_id_asli]
      )
      const timestamp = now()

      if (existingSantri) {
        await batch([
          {
            sql: `UPDATE santri SET status_global = 'aktif', updated_at = ? WHERE id = ?`,
            params: [timestamp, existingSantri.id],
          },
          {
            sql: 'DELETE FROM santri_arsip WHERE id = ?',
            params: [arsipId],
          },
        ])
      } else {
        const snap = JSON.parse(arsip.snapshot)
        await restoreHardDeletedArchive(arsip, snap)
        await execute('DELETE FROM santri_arsip WHERE id = ?', [arsipId])
      }

      berhasil++
    } catch (err: any) {
      gagal++
      errorList.push(`Arsip ID ${arsipId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')
  return { success: true, berhasil, gagal, errors: errorList }
}

export async function getArsipForDownload(
  arsipIds?: string[],
  group?: ArchiveGroupFilter
): Promise<{ data: any[] } | { error: string }> {
  const select = 'SELECT id, santri_id_asli, nis, nama_lengkap, asrama, angkatan, catatan, tanggal_arsip, snapshot FROM santri_arsip'

  if (arsipIds && arsipIds.length > 0) {
    const data = await query(`${select} WHERE id IN (${inClause(arsipIds)}) ORDER BY angkatan DESC, nama_lengkap`, arsipIds)
    return { data }
  }

  if (group) {
    const clauses = ['DATE(tanggal_arsip) = ?']
    const params: any[] = [group.tanggal_arsip]
    if (group.angkatan !== null) { clauses.push('angkatan = ?'); params.push(group.angkatan) }
    else clauses.push('angkatan IS NULL')
    if (group.catatan) { clauses.push('catatan = ?'); params.push(group.catatan) }
    else clauses.push('catatan IS NULL')

    const data = await query(`${select} WHERE ${clauses.join(' AND ')} ORDER BY angkatan DESC, nama_lengkap`, params)
    return { data }
  }

  const data = await query(`${select} ORDER BY angkatan DESC, nama_lengkap`)
  return { data }
}

export async function hapusArsipPermanen(arsipId: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'delete')
  if ('error' in access) return access

  const arsip = await queryOne<Row>(`
    SELECT a.id, s.status_global
    FROM santri_arsip a
    LEFT JOIN santri s ON s.id = a.santri_id_asli
    WHERE a.id = ?
  `, [arsipId])
  if (!arsip) return { error: 'Arsip tidak ditemukan' }
  if (arsip.status_global === ARCHIVE_STATUS) {
    return { error: 'Arsip ini masih menjadi penanda status alumni. Restore dulu sebelum menghapus catatannya.' }
  }

  await query('DELETE FROM santri_arsip WHERE id = ?', [arsipId])
  revalidatePath('/dashboard/santri/arsip')
  return { success: true }
}

export async function hapusArsipMassal(arsipIds: string[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'delete')
  if ('error' in access) return access
  if (!arsipIds || arsipIds.length === 0) return { error: 'Pilih minimal 1 data' }

  const rows = await query<{ id: string; status_global: string | null }>(`
    SELECT a.id, s.status_global
    FROM santri_arsip a
    LEFT JOIN santri s ON s.id = a.santri_id_asli
    WHERE a.id IN (${inClause(arsipIds)})
  `, arsipIds)
  const blocked = rows.filter(r => r.status_global === ARCHIVE_STATUS)
  if (blocked.length > 0) {
    return { error: `${blocked.length} arsip masih menjadi penanda status alumni. Restore dulu sebelum menghapus catatannya.` }
  }

  await query(`DELETE FROM santri_arsip WHERE id IN (${inClause(arsipIds)})`, arsipIds)
  revalidatePath('/dashboard/santri/arsip')
  return { success: true, count: arsipIds.length }
}
