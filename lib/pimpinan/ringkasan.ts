import { query } from '@/lib/db'
import { currentMonthWib, monthPeriod, pct, safeNumber } from './helpers'
import { getKeuanganMonitoring } from './keuangan'
import { getAbsensiSantriMonitoring, getAbsensiGuruMonitoring } from './absensi'
import { getKesehatanMonitoring } from './kesehatan'
import { getFinanceAlerts } from './keuangan'

export type RingkasanPimpinan = {
  santriAktif: number
  guruTotal: number
  keuangan: {
    totalSaldo: number
    masukBulan: number
    keluarBulan: number
    sppBelumLunas: number
    estimasiSpp: number
  }
  absensi: {
    pctPengajian: number
    pctBerjamaah: number
    pctGuru: number
    alfaPengajian: number
  }
  kesehatan: { sakitHariIni: number }
  cashTrend: Array<{ day: string; masuk: number; keluar: number }>
  alert: Array<{ kind: string; label: string; count: number; amount_rupiah: number }>
}

async function getCashTrend(): Promise<RingkasanPimpinan['cashTrend']> {
  try {
    return await query<{ day: string; masuk: number; keluar: number }>(
      `SELECT day, SUM(masuk) AS masuk, 0 AS keluar FROM (
         SELECT date(tanggal_bayar) AS day, nominal_bayar AS masuk
         FROM spp_log WHERE date(tanggal_bayar) >= date('now', '-29 days')
         UNION ALL
         SELECT date(tanggal_bayar) AS day, nominal_bayar AS masuk
         FROM pembayaran_tahunan
         WHERE date(tanggal_bayar) >= date('now', '-29 days')
           AND COALESCE(status, 'AKTIF') != 'VOID'
       ) GROUP BY day ORDER BY day`
    )
  } catch {
    return []
  }
}

async function getSantriAktifCount(): Promise<number> {
  try {
    const rows = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM santri WHERE status_global = 'aktif'`
    )
    return safeNumber(rows[0]?.total)
  } catch {
    return 0
  }
}

async function getGuruTotalCount(): Promise<number> {
  try {
    const rows = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM data_guru`)
    return safeNumber(rows[0]?.total)
  } catch {
    return 0
  }
}

async function getBerjamaahPct(period: ReturnType<typeof monthPeriod>) {
  try {
    const rows = await query<{ total: number; alfa: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN shubuh = 'A' OR dzuhur = 'A' OR ashar = 'A' OR maghrib = 'A' OR isya = 'A' THEN 1 ELSE 0 END) AS alfa
       FROM absen_berjamaah
       WHERE tanggal BETWEEN ? AND ?`,
      [period.from, period.to]
    )
    const total = safeNumber(rows[0]?.total)
    const alfa = safeNumber(rows[0]?.alfa)
    return pct(total - alfa, total)
  } catch {
    return 0
  }
}

export async function getRingkasanPimpinan(): Promise<RingkasanPimpinan> {
  const period = monthPeriod(currentMonthWib())
  const [santriAktif, guruTotal, keuangan, absensiSantri, absensiGuru, kesehatan, cashTrend, alert, pctBerjamaah] =
    await Promise.all([
      getSantriAktifCount(),
      getGuruTotalCount(),
      getKeuanganMonitoring(),
      getAbsensiSantriMonitoring(),
      getAbsensiGuruMonitoring(),
      getKesehatanMonitoring(),
      getCashTrend(),
      getFinanceAlerts(),
      getBerjamaahPct(period),
    ])

  const alfaPengajian = absensiSantri.pengajian.reduce((sum, row) => sum + row.alfa, 0)
  const izinPengajian = absensiSantri.pengajian.reduce((sum, row) => sum + row.izin, 0)
  const sakitPengajian = absensiSantri.pengajian.reduce((sum, row) => sum + row.sakit, 0)
  const hadirPengajian = Math.max(
    absensiSantri.totalWajibSesi - alfaPengajian - izinPengajian - sakitPengajian,
    0
  )

  const guruHadir = absensiGuru.total.hadir + absensiGuru.total.badal
  const guruTotalSesi = absensiGuru.total.hadir + absensiGuru.total.badal + absensiGuru.total.kosong

  return {
    santriAktif,
    guruTotal,
    keuangan: {
      totalSaldo: keuangan.totalSaldo,
      masukBulan: keuangan.arusKasBulan.masuk,
      keluarBulan: keuangan.arusKasBulan.keluar,
      sppBelumLunas: keuangan.spp.santri_belum_lunas,
      estimasiSpp: keuangan.spp.estimasi_nominal,
    },
    absensi: {
      pctPengajian: pct(hadirPengajian, absensiSantri.totalWajibSesi),
      pctBerjamaah,
      pctGuru: pct(guruHadir, guruTotalSesi),
      alfaPengajian,
    },
    kesehatan: { sakitHariIni: kesehatan.totalSakitHariIni },
    cashTrend,
    alert,
  }
}
