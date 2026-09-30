import type { WeekPeriod } from './week-period'

export function getAbsensiWeek(dateKey: string): WeekPeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Tanggal tidak valid')
  const date = new Date(`${dateKey}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) throw new Error('Tanggal tidak valid')
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 4) % 7)
  const start = date.toISOString().slice(0, 10)
  date.setUTCDate(date.getUTCDate() + 6)
  return { start, end: date.toISOString().slice(0, 10) }
}

function parseTimestamp(timestamp: string) {
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T')
  return new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`)
}

export function tanggalInputWib(timestamp: string | null) {
  if (!timestamp) return '-'
  const date = parseTimestamp(timestamp)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export type PemanggilanRow = {
  santri_id: string; nama: string; asrama: string; kamar: string; kelas: string
  pekan: WeekPeriod; tanggal_input: string | null
  alfa_shubuh: number; alfa_ashar: number; alfa_maghrib: number; total: number
}

export type AbsensiCetakSource = {
  id: string; tanggal: string; created_at: string | null
  shubuh: string; ashar: string; maghrib: string
  verif_shubuh: string | null; verif_ashar: string | null; verif_maghrib: string | null
  santri_id: string; nama_lengkap: string; asrama: string | null; kamar: string | null; nama_kelas: string | null
}

export function rekapPemanggilan(rows: AbsensiCetakSource[], pekan: WeekPeriod, onlyMangkir: boolean): PemanggilanRow[] {
  const groups = new Map<string, PemanggilanRow>()
  for (const row of rows) {
    if (row.tanggal > pekan.end) continue
    const sessions = (['shubuh', 'ashar', 'maghrib'] as const).filter(sesi =>
      row[sesi] === 'A' && (onlyMangkir || row.tanggal < pekan.start
        ? row[`verif_${sesi}`] === 'BELUM'
        : row[`verif_${sesi}`] == null || row[`verif_${sesi}`] === 'BELUM'))
    if (!sessions.length) continue
    const week = getAbsensiWeek(row.tanggal)
    const key = `${row.santri_id}:${week.start}`
    let item = groups.get(key)
    if (!item) {
      item = { santri_id: row.santri_id, nama: row.nama_lengkap, asrama: row.asrama || '-', kamar: row.kamar || '-',
        kelas: row.nama_kelas || '-', pekan: week, tanggal_input: null,
        alfa_shubuh: 0, alfa_ashar: 0, alfa_maghrib: 0, total: 0 }
      groups.set(key, item)
    }
    if (row.created_at && (!item.tanggal_input || parseTimestamp(row.created_at).getTime() < parseTimestamp(item.tanggal_input).getTime())) item.tanggal_input = row.created_at
    for (const sesi of sessions) { item[`alfa_${sesi}`]++; item.total++ }
  }
  return [...groups.values()].sort((a, b) => a.nama.localeCompare(b.nama) || a.pekan.start.localeCompare(b.pekan.start) || a.santri_id.localeCompare(b.santri_id))
}
