'use server'

import { query, batch, generateId } from '@/lib/db'
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
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
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
    absensiMap[`${a.kelas_id}-${a.tanggal}`] = {
      shubuh: a.shubuh || 'H',
      ashar: a.ashar || 'H',
      maghrib: a.maghrib || 'H',
    }
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
  if (payload.length === 0) return { error: 'Tidak ada data untuk disimpan' }

  const normalizeStatus = (value: unknown) => {
    const status = String(value || 'H').toUpperCase()
    return status === 'A' || status === 'B' ? status : 'H'
  }

  const statements = payload.map(item => ({
    sql: `
        INSERT INTO absensi_guru (id, kelas_id, guru_id, tanggal, shubuh, ashar, maghrib, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(kelas_id, tanggal) DO UPDATE SET
          guru_id = excluded.guru_id,
          shubuh = excluded.shubuh,
          ashar = excluded.ashar,
          maghrib = excluded.maghrib,
          updated_by = excluded.updated_by
      `,
    params: [
      generateId(),
      item.kelas_id,
      item.guru_id_wali ?? null,
      item.tanggal,
      normalizeStatus(item.shubuh),
      normalizeStatus(item.ashar),
      normalizeStatus(item.maghrib),
      session?.id ?? null,
    ],
  }))

  // D1 lebih stabil jika banyak upsert dikirim dalam beberapa batch kecil.
  const chunkSize = 50
  for (let i = 0; i < statements.length; i += chunkSize) {
    await batch(statements.slice(i, i + chunkSize))
  }

  revalidatePath('/dashboard/akademik/absensi-guru')
  return { success: true, saved: payload.length }
}
