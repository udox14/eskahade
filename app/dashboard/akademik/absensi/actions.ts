'use server'

import { query, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList } from '@/lib/cache/master'

function getWeekRange(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day < 3 ? day + 7 : day) - 3
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  const start = new Date(d)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return { start, end }
}

export async function getAbsensiData(tanggalRef: string, filters: { kelasId?: string, asrama?: string, marhalahId?: string }) {
  const { start, end } = getWeekRange(new Date(tanggalRef))
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  let whereClauses = ["rp.status_riwayat = 'aktif'"]
  let params: any[] = []

  if (filters.kelasId) {
    whereClauses.push("rp.kelas_id = ?")
    params.push(filters.kelasId)
  }
  if (filters.asrama) {
    whereClauses.push("s.asrama = ?")
    params.push(filters.asrama)
  }
  if (filters.marhalahId) {
    whereClauses.push("k.marhalah_id = ?")
    params.push(filters.marhalahId)
  }

  const whereSql = whereClauses.join(" AND ")

  const santri = await query<any>(`
    SELECT 
      rp.id, 
      s.id AS santri_id, 
      s.nama_lengkap, 
      s.nis,
      s.asrama,
      s.kamar,
      s.sekolah,
      s.kelas_sekolah,
      k.nama_kelas AS kelas_pesantren
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${whereSql}
    ORDER BY s.asrama, s.kamar, s.nama_lengkap
  `, params)

  if (!santri.length) return { santri: [], absensi: [] }

  const absensi = await query<any>(`
    SELECT ah.riwayat_pendidikan_id, ah.tanggal, ah.shubuh, ah.ashar, ah.maghrib
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${whereSql}
      AND ah.tanggal >= ? AND ah.tanggal <= ?
  `, [...params, startStr, endStr])

  return { santri, absensi }
}

export async function simpanAbsensi(dataInput: any[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const toDelete: { riwayat_id: string; tanggal: string }[] = []
  const toUpsert: any[] = []

  for (const item of dataInput) {
    const s = item.shubuh || 'H'
    const a = item.ashar || 'H'
    const m = item.maghrib || 'H'

    if (s === 'H' && a === 'H' && m === 'H') {
      toDelete.push({ riwayat_id: item.riwayat_id, tanggal: item.tanggal })
    } else {
      toUpsert.push({ riwayat_id: item.riwayat_id, tanggal: item.tanggal, s, a, m })
    }
  }

  for (const key of toDelete) {
    await execute(
      `DELETE FROM absensi_harian WHERE riwayat_pendidikan_id = ? AND tanggal = ?`,
      [key.riwayat_id, key.tanggal]
    )
  }

  for (const item of toUpsert) {
    await execute(`
      INSERT INTO absensi_harian (id, riwayat_pendidikan_id, tanggal, shubuh, ashar, maghrib, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, tanggal) DO UPDATE SET
        shubuh = excluded.shubuh,
        ashar = excluded.ashar,
        maghrib = excluded.maghrib,
        created_by = excluded.created_by
    `, [generateId(), item.riwayat_id, item.tanggal, item.s, item.a, item.m, session.id])
  }

  revalidatePath('/dashboard/akademik/absensi')
  return { success: true }
}

export async function getKelasList() {
  const data = await query<any>('SELECT id, nama_kelas, marhalah_id FROM kelas ORDER BY nama_kelas')
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getAsramaList() {
  const data = await query<any>(`
    SELECT DISTINCT asrama 
    FROM santri 
    WHERE asrama IS NOT NULL AND asrama != '' 
    ORDER BY asrama
  `)
  return data.map((d: any) => d.asrama)
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export async function getAbsensiGlobalA(tanggalRef: string) {
  const { start, end } = getWeekRange(new Date(tanggalRef))
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  const results = await query<any>(`
    WITH ProblemStudents AS (
      SELECT DISTINCT riwayat_pendidikan_id
      FROM absensi_harian
      WHERE tanggal >= ? AND tanggal <= ?
        AND (shubuh = 'A' OR ashar = 'A' OR maghrib = 'A')
    )
    SELECT 
      rp.id, 
      s.nama_lengkap, 
      s.asrama, 
      s.kamar, 
      s.sekolah, 
      s.kelas_sekolah,
      k.nama_kelas AS kelas_pesantren,
      ah.tanggal,
      ah.shubuh,
      ah.ashar,
      ah.maghrib
    FROM ProblemStudents ps
    JOIN riwayat_pendidikan rp ON rp.id = ps.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN absensi_harian ah ON ah.riwayat_pendidikan_id = ps.riwayat_pendidikan_id
      AND ah.tanggal >= ? AND ah.tanggal <= ?
    ORDER BY s.nama_lengkap
  `, [startStr, endStr, startStr, endStr])

  const santriMap = new Map()
  const absensiGrid: Record<string, any> = {}
  
  results.forEach((row: any) => {
    if (!santriMap.has(row.id)) {
      santriMap.set(row.id, {
        id: row.id,
        nama_lengkap: row.nama_lengkap,
        asrama: row.asrama,
        kamar: row.kamar,
        sekolah: row.sekolah,
        kelas_sekolah: row.kelas_sekolah,
        kelas_pesantren: row.kelas_pesantren
      })
    }
    
    if (row.tanggal) {
      if (!absensiGrid[row.id]) absensiGrid[row.id] = {}
      absensiGrid[row.id][row.tanggal] = {
        shubuh: row.shubuh,
        ashar: row.ashar,
        maghrib: row.maghrib
      }
    }
  })

  return {
    santri: Array.from(santriMap.values()),
    absensi: absensiGrid
  }
}