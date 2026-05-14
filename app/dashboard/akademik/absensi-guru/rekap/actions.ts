'use server'

import { execute, query } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'
import {
  buildGabunganByKelas,
  buildGabunganMembersByGroup,
  buildWeeklyGuruRuleMap,
  ensureGuruJadwalSchema,
  getKelasGabunganPengajian,
  getWeeklyGuruRules,
  resolveGuruForDate,
} from '@/lib/akademik/guru-jadwal'

type GuruSession = 'shubuh' | 'ashar' | 'maghrib'
type GuruStatus = 'H' | 'A' | 'B'

const SESSIONS: GuruSession[] = ['shubuh', 'ashar', 'maghrib']
const SESSION_LABEL: Record<GuruSession, string> = {
  shubuh: 'Shubuh',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
}

type GuruBreakdown = {
  wajib: number
  hadir: number
  badal: number
  kosong: number
  persentase: number
  pct_hadir: number
  pct_badal: number
  pct_kosong: number
}

type GuruDetailRow = {
  tanggal: string
  hari: string
  sesi: GuruSession
  sesi_label: string
  kelas: string
  status: GuruStatus
  status_label: string
  catatan: string
}

function isLibur(dayOfWeek: number, session: GuruSession): boolean {
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

async function ensureRekapSchema() {
  await ensureGuruJadwalSchema()
  await execute(`
    CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
      tanggal    TEXT NOT NULL,
      sesi       TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tanggal, sesi)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_pengajian_libur_sesi_tanggal
    ON pengajian_libur_sesi(tanggal, sesi)
  `)
}

async function getActiveKelasList(marhalahId: string) {
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
  if (marhalahId) {
    sql += ' AND k.marhalah_id = ?'
    params.push(marhalahId)
  }
  sql += ' ORDER BY k.nama_kelas'
  return query<any>(sql, params)
}

async function getAbsensiMap(kelasIds: string[], startDate: string, endDate: string) {
  if (!kelasIds.length) return new Map<string, any>()
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

  const absensiMap = new Map<string, any>()
  absensiList.forEach((absen: any) => {
    absensiMap.set(`${absen.kelas_id}-${absen.tanggal}`, absen)
  })
  return absensiMap
}

async function getManualLiburSet(startDate: string, endDate: string) {
  const rows = await query<{ tanggal: string; sesi: GuruSession }>(`
    SELECT tanggal, sesi
    FROM pengajian_libur_sesi
    WHERE tanggal >= ? AND tanggal <= ?
  `, [startDate, endDate])

  return new Set(rows.map(row => `${row.tanggal}|${row.sesi}`))
}

function snapshotBySession(absen: any, session: GuruSession) {
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

function emptyBreakdown(): GuruBreakdown {
  return {
    wajib: 0,
    hadir: 0,
    badal: 0,
    kosong: 0,
    persentase: 0,
    pct_hadir: 0,
    pct_badal: 0,
    pct_kosong: 0,
  }
}

function finalizeBreakdown(breakdown: GuruBreakdown, badalAsHadir: boolean) {
  const pembilang = breakdown.hadir + (badalAsHadir ? breakdown.badal : 0)
  return {
    ...breakdown,
    persentase: breakdown.wajib > 0 ? Math.round((pembilang / breakdown.wajib) * 100) : 0,
    pct_hadir: breakdown.wajib > 0 ? Math.round((breakdown.hadir / breakdown.wajib) * 100) : 0,
    pct_badal: breakdown.wajib > 0 ? Math.round((breakdown.badal / breakdown.wajib) * 100) : 0,
    pct_kosong: breakdown.wajib > 0 ? Math.round((breakdown.kosong / breakdown.wajib) * 100) : 0,
  }
}

function incrementBreakdown(breakdown: GuruBreakdown, status: string) {
  breakdown.wajib += 1
  if (status === 'A') breakdown.kosong += 1
  else if (status === 'B') breakdown.badal += 1
  else breakdown.hadir += 1
}

function formatKelasLabel(group: any, members: any[], kelasNama: string) {
  return group
    ? `${members.map(member => member.nama_kelas).join(' + ')}${group.tempat ? ` - ${group.tempat}` : ''}`
    : kelasNama
}

function statusLabel(status: GuruStatus) {
  if (status === 'A') return 'Kosong/Alfa'
  if (status === 'B') return 'Badal'
  return 'Hadir'
}

function hariLabel(tanggal: string) {
  const labels = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  return labels[new Date(tanggal).getDay()] || ''
}

export async function getGuruOptionsForRekap(marhalahId: string = '') {
  await ensureRekapSchema()
  const kelasList = await getActiveKelasList(marhalahId)
  if (!kelasList.length) return []

  const kelasIds = kelasList.map((k: any) => String(k.id))
  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))
  const guruMap = new Map<string, { id: string; nama: string }>()

  for (const kelas of kelasList) {
    for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
      const resolved = SESSIONS.reduce((acc, session) => {
        const override = ruleMap.get(`${kelas.id}|${session}|${dayOfWeek}`)
        const fallback = session === 'shubuh'
          ? { id: kelas.guru_shubuh_id, nama: kelas.guru_shubuh_nama }
          : session === 'ashar'
            ? { id: kelas.guru_ashar_id, nama: kelas.guru_ashar_nama }
            : { id: kelas.guru_maghrib_id, nama: kelas.guru_maghrib_nama }
        acc[session] = override
          ? { id: override.guru_id, nama: override.guru_nama }
          : fallback
        return acc
      }, {} as Record<GuruSession, { id: number | string | null; nama?: string | null }>)

      for (const session of SESSIONS) {
        if (isLibur(dayOfWeek, session)) continue
        const guru = resolved[session]
        if (!guru?.id || !guru.nama) continue
        guruMap.set(String(guru.id), { id: String(guru.id), nama: guru.nama })
      }
    }
  }

  return Array.from(guruMap.values())
    .sort((a, b) => a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' }))
}

