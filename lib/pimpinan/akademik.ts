import { query } from '@/lib/db'
import { getActiveTahunAjaran, safeNumber } from './helpers'

export type AkademikMonitoring = {
  perMarhalah: Array<{
    marhalah: string
    kelas: number
    santri: number
    rata_rata: number
  }>
  ranking: Array<{
    kelas: string
    marhalah: string
    rank1: { nama: string; rata: number } | null
    rank2: { nama: string; rata: number } | null
    rank3: { nama: string; rata: number } | null
  }>
  semester: number | null
}

async function getLatestSemester(): Promise<number | null> {
  try {
    const rows = await query<{ semester: number }>(
      'SELECT MAX(semester) AS semester FROM ranking'
    )
    const semester = rows[0]?.semester
    return semester == null ? null : Number(semester)
  } catch {
    return null
  }
}

async function getPerMarhalah(tahunAjaranId?: number | null): Promise<AkademikMonitoring['perMarhalah']> {
  const taFilter = tahunAjaranId
    ? `AND k.tahun_ajaran_id = ${Number(tahunAjaranId)}`
    : `AND k.tahun_ajaran_id = (SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1)`

  try {
    const rows = await query<{ marhalah: string; kelas: number; santri: number }>(
      `SELECT COALESCE(m.nama, 'Tanpa Marhalah') AS marhalah,
              COUNT(DISTINCT k.id) AS kelas,
              COUNT(DISTINCT CASE WHEN s.status_global = 'aktif' THEN rp.santri_id END) AS santri
       FROM marhalah m
       LEFT JOIN kelas k ON k.marhalah_id = m.id ${taFilter}
       LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN santri s ON s.id = rp.santri_id
       GROUP BY m.id
       ORDER BY m.urutan`
    )
    return rows.map(row => ({
      marhalah: row.marhalah,
      kelas: safeNumber(row.kelas),
      santri: safeNumber(row.santri),
      rata_rata: 0,
    }))
  } catch {
    return []
  }
}

async function getRataRata(
  rows: AkademikMonitoring['perMarhalah']
): Promise<AkademikMonitoring['perMarhalah']> {
  try {
    const semester = await getLatestSemester()
    if (semester == null) return rows
    const avgRows = await query<{ marhalah: string; rata_rata: number }>(
      `SELECT COALESCE(m.nama, 'Tanpa Marhalah') AS marhalah,
              ROUND(AVG(n.nilai), 1) AS rata_rata
       FROM nilai_akademik n
       JOIN riwayat_pendidikan rp ON rp.id = n.riwayat_pendidikan_id AND rp.status_riwayat = 'aktif'
       JOIN kelas k ON k.id = rp.kelas_id
       JOIN marhalah m ON m.id = k.marhalah_id
       WHERE n.semester = ?
       GROUP BY m.id`,
      [semester]
    )
    const avgMap = new Map(avgRows.map(row => [row.marhalah, safeNumber(row.rata_rata)]))
    return rows.map(row => ({ ...row, rata_rata: avgMap.get(row.marhalah) ?? 0 }))
  } catch {
    return rows
  }
}

async function getRanking(semester: number | null): Promise<AkademikMonitoring['ranking']> {
  if (semester == null) return []
  try {
    const rows = await query<{
      kelas_id: number
      kelas: string
      marhalah: string
      ranking_kelas: number
      nama_lengkap: string
      rata_rata: number
    }>(
      `SELECT k.id AS kelas_id,
              k.nama_kelas AS kelas,
              COALESCE(m.nama, '-') AS marhalah,
              r.ranking_kelas,
              s.nama_lengkap,
              COALESCE(r.rata_rata, 0) AS rata_rata
       FROM ranking r
       JOIN riwayat_pendidikan rp ON rp.id = r.riwayat_pendidikan_id
       JOIN kelas k ON k.id = rp.kelas_id
       JOIN marhalah m ON m.id = k.marhalah_id
       JOIN santri s ON s.id = rp.santri_id
       WHERE r.semester = ? AND r.ranking_kelas BETWEEN 1 AND 3
       ORDER BY k.nama_kelas, r.ranking_kelas`,
      [semester]
    )

    const map = new Map<
      string,
      AkademikMonitoring['ranking'][number]
    >()
    for (const row of rows) {
      const key = String(row.kelas_id)
      if (!map.has(key)) {
        map.set(key, {
          kelas: row.kelas,
          marhalah: row.marhalah,
          rank1: null,
          rank2: null,
          rank3: null,
        })
      }
      const entry = map.get(key)!
      const item = { nama: row.nama_lengkap, rata: safeNumber(row.rata_rata) }
      if (row.ranking_kelas === 1) entry.rank1 = item
      else if (row.ranking_kelas === 2) entry.rank2 = item
      else if (row.ranking_kelas === 3) entry.rank3 = item
    }

    return Array.from(map.values()).sort((a, b) => a.kelas.localeCompare(b.kelas, undefined, {
      numeric: true,
      sensitivity: 'base',
    }))
  } catch {
    return []
  }
}

export async function getAkademikMonitoring(
  input: { tahunAjaranId?: number | null } = {}
): Promise<AkademikMonitoring> {
  const active = await getActiveTahunAjaran()
  const tahunAjaranId = input.tahunAjaranId ?? (active?.id != null ? Number(active.id) : null)
  const semester = await getLatestSemester()

  const [perMarhalah, ranking] = await Promise.all([
    getRataRata(await getPerMarhalah(tahunAjaranId)),
    getRanking(semester),
  ])

  return { perMarhalah, ranking, semester }
}
