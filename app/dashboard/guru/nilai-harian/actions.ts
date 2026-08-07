'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession } from '@/lib/auth/session'
import { batch, execute, generateId, query, queryOne } from '@/lib/db'
import {
  canAccessKelas,
  ensureGuruFeatureSchema,
  getAccessibleKelasForSession,
  getGuruIdForSession,
  getSantriForKelas,
} from '@/lib/akademik/guru-access'

export type NilaiHarianRekapView = 'sesi' | 'mapel' | 'semua'

export type NilaiHarianStats = {
  count: number
  avg: number
  min: number
  max: number
  tuntas: number
  tidakTuntas: number
  pctTuntas: number
  histogram: number[]
}

function computeStatsPerValue(values: { nilai: number; kkm: number }[]): NilaiHarianStats {
  const histogram = [0, 0, 0, 0, 0, 0]
  for (const item of values) {
    const v = item.nilai
    if (v < 50) histogram[0]++
    else if (v < 60) histogram[1]++
    else if (v < 70) histogram[2]++
    else if (v < 80) histogram[3]++
    else if (v < 90) histogram[4]++
    else histogram[5]++
  }
  const count = values.length
  if (!count) {
    return { count: 0, avg: 0, min: 0, max: 0, tuntas: 0, tidakTuntas: 0, pctTuntas: 0, histogram }
  }
  const sum = values.reduce((acc, item) => acc + item.nilai, 0)
  const tuntas = values.filter(item => item.nilai >= item.kkm).length
  return {
    count,
    avg: Math.round((sum / count) * 10) / 10,
    min: Math.min(...values.map(item => item.nilai)),
    max: Math.max(...values.map(item => item.nilai)),
    tuntas,
    tidakTuntas: count - tuntas,
    pctTuntas: Math.round((tuntas / count) * 1000) / 10,
    histogram,
  }
}

function aggregatePerSantri(
  values: { riwayatId: string; nilai: number; kkm: number }[],
  santriById: Map<string, { riwayat_id: string; nama: string; nis: string | null }>
) {
  const byRiwayat = new Map<string, { nilai: number; kkm: number }[]>()
  for (const item of values) {
    const arr = byRiwayat.get(item.riwayatId) || []
    arr.push(item)
    byRiwayat.set(item.riwayatId, arr)
  }
  const rows = Array.from(santriById.values()).map(santri => ({
    riwayat_id: santri.riwayat_id,
    nama: santri.nama,
    nis: santri.nis,
    ...computeStatsPerValue(byRiwayat.get(santri.riwayat_id) || []),
  }))
  return rows.sort((a, b) => b.avg - a.avg)
}

export async function getNilaiHarianInitialData() {
  const session = await getSession()
  if (!session) return { kelas: [] }
  await ensureGuruFeatureSchema()
  const kelas = await getAccessibleKelasForSession(session)
  return { kelas }
}

