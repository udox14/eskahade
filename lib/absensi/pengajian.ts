// lib/absensi/pengajian.ts
// Helper murni untuk rekap absensi pengajian (3 sesi: shubuh/ashar/maghrib).
// Diekstrak dari app/dashboard/akademik/absensi/rekap/actions.ts agar bisa
// dipakai di luar file 'use server' (mis. portal ortu).

export const VALID_SESI = ['shubuh', 'ashar', 'maghrib'] as const
export type SessionType = typeof VALID_SESI[number]

export function normalizeDate(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : ''
}

export function getDateRange(startDate: string, endDate: string) {
  const start = normalizeDate(startDate)
  const end = normalizeDate(endDate)
  if (!start && !end) return { start: '', end: '' }
  if (start && end) return start <= end ? { start, end } : { start: end, end: start }
  return { start: start || end, end: end || start }
}

// Libur mingguan tetap: Selasa & Kamis maghrib, Jumat shubuh+ashar
export function isHoliday(dateStr: string, session: SessionType) {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  if (day === 2 && session === 'maghrib') return true
  if (day === 4 && session === 'maghrib') return true
  if (day === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

export function countActiveSessions(startDate: string, endDate: string, liburSet: Set<string>) {
  if (!startDate || !endDate) return 0
  const current = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  let total = 0

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    VALID_SESI.forEach(session => {
      if (!isHoliday(dateStr, session) && !liburSet.has(`${dateStr}-${session}`)) total++
    })
    current.setDate(current.getDate() + 1)
  }

  return total
}
