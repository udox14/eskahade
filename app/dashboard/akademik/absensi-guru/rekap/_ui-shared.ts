/**
 * Konstanta dan helper tampilan yang dipakai bersama oleh halaman rekap dan
 * kalender per guru. Dipisah supaya kedua berkas memakai warna serta label yang
 * sama persis - beda warna antara sel kalender dan tabel akan membingungkan
 * pembaca yang membandingkan keduanya.
 */

export type GuruSession = 'shubuh' | 'ashar' | 'maghrib'

export const SESSIONS: GuruSession[] = ['shubuh', 'ashar', 'maghrib']

export const SESSION_LABEL: Record<GuruSession, string> = {
  shubuh: 'Shubuh',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
}

export const SESSION_COLORS: Record<GuruSession, string> = {
  shubuh: 'border-sky-100 bg-sky-50 text-sky-700',
  ashar: 'border-orange-100 bg-orange-50 text-orange-700',
  maghrib: 'border-violet-100 bg-violet-50 text-violet-700',
}

/** Warna strip sesi di sel kalender. Kunci mengikuti status baris detail. */
export const STATUS_TONE: Record<string, string> = {
  H: 'bg-emerald-500',
  B: 'bg-amber-400',
  A: 'bg-rose-500',
}

export const STATUS_TEXT: Record<string, string> = {
  H: 'Hadir',
  B: 'Badal',
  A: 'Alfa',
}

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const NAMA_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function statusClass(status: string) {
  if (status === 'A') return 'bg-red-50 text-red-700 border-red-100'
  if (status === 'B') return 'bg-yellow-50 text-yellow-700 border-yellow-100'
  return 'bg-green-50 text-green-700 border-green-100'
}

export function sourceLabel(row: { sumber_guru?: string | null } | null | undefined) {
  if (row?.sumber_guru === 'snapshot') return 'Snapshot'
  return 'Jadwal'
}
