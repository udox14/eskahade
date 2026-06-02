'use server'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { batch, query, queryOne } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'

type ForeignKeyEdge = {
  childTable: string
  childColumn: string
  parentTable: string
  parentColumn: string
}

type DeleteStatement = {
  sql: string
  params: unknown[]
}

type SantriDetailBase = Record<string, unknown> & {
  id: string
  nis: string | null
  nama_lengkap: string
  asrama: string | null
}

type RiwayatPendidikanRow = {
  id: string
  status_riwayat: string
  kelas_id?: string | null
  nama_kelas: string | null
  marhalah_nama: string | null
}

type NilaiAkademikRow = {
  riwayat_pendidikan_id: string
  mapel_nama: string | null
  nilai: number | null
  semester: number
}

type RiwayatAkademikRow = {
  id: string
  status_riwayat: string
  nama_kelas: string | null
  marhalah_nama: string | null
  tahun_ajaran_nama: string | null
  ranking_kelas: number | null
  predikat: string | null
  rata_rata: number | null
}

export type SantriDetail = SantriDetailBase & {
  riwayat_pendidikan: RiwayatPendidikanRow[]
  info_kelas: string
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

const STATIC_EDGES: ForeignKeyEdge[] = [
  { childTable: 'riwayat_pendidikan',     childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'absen_sakit',            childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'pelanggaran',            childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'perizinan',              childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'spp_log',                childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'spp_setoran_detail',     childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'spp_tunggakan_alasan',   childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'spp_tunggakan_historis', childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'pembayaran_tahunan',     childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'tabungan_log',           childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'upk_transaksi',          childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'riwayat_surat',          childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'hasil_tes_klasifikasi',  childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'absen_asrama',           childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'kamar_draft',            childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'kamar_ketua',            childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'mutasi_asrama_log',      childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'perpulangan_log',        childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'surat_pernyataan',       childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'surat_perjanjian',       childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'santri_nonaktif_log',   childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'santri_keluar_tandai',  childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'denda_buku_pribadi',     childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'uang_jajan_auto_rule',   childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'uang_jajan_auto_skip',   childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'verifikasi_panggilan',   childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'verifikasi_panggilan_vonis', childColumn: 'santri_id', parentTable: 'santri',                parentColumn: 'id' },
  { childTable: 'psb_flow',               childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'psb_payment_receipt',    childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'hafalan_progress',       childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'ehb_plotting_santri',    childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'ehb_absensi',            childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'ehb_absensi_menghafal',  childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'absen_malam_v2',         childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'absen_berjamaah',        childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'upk_antrian',            childColumn: 'santri_id',      parentTable: 'santri',                  parentColumn: 'id' },
  { childTable: 'absensi_harian',         childColumn: 'riwayat_pendidikan_id', parentTable: 'riwayat_pendidikan', parentColumn: 'id' },
  { childTable: 'nilai_akademik',         childColumn: 'riwayat_pendidikan_id', parentTable: 'riwayat_pendidikan', parentColumn: 'id' },
  { childTable: 'nilai_akhlak',           childColumn: 'riwayat_pendidikan_id', parentTable: 'riwayat_pendidikan', parentColumn: 'id' },
  { childTable: 'ranking',                childColumn: 'riwayat_pendidikan_id', parentTable: 'riwayat_pendidikan', parentColumn: 'id' },
  { childTable: 'nilai_harian_detail',    childColumn: 'riwayat_pendidikan_id', parentTable: 'riwayat_pendidikan', parentColumn: 'id' },
  { childTable: 'hafalan_progress',       childColumn: 'riwayat_pendidikan_id', parentTable: 'riwayat_pendidikan', parentColumn: 'id' },
  { childTable: 'upk_item',               childColumn: 'transaksi_id',  parentTable: 'upk_transaksi',             parentColumn: 'id' },
]

const STATIC_PK: Map<string, string | null> = new Map([
  ['santri',                   'id'],
  ['riwayat_pendidikan',       'id'],
  ['absen_sakit',              'id'],
  ['pelanggaran',              'id'],
  ['perizinan',                'id'],
  ['spp_log',                  'id'],
  ['spp_setoran_detail',       'id'],
  ['spp_tunggakan_alasan',     'id'],
  ['spp_tunggakan_historis',  'id'],
  ['pembayaran_tahunan',       'id'],
  ['tabungan_log',             'id'],
  ['upk_transaksi',            'id'],
  ['upk_item',                 'id'],
  ['riwayat_surat',            'id'],
  ['hasil_tes_klasifikasi',    'id'],
  ['absen_asrama',             null],
  ['kamar_draft',              'id'],
  ['kamar_ketua',              'id'],
  ['mutasi_asrama_log',        'id'],
  ['perpulangan_log',          'id'],
  ['surat_pernyataan',         'id'],
  ['surat_perjanjian',         'id'],
  ['santri_nonaktif_log',     'id'],
  ['santri_keluar_tandai',    'id'],
  ['denda_buku_pribadi',       'id'],
  ['uang_jajan_auto_rule',     'id'],
  ['uang_jajan_auto_skip',     'id'],
  ['verifikasi_panggilan',     'id'],
  ['verifikasi_panggilan_vonis', 'id'],
  ['psb_flow',                 'id'],
  ['psb_payment_receipt',      'id'],
  ['hafalan_progress',         'id'],
  ['ehb_plotting_santri',      'id'],
  ['ehb_absensi',              'id'],
  ['ehb_absensi_menghafal',    'id'],
  ['absen_malam_v2',           'id'],
  ['absen_berjamaah',          'id'],
  ['upk_antrian',              'id'],
  ['absensi_harian',           'id'],
  ['nilai_akademik',           'id'],
  ['nilai_akhlak',             'id'],
  ['ranking',                  'id'],
  ['nilai_harian_detail',      'id'],
])

async function buildRelatedDeleteStatements(rootSantriId: string) {
  const statements: DeleteStatement[] = []

  function collectChildren(parentTable: string, parentWhereSql: string, parentParams: unknown[], trail: string[]) {
    const parentEdges = STATIC_EDGES.filter(edge => edge.parentTable === parentTable)

    for (const edge of parentEdges) {
      if (trail.includes(edge.childTable)) continue

      const childTableSql = quoteIdentifier(edge.childTable)
      const childColumnSql = quoteIdentifier(edge.childColumn)
      const parentTableSql = quoteIdentifier(parentTable)
      const parentColumnSql = quoteIdentifier(edge.parentColumn)
      const childWhereSql = `${childColumnSql} IN (SELECT ${parentColumnSql} FROM ${parentTableSql} WHERE ${parentWhereSql})`
      const childPk = STATIC_PK.get(edge.childTable) ?? null

      if (childPk) {
        collectChildren(edge.childTable, childWhereSql, parentParams, [...trail, edge.childTable])
      }

      statements.push({
        sql: `DELETE FROM ${childTableSql} WHERE ${childWhereSql}`,
        params: parentParams,
      })
    }
  }

  collectChildren('santri', `${quoteIdentifier('id')} = ?`, [rootSantriId], ['santri'])

  statements.push({
    sql: `DELETE FROM ${quoteIdentifier('santri')} WHERE ${quoteIdentifier('id')} = ?`,
    params: [rootSantriId],
  })

  return statements
}

export async function getSantriDetail(id: string) {
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')
  const data = await queryOne<SantriDetailBase>(`SELECT s.*, ${kategoriEfektifSql} AS kategori_efektif FROM santri s WHERE s.id = ?`, [id])
  if (!data) return null

  const riwayat = await query<RiwayatPendidikanRow>(`
    SELECT rp.id, rp.status_riwayat,
      k.id as kelas_id, k.nama_kelas,
      m.nama as marhalah_nama
    FROM riwayat_pendidikan rp
    LEFT JOIN kelas k ON rp.kelas_id = k.id
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    WHERE rp.santri_id = ?
  `, [id])

  const kelasAktif = riwayat.find(r => r.status_riwayat === 'aktif')
  const infoKelas = kelasAktif?.nama_kelas || 'Belum Masuk Kelas'

  return { ...data, riwayat_pendidikan: riwayat, info_kelas: infoKelas }
}

export async function getRiwayatAkademik(santriId: string) {
  const riwayat = await query<RiwayatAkademikRow>(`
    SELECT rp.id, rp.status_riwayat,
      k.nama_kelas, m.nama as marhalah_nama, ta.nama as tahun_ajaran_nama,
      r.ranking_kelas, r.predikat, r.rata_rata
    FROM riwayat_pendidikan rp
    LEFT JOIN kelas k ON rp.kelas_id = k.id
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN tahun_ajaran ta ON k.tahun_ajaran_id = ta.id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id
    WHERE rp.santri_id = ?
    ORDER BY rp.created_at DESC
  `, [santriId])

  if (!riwayat.length) return []

  // Ambil semua nilai sekaligus — 1 query, bukan N+1
  const riwayatIds = riwayat.map(r => r.id)
  const ph = riwayatIds.map(() => '?').join(',')
  const semuaNilai = await query<NilaiAkademikRow>(`
    SELECT na.riwayat_pendidikan_id, mp.nama as mapel_nama, na.nilai, na.semester
    FROM nilai_akademik na
    LEFT JOIN mapel mp ON na.mapel_id = mp.id
    WHERE na.riwayat_pendidikan_id IN (${ph})
    ORDER BY na.semester
  `, riwayatIds)

  // Group nilai per riwayat_pendidikan_id di memory
  const nilaiByRiwayat = new Map<string, NilaiAkademikRow[]>()
  semuaNilai.forEach(n => {
    if (!nilaiByRiwayat.has(n.riwayat_pendidikan_id)) nilaiByRiwayat.set(n.riwayat_pendidikan_id, [])
    nilaiByRiwayat.get(n.riwayat_pendidikan_id)!.push(n)
  })

  return riwayat.map(r => ({
    ...r,
    nilai_detail: nilaiByRiwayat.get(r.id) ?? [],
  }))
}

export async function getRiwayatPelanggaran(santriId: string) {
  return await query(
    'SELECT id, tanggal, jenis, deskripsi, poin FROM pelanggaran WHERE santri_id = ? ORDER BY tanggal DESC',
    [santriId]
  )
}

export async function getRiwayatPerizinan(santriId: string) {
  return await query(
    'SELECT id, created_at, status, jenis, alasan, tgl_mulai, tgl_selesai_rencana, tgl_kembali_aktual FROM perizinan WHERE santri_id = ? ORDER BY created_at DESC',
    [santriId]
  )
}

export async function getRiwayatSPP(santriId: string) {
  return await query<{
    id: string
    bulan: number
    tahun: number
    nominal_bayar: number
    tanggal_bayar: string
    penerima_nama: string | null
  }>(`
    SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar, penerima_nama
    FROM (
      SELECT sl.id, sl.bulan, sl.tahun, sl.nominal_bayar, sl.tanggal_bayar, u.full_name as penerima_nama
      FROM spp_log sl
      LEFT JOIN users u ON sl.penerima_id = u.id
      WHERE sl.santri_id = ?

      UNION ALL

      SELECT th.id, th.bulan, th.tahun, th.nominal_tagihan AS nominal_bayar,
             COALESCE(th.tanggal_lunas, th.updated_at) AS tanggal_bayar,
             u.full_name as penerima_nama
      FROM spp_tunggakan_historis th
      LEFT JOIN users u ON th.penerima_id = u.id
      WHERE th.santri_id = ? AND th.status = 'LUNAS'
    )
    ORDER BY tahun DESC, bulan DESC
  `, [santriId, santriId])
}

export async function getRiwayatTabungan(santriId: string) {
  return await query(
    'SELECT * FROM tabungan_log WHERE santri_id = ? ORDER BY created_at DESC',
    [santriId]
  )
}

export async function deleteSantri(santriId: string) {
  const session = await getSession()
  if (!hasRole(session, 'admin')) {
    return { error: 'Hanya admin yang boleh menghapus data santri.' }
  }

  const santri = await queryOne<{
    id: string
    nis: string | null
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    status_global: string | null
  }>(
    `SELECT id, nis, nama_lengkap, asrama, kamar, status_global
     FROM santri
     WHERE id = ?`,
    [santriId]
  )

  if (!santri) return { error: 'Data santri tidak ditemukan atau sudah dihapus.' }

  try {
    const statements = await buildRelatedDeleteStatements(santriId)
    await batch(statements)

    await logActivity({
      actor: actorFromSession(session),
      module: 'Data Santri',
      action: 'delete_santri',
      entityType: 'santri',
      entityId: santri.id,
      entityLabel: santri.nama_lengkap,
      summary: `Menghapus data santri ${santri.nama_lengkap}`,
      details: {
        nis: santri.nis,
        asrama: santri.asrama,
        kamar: santri.kamar,
        status_global: santri.status_global,
        related_delete_statements: statements.length - 1,
      },
      fiturHref: '/dashboard/santri',
      logKind: 'delete',
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus santri.'
    await logActivity({
      actor: actorFromSession(session),
      module: 'Data Santri',
      action: 'delete_santri',
      entityType: 'santri',
      entityId: santri.id,
      entityLabel: santri.nama_lengkap,
      summary: `Gagal menghapus data santri ${santri.nama_lengkap}`,
      details: { error: message },
      status: 'failed',
      fiturHref: '/dashboard/santri',
      logKind: 'delete',
    })

    return { error: message }
  }
}
