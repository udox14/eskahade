import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export type WeekPeriod = { start: string; end: string }

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`)
}

export function formatFullIndonesianDate(dateKey: string) {
  return format(parseDateKey(dateKey), 'EEEE, dd MMMM yyyy', { locale: id })
}

export function formatVerificationWeek(period: WeekPeriod, uppercase = false) {
  const label = `Pekan Verifikasi: ${formatFullIndonesianDate(period.start)} s.d. ${formatFullIndonesianDate(period.end)}`
  return uppercase ? label.toUpperCase() : label
}

