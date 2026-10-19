const FINANCE_TIME_ZONE = 'Asia/Jakarta'

/**
 * Format finance timestamps identically in Workers and browsers. D1's
 * `datetime('now')` values have no timezone suffix but are UTC, so normalize
 * them before formatting in the pesantren's timezone.
 */
export function formatFinanceDate(
  value: string | Date | null | undefined,
  includeTime = false
): string {
  if (value == null || value === '') return '-'

  const original = value instanceof Date
    ? Number.isFinite(value.getTime()) ? value.toISOString() : '-'
    : value
  const normalized =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value.trim())
      ? `${value.trim().replace(' ', 'T')}Z`
      : value
  const date = normalized instanceof Date ? normalized : new Date(normalized)

  if (!Number.isFinite(date.getTime())) return original

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: FINANCE_TIME_ZONE,
  }).format(date)
}
