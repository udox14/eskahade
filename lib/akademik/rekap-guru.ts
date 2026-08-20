/* eslint-disable @typescript-eslint/no-explicit-any */
import { execute, query } from '@/lib/db'
import { toWibDateInputValue } from '@/lib/date/wib'
import {
  buildGabunganByKelas,
  buildGabunganMembersByGroup,
  buildWeeklyGuruRuleMap,
  ensureGuruJadwalSchema,
  getKelasGabunganPengajian,
  getWeeklyGuruRules,
  resolveGuruForDate,
} from '@/lib/akademik/guru-jadwal'

/**
 * Perhitungan rekap kinerja guru, dipisah dari server action supaya modul lain
 * bisa memakainya tanpa lewat lapisan HTTP.
 *
 * Pemakainya ada dua dan keduanya wajib melihat angka yang identik: halaman
 * rekap milik sekpen, dan payroll di keuangan terpusat yang memotong gaji
 * berdasarkan angka itu. Kalau definisi "alfa" sempat bercabang di dua tempat,
 * guru akan melihat satu angka di rekap dan angka lain di slip gajinya - dan
 * yang salah selalu dianggap yang mengurangi uangnya.
 *
 * Satuan hitungnya adalah SESI, bukan hari: shubuh, ashar, dan maghrib dihitung
 * terpisah, sehingga satu guru bisa punya tiga waktu wajib dalam sehari.
 */

export type GuruSession = 'shubuh' | 'ashar' | 'maghrib'
export type GuruStatus = 'H' | 'A' | 'B'

export const SESSIONS: GuruSession[] = ['shubuh', 'ashar', 'maghrib']
export const SESSION_LABEL: Record<GuruSession, string> = {
  shubuh: 'Shubuh',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
}

export type GuruBreakdown = {
  wajib: number
  hadir: number
  badal: number
  kosong: number
  persentase: number
  pct_hadir: number
  pct_badal: number
  pct_kosong: number
}

export type GuruDetailRow = {
  tanggal: string
  hari: string
  sesi: GuruSession
  sesi_label: string
  kelas: string
  status: GuruStatus
  status_label: string
  catatan: string
  sumber_guru: 'snapshot' | 'jadwal'
  snapshot_guru_nama: string | null
  jadwal_guru_nama: string | null
  snapshot_berbeda: boolean
}

export type RekapKinerjaGuruRow = {
  id: string
  nama: string
  kelas_ajar: string
  hadir: number
  badal: number
  kosong: number
  libur: number
  total_wajib: number
  snapshot_berbeda: number
  persentase: number
  pct_hadir: number
  pct_badal: number
  pct_kosong: number
}

