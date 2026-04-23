'use server'

import { query, execute, generateId } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export async function getJurnalGuru(startDate: string, endDate: string, marhalahId?: string) {
  let sql = `
    SELECT k.id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama,
           gs.id AS guru_shubuh_id, gs.nama_lengkap AS guru_shubuh_nama,
           ga.id AS guru_ashar_id, ga.nama_lengkap AS guru_ashar_nama,
           gm.id AS guru_maghrib_id, gm.nama_lengkap AS guru_maghrib_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
  `
  const params: any[] = []
  if (marhalahId) { sql += ' WHERE k.marhalah_id = ?'; params.push(marhalahId) }
  sql += ' ORDER BY k.id'

  const kelasList = await query<any>(sql, params)
  if (!kelasList.length) return { list: [], absensi: {} }

  const absensi = await query<any>(
    `SELECT kelas_id, tanggal, shubuh, ashar, maghrib
     FROM absensi_guru
     WHERE tanggal >= ? AND tanggal <= ?`,
    [startDate, endDate]
  )

  const absensiMap: Record<string, any> = {}
  absensi.forEach((a: any) => {
    absensiMap[`${a.kelas_id}-${a.tanggal}`] = { shubuh: a.shubuh, ashar: a.ashar, maghrib: a.maghrib }
  })

  return {
    list: kelasList.sort((a: any, b: any) =>
      a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
    ),
    absensi: absensiMap,
  }
}

export async function simpanAbsensiGuru(payload: any[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (payload.length === 0) return { error: 'Tidak ada data untuk disimpan' }

  const statements: { sql: string; params: any[] }[] = []

  for (const item of payload) {
    statements.push({
      sql: `INSERT INTO absensi_guru (id, kelas_id, guru_id, tanggal, shubuh, ashar, maghrib, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(kelas_id, tanggal) DO UPDATE SET
              shubuh = excluded.shubuh,
              ashar = excluded.ashar,
              maghrib = excluded.maghrib,
              updated_by = excluded.updated_by`,
      params: [generateId(), item.kelas_id, item.guru_id_wali, item.tanggal, item.shubuh, item.ashar, item.maghrib, session.id]
    })
  }

  try {
    await batch(statements)
    revalidatePath('/dashboard/akademik/absensi-guru')
    return { success: true }
  } catch (err: any) {
    console.error("Batch save teacher error:", err)
    return { error: err?.message || 'Gagal menyimpan batch guru' }
  }
}