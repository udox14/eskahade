'use server'

import { execute, query, queryOne } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { getAccessibleKelasForSession } from '@/lib/akademik/guru-access'
import { countActiveSessions, getDateRange, type SessionType } from '@/lib/absensi/pengajian'

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

export async function getUserScope() {
  const session = await getSession()
  if (!session) return { role: 'guest', filter: null }

  const role = session.role

  if (hasRole(session, 'pengurus_asrama')) {
    return { role, type: 'ASRAMA', value: session.asrama_binaan, locked: true }
  }

  if (
    hasRole(session, 'guru') ||
    hasRole(session, 'wali_kelas')
  ) {
    const kelas = await getAccessibleKelasForSession(session)
    const options = (kelas || []).map((k: any) => ({
      id: String(k.id),
      nama_kelas: k.nama_kelas,
    }))

    if (options.length === 1) {
      return { role, type: 'KELAS', value: options[0].id, locked: true, kelasOptions: options }
    }

    return { role, type: 'KELAS', value: null, locked: false, kelasOptions: options }
  }

  return { role, type: 'GLOBAL', value: null, locked: false, kelasOptions: null }
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
    const allowed = (scope.kelasOptions || []).map((k: any) => String(k.id))
    if (scope.locked) {
      filterKelasId = scope.value ?? ''
    } else if (!filterKelasId || !allowed.includes(String(filterKelasId))) {
      return []
    }
    if (!filterKelasId) return []
    sql += ' AND rp.kelas_id = ?'; params.push(filterKelasId)
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
      asrama: s.asrama || '-',
      kamar: s.kamar || '-',
      info_asrama: `${s.asrama || '-'}/ ${s.kamar || '-'}`,
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

export async function getReferensiFilter(asrama = '') {
  const session = await getSession()
  const unrestricted = session && (isAdmin(session) || hasAnyRole(session, ['sekpen', 'akademik']))

  let kelas: any[]
  if (unrestricted) {
    kelas = await query<any>(`
      SELECT k.id, k.nama_kelas
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    `)
  } else if (session && (hasRole(session, 'guru') || hasRole(session, 'wali_kelas'))) {
    const accessible = await getAccessibleKelasForSession(session)
    kelas = (accessible || []).map((k: any) => ({ id: String(k.id), nama_kelas: k.nama_kelas }))
  } else {
    kelas = await query<any>(`
      SELECT k.id, k.nama_kelas
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    `)
  }

  const sorted = kelas.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  const asramaList = await query<{ asrama: string }>(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL AND asrama != ''
    ORDER BY asrama
  `).then(rows => rows.map(r => r.asrama))

  let kamarList: string[] = []
  if (asrama) {
    kamarList = await query<{ kamar: string }>(`
      SELECT DISTINCT kamar
      FROM santri
      WHERE status_global = 'aktif'
        AND asrama = ?
        AND kamar IS NOT NULL AND kamar != ''
    `, [asrama]).then(rows =>
      rows.map(r => r.kamar).sort((a, b) => {
        const na = Number(a)
        const nb = Number(b)
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
        return a.localeCompare(b)
      })
    )
  }

  return { kelas: sorted, asramaList, kamarList }
}
