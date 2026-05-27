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
import { getCachedMapelList } from '@/lib/cache/master'

export async function getNilaiHarianInitialData() {
  const session = await getSession()
  if (!session) return { kelas: [], mapel: [] }
  await ensureGuruFeatureSchema()
  const [kelas, mapel] = await Promise.all([
    getAccessibleKelasForSession(session),
    getCachedMapelList(),
  ])
  return { kelas, mapel }
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
  nilai: { riwayatId: string; nilai: number }[]
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
  let sesiId = payload.sesiId || generateId()
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
    .map(row => ({ riwayatId: row.riwayatId, nilai: normalizeScore(row.nilai) }))

  if (nilaiRows.length > 0) {
    await batch(nilaiRows.map(row => ({
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

export async function getNilaiHarianRekap(kelasId: string, mapelId?: number) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return { sesi: [], santri: [], nilai: {} }
  await ensureGuruFeatureSchema()

  const params: unknown[] = [kelasId]
  const mapelClause = mapelId ? (params.push(mapelId), 'AND mapel_id = ?') : ''
  const sesi = await query<any>(`
    SELECT id, mapel_id, tanggal, nama_sesi, kkm
    FROM nilai_harian_sesi
    WHERE kelas_id = ? ${mapelClause}
    ORDER BY tanggal ASC, created_at ASC
  `, params)
  const santri = await getSantriForKelas(kelasId)

  if (!sesi.length || !santri.length) return { sesi, santri, nilai: {} }
  const sesiIds = sesi.map((row: any) => row.id)
  const placeholders = sesiIds.map(() => '?').join(',')
  const rows = await query<any>(`
    SELECT sesi_id, riwayat_pendidikan_id, nilai
    FROM nilai_harian_detail
    WHERE sesi_id IN (${placeholders})
  `, sesiIds)

  const nilai: Record<string, number> = {}
  for (const row of rows) nilai[`${row.riwayat_pendidikan_id}:${row.sesi_id}`] = row.nilai
  return { sesi, santri, nilai }
}
