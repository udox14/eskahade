export const WIB_TIME_ZONE = 'Asia/Jakarta'

type WibDateParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

function getValidDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function getWibParts(value: Date | string): WibDateParts | null {
  const date = getValidDate(value)
  if (!date) return null

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? ''

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

export function parseWibDate(value: string, mode: 'start' | 'end' = 'start') {
  const clean = value.trim()
  if (!clean) return new Date('')
  const suffix = mode === 'end' ? 'T23:59:59.999+07:00' : 'T00:00:00+07:00'
  return new Date(`${clean}${suffix}`)
}

export function parseWibDateTime(value: string) {
  const clean = value.trim()
  if (!clean) return new Date('')
  if (/[zZ]$|[+\-]\d{2}:\d{2}$/.test(clean)) return new Date(clean)
  const withSeconds = clean.length === 16 ? `${clean}:00` : clean
  return new Date(`${withSeconds}+07:00`)
}

export function toWibDateInputValue(value: Date | string = new Date()) {
  const parts = getWibParts(value)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function toWibTimeInputValue(value: Date | string) {
  const parts = getWibParts(value)
  if (!parts) return ''
  return `${parts.hour}:${parts.minute}`
}

export function toWibDateTimeLocalValue(value: Date | string = new Date()) {
  const parts = getWibParts(value)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function formatWibDate(value: Date | string, locale = 'id-ID') {
  const date = getValidDate(value)
  if (!date) return typeof value === 'string' ? value : ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: WIB_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatWibDateTime(value: Date | string, locale = 'id-ID') {
  const date = getValidDate(value)
  if (!date) return typeof value === 'string' ? value : ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: WIB_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
