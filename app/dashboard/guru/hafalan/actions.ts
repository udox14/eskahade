'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession } from '@/lib/auth/session'
import { execute, generateId, query, queryOne } from '@/lib/db'
import {
  canAccessKelas,
  ensureGuruFeatureSchema,
  getAccessibleKelasForSession,
  getGuruIdForSession,
  getSantriForKelas,
  HAFALAN_TYPES,
  isHafalanType,
} from '@/lib/akademik/guru-access'

export async function getHafalanInitialData() {
  const session = await getSession()
  if (!session) return { kelas: [], types: HAFALAN_TYPES }
  await ensureGuruFeatureSchema()
  const kelas = await getAccessibleKelasForSession(session)
  return { kelas, types: HAFALAN_TYPES }
}

export async function getAvailableHafalanTypes(kelasId: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return []
  await ensureGuruFeatureSchema()

  const kelas = await queryOne<{ marhalah_id: number | null }>('SELECT marhalah_id FROM kelas WHERE id = ?', [kelasId])
  if (!kelas?.marhalah_id) return []

  const rows = await query<{ jenis: string; total_bab: number; total_blok: number }>(`
    SELECT hb.jenis, COUNT(DISTINCT hb.id) AS total_bab, COUNT(hblk.id) AS total_blok
    FROM hafalan_bab hb
    JOIN hafalan_blok hblk ON hblk.bab_id = hb.id AND hblk.is_active = 1
    WHERE hb.marhalah_id = ? AND hb.is_active = 1
    GROUP BY hb.jenis
  `, [kelas.marhalah_id])

  return HAFALAN_TYPES
    .map(type => {
      const row = rows.find(item => item.jenis === type.key)
      return row ? { ...type, total_bab: row.total_bab, total_blok: row.total_blok } : null
    })
    .filter(Boolean)
}

export async function getHafalanInputData(kelasId: string, jenis: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return { santri: [], bab: [], progress: {} }
  if (!isHafalanType(jenis)) return { santri: [], bab: [], progress: {} }
  await ensureGuruFeatureSchema()

  const kelas = await queryOne<{ marhalah_id: number | null }>('SELECT marhalah_id FROM kelas WHERE id = ?', [kelasId])
  if (!kelas?.marhalah_id) return { santri: [], bab: [], progress: {} }

  const [santri, babRows] = await Promise.all([
    getSantriForKelas(kelasId),
    query<any>(`
      SELECT hb.id AS bab_id, hb.judul, hb.urutan AS bab_urutan,
             hblk.id AS blok_id, hblk.label, hblk.deskripsi, hblk.urutan AS blok_urutan
      FROM hafalan_bab hb
      LEFT JOIN hafalan_blok hblk ON hblk.bab_id = hb.id AND hblk.is_active = 1
      WHERE hb.jenis = ? AND hb.marhalah_id = ? AND hb.is_active = 1
      ORDER BY hb.urutan, hb.id, hblk.urutan, hblk.id
    `, [jenis, kelas.marhalah_id]),
  ])

  const babMap = new Map<number, any>()
  for (const row of babRows) {
    if (!babMap.has(row.bab_id)) {
      babMap.set(row.bab_id, { id: row.bab_id, judul: row.judul, urutan: row.bab_urutan, blok: [] })
    }
    if (row.blok_id) {
      babMap.get(row.bab_id).blok.push({
        id: row.blok_id,
        label: row.label,
        deskripsi: row.deskripsi,
        urutan: row.blok_urutan,
      })
    }
  }

  if (santri.length === 0) return { santri, bab: Array.from(babMap.values()), progress: {} }
  const riwayatIds = santri.map(row => row.riwayat_id)
  const placeholders = riwayatIds.map(() => '?').join(',')
  const progressRows = await query<{ blok_id: number; riwayat_pendidikan_id: string }>(`
    SELECT hp.blok_id, hp.riwayat_pendidikan_id
    FROM hafalan_progress hp
    JOIN hafalan_blok hblk ON hblk.id = hp.blok_id
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    WHERE hp.status = 'hafal'
      AND hb.jenis = ?
      AND hb.marhalah_id = ?
      AND hp.riwayat_pendidikan_id IN (${placeholders})
  `, [jenis, kelas.marhalah_id, ...riwayatIds])

  const progress: Record<string, boolean> = {}
  for (const row of progressRows) progress[`${row.riwayat_pendidikan_id}:${row.blok_id}`] = true
  return { santri, bab: Array.from(babMap.values()), progress }
}