export async function getNilaiHarianMapelHome(kelasId: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return []
  await ensureGuruFeatureSchema()

  const kelas = await queryOne<{ marhalah_id: number | null; tahun_ajaran_id: number | null }>(
    'SELECT marhalah_id, tahun_ajaran_id FROM kelas WHERE id = ?',
    [kelasId]
  )
  if (!kelas) return []

  const mapelMap = new Map<number, { id: number; nama: string; nama_kitab: string }>()

  if (kelas.marhalah_id && kelas.tahun_ajaran_id) {
    const rows = await query<{ id: number; nama: string; nama_kitab: string }>(`
      SELECT mp.id, mp.nama,
             COALESCE(REPLACE(GROUP_CONCAT(DISTINCT kt.nama_kitab), ',', ', '), '-') AS nama_kitab
      FROM kitab kt
      JOIN mapel mp ON mp.id = kt.mapel_id
      WHERE kt.marhalah_id = ? AND kt.tahun_ajaran_id = ?
      GROUP BY mp.id, mp.nama
      ORDER BY mp.nama ASC
    `, [kelas.marhalah_id, kelas.tahun_ajaran_id])
    for (const row of rows) {
      mapelMap.set(Number(row.id), { id: Number(row.id), nama: row.nama, nama_kitab: row.nama_kitab || '-' })
    }
  }

  const existing = await query<{ id: number; nama: string }>(`
    SELECT DISTINCT mp.id, mp.nama
    FROM nilai_harian_sesi nhs
    JOIN mapel mp ON mp.id = nhs.mapel_id
    WHERE nhs.kelas_id = ?
    ORDER BY mp.nama ASC
  `, [kelasId])
  for (const row of existing) {
    const id = Number(row.id)
    if (!mapelMap.has(id)) mapelMap.set(id, { id, nama: row.nama, nama_kitab: '-' })
  }

  if (mapelMap.size === 0) return []
  const ids = Array.from(mapelMap.keys())
  const placeholders = ids.map(() => '?').join(',')
  const counts = await query<{ mapel_id: number; total: number }>(`
    SELECT mapel_id, COUNT(*) AS total
    FROM nilai_harian_sesi
    WHERE kelas_id = ? AND mapel_id IN (${placeholders})
    GROUP BY mapel_id
  `, [kelasId, ...ids])
  const countByMapel = new Map(counts.map(row => [Number(row.mapel_id), Number(row.total)]))

  return Array.from(mapelMap.values()).map(item => ({
    ...item,
    total_sesi: countByMapel.get(item.id) || 0,
  }))
}

export async function getNilaiHarianSesi(kelasId: string, mapelId?: number) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return []
  await ensureGuruFeatureSchema()

  const params: unknown[] = [kelasId]
  const mapelClause = mapelId ? (params.push(mapelId), 'AND nhs.mapel_id = ?') : ''

  return query<any>(`
    SELECT nhs.id, nhs.kelas_id, nhs.mapel_id, mp.nama AS mapel_nama, nhs.tanggal,
           nhs.nama_sesi, nhs.kkm, nhs.deskripsi, nhs.guru_id, g.nama_lengkap AS guru_nama,
           COUNT(nhd.id) AS total_nilai
    FROM nilai_harian_sesi nhs
    JOIN mapel mp ON mp.id = nhs.mapel_id
    LEFT JOIN data_guru g ON g.id = nhs.guru_id
    LEFT JOIN nilai_harian_detail nhd ON nhd.sesi_id = nhs.id
    WHERE nhs.kelas_id = ? ${mapelClause}
    GROUP BY nhs.id
    ORDER BY nhs.tanggal DESC, nhs.created_at DESC
  `, params)
}

export async function getNilaiHarianInputData(kelasId: string, sesiId?: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return { santri: [], nilai: {} }
  await ensureGuruFeatureSchema()

  const santri = await getSantriForKelas(kelasId)
  if (!sesiId || santri.length === 0) return { santri, nilai: {} }

  const rows = await query<{ riwayat_pendidikan_id: string; nilai: number }>(
    'SELECT riwayat_pendidikan_id, nilai FROM nilai_harian_detail WHERE sesi_id = ?',
    [sesiId]
  )

  return {
    santri,
    nilai: Object.fromEntries(rows.map(row => [row.riwayat_pendidikan_id, row.nilai])),
  }
}

function normalizeScore(value: unknown) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, Math.round(score)))
}

