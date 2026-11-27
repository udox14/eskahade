// Format util kecil untuk portal ortu (selalu WIB / Asia/Jakarta)

const PORTAL_TIME_ZONE = 'Asia/Jakarta'

export function formatRupiah(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 'Rp0'
  return `Rp${Math.round(value).toLocaleString('id-ID')}`
}

export function formatThousands(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return Math.round(value).toLocaleString('id-ID')
}

export function parseRupiahDigits(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Normalisasi timestamp D1 (`YYYY-MM-DD HH:MM:SS` tanpa Z) ke Date UTC yang valid. */
export function parsePortalTimestamp(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  const trimmed = value.trim()
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed
  const d = new Date(normalized)
  return Number.isFinite(d.getTime()) ? d : null
}

export function formatTanggalId(value: string | null | undefined) {
  const d = parsePortalTimestamp(value)
  if (d) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: PORTAL_TIME_ZONE,
    }).format(d)
  }
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(value || '-')
  const bulan = BULAN_ID[Number(m[2]) - 1] || m[2]
  return `${Number(m[3])} ${bulan} ${m[1]}`
}

export function formatPortalDateShortWib(value: string | null | undefined): string {
  const d = parsePortalTimestamp(value)
  if (!d) return String(value || '-')
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: PORTAL_TIME_ZONE,
  }).format(d)
}

export function formatPortalDateTimeWib(value: string | null | undefined): string {
  const d = parsePortalTimestamp(value)
  if (!d) return '-'
  return (
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: PORTAL_TIME_ZONE,
    }).format(d) + ' WIB'
  )
}

export function formatPortalTimeWib(value: string | null | undefined): string {
  const d = parsePortalTimestamp(value)
  if (!d) return '-'
  return (
    new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: PORTAL_TIME_ZONE,
    }).format(d) + ' WIB'
  )
}

export function formatPortalMonthYearWib(value: string | null | undefined): string {
  const d = parsePortalTimestamp(value)
  if (!d) return 'Lainnya'
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: PORTAL_TIME_ZONE,
  }).format(d)
}

export function formatPortalPeriodYm(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim())
  if (!m) return ym
  const bulan = BULAN_ID[Number(m[2]) - 1]
  return bulan ? `${bulan} ${m[1]}` : ym
}

export function namaBulanId(bulan: number) {
  return BULAN_ID[bulan - 1] || `Bulan ${bulan}`
}
