'use server'

import { query, execute } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getReferensiData() {
  const mapel = await query<any>('SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama', [])
  const kelasRaw = await query<any>(`
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
  `, [])
  const kelas = kelasRaw.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
  return { mapel, kelas }
}

export async function getDataSantriPerKelas(kelasId: string) {
  const data = await query<any>(`
    SELECT rp.id, s.nis, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  return data.map((d: any) => ({
    riwayat_id: d.id,
    nis: d.nis,
    nama: d.nama_lengkap,
  }))
}

export async function simpanNilaiSemuaMapel(
  kelasId: string,
  semester: number,
  dataNilai: any[],
  listMapel: { id: number; nama: string }[]
) {
  const dataSantri = await getDataSantriPerKelas(kelasId)
  const mapNisToId = new Map<string, string>()
  dataSantri.forEach((s: any) => mapNisToId.set(String(s.nis).trim(), s.riwayat_id))

  const mapMapel = new Map<string, number>()
  listMapel.forEach(m => mapMapel.set(m.nama.toUpperCase().trim(), m.id))

  const toUpsert: any[] = []
  const errors: string[] = []

  dataNilai.forEach((row, idx) => {
    const baris = idx + 2
    const nis = String(row['NIS'] || row['nis'] || '').trim()
    const riwayatId = mapNisToId.get(nis)
    if (!riwayatId) { errors.push(`Baris ${baris}: NIS '${nis}' tidak ditemukan di kelas ini.`); return }

    Object.keys(row).forEach(key => {
      const namaKolom = key.toUpperCase().trim()
      if (namaKolom === 'NIS' || namaKolom === 'NAMA SANTRI' || namaKolom === 'NO') return
      const mapelId = mapMapel.get(namaKolom)
      if (!mapelId) return
      const rawVal = row[key]
      if (rawVal === '' || rawVal === null || rawVal === undefined) return
      const nilai = Number(rawVal)
      if (isNaN(nilai) || nilai < 0 || nilai > 100) {
        errors.push(`Baris ${baris}: Nilai '${key}' tidak valid (${rawVal}).`)
      } else {
        toUpsert.push({ riwayat_pendidikan_id: riwayatId, mapel_id: mapelId, semester, nilai })
      }
    })
  })

  if (errors.length > 0) return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }
  if (!toUpsert.length) return { error: 'Tidak ada data nilai yang terbaca. Pastikan nama kolom Excel sesuai nama Mata Pelajaran.' }

  for (const item of toUpsert) {
    await execute(`
      INSERT INTO nilai_akademik (riwayat_pendidikan_id, mapel_id, semester, nilai)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai
    `, [item.riwayat_pendidikan_id, item.mapel_id, item.semester, item.nilai])
  }

  revalidatePath('/dashboard/akademik/nilai')
  return { success: true, count: toUpsert.length }
}