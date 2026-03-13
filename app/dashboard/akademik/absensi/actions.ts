'use server'

import { query, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

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

export async function getAbsensiData(kelasId: string, tanggalRef: string) {
  const { start, end } = getWeekRange(new Date(tanggalRef))
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  const santri = await query<any>(`
    SELECT rp.id, s.id AS santri_id, s.nama_lengkap, s.nis
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  if (!santri.length) return { santri: [], absensi: [] }

  // JOIN langsung ke kelas — hindari IN (100+ ids) yang melebihi batas 999 variabel D1
  const absensi = await query<any>(`
    SELECT ah.riwayat_pendidikan_id, ah.tanggal, ah.shubuh, ah.ashar, ah.maghrib
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
      AND ah.tanggal >= ? AND ah.tanggal <= ?
  `, [kelasId, startStr, endStr])

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
  const data = await query<any>('SELECT id, nama_kelas FROM kelas ORDER BY nama_kelas')
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}