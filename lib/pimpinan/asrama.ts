import { query } from '@/lib/db'
import { currentMonthWib, monthPeriod, safeNumber, type MonthPeriod } from './helpers'

export type AsramaMonitoring = {
  period: MonthPeriod
  perAsrama: Array<{
    asrama: string
    total_santri: number
    kamar_terisi: number
    izin_bulan: number
    izin_aktif: number
    telat_kembali: number
    total_perpulangan: number
    sudah_pulang: number
    sudah_datang: number
  }>
  perizinan: {
    total: number
    pulang: number
    keluar: number
    aktif: number
    tepat: number
    telat: number
  }
  perpulangan: Array<{
    asrama: string
    total: number
    sudah_pulang: number
    sudah_datang: number
  }>
}

async function getKamarTerisi(): Promise<Array<{ asrama: string; kamar_terisi: number }>> {
  try {
    return await query<{ asrama: string; kamar_terisi: number }>(
      `SELECT COALESCE(asrama, 'Tanpa Asrama') AS asrama,
              COUNT(DISTINCT kamar) AS kamar_terisi
       FROM santri
       WHERE status_global = 'aktif' AND kamar IS NOT NULL AND kamar != ''
       GROUP BY COALESCE(asrama, 'Tanpa Asrama')`
    )
  } catch {
    return []
  }
}

async function getPerizinan(period: MonthPeriod): Promise<AsramaMonitoring['perizinan']> {
  try {
    const rows = await query<{
      total: number
      pulang: number
      keluar: number
      aktif: number
      tepat: number
      telat: number
    }>(
      `SELECT COUNT(p.id) AS total,
              SUM(CASE WHEN p.jenis = 'PULANG' THEN 1 ELSE 0 END) AS pulang,
              SUM(CASE WHEN p.jenis = 'KELUAR_KOMPLEK' THEN 1 ELSE 0 END) AS keluar,
              SUM(CASE WHEN p.status = 'AKTIF' THEN 1 ELSE 0 END) AS aktif,
              SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana THEN 1 ELSE 0 END) AS tepat,
              SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) AS telat
       FROM perizinan p
       JOIN santri s ON s.id = p.santri_id
       WHERE date(p.tgl_mulai) BETWEEN ? AND ?`,
      [period.from, period.to]
    )
    const row = rows[0]
    return {
      total: safeNumber(row?.total),
      pulang: safeNumber(row?.pulang),
      keluar: safeNumber(row?.keluar),
      aktif: safeNumber(row?.aktif),
      tepat: safeNumber(row?.tepat),
      telat: safeNumber(row?.telat),
    }
  } catch {
    return { total: 0, pulang: 0, keluar: 0, aktif: 0, tepat: 0, telat: 0 }
  }
}

async function getPerpulangan(): Promise<AsramaMonitoring['perpulangan']> {
  try {
    const periodeRows = await query<{ periode_id: string }>(
      `SELECT periode_id
       FROM perpulangan_log
       GROUP BY periode_id
       ORDER BY MAX(rowid) DESC
       LIMIT 1`
    )
    const periodeId = periodeRows[0]?.periode_id
    if (!periodeId) return []

    return await query<{ asrama: string; total: number; sudah_pulang: number; sudah_datang: number }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              COUNT(*) AS total,
              SUM(CASE WHEN pl.status_pulang = 'PULANG' THEN 1 ELSE 0 END) AS sudah_pulang,
              SUM(CASE WHEN pl.status_datang = 'SUDAH' THEN 1 ELSE 0 END) AS sudah_datang
       FROM perpulangan_log pl
       JOIN santri s ON s.id = pl.santri_id
       WHERE pl.periode_id = ?
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY total DESC`,
      [periodeId]
    )
  } catch {
    return []
  }
}

async function getIzinPerAsrama(
  period: MonthPeriod
): Promise<Array<{ asrama: string; izin_bulan: number; izin_aktif: number; telat_kembali: number }>> {
  try {
    return await query<{ asrama: string; izin_bulan: number; izin_aktif: number; telat_kembali: number }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              COUNT(p.id) AS izin_bulan,
              SUM(CASE WHEN p.status = 'AKTIF' THEN 1 ELSE 0 END) AS izin_aktif,
              SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) AS telat_kembali
       FROM perizinan p
       JOIN santri s ON s.id = p.santri_id
       WHERE date(p.tgl_mulai) BETWEEN ? AND ?
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY izin_bulan DESC`,
      [period.from, period.to]
    )
  } catch {
    return []
  }
}

export async function getAsramaMonitoring(
  input: { month?: string } = {}
): Promise<AsramaMonitoring> {
  const period = monthPeriod(input.month || currentMonthWib())
  const [santriRows, kamarRows, izinRows, perizinan, perpulangan] = await Promise.all([
    query<{ asrama: string; total: number }>(
      `SELECT COALESCE(asrama, 'Tanpa Asrama') AS asrama, COUNT(*) AS total
       FROM santri
       WHERE status_global = 'aktif'
       GROUP BY COALESCE(asrama, 'Tanpa Asrama')`
    ),
    getKamarTerisi(),
    getIzinPerAsrama(period),
    getPerizinan(period),
    getPerpulangan(),
  ])

  const kamarMap = new Map(kamarRows.map(row => [row.asrama, safeNumber(row.kamar_terisi)]))
  const izinMap = new Map(izinRows.map(row => [row.asrama, row]))
  const perpulanganMap = new Map(perpulangan.map(row => [row.asrama, row]))

  const perAsrama = santriRows
    .map(row => {
      const izin = izinMap.get(row.asrama)
      const pulang = perpulanganMap.get(row.asrama)
      return {
        asrama: row.asrama,
        total_santri: safeNumber(row.total),
        kamar_terisi: kamarMap.get(row.asrama) ?? 0,
        izin_bulan: safeNumber(izin?.izin_bulan),
        izin_aktif: safeNumber(izin?.izin_aktif),
        telat_kembali: safeNumber(izin?.telat_kembali),
        total_perpulangan: safeNumber(pulang?.total),
        sudah_pulang: safeNumber(pulang?.sudah_pulang),
        sudah_datang: safeNumber(pulang?.sudah_datang),
      }
    })
    .sort((a, b) => a.asrama.localeCompare(b.asrama))

  return { period, perAsrama, perizinan, perpulangan }
}
