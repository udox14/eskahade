import { toWibDateInputValue } from '@/lib/date/wib'

export const BULAN_PANJANG = [
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

export function currentMonthWib(): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000)
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}`
}

export function todayWib(): string {
  return toWibDateInputValue(new Date())
}

export type MonthPeriod = {
  month: string
  year: number
  monthNum: number
  from: string
  to: string
}

export function monthPeriod(month: string = currentMonthWib()): MonthPeriod {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '')
  if (!match) return monthPeriod(currentMonthWib())

  const year = Number(match[1])
  const monthNum = Number(match[2])
  const last = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  return {
    month: `${year}-${String(monthNum).padStart(2, '0')}`,
    year,
    monthNum,
    from: `${year}-${String(monthNum).padStart(2, '0')}-01`,
    to: `${year}-${String(monthNum).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  }
}

export function labelBulan(month: string): string {
  const period = monthPeriod(month)
  return `${BULAN_PANJANG[period.monthNum - 1] ?? ''} ${period.year}`.trim()
}

export function rupiah(value: number | null | undefined): string {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 'Rp0'
  return 'Rp' + Math.round(number).toLocaleString('id-ID')
}

export function rupiahCompact(value: number | null | undefined): string {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 'Rp0'
  const abs = Math.abs(number)
  const sign = number < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (abs >= 1_000) return `${sign}Rp${(abs / 1_000).toFixed(0)} rb`
  return rupiah(number)
}

export function pct(part: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.round((Number(part || 0) / total) * 100)
}

export function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
