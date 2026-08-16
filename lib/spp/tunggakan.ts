import { query, queryOne } from '@/lib/db'

export const BULAN_SPP = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

export type SppBillingStart = {
  tahun: number
  bulan: number
  value: string
}

export type SppStudentEnrollmentDates = {
  tanggal_masuk?: unknown
  created_at?: unknown
}

export type SppTunggakanItem = {
  source: 'BERJALAN' | 'HISTORIS'
  id: string | null
  tahun: number
  bulan: number
  nama_bulan: string
  label: string
  nominal: number
}

export type SppTunggakanSummary = {
  adaTunggakan: boolean
  items: SppTunggakanItem[]
  berjalan: SppTunggakanItem[]
  historis: SppTunggakanItem[]
  totalBulan: number
  total: number
  totalBerjalan: number
  totalHistoris: number
  listBulan: string
  tahun: number
}

export function periodKey(tahun: number, bulan: number) {
  return tahun * 100 + bulan
}

function parseDatePeriod(value: unknown): number | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const tahun = Number(match[1])
  const bulan = Number(match[2])
  const hari = Number(match[3])
  if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || !Number.isInteger(hari)) return null
  if (tahun < 1 || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null
  return periodKey(tahun, bulan)
}

/**
 * Awal tagihan efektif untuk satu santri.
 *
 * `created_at` ikut dipakai sebagai batas bawah supaya data yang diinput
 * setelah tanggal masuk (termasuk tanggal masuk default 1 Januari) tidak
 * otomatis menarik tagihan ke bulan-bulan sebelum santri dicatat di aplikasi.
 */
export function getSppStudentBillingStart(
  dates: SppStudentEnrollmentDates,
  billingStart: Pick<SppBillingStart, 'tahun' | 'bulan'>,
): SppBillingStart {
  const candidateKeys = [
    periodKey(billingStart.tahun, billingStart.bulan),
    parseDatePeriod(dates.tanggal_masuk),
    parseDatePeriod(dates.created_at),
  ].filter((key): key is number => key !== null)
  const effectiveKey = Math.max(...candidateKeys)
  const tahun = Math.floor(effectiveKey / 100)
  const bulan = effectiveKey % 100

  return {
    tahun,
    bulan,
    value: `${tahun}-${String(bulan).padStart(2, '0')}`,
  }
}

export function isSppBillablePeriod(
  tahun: number,
  bulan: number,
  billingStart: Pick<SppBillingStart, 'tahun' | 'bulan'>,
) {
  return periodKey(tahun, bulan) >= periodKey(billingStart.tahun, billingStart.bulan)
}

export function countSppBillableMonths(
  billingStart: Pick<SppBillingStart, 'tahun' | 'bulan'>,
  endTahun: number,
  endBulan: number,
) {
  const startKey = periodKey(billingStart.tahun, billingStart.bulan)
  const endKey = periodKey(endTahun, endBulan)
  if (endKey < startKey) return 0
  return (endTahun - billingStart.tahun) * 12 + (endBulan - billingStart.bulan) + 1
}

/**
 * SQL expression equivalent to getSppStudentBillingStart().
 * Only used with trusted table aliases from this codebase.
 */
export function getSppStudentStartKeySql(alias: string, billingStartKey: number) {
  const datePeriod = (column: string) => `CASE
    WHEN ${alias}.${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-*'
      AND CAST(substr(${alias}.${column}, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    THEN CAST(substr(${alias}.${column}, 1, 4) AS INTEGER) * 100
       + CAST(substr(${alias}.${column}, 6, 2) AS INTEGER)
    ELSE 0
  END`

  return `MAX(${billingStartKey}, ${datePeriod('tanggal_masuk')}, ${datePeriod('created_at')})`
}

export function monthLabel(tahun: number, bulan: number) {
  return `${BULAN_SPP[bulan - 1] ?? `Bulan ${bulan}`} ${tahun}`
}

export async function getSppBillingStartSetting(): Promise<SppBillingStart> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'spp_tagihan_mulai'`
  )
  const value = row?.value ?? '2026-06'
  const [tahunMulai, bulanMulai] = value.split('-').map(Number)
  return {
    tahun: Number.isFinite(tahunMulai) ? tahunMulai : 2026,
    bulan: Number.isFinite(bulanMulai) ? bulanMulai : 1,
    value,
  }
}

export async function getNominalSppForYear(tahun: number) {
  const row = await queryOne<{ nominal: number }>(
    `SELECT nominal FROM spp_settings
     WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,
    [tahun]
  )
  return row?.nominal ?? 70000
}

