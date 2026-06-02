'use server'

import { batch, execute, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import {
  ensureGuruKitabSchema,
  generateGuruKitabDefaultAssignments,
  getDefaultMapelKeys,
  getGuruKitabAssignments,
  getGuruKitabResolvedForEhb as resolveGuruKitabForEhb,
  GURU_KITAB_SESSIONS,
  type GuruKitabSession,
} from '@/lib/akademik/guru-kitab'
import {
  getKelasGabunganPengajian,
} from '@/lib/akademik/guru-jadwal'
import {
  getCachedDataGuru,
  getCachedMarhalahList,
  getCachedTahunAjaranAktif,
  getCachedTahunAjaranList,
} from '@/lib/cache/master'

export type GuruKitabSaveRow = {
  kelas_id: string
  sesi: GuruKitabSession
  hari_index?: number | null
  guru_id: number | null
  kitab_id: number | null
  source?: 'auto' | 'manual'
  is_active?: number
}

export async function getGuruKitabSetup(tahunAjaranId?: number | null, marhalahId?: string | null) {
  await ensureGuruKitabSchema()
  const aktif = await getCachedTahunAjaranAktif()
  const tahunId = Number(tahunAjaranId || aktif?.id || 0)
  const [tahunAjaranList, marhalahList, guruList] = await Promise.all([
    getCachedTahunAjaranList(),
    getCachedMarhalahList(),
    getCachedDataGuru(),
  ])

  if (!tahunId) {
    return {
      tahunAjaranAktif: aktif,
      tahunAjaranList,
      marhalahList,
      guruList,
      kelasList: [],
      kitabList: [],
      assignments: [],
      gabunganList: [],
      defaultMapel: [],
    }
  }

  if (!marhalahId) {
    return {
      tahunAjaranAktif: aktif,
      tahunAjaranList,
      marhalahList,
      guruList,
      kelasList: [],
      kitabList: [],
      assignments: [],
      gabunganList: [],
      defaultMapel: [],
    }
  }

  const params: unknown[] = [tahunId, Number(marhalahId)]

  const kelasList = await query<any>(`
    SELECT
      k.id,
      k.nama_kelas,
      k.marhalah_id,
      m.nama AS marhalah_nama,
      k.guru_shubuh_id,
      gs.nama_lengkap AS guru_shubuh_nama,
      k.guru_ashar_id,
      ga.nama_lengkap AS guru_ashar_nama,
      k.guru_maghrib_id,
      gm.nama_lengkap AS guru_maghrib_nama
    FROM kelas k
    JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE k.tahun_ajaran_id = ? AND k.marhalah_id = ?
    ORDER BY m.urutan, k.nama_kelas
  `, params)

  const kelasIds = kelasList.map(kelas => String(kelas.id))
  const [kitabList, assignments, gabunganList] = await Promise.all([
    query<any>(`
      SELECT
        kb.id,
        kb.nama_kitab,
        kb.marhalah_id,
        m.nama AS marhalah_nama,
        kb.mapel_id,
        mp.nama AS mapel_nama
      FROM kitab kb
      JOIN marhalah m ON m.id = kb.marhalah_id
      JOIN mapel mp ON mp.id = kb.mapel_id
      WHERE kb.tahun_ajaran_id = ?
      ORDER BY m.urutan, mp.nama, kb.nama_kitab
    `, [tahunId]),
    getGuruKitabAssignments(tahunId, kelasIds),
    getKelasGabunganPengajian(kelasIds),
  ])

  const defaultMapel = kelasList.flatMap(kelas =>
    GURU_KITAB_SESSIONS.map(sesi => ({
      kelas_id: kelas.id,
      sesi,
      mapel_keys: getDefaultMapelKeys(kelas.marhalah_nama || '', sesi),
    }))
  )

  return {
    tahunAjaranAktif: aktif,
    tahunAjaranList,
    marhalahList,
    guruList,
    kelasList,
    kitabList,
    assignments,
    gabunganList,
    defaultMapel,
  }
}

export async function generateGuruKitabDefaults(tahunAjaranId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const tahunId = Number(tahunAjaranId || 0)
  if (!tahunId) return { error: 'Pilih tahun ajaran dulu.' }

  const result = await generateGuruKitabDefaultAssignments(tahunId)
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_guru_kitab',
    action: 'create',
    fiturHref: '/dashboard/master/guru-kitab',
    logKind: 'update',
    entityType: 'guru_kitab_assignment',
    entityId: String(tahunId),
    entityLabel: 'Generate pembagian kitab guru',
    summary: `Generate default pembagian kitab: ${result.inserted} tambah, ${result.updated} update`,
    details: result,
  })
  revalidatePath('/dashboard/master/guru-kitab')
  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, ...result }
}

export async function saveGuruKitabAssignments(tahunAjaranId: number, rows: GuruKitabSaveRow[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureGuruKitabSchema()
  const tahunId = Number(tahunAjaranId || 0)
  if (!tahunId) return { error: 'Pilih tahun ajaran dulu.' }

  const cleanRows = rows
    .map(row => ({
      kelas_id: String(row.kelas_id || '').trim(),
      sesi: row.sesi,
      hari_index: row.hari_index == null ? null : Number(row.hari_index),
      guru_id: Number(row.guru_id || 0) || null,
      kitab_id: Number(row.kitab_id || 0) || null,
      source: row.source === 'auto' ? 'auto' : 'manual',
      is_active: row.is_active === 0 ? 0 : 1,
    }))
    .filter(row =>
      row.kelas_id &&
      GURU_KITAB_SESSIONS.includes(row.sesi) &&
      (row.hari_index == null || (Number.isInteger(row.hari_index) && row.hari_index >= 0 && row.hari_index <= 6)) &&
      row.guru_id &&
      row.kitab_id
    )

  const affectedKelasIds = Array.from(new Set(rows.map(row => String(row.kelas_id || '').trim()).filter(Boolean)))
  if (affectedKelasIds.length === 0) return { error: 'Tidak ada kelas yang disimpan.' }

  const placeholders = affectedKelasIds.map(() => '?').join(',')
  await execute(
    `DELETE FROM guru_kitab_assignment WHERE tahun_ajaran_id = ? AND kelas_id IN (${placeholders})`,
    [tahunId, ...affectedKelasIds]
  )

  if (cleanRows.length > 0) {
    await batch(cleanRows.map(row => ({
      sql: `
        INSERT OR IGNORE INTO guru_kitab_assignment
          (tahun_ajaran_id, kelas_id, sesi, hari_index, guru_id, kitab_id, source, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      params: [tahunId, row.kelas_id, row.sesi, row.hari_index, row.guru_id, row.kitab_id, row.source, row.is_active],
    })))
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_guru_kitab',
    action: 'update',
    fiturHref: '/dashboard/master/guru-kitab',
    logKind: 'update',
    entityType: 'guru_kitab_assignment_batch',
    entityId: String(tahunId),
    entityLabel: 'Pembagian kitab guru',
    summary: `Menyimpan pembagian kitab ${affectedKelasIds.length} kelas`,
    details: { tahun_ajaran_id: tahunId, total_kelas: affectedKelasIds.length, total_rows: cleanRows.length },
  })
  revalidatePath('/dashboard/master/guru-kitab')
  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, saved: cleanRows.length, kelas: affectedKelasIds.length }
}

export async function getGuruKitabResolvedForEhb(eventId: number) {
  return resolveGuruKitabForEhb(eventId)
}

export async function getTahunAjaranName(tahunAjaranId: number) {
  return queryOne<{ nama: string }>('SELECT nama FROM tahun_ajaran WHERE id = ?', [tahunAjaranId])
}
