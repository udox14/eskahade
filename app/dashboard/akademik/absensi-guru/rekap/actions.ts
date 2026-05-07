'use server'

import { query } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { buildWeeklyGuruRuleMap, getWeeklyGuruRules, resolveGuruForDate } from '@/lib/akademik/guru-jadwal'

function isLibur(dayOfWeek: number, session: 'shubuh' | 'ashar' | 'maghrib'): boolean {
  if (dayOfWeek === 2 && session === 'maghrib') return true
  if (dayOfWeek === 4 && session === 'maghrib') return true
  if (dayOfWeek === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

function getDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
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
  let sql = `
    SELECT
      k.id,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      gs.id AS guru_shubuh_id,
      gs.nama_lengkap AS guru_shubuh_nama,
      ga.id AS guru_ashar_id,
      ga.nama_lengkap AS guru_ashar_nama,
      gm.id AS guru_maghrib_id,
      gm.nama_lengkap AS guru_maghrib_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE EXISTS (
      SELECT 1
      FROM riwayat_pendidikan rp
      JOIN santri s ON s.id = rp.santri_id
      WHERE rp.kelas_id = k.id
        AND rp.status_riwayat = 'aktif'
        AND s.status_global = 'aktif'
    )
  `
  const params: any[] = []
  if (marhalahId) { sql += ' AND k.marhalah_id = ?'; params.push(marhalahId) }

  const kelasList = await query<any>(sql, params)
  if (!kelasList.length) return []

  const kelasIds = kelasList.map((k: any) => k.id)
  const ph = kelasIds.map(() => '?').join(',')

  const absensiList = await query<any>(`
    SELECT
      kelas_id,
      tanggal,
      shubuh,
      ashar,
      maghrib,
      guru_shubuh_id_snapshot,
      guru_shubuh_nama_snapshot,
      guru_ashar_id_snapshot,
      guru_ashar_nama_snapshot,
      guru_maghrib_id_snapshot,
      guru_maghrib_nama_snapshot
    FROM absensi_guru
    WHERE kelas_id IN (${ph}) AND tanggal >= ? AND tanggal <= ?
  `, [...kelasIds, startDate, endDate])

  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))
  const statsGuru = new Map<string, any>()

  const initGuru = (id: string | number | null, nama: string | null, kelasNama: string, label: string) => {
    if (!id || !nama) return null
    const guruKey = String(id)
    if (!statsGuru.has(guruKey)) {
      statsGuru.set(guruKey, {
        id: guruKey,
        nama,
        kelas_ajar: new Set<string>(),
        hadir: 0,
        badal: 0,
        kosong: 0,
        libur: 0,
        total_wajib: 0,
      })
    }
    statsGuru.get(guruKey).kelas_ajar.add(`${kelasNama} (${label})`)
    return statsGuru.get(guruKey)
  }

  const absensiMap = new Map<string, any>()
  absensiList.forEach((absen: any) => {
    absensiMap.set(`${absen.kelas_id}-${absen.tanggal}`, absen)
  })

  const snapshotBySession = (absen: any, session: 'shubuh' | 'ashar' | 'maghrib') => {
    if (session === 'shubuh') {
      return {
        id: absen?.guru_shubuh_id_snapshot ?? null,
        nama: absen?.guru_shubuh_nama_snapshot ?? null,
      }
    }
    if (session === 'ashar') {
      return {
        id: absen?.guru_ashar_id_snapshot ?? null,
        nama: absen?.guru_ashar_nama_snapshot ?? null,
      }
    }
    return {
      id: absen?.guru_maghrib_id_snapshot ?? null,
      nama: absen?.guru_maghrib_nama_snapshot ?? null,
    }
  }

  const dates = getDateRange(startDate, endDate)
  kelasList.forEach((kelas: any) => {
    dates.forEach(tanggal => {
      const dayOfWeek = new Date(tanggal).getDay()
      const absen = absensiMap.get(`${kelas.id}-${tanggal}`)
      const resolved = resolveGuruForDate(kelas, tanggal, ruleMap)

      const processSession = (session: 'shubuh' | 'ashar' | 'maghrib', label: string) => {
        if (isLibur(dayOfWeek, session)) return

        const snapshot = snapshotBySession(absen, session)
        const targetGuru = snapshot.id && snapshot.nama ? snapshot : resolved[session]
        const stat = initGuru(targetGuru.id, targetGuru.nama, kelas.nama_kelas, label)
        if (!stat) return

        stat.total_wajib += 1
        const status = String(absen?.[session] || 'H').toUpperCase()
        if (status === 'L') {
          stat.libur += 1
          stat.total_wajib = Math.max(stat.total_wajib - 1, 0)
        } else if (status === 'A') {
          stat.kosong += 1
        } else if (status === 'B') {
          stat.badal += 1
        } else {
          stat.hadir += 1
        }
      }

      processSession('shubuh', 'Shubuh')
      processSession('ashar', 'Ashar')
      processSession('maghrib', 'Maghrib')
    })
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
