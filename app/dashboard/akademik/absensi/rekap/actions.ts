'use server'

import { execute, query, queryOne } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'

const VALID_SESI = ['shubuh', 'ashar', 'maghrib'] as const
type SessionType = typeof VALID_SESI[number]

async function ensureLiburPengajianTable() {
  try {
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
  } catch {
    // noop
  }
}

function normalizeDate(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : ''
}

function getDateRange(startDate: string, endDate: string) {
  const start = normalizeDate(startDate)
  const end = normalizeDate(endDate)
  if (!start && !end) return { start: '', end: '' }
  if (start && end) return start <= end ? { start, end } : { start: end, end: start }
  return { start: start || end, end: end || start }
}

function isHoliday(dateStr: string, session: SessionType) {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  if (day === 2 && session === 'maghrib') return true
  if (day === 4 && session === 'maghrib') return true
  if (day === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

function countActiveSessions(startDate: string, endDate: string, liburSet: Set<string>) {
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

export async function getUserScope() {
  const session = await getSession()
  if (!session) return { role: 'guest', filter: null }

  const role = session.role

  if (hasRole(session, 'pengurus_asrama')) {
    return { role, type: 'ASRAMA', value: session.asrama_binaan }
  }

  if (hasRole(session, 'wali_kelas')) {
    const kelas = await queryOne<{ id: string }>(`
      SELECT k.id FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.wali_kelas_id = ? LIMIT 1
    `, [session.id])
    return { role, type: 'KELAS', value: kelas?.id }
  }

  return { role, type: 'GLOBAL', value: null }
}

export async function getRekapAbsensi(
  filterNama: string,
  filterAsrama: string,
  filterKelasId: string,
  filterKamar: string,
  startDate = '',
  endDate = ''
) {
  await ensureLiburPengajianTable()
  const scope = await getUserScope()
  const range = getDateRange(startDate, endDate)

  let sql = `
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
           rp.id AS riwayat_id,
           k.nama_kelas
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE s.status_global = 'aktif'
  `
  const params: any[] = []

  if (scope.type === 'ASRAMA') {
    if (!scope.value) return []
    sql += ' AND s.asrama = ?'; params.push(scope.value)
  } else if (scope.type === 'KELAS') {
    if (!scope.value) return []
    sql += ' AND rp.kelas_id = ?'; params.push(scope.value)
  }

  if (filterAsrama && scope.type !== 'ASRAMA') { sql += ' AND s.asrama = ?'; params.push(filterAsrama) }
  if (filterKamar) { sql += ' AND s.kamar = ?'; params.push(filterKamar) }
  if (filterKelasId && scope.type !== 'KELAS') { sql += ' AND rp.kelas_id = ?'; params.push(filterKelasId) }
  if (filterNama) { sql += ' AND s.nama_lengkap LIKE ?'; params.push(`%${filterNama}%`) }

  sql += ' ORDER BY s.nama_lengkap LIMIT 100'

  const santriList = await query<any>(sql, params)
  if (!santriList.length) return []

  const riwayatIds = santriList.map((s: any) => s.riwayat_id)
  const ph = riwayatIds.map(() => '?').join(',')

  const dateWhere = range.start && range.end ? 'AND tanggal >= ? AND tanggal <= ?' : ''
  const dateParams = range.start && range.end ? [range.start, range.end] : []

  const absenList = await query<any>(`
    SELECT riwayat_pendidikan_id, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${ph})
      ${dateWhere}
      AND (
        shubuh IN ('A','S','I')
        OR ashar IN ('A','S','I')
        OR maghrib IN ('A','S','I')
      )
  `, [...riwayatIds, ...dateParams])

  let totalActiveSessions = 0
  if (range.start && range.end) {
    const liburList = await query<{ tanggal: string; sesi: SessionType }>(`
      SELECT tanggal, sesi
      FROM pengajian_libur_sesi
      WHERE tanggal >= ? AND tanggal <= ?
    `, [range.start, range.end])
    totalActiveSessions = countActiveSessions(
      range.start,
      range.end,
      new Set(liburList.map(item => `${item.tanggal}-${item.sesi}`))
    )
  }

  const result = santriList.map((s: any) => {
    const absenAnak = absenList.filter((a: any) => a.riwayat_pendidikan_id === s.riwayat_id)
    let sakit = 0, izin = 0, alfa = 0

    absenAnak.forEach((row: any) => {
      if (row.shubuh === 'S') sakit++; if (row.shubuh === 'I') izin++; if (row.shubuh === 'A') alfa++
      if (row.ashar === 'S') sakit++;  if (row.ashar === 'I') izin++;  if (row.ashar === 'A') alfa++
      if (row.maghrib === 'S') sakit++; if (row.maghrib === 'I') izin++; if (row.maghrib === 'A') alfa++
    })

    const hadir = totalActiveSessions > 0 ? Math.max(totalActiveSessions - sakit - izin - alfa, 0) : 0

    return {
      id: s.id,
      nama: s.nama_lengkap,
      nis: s.nis,
      info_asrama: `${s.asrama || '-'} - Kamar ${s.kamar || '-'}`,
      info_kelas: s.nama_kelas || '-',
      total_h: hadir,
      total_s: sakit,
      total_i: izin,
      total_a: alfa,
      total_masalah: sakit + izin + alfa,
    }
  })

  return result.sort((a: any, b: any) => b.total_a - a.total_a)
}

export async function getDetailAbsensiSantri(santriId: string, startDate = '', endDate = '') {
  const riwayat = await queryOne<{ id: string }>(
    `SELECT id FROM riwayat_pendidikan WHERE santri_id = ? AND status_riwayat = 'aktif'`,
    [santriId]
  )
  if (!riwayat) return []

  const range = getDateRange(startDate, endDate)
  const dateWhere = range.start && range.end ? 'AND tanggal >= ? AND tanggal <= ?' : ''
  const params = range.start && range.end ? [riwayat.id, range.start, range.end] : [riwayat.id]

  return query<any>(`
    SELECT tanggal, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id = ?
      ${dateWhere}
      AND (
        shubuh IN ('A','S','I')
        OR ashar IN ('A','S','I')
        OR maghrib IN ('A','S','I')
      )
    ORDER BY tanggal DESC
  `, params)
}

export async function getReferensiFilter() {
  const kelas = await query<any>(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)
  const sorted = kelas.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
  return { kelas: sorted }
}