export async function toggleHafalanProgress(payload: { kelasId: string; jenis: string; riwayatId: string; blokId: number }) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, payload.kelasId))) return { error: 'Akses kelas ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  await ensureGuruFeatureSchema()

  const valid = await queryOne<{ id: number }>(`
    SELECT hblk.id
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    JOIN kelas k ON k.marhalah_id = hb.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.id = ?
    WHERE k.id = ?
      AND hblk.id = ?
      AND hb.jenis = ?
      AND hb.is_active = 1
      AND hblk.is_active = 1
  `, [payload.riwayatId, payload.kelasId, payload.blokId, payload.jenis])
  if (!valid) return { error: 'Blok hafalan tidak tersedia untuk kelas ini.' }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM hafalan_progress WHERE blok_id = ? AND riwayat_pendidikan_id = ? AND status = 'hafal'",
    [payload.blokId, payload.riwayatId]
  )

  if (existing) {
    await execute('DELETE FROM hafalan_progress WHERE id = ?', [existing.id])
  } else {
    await execute(`
      INSERT INTO hafalan_progress (id, blok_id, riwayat_pendidikan_id, guru_id, status, tanggal_setor, updated_by, updated_at)
      VALUES (?, ?, ?, ?, 'hafal', date('now'), ?, datetime('now'))
      ON CONFLICT(blok_id, riwayat_pendidikan_id) DO UPDATE SET
        guru_id = excluded.guru_id,
        status = 'hafal',
        tanggal_setor = excluded.tanggal_setor,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `, [generateId(), payload.blokId, payload.riwayatId, await getGuruIdForSession(session), session.id])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_hafalan',
    action: existing ? 'delete' : 'update',
    fiturHref: '/dashboard/guru/hafalan',
    logKind: 'update',
    entityType: 'hafalan_progress',
    entityId: `${payload.riwayatId}:${payload.blokId}`,
    summary: existing ? 'Membatalkan blok hafalan santri' : 'Menandai blok hafalan santri',
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, blok_id: payload.blokId },
  })

  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, checked: !existing }
}

export async function simpanHafalanProgressBatch(payload: {
  kelasId: string
  jenis: string
  riwayatId: string
  checkedBlokIds: number[]
}) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, payload.kelasId))) return { error: 'Akses kelas ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  await ensureGuruFeatureSchema()

  const validRows = await query<{ id: number }>(`
    SELECT hblk.id
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    JOIN kelas k ON k.marhalah_id = hb.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.id = ?
    WHERE k.id = ?
      AND hb.jenis = ?
      AND hb.is_active = 1
      AND hblk.is_active = 1
  `, [payload.riwayatId, payload.kelasId, payload.jenis])

  const validIds = new Set(validRows.map(row => Number(row.id)))
  const checkedIds = Array.from(new Set((payload.checkedBlokIds || []).map(Number).filter(id => validIds.has(id))))
  const guruId = await getGuruIdForSession(session)
  if (validIds.size === 0) return { error: 'Belum ada blok hafalan aktif untuk kelas ini.' }

  const validPlaceholders = Array.from(validIds).map(() => '?').join(',')
  await execute(
    `DELETE FROM hafalan_progress
     WHERE riwayat_pendidikan_id = ?
       AND blok_id IN (${validPlaceholders})`,
    [payload.riwayatId, ...Array.from(validIds)]
  )

  for (const blokId of checkedIds) {
    await execute(`
      INSERT INTO hafalan_progress (id, blok_id, riwayat_pendidikan_id, guru_id, status, tanggal_setor, updated_by, updated_at)
      VALUES (?, ?, ?, ?, 'hafal', date('now'), ?, datetime('now'))
    `, [generateId(), blokId, payload.riwayatId, guruId, session.id])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_hafalan',
    action: 'update',
    fiturHref: '/dashboard/guru/hafalan',
    logKind: 'update',
    entityType: 'hafalan_progress_batch',
    entityId: `${payload.riwayatId}:${payload.jenis}`,
    summary: `Menyimpan hafalan ${payload.jenis} untuk ${checkedIds.length} blok`,
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, total_blok: checkedIds.length },
  })

  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, checkedBlokIds: checkedIds }
}
