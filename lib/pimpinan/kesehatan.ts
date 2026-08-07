import { query } from '@/lib/db'
import { currentMonthWib, monthPeriod, safeNumber, todayWib, type MonthPeriod } from './helpers'

export type KesehatanMonitoring = {
  period: MonthPeriod
  sakitHariIni: Array<{ asrama: string; aktif: number }>
  totalSakitHariIni: number
  sakitBulan: Array<{
    asrama: string
    total: number
    santri: number
    beli_surat: number
  }>
  totalSakitBulan: number
  poskestren: {
    kunjungan: number
    pasien: number
    dirujuk: number
  }
}

async function getSakitHariIni(): Promise<Array<{ asrama: string; aktif: number }>> {
  try {
    const rows = await query<{ asrama: string; aktif: number }>(
      `WITH latest AS (
         SELECT COALESCE(episode_id, id) AS episode_key, MAX(created_at) AS max_created_at
         FROM absen_sakit
         GROUP BY COALESCE(episode_id, id)
       ),
       closed AS (
         SELECT DISTINCT COALESCE(episode_id, id) AS episode_key
         FROM absen_sakit
         WHERE status_sakit = 'SEMBUH' OR sembuh_at IS NOT NULL
       )
       SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              COUNT(DISTINCT COALESCE(ab.episode_id, ab.id)) AS aktif
       FROM absen_sakit ab
       JOIN latest l ON l.episode_key = COALESCE(ab.episode_id, ab.id) AND l.max_created_at = ab.created_at
       JOIN santri s ON s.id = ab.santri_id
       LEFT JOIN closed c ON c.episode_key = COALESCE(ab.episode_id, ab.id)
       WHERE c.episode_key IS NULL
         AND ab.tanggal <= ?
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY aktif DESC`,
      [todayWib()]
    )
    return rows.map(row => ({ asrama: row.asrama, aktif: safeNumber(row.aktif) }))
  } catch {
    return []
  }
}

async function getSakitBulan(
  period: MonthPeriod
): Promise<Array<{ asrama: string; total: number; santri: number; beli_surat: number }>> {
  try {
    const rows = await query<{
      asrama: string
      total: number
      santri: number
      beli_surat: number
    }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              COUNT(*) AS total,
              COUNT(DISTINCT s.id) AS santri,
              SUM(CASE WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN 1 ELSE 0 END) AS beli_surat
       FROM absen_sakit ab
       JOIN santri s ON s.id = ab.santri_id
       WHERE ab.tanggal BETWEEN ? AND ?
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY total DESC`,
      [period.from, period.to]
    )
    return rows.map(row => ({
      asrama: row.asrama,
      total: safeNumber(row.total),
      santri: safeNumber(row.santri),
      beli_surat: safeNumber(row.beli_surat),
    }))
  } catch {
    return []
  }
}

async function getPoskestren(period: MonthPeriod): Promise<KesehatanMonitoring['poskestren']> {
  try {
    const rows = await query<{ kunjungan: number; pasien: number; dirujuk: number }>(
      `SELECT COUNT(*) AS kunjungan,
              COUNT(DISTINCT p.santri_id) AS pasien,
              COUNT(CASE WHEN v.status = 'DIRUJUK' THEN 1 END) AS dirujuk
       FROM poskestren_visit v
       JOIN poskestren_patient p ON p.id = v.patient_id
       WHERE v.queue_date BETWEEN ? AND ?`,
      [period.from, period.to]
    )
    return {
      kunjungan: safeNumber(rows[0]?.kunjungan),
      pasien: safeNumber(rows[0]?.pasien),
      dirujuk: safeNumber(rows[0]?.dirujuk),
    }
  } catch {
    return { kunjungan: 0, pasien: 0, dirujuk: 0 }
  }
}

export async function getKesehatanMonitoring(
  input: { month?: string } = {}
): Promise<KesehatanMonitoring> {
  const period = monthPeriod(input.month || currentMonthWib())
  const [sakitHariIni, sakitBulan, poskestren] = await Promise.all([
    getSakitHariIni(),
    getSakitBulan(period),
    getPoskestren(period),
  ])

  return {
    period,
    sakitHariIni,
    totalSakitHariIni: sakitHariIni.reduce((sum, row) => sum + row.aktif, 0),
    sakitBulan,
    totalSakitBulan: sakitBulan.reduce((sum, row) => sum + row.total, 0),
    poskestren,
  }
}
