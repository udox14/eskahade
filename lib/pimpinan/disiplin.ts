import { query } from '@/lib/db'
import { currentMonthWib, monthPeriod, safeNumber, type MonthPeriod } from './helpers'

export type DisiplinMonitoring = {
  period: MonthPeriod
  perAsrama: Array<{
    asrama: string
    total: number
    santri: number
    pending: number
  }>
  perJenis: Array<{ jenis: string; total: number; pending: number }>
  suratPerjanjian: Array<{ level: string; total: number }>
  total: { total: number; santri: number; pending: number }
}

async function getPerAsrama(period: MonthPeriod): Promise<DisiplinMonitoring['perAsrama']> {
  try {
    const rows = await query<{ asrama: string; total: number; santri: number; pending: number }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              SUM(p.jumlah_kejadian) AS total,
              COUNT(DISTINCT p.santri_id) AS santri,
              0 AS pending
       FROM discipline_incidents p
       JOIN santri s ON s.id = p.santri_id
       WHERE p.status='active' AND substr(p.tanggal,1,10) BETWEEN substr(?,1,10) AND substr(?,1,10)
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY total DESC`,
      [period.from, period.to]
    )
    return rows.map(row => ({
      asrama: row.asrama,
      total: safeNumber(row.total),
      santri: safeNumber(row.santri),
      pending: safeNumber(row.pending),
    }))
  } catch (error) {
    throw error
  }
}

async function getPerJenis(period: MonthPeriod): Promise<DisiplinMonitoring['perJenis']> {
  try {
    const rows = await query<{ jenis: string; total: number; pending: number }>(
      `SELECT COALESCE(NULLIF(TRIM(mp.nama_pelanggaran), ''), p.jenis) AS jenis,
              SUM(p.jumlah_kejadian) AS total,
              0 AS pending
       FROM discipline_incidents p
       LEFT JOIN master_pelanggaran mp ON mp.id = p.master_id
       WHERE p.status='active' AND substr(p.tanggal,1,10) BETWEEN substr(?,1,10) AND substr(?,1,10)
       GROUP BY COALESCE(NULLIF(TRIM(mp.nama_pelanggaran), ''), p.jenis)
       ORDER BY total DESC
       LIMIT 15`,
      [period.from, period.to]
    )
    return rows.map(row => ({
      jenis: row.jenis || 'Lainnya',
      total: safeNumber(row.total),
      pending: safeNumber(row.pending),
    }))
  } catch (error) {
    throw error
  }
}

async function getSuratPerjanjian(): Promise<Array<{ level: string; total: number }>> {
  try {
    const rows = await query<{ level: string; total: number }>(
      `SELECT COALESCE(level, '-') AS level, COUNT(*) AS total
       FROM surat_perjanjian
       GROUP BY COALESCE(level, '-')
       ORDER BY level`
    )
    return rows.map(row => ({ level: row.level, total: safeNumber(row.total) }))
  } catch (error) {
    throw error
  }
}

export async function getDisiplinMonitoring(
  input: { month?: string } = {}
): Promise<DisiplinMonitoring> {
  const period = monthPeriod(input.month || currentMonthWib())
  const [perAsrama, perJenis, suratPerjanjian] = await Promise.all([
    getPerAsrama(period),
    getPerJenis(period),
    getSuratPerjanjian(),
  ])

  return {
    period,
    perAsrama,
    perJenis,
    suratPerjanjian,
    total: {
      total: perAsrama.reduce((sum, row) => sum + row.total, 0),
      santri: perAsrama.reduce((sum, row) => sum + row.santri, 0),
      pending: await getPending(),
    },
  }
}

async function getPending() {
  const row=await query<{n:number}>("SELECT COALESCE(SUM(perlu_verifikasi),0) n FROM discipline_incidents WHERE status='active'")
  return row[0]?.n??0
}