export async function getTunggakanSppSantri(santriId: string, asOf = new Date()): Promise<SppTunggakanSummary> {
  const currentYear = asOf.getFullYear()
  const currentMonth = asOf.getMonth() + 1
  const billingStart = await getSppBillingStartSetting()
  const endKey = periodKey(currentYear, currentMonth)

  const santri = await queryOne<{
    bebas_spp: number | null
    tanggal_masuk: string | null
    created_at: string | null
  }>(
    `SELECT COALESCE(bebas_spp, 0) AS bebas_spp,
            tanggal_masuk, created_at
      FROM santri
      WHERE id = ?`,
    [santriId]
  )

  const studentBillingStart = getSppStudentBillingStart(santri ?? {}, billingStart)
  const studentStartKey = periodKey(studentBillingStart.tahun, studentBillingStart.bulan)

  const paidRows = await query<{ tahun: number; bulan: number }>(
    `SELECT tahun, bulan
     FROM spp_log
     WHERE santri_id = ?
       AND (tahun * 100 + bulan) BETWEEN ? AND ?`,
    [santriId, studentStartKey, endKey]
  )
  const paidKeys = new Set(paidRows.map(row => periodKey(row.tahun, row.bulan)))
  const waivedRows = await query<{ tahun: number; bulan: number }>(
    `SELECT tahun, bulan
     FROM spp_tagihan_ditiadakan
     WHERE santri_id = ?
       AND is_active = 1
       AND (tahun * 100 + bulan) BETWEEN ? AND ?`,
    [santriId, studentStartKey, endKey]
  )
  const waivedKeys = new Set(waivedRows.map(row => periodKey(row.tahun, row.bulan)))

  const berjalan: SppTunggakanItem[] = []
  if ((santri?.bebas_spp ?? 0) !== 1) {
    for (let year = studentBillingStart.tahun; year <= currentYear; year++) {
      const fromMonth = year === studentBillingStart.tahun ? studentBillingStart.bulan : 1
      const toMonth = year === currentYear ? currentMonth : 12
      const nominal = await getNominalSppForYear(year)
      for (let month = fromMonth; month <= toMonth; month++) {
        const key = periodKey(year, month)
        if (paidKeys.has(key) || waivedKeys.has(key)) continue
        berjalan.push({
          source: 'BERJALAN',
          id: null,
          tahun: year,
          bulan: month,
          nama_bulan: BULAN_SPP[month - 1] ?? `Bulan ${month}`,
          label: monthLabel(year, month),
          nominal,
        })
      }
    }
  }

  const historisRows = await query<{
    id: string
    tahun: number
    bulan: number
    nominal_tagihan: number
  }>(
    `SELECT id, tahun, bulan, nominal_tagihan
     FROM spp_tunggakan_historis
      WHERE santri_id = ? AND status = 'BELUM_LUNAS'
        AND (tahun * 100 + bulan) >= ?
      ORDER BY tahun, bulan`,
    [santriId, studentStartKey]
  )
  const historis = historisRows.map(row => ({
    source: 'HISTORIS' as const,
    id: row.id,
    tahun: row.tahun,
    bulan: row.bulan,
    nama_bulan: BULAN_SPP[row.bulan - 1] ?? `Bulan ${row.bulan}`,
    label: monthLabel(row.tahun, row.bulan),
    nominal: row.nominal_tagihan,
  }))

  const items = [...historis, ...berjalan].sort((a, b) => periodKey(a.tahun, a.bulan) - periodKey(b.tahun, b.bulan))
  const totalHistoris = historis.reduce((sum, item) => sum + item.nominal, 0)
  const totalBerjalan = berjalan.reduce((sum, item) => sum + item.nominal, 0)

  return {
    adaTunggakan: items.length > 0,
    items,
    berjalan,
    historis,
    totalBulan: items.length,
    total: totalHistoris + totalBerjalan,
    totalBerjalan,
    totalHistoris,
    listBulan: items.map(item => item.label).join(', '),
    tahun: currentYear,
  }
}

export type SppMonthStatus = 'LUNAS' | 'DITIADAKAN' | 'BELUM_LUNAS' | 'BELUM_ADA_TAGIHAN'

export type SppMonthCell = {
  bulan: number
  nama_bulan: string
  status: SppMonthStatus
  nominal: number
  tanggalBayar: string | null
}