export async function getRekapKinerjaGuru(
  startDate: string,
  endDate: string,
  marhalahId: string,
  badalAsHadir: boolean
) {
  await ensureRekapSchema()
  const kelasList = await getActiveKelasList(marhalahId)
  if (!kelasList.length) return []

  const kelasIds = kelasList.map((k: any) => String(k.id))
  const absensiMap = await getAbsensiMap(kelasIds, startDate, endDate)
  const manualLiburSet = await getManualLiburSet(startDate, endDate)
  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))
  const gabungan = await getKelasGabunganPengajian(kelasIds)
  const gabunganByKelas = buildGabunganByKelas(gabungan)
  const gabunganMembersByGroup = buildGabunganMembersByGroup(gabungan)
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

  const dates = getDateRange(startDate, endDate)
  kelasList.forEach((kelas: any) => {
    dates.forEach(tanggal => {
      const dayOfWeek = new Date(tanggal).getDay()
      const absen = absensiMap.get(`${kelas.id}-${tanggal}`)
      const resolved = resolveGuruForDate(kelas, tanggal, ruleMap)

      const processSession = (session: GuruSession, label: string) => {
        if (isLibur(dayOfWeek, session)) return
        if (manualLiburSet.has(`${tanggal}|${session}`)) return

        const group = gabunganByKelas.get(`${kelas.id}|${session}`)
        const members = group ? (gabunganMembersByGroup.get(group.id) || []) : []
        const representative = members[0]
        if (representative && representative.kelas_id !== kelas.id) return

        const snapshot = snapshotBySession(absen, session)
        const targetGuru = snapshot.id && snapshot.nama ? snapshot : resolved[session]
        const kelasLabel = formatKelasLabel(group, members, kelas.nama_kelas)
        const stat = initGuru(targetGuru.id, targetGuru.nama, kelasLabel, label)
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

export async function getRekapDetailGuru(
  startDate: string,
  endDate: string,
  guruId: string,
  marhalahId: string,
  badalAsHadir: boolean
) {
  await ensureRekapSchema()
  if (!guruId) return null

  const kelasList = await getActiveKelasList(marhalahId)
  if (!kelasList.length) return null

  const guruRows = await query<{ id: number | string; nama_lengkap: string }>(
    'SELECT id, nama_lengkap FROM data_guru WHERE id = ? LIMIT 1',
    [guruId]
  )
  const guru = guruRows[0]
  if (!guru) return null

  const kelasIds = kelasList.map((k: any) => String(k.id))
  const absensiMap = await getAbsensiMap(kelasIds, startDate, endDate)
  const manualLiburSet = await getManualLiburSet(startDate, endDate)
  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))
  const gabungan = await getKelasGabunganPengajian(kelasIds)
  const gabunganByKelas = buildGabunganByKelas(gabungan)
  const gabunganMembersByGroup = buildGabunganMembersByGroup(gabungan)
  const dates = getDateRange(startDate, endDate)
  const targetGuruId = String(guruId)
  const total = emptyBreakdown()
  const perSesi: Record<GuruSession, GuruBreakdown> = {
    shubuh: emptyBreakdown(),
    ashar: emptyBreakdown(),
    maghrib: emptyBreakdown(),
  }
  const detail: GuruDetailRow[] = []
  const kelasAjar = new Set<string>()

  kelasList.forEach((kelas: any) => {
    dates.forEach(tanggal => {
      const dayOfWeek = new Date(tanggal).getDay()
      const absen = absensiMap.get(`${kelas.id}-${tanggal}`)
      const resolved = resolveGuruForDate(kelas, tanggal, ruleMap)

      SESSIONS.forEach(session => {
        if (isLibur(dayOfWeek, session)) return
        if (manualLiburSet.has(`${tanggal}|${session}`)) return

        const group = gabunganByKelas.get(`${kelas.id}|${session}`)
        const members = group ? (gabunganMembersByGroup.get(group.id) || []) : []
        const representative = members[0]
        if (representative && representative.kelas_id !== kelas.id) return

        const snapshot = snapshotBySession(absen, session)
        const targetGuru = snapshot.id && snapshot.nama ? snapshot : resolved[session]
        if (String(targetGuru.id || '') !== targetGuruId) return

        const status = String(absen?.[session] || 'H').toUpperCase()
        if (status === 'L') return

        const normalizedStatus: GuruStatus = status === 'A' || status === 'B' ? status : 'H'
        const kelasLabel = formatKelasLabel(group, members, kelas.nama_kelas)
        kelasAjar.add(`${kelasLabel} (${SESSION_LABEL[session]})`)
        incrementBreakdown(total, normalizedStatus)
        incrementBreakdown(perSesi[session], normalizedStatus)
        detail.push({
          tanggal,
          hari: hariLabel(tanggal),
          sesi: session,
          sesi_label: SESSION_LABEL[session],
          kelas: kelasLabel,
          status: normalizedStatus,
          status_label: statusLabel(normalizedStatus),
          catatan: normalizedStatus === 'B' ? 'Diisi badal' : '-',
        })
      })
    })
  })

  return {
    guru: {
      id: String(guru.id),
      nama: guru.nama_lengkap,
    },
    kelas_ajar: Array.from(kelasAjar).join(', '),
    total: finalizeBreakdown(total, badalAsHadir),
    per_sesi: {
      shubuh: finalizeBreakdown(perSesi.shubuh, badalAsHadir),
      ashar: finalizeBreakdown(perSesi.ashar, badalAsHadir),
      maghrib: finalizeBreakdown(perSesi.maghrib, badalAsHadir),
    },
    detail: detail.sort((a, b) => `${a.tanggal}-${a.sesi}`.localeCompare(`${b.tanggal}-${b.sesi}`)),
  }
}
