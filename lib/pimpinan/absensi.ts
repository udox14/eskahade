import { query } from '@/lib/db'
import { currentMonthWib, monthPeriod, pct, safeNumber, type MonthPeriod } from './helpers'
import { countActiveSessions, isHoliday, VALID_SESI } from '@/lib/absensi/pengajian'
import { toWibDateInputValue } from '@/lib/date/wib'

export type RingkasanRekap = {
  total: number
  santri: number
}

export type AbsensiSantriMonitoring = {
  period: MonthPeriod
  pengajian: Array<{ asrama: string; alfa: number; izin: number; sakit: number; santri_alfa: number }>
  berjamaah: Array<{ asrama: string; alfa: number; santri: number }>
  malam: Array<{ asrama: string; alfa: number; santri: number }>
  topAlfa: Array<{
    id: string
    nama_lengkap: string
    nis: string | null
    asrama: string | null
    kamar: string | null
    alfa: number
  }>
  totalWajibSesi: number
  totalAlfa: number
}

function monthWhere(asrama: string | undefined) {
  return asrama ? 'AND s.asrama = ?' : ''
}

async function getPengajianRekap(
  period: MonthPeriod,
  asrama?: string
): Promise<AbsensiSantriMonitoring['pengajian']> {
  try {
    const rows = await query<{
      asrama: string
      alfa: number
      izin: number
      sakit: number
      santri_alfa: number
    }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              SUM(CASE WHEN ah.shubuh = 'A' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.ashar = 'A' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.maghrib = 'A' THEN 1 ELSE 0 END) AS alfa,
              SUM(CASE WHEN ah.shubuh = 'I' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.ashar = 'I' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.maghrib = 'I' THEN 1 ELSE 0 END) AS izin,
              SUM(CASE WHEN ah.shubuh = 'S' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.ashar = 'S' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.maghrib = 'S' THEN 1 ELSE 0 END) AS sakit,
              COUNT(DISTINCT CASE WHEN ah.shubuh = 'A' OR ah.ashar = 'A' OR ah.maghrib = 'A' THEN s.id END) AS santri_alfa
       FROM absensi_harian ah
       JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id AND rp.status_riwayat = 'aktif'
       JOIN santri s ON s.id = rp.santri_id
       WHERE ah.tanggal BETWEEN ? AND ?
         ${monthWhere(asrama)}
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY alfa DESC`,
      asrama ? [period.from, period.to, asrama] : [period.from, period.to]
    )
    return rows.map(row => ({
      asrama: row.asrama,
      alfa: safeNumber(row.alfa),
      izin: safeNumber(row.izin),
      sakit: safeNumber(row.sakit),
      santri_alfa: safeNumber(row.santri_alfa),
    }))
  } catch {
    return []
  }
}

async function getBerjamaahRekap(
  period: MonthPeriod,
  asrama?: string
): Promise<AbsensiSantriMonitoring['berjamaah']> {
  try {
    const rows = await query<{ asrama: string; alfa: number; santri: number }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              COUNT(*) AS alfa,
              COUNT(DISTINCT s.id) AS santri
       FROM absen_berjamaah a
       JOIN santri s ON s.id = a.santri_id
       WHERE a.tanggal BETWEEN ? AND ?
         AND (a.shubuh = 'A' OR a.dzuhur = 'A' OR a.ashar = 'A' OR a.maghrib = 'A' OR a.isya = 'A')
         ${monthWhere(asrama)}
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY alfa DESC`,
      asrama ? [period.from, period.to, asrama] : [period.from, period.to]
    )
    return rows.map(row => ({
      asrama: row.asrama,
      alfa: safeNumber(row.alfa),
      santri: safeNumber(row.santri),
    }))
  } catch {
    return []
  }
}

async function getMalamRekap(
  period: MonthPeriod,
  asrama?: string
): Promise<AbsensiSantriMonitoring['malam']> {
  try {
    const rows = await query<{ asrama: string; alfa: number; santri: number }>(
      `SELECT COALESCE(s.asrama, 'Tanpa Asrama') AS asrama,
              COUNT(*) AS alfa,
              COUNT(DISTINCT s.id) AS santri
       FROM absen_malam_v2 a
       JOIN santri s ON s.id = a.santri_id
       WHERE a.tanggal BETWEEN ? AND ?
         AND a.status = 'ALFA'
         ${monthWhere(asrama)}
       GROUP BY COALESCE(s.asrama, 'Tanpa Asrama')
       ORDER BY alfa DESC`,
      asrama ? [period.from, period.to, asrama] : [period.from, period.to]
    )
    return rows.map(row => ({
      asrama: row.asrama,
      alfa: safeNumber(row.alfa),
      santri: safeNumber(row.santri),
    }))
  } catch {
    return []
  }
}

async function getTopAlfa(
  period: MonthPeriod,
  asrama?: string,
  limit = 30
): Promise<AbsensiSantriMonitoring['topAlfa']> {
  try {
    const rows = await query<{
      id: string
      nama_lengkap: string
      nis: string | null
      asrama: string | null
      kamar: string | null
      alfa: number
    }>(
      `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
              SUM(CASE WHEN ah.shubuh = 'A' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.ashar = 'A' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN ah.maghrib = 'A' THEN 1 ELSE 0 END) AS alfa
       FROM absensi_harian ah
       JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id AND rp.status_riwayat = 'aktif'
       JOIN santri s ON s.id = rp.santri_id
       WHERE ah.tanggal BETWEEN ? AND ?
         ${monthWhere(asrama)}
       GROUP BY s.id
       HAVING alfa > 0
       ORDER BY alfa DESC, s.nama_lengkap
       LIMIT ${limit}`,
      asrama ? [period.from, period.to, asrama] : [period.from, period.to]
    )
    return rows.map(row => ({ ...row, alfa: safeNumber(row.alfa) }))
  } catch {
    return []
  }
}

