'use server'

import { query } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'

function isLibur(dayOfWeek: number, session: 'shubuh' | 'ashar' | 'maghrib'): boolean {
  if (dayOfWeek === 2 && session === 'maghrib') return true
  if (dayOfWeek === 4 && session === 'maghrib') return true
  if (dayOfWeek === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

function hitungHariEfektif(startDate: string, endDate: string, session: 'shubuh' | 'ashar' | 'maghrib'): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    if (!isLibur(current.getDay(), session)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export async function getRekapKinerjaGuru(
  startDate: string,
  endDate: string,
  marhalahId: string,
  badalAsHadir: boolean
) {
  const hariEfektif = {
    shubuh: hitungHariEfektif(startDate, endDate, 'shubuh'),
    ashar:  hitungHariEfektif(startDate, endDate, 'ashar'),
    maghrib: hitungHariEfektif(startDate, endDate, 'maghrib'),
  }

  let sql = `
    SELECT k.id, k.nama_kelas,
           m.nama AS marhalah_nama,
           gs.id AS gs_id, gs.nama_lengkap AS gs_nama,
           ga.id AS ga_id, ga.nama_lengkap AS ga_nama,
           gm.id AS gm_id, gm.nama_lengkap AS gm_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
  `
  const params: any[] = []
  if (marhalahId) { sql += ' WHERE k.marhalah_id = ?'; params.push(marhalahId) }

  const kelasList = await query<any>(sql, params)
  if (!kelasList.length) return []

  const kelasIds = kelasList.map((k: any) => k.id)
  const ph = kelasIds.map(() => '?').join(',')

  const absensiList = await query<any>(`
    SELECT kelas_id, tanggal, shubuh, ashar, maghrib
    FROM absensi_guru
    WHERE kelas_id IN (${ph}) AND tanggal >= ? AND tanggal <= ?
  `, [...kelasIds, startDate, endDate])

  const statsGuru = new Map<string, any>()

  const initGuru = (id: string, nama: string) => {
    if (!id) return
    if (!statsGuru.has(id)) {
      statsGuru.set(id, { id, nama, kelas_ajar: new Set<string>(), hadir: 0, badal: 0, kosong: 0, libur: 0, total_wajib: 0 })
    }
  }

  kelasList.forEach((k: any) => {
    const sessions: Array<{ key: 'shubuh' | 'ashar' | 'maghrib'; guruId: string; guruNama: string; label: string }> = [
      { key: 'shubuh',  guruId: k.gs_id, guruNama: k.gs_nama, label: 'Shubuh' },
      { key: 'ashar',   guruId: k.ga_id, guruNama: k.ga_nama, label: 'Ashar' },
      { key: 'maghrib', guruId: k.gm_id, guruNama: k.gm_nama, label: 'Maghrib' },
    ]
    sessions.forEach(({ key, guruId, guruNama, label }) => {
      if (!guruId) return
      initGuru(guruId, guruNama)
      const stat = statsGuru.get(guruId)
      stat.total_wajib += hariEfektif[key]
      stat.kelas_ajar.add(`${k.nama_kelas} (${label})`)
    })
  })

  const mapJadwal = new Map<string, any>()
  kelasList.forEach((k: any) => {
    mapJadwal.set(k.id, { shubuh: { id: k.gs_id }, ashar: { id: k.ga_id }, maghrib: { id: k.gm_id } })
  })

  absensiList.forEach((absen: any) => {
    const jadwal = mapJadwal.get(absen.kelas_id)
    if (!jadwal) return

    const processSession = (session: 'shubuh' | 'ashar' | 'maghrib') => {
      const guruId = jadwal[session]?.id
      if (!guruId || !statsGuru.has(guruId)) return
      const stat = statsGuru.get(guruId)
      const status = absen[session]
      if (status === 'L') { stat.libur++; stat.total_wajib-- }
      else if (status === 'H') stat.hadir++
      else if (status === 'B') stat.badal++
      else if (status === 'A') stat.kosong++
    }

    processSession('shubuh')
    processSession('ashar')
    processSession('maghrib')
  })

  const result = Array.from(statsGuru.values()).map(g => {
    const total_wajib = Math.max(g.total_wajib, 0)
    const pembilang = g.hadir + (badalAsHadir ? g.badal : 0)
    const persentase = total_wajib > 0 ? Math.round((pembilang / total_wajib) * 100) : 0
    const pct = (n: number) => total_wajib > 0 ? Math.round((n / total_wajib) * 100) : 0
    return {
      ...g,
      total_wajib,
      kelas_ajar: Array.from(g.kelas_ajar).join(', '),
      persentase,
      pct_hadir: pct(g.hadir),
      pct_badal: pct(g.badal),
      pct_kosong: pct(g.kosong),
    }
  })

  return result.sort((a, b) => a.persentase - b.persentase)
}