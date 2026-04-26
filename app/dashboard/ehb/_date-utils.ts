export const WIB_TIME_ZONE = 'Asia/Jakarta'

const ID_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']
const ID_DAY_NAMES_UPPER = ID_DAY_NAMES.map(day => day.toUpperCase())
const ID_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const ID_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function parseDateKeyWib(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDateKeyWib(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDatesBetweenWib(start?: string | null, end?: string | null) {
  if (!start || !end) return []
  const dates: string[] = []
  const current = parseDateKeyWib(start)
  const last = parseDateKeyWib(end)
  while (current <= last) {
    dates.push(formatDateKeyWib(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

export function dayNameWib(date: string, upper = false) {
  const names = upper ? ID_DAY_NAMES_UPPER : ID_DAY_NAMES
  return names[parseDateKeyWib(date).getDay()]
}

export function longDateWib(date: string, includeYear = true) {
  const d = parseDateKeyWib(date)
  const base = `${d.getDate()} ${ID_MONTH_NAMES[d.getMonth()]}`
  return includeYear ? `${base} ${d.getFullYear()}` : base
}

export function fullDateWib(date: string, upperDay = false) {
  return `${dayNameWib(date, upperDay)}, ${longDateWib(date)}`
}

export function shortDateWib(date: string, includeYear = true) {
  const d = parseDateKeyWib(date)
  const base = `${d.getDate()}-${ID_MONTH_SHORT[d.getMonth()]}`
  return includeYear ? `${base}-${String(d.getFullYear()).slice(-2)}` : base
}

export function formatDateRangeWib(start?: string | null, end?: string | null) {
  if (!start || !end) return ''
  return `${longDateWib(start, false)} - ${longDateWib(end)}`
}

export function nowWibString() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
}