/**
 * Versi portal-safe dari getStatusSPP/getTagihanDitiadakanSPP di
 * app/dashboard/asrama/spp/actions.ts — keduanya digerbangi sesi staff
 * (assertSantriAccess) sehingga tidak bisa dipanggil dari context Portal
 * Ortu. Fungsi ini melakukan query yang sama tapi diberi santriId langsung
 * dari sesi portal, tanpa gerbang staff.
 *
 * Sengaja TIDAK menyentuh spp_tunggakan_historis — persis seperti grid 12
 * bulan di app/dashboard/asrama/spp/_page-content.tsx (lihat `riwayatBayar`/
 * `tagihanDitiadakan`), tunggakan historis merepresentasikan bulan SEBELUM
 * awal tagihan sistem sehingga bukan konsep "sel bulan tahun berjalan" —
 * historis tetap ikut dihitung di total pembayaran lewat getTunggakanSppSantri,
 * hanya tidak diplot ke grid ini.
 */
export async function getSppMonthlyGrid(santriId: string, tahun: number): Promise<SppMonthCell[]> {
  const billingStart = await getSppBillingStartSetting()
  const santri = await queryOne<SppStudentEnrollmentDates>(
    `SELECT tanggal_masuk, created_at FROM santri WHERE id = ?`,
    [santriId]
  )
  const studentBillingStart = getSppStudentBillingStart(santri ?? {}, billingStart)

  const now = new Date()
  const currentKey = periodKey(now.getFullYear(), now.getMonth() + 1)

  const paidRows = await query<{ bulan: number; nominal_bayar: number; tanggal_bayar: string }>(
    `SELECT bulan, nominal_bayar, tanggal_bayar FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
  const paidByMonth = new Map(paidRows.map(row => [row.bulan, row]))

  const waivedRows = await query<{ bulan: number }>(
    `SELECT bulan FROM spp_tagihan_ditiadakan WHERE santri_id = ? AND tahun = ? AND is_active = 1`,
    [santriId, tahun]
  )
  const waivedMonths = new Set(waivedRows.map(row => row.bulan))

  const nominalTahun = await getNominalSppForYear(tahun)

  const cells: SppMonthCell[] = []
  for (let bulan = 1; bulan <= 12; bulan++) {
    const key = periodKey(tahun, bulan)
    const billable = isSppBillablePeriod(tahun, bulan, studentBillingStart)
    const paid = paidByMonth.get(bulan)

    let status: SppMonthStatus
    let nominal = nominalTahun

    if (!billable) {
      status = 'BELUM_ADA_TAGIHAN'
    } else if (paid) {
      status = 'LUNAS'
      nominal = Number(paid.nominal_bayar)
    } else if (waivedMonths.has(bulan)) {
      status = 'DITIADAKAN'
    } else if (key > currentKey) {
      status = 'BELUM_ADA_TAGIHAN'
    } else {
      status = 'BELUM_LUNAS'
    }

    cells.push({
      bulan,
      nama_bulan: BULAN_SPP[bulan - 1],
      status,
      nominal: status === 'LUNAS' || status === 'BELUM_LUNAS' ? nominal : 0,
      tanggalBayar: paid?.tanggal_bayar ?? null,
    })
  }
  return cells
}

export async function getJumlahTunggakanHistorisBySantri(santriIds: string[]) {
  if (santriIds.length === 0) return new Map<string, number>()

  // D1 has a limit of 100 bind variables per query, so chunk into batches
  const CHUNK_SIZE = 80
  const result = new Map<string, number>()
  const billingStart = await getSppBillingStartSetting()

  for (let i = 0; i < santriIds.length; i += CHUNK_SIZE) {
    const chunk = santriIds.slice(i, i + CHUNK_SIZE)
    const placeholders = chunk.map(() => '?').join(',')
    const rows = await query<{
      santri_id: string
      tahun: number
      bulan: number
      tanggal_masuk: string | null
      created_at: string | null
    }>(
      `SELECT h.santri_id, h.tahun, h.bulan, s.tanggal_masuk, s.created_at
       FROM spp_tunggakan_historis h
       JOIN santri s ON s.id = h.santri_id
       WHERE h.status = 'BELUM_LUNAS' AND h.santri_id IN (${placeholders})`,
      chunk
    )
    for (const row of rows) {
      const start = getSppStudentBillingStart(row, billingStart)
      if (!isSppBillablePeriod(row.tahun, row.bulan, start)) continue
      result.set(row.santri_id, (result.get(row.santri_id) ?? 0) + 1)
    }
  }

  return result
}
