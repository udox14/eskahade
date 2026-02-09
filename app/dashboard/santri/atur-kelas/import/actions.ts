'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ImportRow = {
  nis: string | number;
  nama_kelas: string; // User mengetik "1-A" atau "1 A"
}

export async function importPenempatanKelas(data: ImportRow[]) {
  const supabase = await createClient()

  if (!data || data.length === 0) return { error: "Data kosong." }

  // 1. Ambil Semua Kelas Aktif untuk Referensi (Biar tidak query satu-satu)
  const { data: semuaKelas } = await supabase.from('kelas').select('id, nama_kelas')
  
  // Buat Map agar pencarian cepat: "1-A" -> "UUID-123"
  const mapKelas = new Map()
  semuaKelas?.forEach(k => {
    // Kita simpan dengan huruf kecil semua biar pencarian tidak sensitif huruf besar/kecil
    mapKelas.set(k.nama_kelas.trim().toLowerCase(), k.id)
  })

  // 2. Ambil Semua Santri (Hanya ID dan NIS)
  const { data: semuaSantri } = await supabase.from('santri').select('id, nis')
  const mapSantri = new Map()
  semuaSantri?.forEach(s => {
    mapSantri.set(String(s.nis).trim(), s.id)
  })

  // 3. Proses Matching
  const toInsert: any[] = []
  const errors: string[] = []

  data.forEach((row, index) => {
    const rowNum = index + 2 // Karena ada header
    const nis = String(row.nis).trim()
    const namaKelasRaw = String(row.nama_kelas).trim()
    const namaKelasKey = namaKelasRaw.toLowerCase()

    const santriId = mapSantri.get(nis)
    const kelasId = mapKelas.get(namaKelasKey)

    if (!santriId) {
      errors.push(`Baris ${rowNum}: NIS '${nis}' tidak ditemukan di database santri.`)
    } else if (!kelasId) {
      errors.push(`Baris ${rowNum}: Kelas '${namaKelasRaw}' tidak ditemukan di Master Kelas.`)
    } else {
      toInsert.push({
        santri_id: santriId,
        kelas_id: kelasId,
        status_riwayat: 'aktif'
      })
    }
  })

  if (errors.length > 0) {
    // Kembalikan error parsial (maksimal 10 error biar tidak penuh layar)
    return { error: `Ditemukan ${errors.length} masalah. Contoh:\n` + errors.slice(0, 5).join('\n') }
  }

  // 4. Eksekusi Simpan
  if (toInsert.length > 0) {
    const { error } = await supabase.from('riwayat_pendidikan').insert(toInsert)
    if (error) return { error: "Database Error: " + error.message }
  }

  revalidatePath('/dashboard/santri')
  return { success: true, count: toInsert.length }
}