'use server'

import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

export async function getUserScope() {
  const session = await getSession()
  if (!session) return { role: 'guest', filter: null }

  const role = session.role

  if (role === 'pengurus_asrama') {
    return { role, type: 'ASRAMA', value: session.asrama_binaan }
  }

  if (role === 'wali_kelas') {
    const kelas = await queryOne<{ id: string }>(
      'SELECT id FROM kelas WHERE wali_kelas_id = ?', [session.id]
    )
    return { role, type: 'KELAS', value: kelas?.id }
  }

  return { role, type: 'GLOBAL', value: null }
}

export async function getRekapAbsensi(
  filterNama: string,
  filterAsrama: string,
  filterKelasId: string,
  filterKamar: string
) {
  const scope = await getUserScope()

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

  const absenList = await query<any>(`
    SELECT riwayat_pendidikan_id, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${ph})
      AND (shubuh != 'H' OR ashar != 'H' OR maghrib != 'H')
  `, riwayatIds)

  const result = santriList.map((s: any) => {
    const absenAnak = absenList.filter((a: any) => a.riwayat_pendidikan_id === s.riwayat_id)
    let sakit = 0, izin = 0, alfa = 0

    absenAnak.forEach((row: any) => {
      if (row.shubuh === 'S') sakit++; if (row.shubuh === 'I') izin++; if (row.shubuh === 'A') alfa++
      if (row.ashar === 'S') sakit++;  if (row.ashar === 'I') izin++;  if (row.ashar === 'A') alfa++
      if (row.maghrib === 'S') sakit++; if (row.maghrib === 'I') izin++; if (row.maghrib === 'A') alfa++
    })

    return {
      id: s.id,
      nama: s.nama_lengkap,
      nis: s.nis,
      info_asrama: `${s.asrama || '-'} - Kamar ${s.kamar || '-'}`,
      info_kelas: s.nama_kelas || '-',
      total_s: sakit,
      total_i: izin,
      total_a: alfa,
      total_masalah: sakit + izin + alfa,
    }
  })

  return result.sort((a: any, b: any) => b.total_a - a.total_a)
}

export async function getDetailAbsensiSantri(santriId: string) {
  const riwayat = await queryOne<{ id: string }>(
    `SELECT id FROM riwayat_pendidikan WHERE santri_id = ? AND status_riwayat = 'aktif'`,
    [santriId]
  )
  if (!riwayat) return []

  return query<any>(`
    SELECT tanggal, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id = ?
      AND (shubuh != 'H' OR ashar != 'H' OR maghrib != 'H')
    ORDER BY tanggal DESC
  `, [riwayat.id])
}

export async function getReferensiFilter() {
  const kelas = await query<any>('SELECT id, nama_kelas FROM kelas')
  const sorted = kelas.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
  return { kelas: sorted }
}