async function getWajibSesi(period: MonthPeriod): Promise<number> {
  try {
    // Tanggal yang belum terjadi tidak dihitung — batasi sampai hari ini (WIB).
    const todayStr = toWibDateInputValue()
    const to = period.to > todayStr ? todayStr : period.to
    const liburList = await query<{ tanggal: string; sesi: string }>(
      `SELECT tanggal, sesi FROM pengajian_libur_sesi WHERE tanggal >= ? AND tanggal <= ?`,
      [period.from, to]
    )
    const liburSet = new Set(
      liburList
        .filter(row => (VALID_SESI as readonly string[]).includes(row.sesi))
        .map(row => `${row.tanggal}-${row.sesi}`)
    )
    return countActiveSessions(period.from, to, liburSet)
  } catch {
    return 0
  }
}

export async function getAbsensiSantriMonitoring(
  input: { month?: string; asrama?: string } = {}
): Promise<AbsensiSantriMonitoring> {
  const period = monthPeriod(input.month || currentMonthWib())
  const asrama = input.asrama?.trim() || undefined

  const [pengajian, berjamaah, malam, topAlfa, totalWajibSesi] =
    await Promise.all([
      getPengajianRekap(period, asrama),
      getBerjamaahRekap(period, asrama),
      getMalamRekap(period, asrama),
      getTopAlfa(period, asrama),
      getWajibSesi(period),
    ])

  const totalAlfa = pengajian.reduce((sum, row) => sum + row.alfa, 0)

  return {
    period,
    pengajian,
    berjamaah,
    malam,
    topAlfa,
    totalWajibSesi,
    totalAlfa,
  }
}

export type AbsensiGuruMonitoring = {
  from: string
  to: string
  totalGuru: number
  breakdown: Array<{
    nama: string
    hadir: number
    badal: number
    kosong: number
    libur: number
    total: number
    persentase: number
  }>
  total: { hadir: number; badal: number; kosong: number; libur: number }
}

export async function getAbsensiGuruMonitoring(
  input: { from?: string; to?: string } = {}
): Promise<AbsensiGuruMonitoring> {
  const period = monthPeriod()
  const from = input.from || period.from
  const to = input.to || period.to

  try {
    const [rows, guruCount] = await Promise.all([
      query<{ nama: string; status: string; total: number }>(
        `SELECT nama, status, COUNT(*) AS total
         FROM (
           SELECT COALESCE(NULLIF(TRIM(guru_shubuh_nama_snapshot), ''), 'Guru tidak terisi') AS nama,
                  shubuh AS status
           FROM absensi_guru
           WHERE tanggal BETWEEN ? AND ? AND shubuh IN ('H','A','B','L')
           UNION ALL
           SELECT COALESCE(NULLIF(TRIM(guru_ashar_nama_snapshot), ''), 'Guru tidak terisi'),
                  ashar
           FROM absensi_guru
           WHERE tanggal BETWEEN ? AND ? AND ashar IN ('H','A','B','L')
           UNION ALL
           SELECT COALESCE(NULLIF(TRIM(guru_maghrib_nama_snapshot), ''), 'Guru tidak terisi'),
                  maghrib
           FROM absensi_guru
           WHERE tanggal BETWEEN ? AND ? AND maghrib IN ('H','A','B','L')
         )
         GROUP BY nama, status
         ORDER BY nama, status`,
        [from, to, from, to, from, to]
      ),
      query<{ total: number }>('SELECT COUNT(*) AS total FROM data_guru'),
    ])

    const map = new Map<string, { hadir: number; badal: number; kosong: number; libur: number }>()
    for (const row of rows) {
      if (!map.has(row.nama)) map.set(row.nama, { hadir: 0, badal: 0, kosong: 0, libur: 0 })
      const stat = map.get(row.nama)!
      const total = safeNumber(row.total)
      if (row.status === 'H') stat.hadir += total
      else if (row.status === 'B') stat.badal += total
      else if (row.status === 'A') stat.kosong += total
      else if (row.status === 'L') stat.libur += total
    }

    const breakdown = Array.from(map.entries())
      .map(([nama, stat]) => {
        const total = stat.hadir + stat.badal + stat.kosong + stat.libur
        const hadir = stat.hadir + stat.badal
        return {
          nama,
          ...stat,
          total,
          persentase: pct(hadir, total),
        }
      })
      .sort((a, b) => a.persentase - b.persentase || a.nama.localeCompare(b.nama))

    return {
      from,
      to,
      totalGuru: safeNumber(guruCount[0]?.total),
      breakdown,
      total: breakdown.reduce(
        (acc, row) => ({
          hadir: acc.hadir + row.hadir,
          badal: acc.badal + row.badal,
          kosong: acc.kosong + row.kosong,
          libur: acc.libur + row.libur,
        }),
        { hadir: 0, badal: 0, kosong: 0, libur: 0 }
      ),
    }
  } catch {
    return { from, to, totalGuru: 0, breakdown: [], total: { hadir: 0, badal: 0, kosong: 0, libur: 0 } }
  }
}

export { isHoliday }
