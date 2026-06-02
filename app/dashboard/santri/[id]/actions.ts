'use server'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { batch, query, queryOne } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'

type ForeignKeyRow = {
  table: string
  from: string
  to: string | null
}

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

async function getTablePrimaryKey(tableName: string) {
  const columns = await query<{ name: string; pk: number }>(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
  const pkColumns = columns
    .filter(column => column.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map(column => column.name)

  return pkColumns.length === 1 ? pkColumns[0] : null
}

async function getSantriForeignKeyEdges() {
  const tables = await query<{ name: string }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'`
  )

  const edges: ForeignKeyEdge[] = []

  for (const { name } of tables) {
    const foreignKeys = await query<ForeignKeyRow>(`PRAGMA foreign_key_list(${quoteIdentifier(name)})`)
    for (const foreignKey of foreignKeys) {
      if (!foreignKey.table || !foreignKey.from) continue
      edges.push({
        childTable: name,
        childColumn: foreignKey.from,
        parentTable: foreignKey.table,
        parentColumn: foreignKey.to || 'id',
      })
    }
  }

  return edges
}

async function buildRelatedDeleteStatements(rootSantriId: string) {
  const edges = await getSantriForeignKeyEdges()
  const primaryKeyCache = new Map<string, string | null>()
  const statements: DeleteStatement[] = []

  async function primaryKey(tableName: string) {
    if (!primaryKeyCache.has(tableName)) {
      primaryKeyCache.set(tableName, await getTablePrimaryKey(tableName))
    }
    return primaryKeyCache.get(tableName) ?? null
  }

  async function collectChildren(parentTable: string, parentWhereSql: string, parentParams: unknown[], trail: string[]) {
    const parentEdges = edges.filter(edge => edge.parentTable === parentTable)

    for (const edge of parentEdges) {
      if (trail.includes(edge.childTable)) continue

      const childTableSql = quoteIdentifier(edge.childTable)
      const childColumnSql = quoteIdentifier(edge.childColumn)
      const parentTableSql = quoteIdentifier(parentTable)
      const parentColumnSql = quoteIdentifier(edge.parentColumn)
      const childWhereSql = `${childColumnSql} IN (SELECT ${parentColumnSql} FROM ${parentTableSql} WHERE ${parentWhereSql})`
      const childPk = await primaryKey(edge.childTable)

      if (childPk) {
        await collectChildren(edge.childTable, childWhereSql, parentParams, [...trail, edge.childTable])
      }

      statements.push({
        sql: `DELETE FROM ${childTableSql} WHERE ${childWhereSql}`,
        params: parentParams,
      })
    }
  }

  await collectChildren('santri', `${quoteIdentifier('id')} = ?`, [rootSantriId], ['santri'])

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