export async function simpanNilaiHarian(payload: {
  kelasId: string
  mapelId: number
  sesiId?: string | null
  tanggal: string
  namaSesi: string
  kkm: number
  deskripsi?: string
  nilai: { riwayatId: string; nilai: number | null }[]
}) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, payload.kelasId))) return { error: 'Akses kelas ditolak.' }
  await ensureGuruFeatureSchema()

  const namaSesi = String(payload.namaSesi || '').trim()
  if (!namaSesi) return { error: 'Nama sesi wajib diisi.' }
  if (!payload.mapelId) return { error: 'Mapel wajib dipilih.' }
  if (!payload.tanggal) return { error: 'Tanggal wajib diisi.' }

  const kelas = await queryOne<{ tahun_ajaran_id: number | null }>(
    'SELECT tahun_ajaran_id FROM kelas WHERE id = ?',
    [payload.kelasId]
  )
  if (!kelas) return { error: 'Kelas tidak ditemukan.' }

  const guruId = await getGuruIdForSession(session)
  const sesiId = payload.sesiId || generateId()
  const existing = payload.sesiId
    ? await queryOne<{ id: string }>('SELECT id FROM nilai_harian_sesi WHERE id = ? AND kelas_id = ?', [payload.sesiId, payload.kelasId])
    : null

  if (existing) {
    await execute(`
      UPDATE nilai_harian_sesi
      SET mapel_id = ?, guru_id = ?, tanggal = ?, nama_sesi = ?, kkm = ?, deskripsi = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      payload.mapelId,
      guruId,
      payload.tanggal,
      namaSesi,
      normalizeScore(payload.kkm),
      String(payload.deskripsi || '').trim() || null,
      sesiId,
    ])
  } else {
    await execute(`
      INSERT INTO nilai_harian_sesi (
        id, kelas_id, mapel_id, guru_id, tahun_ajaran_id, tanggal, nama_sesi, kkm, deskripsi, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sesiId,
      payload.kelasId,
      payload.mapelId,
      guruId,
      kelas.tahun_ajaran_id,
      payload.tanggal,
      namaSesi,
      normalizeScore(payload.kkm),
      String(payload.deskripsi || '').trim() || null,
      session.id,
    ])
  }

  const allowed = new Set((await getSantriForKelas(payload.kelasId)).map(row => row.riwayat_id))
  const nilaiRows = (payload.nilai || [])
    .filter(row => allowed.has(row.riwayatId))
    .map(row => ({ riwayatId: row.riwayatId, nilai: row.nilai == null ? null : normalizeScore(row.nilai) }))

  const toUpsert = nilaiRows.filter(row => row.nilai !== null)
  const toDelete = nilaiRows.filter(row => row.nilai === null)

  if (toUpsert.length > 0) {
    await batch(toUpsert.map(row => ({
      sql: `
        INSERT INTO nilai_harian_detail (id, sesi_id, riwayat_pendidikan_id, nilai, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(sesi_id, riwayat_pendidikan_id) DO UPDATE SET
          nilai = excluded.nilai,
          updated_at = excluded.updated_at
      `,
      params: [generateId(), sesiId, row.riwayatId, row.nilai],
    })))
  }
  if (toDelete.length > 0) {
    await batch(toDelete.map(row => ({
      sql: 'DELETE FROM nilai_harian_detail WHERE sesi_id = ? AND riwayat_pendidikan_id = ?',
      params: [sesiId, row.riwayatId],
    })))
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_nilai_harian',
    action: existing ? 'update' : 'create',
    fiturHref: '/dashboard/guru/nilai-harian',
    logKind: existing ? 'update' : 'create',
    entityType: 'nilai_harian_sesi',
    entityId: sesiId,
    entityLabel: namaSesi,
    summary: `Menyimpan nilai harian ${namaSesi} untuk ${nilaiRows.length} santri`,
    details: { kelas_id: payload.kelasId, mapel_id: payload.mapelId, kkm: normalizeScore(payload.kkm) },
  })

  revalidatePath('/dashboard/guru/nilai-harian')
  return { success: true, sesiId, count: nilaiRows.length }
}

export async function hapusNilaiHarianSesi(sesiId: string, kelasId: string) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, kelasId))) return { error: 'Akses kelas ditolak.' }
  await ensureGuruFeatureSchema()

  const sesi = await queryOne<{ id: string; nama_sesi: string }>(
    'SELECT id, nama_sesi FROM nilai_harian_sesi WHERE id = ? AND kelas_id = ?',
    [sesiId, kelasId]
  )
  if (!sesi) return { error: 'Sesi tidak ditemukan.' }

  await execute('DELETE FROM nilai_harian_detail WHERE sesi_id = ?', [sesiId])
  await execute('DELETE FROM nilai_harian_sesi WHERE id = ?', [sesiId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_nilai_harian',
    action: 'delete',
    fiturHref: '/dashboard/guru/nilai-harian',
    logKind: 'delete',
    entityType: 'nilai_harian_sesi',
    entityId: sesiId,
    entityLabel: sesi.nama_sesi,
    summary: `Menghapus sesi nilai harian ${sesi.nama_sesi}`,
    details: { kelas_id: kelasId },
  })

  revalidatePath('/dashboard/guru/nilai-harian')
  return { success: true }
}

