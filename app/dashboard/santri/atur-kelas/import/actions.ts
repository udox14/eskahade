'use server'

import { query, batch } from '@/lib/db'
import { revalidatePath } from 'next/cache'

type ImportRow = {
  nis: string | number
  nama_kelas: string
}

// FIX #8: Ganti for...of await query INSERT -> batch()
export async function importPenempatanKelas(data: ImportRow[]) {
  if (!data || data.length === 0) return { error: 'Data kosong.' }

  const semuaKelas = await query<{ id: string; nama_kelas: string }>('SELECT id, nama_kelas FROM kelas')
  const mapKelas = new Map(semuaKelas.map(k => [k.nama_kelas.trim().toLowerCase(), k.id]))

  const semuaSantri = await query<{ id: string; nis: string }>('SELECT id, nis FROM santri')
  const mapSantri = new Map(semuaSantri.map(s => [String(s.nis).trim(), s.id]))

  const toInsert: any[] = []
  const errors: string[] = []

  data.forEach((row, index) => {
    const rowNum = index + 2
    const nis = String(row.nis).trim()
    const namaKelasRaw = String(row.nama_kelas).trim()
    const namaKelasKey = namaKelasRaw.toLowerCase()

    const santriId = mapSantri.get(nis)
    const kelasId = mapKelas.get(namaKelasKey)

    if (!santriId) errors.push(`Baris ${rowNum}: NIS '${nis}' tidak ditemukan di database santri.`)
    else if (!kelasId) errors.push(`Baris ${rowNum}: Kelas '${namaKelasRaw}' tidak ditemukan di Master Kelas.`)
    else toInsert.push({ santri_id: santriId, kelas_id: kelasId })
  })

  if (errors.length > 0) {
    return { error: `Ditemukan ${errors.length} masalah. Contoh:\n` + errors.slice(0, 5).join('\n') }
  }

  const now = new Date().toISOString()
  await batch(toInsert.map(item => ({
    sql: 'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
    params: [crypto.randomUUID(), item.santri_id, item.kelas_id, 'aktif', now],
  })))

  revalidatePath('/dashboard/santri')
  return { success: true, count: toInsert.length }
}
