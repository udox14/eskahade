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
  const startKey = periodKey(billingStart.tahun, billingStart.bulan)
  const endKey = periodKey(currentYear, currentMonth)

  const santri = await queryOne<{ bebas_spp: number | null }>(
    `SELECT COALESCE(bebas_spp, 0) AS bebas_spp
     FROM santri
     WHERE id = ?`,
    [santriId]
  )

  const paidRows = await query<{ tahun: number; bulan: number }>(
    `SELECT tahun, bulan
     FROM spp_log
     WHERE santri_id = ?
       AND (tahun * 100 + bulan) BETWEEN ? AND ?`,
    [santriId, startKey, endKey]
  )
  const paidKeys = new Set(paidRows.map(row => periodKey(row.tahun, row.bulan)))
  const waivedRows = await query<{ tahun: number; bulan: number }>(
    `SELECT tahun, bulan
     FROM spp_tagihan_ditiadakan
     WHERE santri_id = ?
       AND is_active = 1
       AND (tahun * 100 + bulan) BETWEEN ? AND ?`,
    [santriId, startKey, endKey]
  )
  const waivedKeys = new Set(waivedRows.map(row => periodKey(row.tahun, row.bulan)))

  const berjalan: SppTunggakanItem[] = []
  if ((santri?.bebas_spp ?? 0) !== 1) {
    for (let year = billingStart.tahun; year <= currentYear; year++) {
      const fromMonth = year === billingStart.tahun ? billingStart.bulan : 1
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
     ORDER BY tahun, bulan`,
    [santriId]
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

export async function getJumlahTunggakanHistorisBySantri(santriIds: string[]) {
  if (santriIds.length === 0) return new Map<string, number>()
  const placeholders = santriIds.map(() => '?').join(',')
  const rows = await query<{ santri_id: string; jumlah: number }>(
    `SELECT santri_id, COUNT(*) AS jumlah
     FROM spp_tunggakan_historis
     WHERE status = 'BELUM_LUNAS' AND santri_id IN (${placeholders})
     GROUP BY santri_id`,
    santriIds
  )
  return new Map(rows.map(row => [row.santri_id, row.jumlah]))
}