/** Libur tetap mingguan; di luar ini sekpen bisa menandai libur per tanggal. */
function isLibur(dayOfWeek: number, session: GuruSession): boolean {
  if (dayOfWeek === 2 && session === 'maghrib') return true
  if (dayOfWeek === 4 && session === 'maghrib') return true
  if (dayOfWeek === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

/**
 * Memangkas rentang sampai hari ini (WIB).
 *
 * Sesi tanpa baris `absensi_guru` dibaca sebagai hadir - lihat pembacaan status
 * di bawah. Tanpa pemangkasan ini, sisa hari pada bulan berjalan ikut masuk
 * sebagai waktu wajib yang otomatis "hadir": total wajib membengkak dan
 * persentase alfa jadi terlihat lebih kecil daripada kenyataannya.
 *
 * Pola yang sama sudah dipakai rekap absensi santri, dashboard pimpinan, dan
 * portal ortu.
 */
export function rentangEfektifRekapGuru(startDate: string, endDate: string) {
  const hariIni = toWibDateInputValue()
  const dipangkas = Boolean(endDate) && endDate > hariIni
  return {
    start: startDate,
    end: dipangkas ? hariIni : endDate,
    dipangkas,
    hariIni,
  }
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

export async function ensureRekapGuruSchema() {
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

async function getKelasListForRekap(
  marhalahId: string,
  tahunAjaranId: string = '',
  startDate?: string,
  endDate?: string
) {
  let sql = `
    SELECT
      k.id,
      k.tahun_ajaran_id,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      gs.id AS guru_shubuh_id,
      gs.nama_lengkap AS guru_shubuh_nama,
      ga.id AS guru_ashar_id,
      ga.nama_lengkap AS guru_ashar_nama,
      gm.id AS guru_maghrib_id,
      gm.nama_lengkap AS guru_maghrib_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE ${tahunAjaranId ? 'k.tahun_ajaran_id = ?' : 'ta.is_active = 1'}
  `
  const params: any[] = tahunAjaranId ? [tahunAjaranId] : []
  if (marhalahId) {
    sql += ' AND k.marhalah_id = ?'
    params.push(marhalahId)
  }
  const hasDateRange = Boolean(startDate && endDate)
  sql += `
    AND (
      EXISTS (
        SELECT 1
        FROM riwayat_pendidikan rp
        JOIN santri s ON s.id = rp.santri_id
        WHERE rp.kelas_id = k.id
          AND rp.status_riwayat = 'aktif'
          AND s.status_global = 'aktif'
      )
      ${hasDateRange ? `OR EXISTS (
        SELECT 1
        FROM absensi_guru ag
        WHERE ag.kelas_id = k.id
          AND ag.tanggal >= ?
          AND ag.tanggal <= ?
      )` : ''}
    )
  `
  if (hasDateRange) params.push(startDate, endDate)
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

function hasGuru(guru: { id?: string | number | null; nama?: string | null }) {
  return Boolean(guru?.id && guru?.nama)
}

function isDifferentGuru(
  snapshot: { id?: string | number | null; nama?: string | null },
  jadwal: { id?: string | number | null; nama?: string | null }
) {
  return hasGuru(snapshot) && hasGuru(jadwal) && String(snapshot.id) !== String(jadwal.id)
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

export async function hitungGuruOptionsForRekap(
  marhalahId: string = '',
  tahunAjaranId: string = '',
  startDate: string = '',
  endDate: string = ''
) {
  await ensureRekapGuruSchema()
  const kelasList = await getKelasListForRekap(marhalahId, tahunAjaranId, startDate, endDate)
  if (!kelasList.length) return []

  const kelasIds = kelasList.map((k: any) => String(k.id))
  const absensiMap = startDate && endDate
    ? await getAbsensiMap(kelasIds, startDate, endDate)
    : new Map<string, any>()
  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))
  const guruMap = new Map<string, { id: string; nama: string }>()

  for (const absen of absensiMap.values()) {
    for (const session of SESSIONS) {
      const snapshot = snapshotBySession(absen, session)
      if (snapshot.id && snapshot.nama) {
        guruMap.set(String(snapshot.id), { id: String(snapshot.id), nama: snapshot.nama })
      }
    }
  }

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

/**
 * `badalAsHadir` hanya memengaruhi kolom persentase, bukan cacah mentah
 * hadir/badal/kosong. Payroll memakai cacah mentahnya, jadi nilai argumen ini
 * tidak pernah menggeser potongan gaji siapa pun.
 */
export async function hitungRekapKinerjaGuru(
  startDate: string,
  endDate: string,
  marhalahId: string,
  badalAsHadir: boolean,
  tahunAjaranId: string = ''
): Promise<RekapKinerjaGuruRow[]> {
  await ensureRekapGuruSchema()
  const { start, end } = rentangEfektifRekapGuru(startDate, endDate)
  const kelasList = await getKelasListForRekap(marhalahId, tahunAjaranId, start, end)
  if (!kelasList.length) return []

  const kelasIds = kelasList.map((k: any) => String(k.id))
  const absensiMap = await getAbsensiMap(kelasIds, start, end)
  const manualLiburSet = await getManualLiburSet(start, end)
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
        snapshot_berbeda: 0,
      })
    }
    statsGuru.get(guruKey).kelas_ajar.add(`${kelasNama} (${label})`)
    return statsGuru.get(guruKey)
  }

  const dates = getDateRange(start, end)
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
        const jadwalGuru = resolved[session]
        const targetGuru = hasGuru(snapshot) ? snapshot : jadwalGuru
        const kelasLabel = formatKelasLabel(group, members, kelas.nama_kelas)
        const stat = initGuru(targetGuru.id, targetGuru.nama, kelasLabel, label)
        if (!stat) return

        // JANGAN ubah default 'H' ini menjadi "belum diinput".
        //
        // `absensi_guru` adalah jurnal pengecualian: grid input hanya mengirim
        // sel yang disentuh petugas (lihat `dirtyKeys` di halaman absensi guru),
        // dan sel yang tidak disentuh tampil hadir. Tidak adanya baris berarti
        // "hadir", bukan "belum tercatat". Memperlakukannya sebagai data hilang
        // akan menghapus hampir seluruh kehadiran dari penyebut dan membuat
        // setiap guru tampak nyaris selalu alfa.
        const status = String(absen?.[session] || 'H').toUpperCase()
        // Sesi yang ditandai libur bukan waktu efektif: tidak menambah wajib,
        // dan selisih snapshot di dalamnya tidak perlu diperingatkan.
        if (status === 'L') {
          stat.libur += 1
          return
        }

        stat.total_wajib += 1
        if (isDifferentGuru(snapshot, jadwalGuru)) stat.snapshot_berbeda += 1
        if (status === 'A') {
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

  // Guru tanpa satu pun waktu efektif pada rentang ini tidak dinilai. Kalau
  // dibiarkan, persentasenya jatuh ke 0% dan ia menempati puncak urutan
  // "Performa (Terendah)" seolah tidak pernah hadir, padahal memang tidak ada
  // yang bisa dihadiri.
  const result = Array.from(statsGuru.values()).filter(g => g.total_wajib > 0).map(g => {
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

export async function hitungRekapDetailGuru(
  startDate: string,
  endDate: string,
  guruId: string,
  marhalahId: string,
  badalAsHadir: boolean,
  tahunAjaranId: string = ''
) {
  await ensureRekapGuruSchema()
  if (!guruId) return null

  const { start, end, dipangkas } = rentangEfektifRekapGuru(startDate, endDate)
  const kelasList = await getKelasListForRekap(marhalahId, tahunAjaranId, start, end)
  if (!kelasList.length) return null

  const guruRows = await query<{ id: number | string; nama_lengkap: string }>(
    'SELECT id, nama_lengkap FROM data_guru WHERE id = ? LIMIT 1',
    [guruId]
  )
  const guru = guruRows[0]
  if (!guru) return null

  const kelasIds = kelasList.map((k: any) => String(k.id))
  const absensiMap = await getAbsensiMap(kelasIds, start, end)
  const manualLiburSet = await getManualLiburSet(start, end)
  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))
  const gabungan = await getKelasGabunganPengajian(kelasIds)
  const gabunganByKelas = buildGabunganByKelas(gabungan)
  const gabunganMembersByGroup = buildGabunganMembersByGroup(gabungan)
  const dates = getDateRange(start, end)
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
        const jadwalGuru = resolved[session]
        const targetGuru = hasGuru(snapshot) ? snapshot : jadwalGuru
        if (String(targetGuru.id || '') !== targetGuruId) return

        // Default 'H' disengaja - lihat penjelasan jurnal pengecualian di
        // `hitungRekapKinerjaGuru`.
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
          sumber_guru: hasGuru(snapshot) ? 'snapshot' : 'jadwal',
          snapshot_guru_nama: snapshot.nama ?? null,
          jadwal_guru_nama: jadwalGuru.nama ?? null,
          snapshot_berbeda: isDifferentGuru(snapshot, jadwalGuru),
        })
      })
    })
  })

  return {
    guru: {
      id: String(guru.id),
      nama: guru.nama_lengkap,
    },
    rentang_efektif: { start, end, dipangkas },
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
