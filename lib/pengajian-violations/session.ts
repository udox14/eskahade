import type { Sesi } from './types'

export const SESSION_LABELS: Record<Sesi, string> = {
  shubuh: 'Shubuh',
  ashar: 'Ashar',
  maghrib: 'Malam',
}

// The datetime-local value is a wall-clock time in UTC+7, not the server timezone.
// End hours are inclusive: 07:59, 17:59 and 21:59 remain in their session.
export function inferSession(localDateTime: string): Sesi | '' {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) return ''
  const hour = Number(localDateTime.slice(11, 13))
  const minute = Number(localDateTime.slice(14, 16))
  if (minute > 59) return ''
  if (hour >= 4 && hour < 8) return 'shubuh'
  if (hour >= 15 && hour < 18) return 'ashar'
  if (hour >= 18 && hour < 22) return 'maghrib'
  return ''
}
