import { query } from '@/lib/db'
import { currentMonthWib, monthPeriod, safeNumber, type MonthPeriod } from './helpers'

export type KeuanganMonitoring = {
  period: MonthPeriod
  saldoAkun: Array<{ code: string; name: string; balance_rupiah: number }>
  totalSaldo: number
  arusKasBulan: { masuk: number; keluar: number; selisih: number }
  alert: Array<{ kind: string; label: string; count: number; amount_rupiah: number }>
  spp: {
    santri_belum_lunas: number
    estimasi_nominal: number
    nominal_spp: number
    transaksi_bulan: number
    total_bayar_bulan: number
  }
  psbBulan: { transaksi: number; total_bayar: number }
}

async function getSaldoAkun(): Promise<Array<{ code: string; name: string; balance_rupiah: number }>> {
  return []
}

async function getArusKas(period: MonthPeriod): Promise<{ masuk: number; keluar: number; selisih: number }> {
  try {
    const rows = await query<{ masuk: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS masuk FROM (
         SELECT nominal_bayar AS amount FROM spp_log WHERE date(tanggal_bayar) BETWEEN ? AND ?
         UNION ALL
         SELECT nominal_bayar AS amount FROM pembayaran_tahunan
         WHERE date(tanggal_bayar) BETWEEN ? AND ? AND COALESCE(status, 'AKTIF') != 'VOID'
       )`,
      [period.from, period.to, period.from, period.to]
    )
    const masuk = safeNumber(rows[0]?.masuk)
    return { masuk, keluar: 0, selisih: masuk }
  } catch {
    return { masuk: 0, keluar: 0, selisih: 0 }
  }
}

export async function getFinanceAlerts(): Promise<KeuanganMonitoring['alert']> {
  return []
}

async function getSppBulan(period: MonthPeriod): Promise<KeuanganMonitoring['spp']> {
  try {
    const [belumRows, bayarRows, nominalRows] = await Promise.all([
      query<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM santri s
         WHERE s.status_global = 'aktif'
           AND COALESCE(s.bebas_spp, 0) = 0
           AND NOT EXISTS (
             SELECT 1 FROM spp_log sl
             WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM spp_tagihan_ditiadakan w
             WHERE w.santri_id = s.id AND w.tahun = ? AND w.bulan = ? AND w.is_active = 1
           )
           AND (s.tanggal_masuk IS NULL OR s.tanggal_masuk <= ?)`,
        [period.year, period.monthNum, period.year, period.monthNum, period.to]
      ),
      query<{ transaksi: number; total_bayar: number }>(
        `SELECT COUNT(*) AS transaksi, COALESCE(SUM(nominal_bayar), 0) AS total_bayar
         FROM spp_log
         WHERE tahun = ? AND bulan = ?`,
        [period.year, period.monthNum]
      ),
      query<{ nominal: number }>(
        `SELECT nominal FROM spp_settings
         WHERE tahun_kalender = ? AND is_active = 1
         ORDER BY id DESC LIMIT 1`,
        [period.year]
      ),
    ])
    const belum = safeNumber(belumRows[0]?.total)
    const nominalSpp = safeNumber(nominalRows[0]?.nominal) || 70000
    return {
      santri_belum_lunas: belum,
      estimasi_nominal: belum * nominalSpp,
      nominal_spp: nominalSpp,
      transaksi_bulan: safeNumber(bayarRows[0]?.transaksi),
      total_bayar_bulan: safeNumber(bayarRows[0]?.total_bayar),
    }
  } catch {
    return {
      santri_belum_lunas: 0,
      estimasi_nominal: 0,
      nominal_spp: 0,
      transaksi_bulan: 0,
      total_bayar_bulan: 0,
    }
  }
}

async function getPsbBulan(period: MonthPeriod): Promise<KeuanganMonitoring['psbBulan']> {
  try {
    const rows = await query<{ transaksi: number; total_bayar: number }>(
      `SELECT COUNT(*) AS transaksi, COALESCE(SUM(nominal_bayar), 0) AS total_bayar
       FROM pembayaran_tahunan
       WHERE date(tanggal_bayar) BETWEEN ? AND ?
         AND COALESCE(status, 'AKTIF') != 'VOID'`,
      [period.from, period.to]
    )
    return {
      transaksi: safeNumber(rows[0]?.transaksi),
      total_bayar: safeNumber(rows[0]?.total_bayar),
    }
  } catch {
    return { transaksi: 0, total_bayar: 0 }
  }
}

export async function getKeuanganMonitoring(
  input: { month?: string } = {}
): Promise<KeuanganMonitoring> {
  const period = monthPeriod(input.month || currentMonthWib())
  const [saldoAkun, arusKasBulan, alert, spp, psbBulan] = await Promise.all([
    getSaldoAkun(),
    getArusKas(period),
    getFinanceAlerts(),
    getSppBulan(period),
    getPsbBulan(period),
  ])

  const totalSaldo = saldoAkun.reduce((sum, row) => sum + safeNumber(row.balance_rupiah), 0)

  return {
    period,
    saldoAkun,
    totalSaldo,
    arusKasBulan,
    alert,
    spp,
    psbBulan,
  }
}
