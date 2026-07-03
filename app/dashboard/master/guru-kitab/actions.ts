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

export async function copyGuruKitabFromTahunAjaran(targetTahunAjaranId: number, sourceTahunAjaranId: number): Promise<
  { success: boolean; count: number; skipped: number; unmatched: number } | { error: string }
> {
  const session = await getSession()
  await ensureGuruKitabSchema()
  const targetId = Number(targetTahunAjaranId || 0)
  const sourceId = Number(sourceTahunAjaranId || 0)
  if (!targetId) return { error: 'Pilih tahun ajaran target dulu.' }
  if (!sourceId) return { error: 'Pilih tahun ajaran sumber dulu.' }
  if (targetId === sourceId) return { error: 'Tidak bisa copy dari tahun ajaran yang sama.' }

  const sourceRows = await query<{
    sesi: GuruKitabSession; hari_index: number | null; guru_id: number; is_active: number
    nama_kelas: string; kelas_marhalah_id: string; nama_kitab: string; kitab_marhalah_id: string
  }>(
    `SELECT gka.sesi, gka.hari_index, gka.guru_id, gka.is_active,
            k.nama_kelas, k.marhalah_id AS kelas_marhalah_id,
            kt.nama_kitab, kt.marhalah_id AS kitab_marhalah_id
     FROM guru_kitab_assignment gka
     JOIN kelas k ON k.id = gka.kelas_id
     JOIN kitab kt ON kt.id = gka.kitab_id
     WHERE gka.tahun_ajaran_id = ?`,
    [sourceId]
  )
  if (sourceRows.length === 0) return { error: 'Tidak ada data pembagian kitab guru di tahun ajaran sumber.' }

  const [targetKelas, targetKitab] = await Promise.all([
    query<{ id: string; nama_kelas: string; marhalah_id: string }>(
      'SELECT id, nama_kelas, marhalah_id FROM kelas WHERE tahun_ajaran_id = ?', [targetId]
    ),
    query<{ id: number; nama_kitab: string; marhalah_id: string }>(
      'SELECT id, nama_kitab, marhalah_id FROM kitab WHERE tahun_ajaran_id = ?', [targetId]
    ),
  ])
  const kelasMap = new Map(targetKelas.map(k => [`${k.nama_kelas.toLowerCase().trim()}|||${k.marhalah_id}`, k.id]))
  const kitabMap = new Map(targetKitab.map(k => [`${k.nama_kitab.toLowerCase().trim()}|||${k.marhalah_id}`, k.id]))

  const insertStmts: { sql: string; params: any[] }[] = []
  let unmatched = 0

  for (const row of sourceRows) {
    const kelasId = kelasMap.get(`${row.nama_kelas.toLowerCase().trim()}|||${row.kelas_marhalah_id}`)
    const kitabId = kitabMap.get(`${row.nama_kitab.toLowerCase().trim()}|||${row.kitab_marhalah_id}`)
    if (!kelasId || !kitabId) { unmatched++; continue }
    insertStmts.push({
      sql: `INSERT OR IGNORE INTO guru_kitab_assignment
              (tahun_ajaran_id, kelas_id, sesi, hari_index, guru_id, kitab_id, source, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, datetime('now'))`,
      params: [targetId, kelasId, row.sesi, row.hari_index, row.guru_id, kitabId, row.is_active],
    })
  }

  if (insertStmts.length === 0) return { success: true, count: 0, skipped: 0, unmatched }

  const before = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM guru_kitab_assignment WHERE tahun_ajaran_id = ?', [targetId])
  await batch(insertStmts)
  const after = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM guru_kitab_assignment WHERE tahun_ajaran_id = ?', [targetId])
  const count = (after?.c ?? 0) - (before?.c ?? 0)
  const skipped = insertStmts.length - count

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_guru_kitab',
    action: 'create',
    fiturHref: '/dashboard/master/guru-kitab',
    logKind: 'create',
    entityType: 'guru_kitab_assignment_batch',
    entityId: 'copy-tahun-ajaran',
    entityLabel: 'Copy pembagian kitab guru dari tahun ajaran lalu',
    summary: `Copy pembagian kitab guru dari tahun ajaran lalu: ${count} baris disalin`,
    details: { inserted: count, skipped, unmatched, source_tahun_ajaran_id: sourceId, target_tahun_ajaran_id: targetId },
  })

  revalidatePath('/dashboard/master/guru-kitab')
  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, count, skipped, unmatched }
}