export async function getNilaiHarianRekapData(
  kelasId: string,
  view: NilaiHarianRekapView = 'sesi',
  sesiId?: string,
  mapelId?: number
) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return { error: 'Akses ditolak.' }
  await ensureGuruFeatureSchema()

  const [santri, kelas, sesiRows] = await Promise.all([
    getSantriForKelas(kelasId),
    queryOne<{ marhalah_id: number | null; tahun_ajaran_id: number | null }>(
      'SELECT marhalah_id, tahun_ajaran_id FROM kelas WHERE id = ?',
      [kelasId]
    ),
    query<any>(`
      SELECT nhs.id, nhs.mapel_id, mp.nama AS mapel_nama, nhs.tanggal, nhs.nama_sesi, nhs.kkm
      FROM nilai_harian_sesi nhs
      JOIN mapel mp ON mp.id = nhs.mapel_id
      WHERE nhs.kelas_id = ?
      ORDER BY mp.nama ASC, nhs.tanggal DESC, nhs.created_at DESC
    `, [kelasId]),
  ])

  const emptyBase = {
    view,
    empty: true,
    sesiList: [],
    mapelList: [],
    selectedSesi: null,
    selectedMapel: null,
    santriList: [],
    perSesi: [],
    perMapel: [],
    perSantri: [],
    stats: computeStatsPerValue([]),
    selectedSesiId: null,
    selectedMapelId: null,
  }
  if (sesiRows.length === 0 || santri.length === 0) return emptyBase

  const kitabMap = new Map<number, string>()
  if (kelas?.marhalah_id && kelas?.tahun_ajaran_id) {
    const kitabRows = await query<{ mapel_id: number; nama_kitab: string }>(`
      SELECT kt.mapel_id, REPLACE(GROUP_CONCAT(DISTINCT kt.nama_kitab), ',', ', ') AS nama_kitab
      FROM kitab kt
      WHERE kt.marhalah_id = ? AND kt.tahun_ajaran_id = ?
      GROUP BY kt.mapel_id
    `, [kelas.marhalah_id, kelas.tahun_ajaran_id])
    for (const row of kitabRows) kitabMap.set(Number(row.mapel_id), row.nama_kitab)
  }

  const sesiById = new Map(sesiRows.map((row: any) => [row.id, row]))
  const mapelCount = new Map<number, number>()
  for (const row of sesiRows) {
    const id = Number(row.mapel_id)
    mapelCount.set(id, (mapelCount.get(id) || 0) + 1)
  }
  const mapelList = Array.from(mapelCount.entries()).map(([mapel_id, total_sesi]) => {
    const first = sesiRows.find((row: any) => Number(row.mapel_id) === mapel_id)
    return {
      mapel_id,
      mapel_nama: first?.mapel_nama || `Mapel ${mapel_id}`,
      nama_kitab: kitabMap.get(mapel_id) || '-',
      total_sesi,
    }
  })

  const details = await query<{ sesi_id: string; riwayat_pendidikan_id: string; nilai: number }>(`
    SELECT nhd.sesi_id, nhd.riwayat_pendidikan_id, nhd.nilai
    FROM nilai_harian_detail nhd
    JOIN nilai_harian_sesi nhs ON nhs.id = nhd.sesi_id
    WHERE nhs.kelas_id = ?
  `, [kelasId])

  const valuesBySesi = new Map<string, { riwayatId: string; nilai: number; kkm: number }[]>()
  const valuesByMapel = new Map<number, { riwayatId: string; nilai: number; kkm: number }[]>()
  const allValues: { riwayatId: string; nilai: number; kkm: number }[] = []
  for (const detail of details) {
    const sesi = sesiById.get(detail.sesi_id)
    if (!sesi) continue
    const item = {
      riwayatId: detail.riwayat_pendidikan_id,
      nilai: Number(detail.nilai),
      kkm: Number(sesi.kkm || 0),
    }
    allValues.push(item)
    const arrSesi = valuesBySesi.get(detail.sesi_id) || []
    arrSesi.push(item)
    valuesBySesi.set(detail.sesi_id, arrSesi)
    const arrMapel = valuesByMapel.get(Number(sesi.mapel_id)) || []
    arrMapel.push(item)
    valuesByMapel.set(Number(sesi.mapel_id), arrMapel)
  }

  const santriById = new Map(santri.map((row: any) => [row.riwayat_id, row]))

  if (view === 'sesi') {
    const pool = mapelId
      ? sesiRows.filter((row: any) => Number(row.mapel_id) === mapelId)
      : sesiRows
    const selected = sesiId ? pool.find((row: any) => row.id === sesiId) || pool[0] : pool[0]
    const values = valuesBySesi.get(selected.id) || []
    const nilaiByRiwayat = new Map(values.map(item => [item.riwayatId, item.nilai]))
    const santriList = santri.map((row: any) => ({
      riwayat_id: row.riwayat_id,
      nama: row.nama,
      nis: row.nis,
      nilai: nilaiByRiwayat.get(row.riwayat_id) ?? null,
    }))
    return {
      view,
      empty: false,
      sesiList: pool.map((row: any) => ({
        id: row.id,
        mapel_id: row.mapel_id,
        mapel_nama: row.mapel_nama,
        nama_sesi: row.nama_sesi,
        tanggal: row.tanggal,
        kkm: Number(row.kkm || 0),
      })),
      mapelList,
      selectedSesi: {
        id: selected.id,
        mapel_id: selected.mapel_id,
        mapel_nama: selected.mapel_nama,
        nama_sesi: selected.nama_sesi,
        tanggal: selected.tanggal,
        kkm: Number(selected.kkm || 0),
      },
      selectedMapel: null,
      santriList,
      perSesi: [],
      perMapel: [],
      perSantri: [],
      stats: computeStatsPerValue(values),
      selectedSesiId: selected.id,
      selectedMapelId: null,
    }
  }

  if (view === 'mapel') {
    const selectedMapelId = mapelId ?? mapelList[0].mapel_id
    const mapelSesi = sesiRows.filter((row: any) => Number(row.mapel_id) === selectedMapelId)
    const perSesi = mapelSesi.map((row: any) => ({
      id: row.id,
      nama_sesi: row.nama_sesi,
      tanggal: row.tanggal,
      kkm: Number(row.kkm || 0),
      ...computeStatsPerValue(valuesBySesi.get(row.id) || []),
    }))
    const values = valuesByMapel.get(selectedMapelId) || []
    const selectedMapel = mapelList.find(item => item.mapel_id === selectedMapelId) || null
    return {
      view,
      empty: false,
      sesiList: [],
      mapelList,
      selectedSesi: null,
      selectedMapel,
      santriList: [],
      perSesi,
      perMapel: [],
      perSantri: aggregatePerSantri(values, santriById),
      stats: computeStatsPerValue(values),
      selectedSesiId: null,
      selectedMapelId: selectedMapelId,
    }
  }

  const perMapel = mapelList.map(item => ({
    ...item,
    ...computeStatsPerValue(valuesByMapel.get(item.mapel_id) || []),
  }))
  return {
    view,
    empty: false,
    sesiList: [],
    mapelList,
    selectedSesi: null,
    selectedMapel: null,
    santriList: [],
    perSesi: [],
    perMapel,
    perSantri: aggregatePerSantri(allValues, santriById),
    stats: computeStatsPerValue(allValues),
    selectedSesiId: null,
    selectedMapelId: null,
  }
}
