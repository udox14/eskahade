'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Data Referensi
export async function getReferensiData() {
  const supabase = await createClient()
  const { data: mapel } = await supabase.from('mapel').select('id, nama').eq('aktif', true).order('nama')
  const { data: kelas } = await supabase.from('kelas').select('id, nama_kelas, marhalah(nama)').order('nama_kelas')
  return { mapel, kelas }
}

// 2. Ambil Data Santri
export async function getDataSantriPerKelas(kelasId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('riwayat_pendidikan')
    .select(`id, santri:santri_id (nis, nama_lengkap)`)
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .order('santri(nama_lengkap)')

  return data?.map((d: any) => ({
    riwayat_id: d.id,
    nis: d.santri.nis,
    nama: d.santri.nama_lengkap
  })) || []
}

// 3. Simpan Nilai Massal (SEMUA MAPEL SEKALIGUS)
export async function simpanNilaiSemuaMapel(
  kelasId: string, 
  semester: number, 
  dataNilai: any[], // Array objek bebas, key-nya nama mapel
  listMapel: { id: number, nama: string }[] // Daftar mapel buat mapping nama->id
) {
  const supabase = await createClient()

  // Ambil data santri untuk validasi
  const dataSantri = await getDataSantriPerKelas(kelasId)
  const mapNisToId = new Map()
  dataSantri.forEach(s => mapNisToId.set(String(s.nis).trim(), s.riwayat_id))

  // Buat Map: Nama Mapel (Huruf Besar) -> ID Mapel
  const mapMapel = new Map()
  listMapel.forEach(m => mapMapel.set(m.nama.toUpperCase().trim(), m.id))

  const toUpsert: any[] = []
  const errors: string[] = []

  // Loop setiap baris Excel
  dataNilai.forEach((row, idx) => {
    const baris = idx + 2
    // Cari NIS (bisa key 'NIS' atau 'nis')
    const nis = String(row['NIS'] || row['nis'] || '').trim()
    
    // Validasi Santri
    const riwayatId = mapNisToId.get(nis)
    if (!riwayatId) {
      errors.push(`Baris ${baris}: NIS '${nis}' tidak ditemukan di kelas ini.`)
      return
    }

    // Loop setiap kolom (Key) di baris tersebut
    Object.keys(row).forEach(key => {
      const namaKolom = key.toUpperCase().trim()

      // Skip kolom identitas, hanya proses kolom yang namanya ada di daftar Mapel
      if (namaKolom === 'NIS' || namaKolom === 'NAMA SANTRI' || namaKolom === 'NO') return

      const mapelId = mapMapel.get(namaKolom)
      if (mapelId) {
        // Ambil nilainya
        const rawVal = row[key]
        
        // Hanya simpan jika ada isinya (bukan kosong/null)
        if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
          const nilai = Number(rawVal)
          
          if (isNaN(nilai) || nilai < 0 || nilai > 100) {
            errors.push(`Baris ${baris}: Nilai '${key}' tidak valid (${rawVal}).`)
          } else {
            toUpsert.push({
              riwayat_pendidikan_id: riwayatId,
              mapel_id: mapelId,
              semester: semester,
              nilai: nilai
            })
          }
        }
      }
    })
  })

  if (errors.length > 0) {
    return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }
  }

  if (toUpsert.length === 0) {
    return { error: "Tidak ada data nilai yang terbaca. Pastikan nama kolom Excel sesuai nama Mata Pelajaran." }
  }

  // Eksekusi Simpan
  const { error } = await supabase
    .from('nilai_akademik')
    .upsert(toUpsert, { onConflict: 'riwayat_pendidikan_id, mapel_id, semester' })

  if (error) {
    console.error("Error Simpan:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/akademik/nilai')
  return { success: true, count: toUpsert.length }
}