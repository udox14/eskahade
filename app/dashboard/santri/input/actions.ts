'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Tipe data SUPER LENGKAP (+ Kelas Pesantren)
type SantriImportData = {
  nis: string | number;
  nama_lengkap: string;
  nik?: string | number;
  jenis_kelamin: 'L' | 'P';
  tempat_lahir?: string;
  tanggal_lahir?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  alamat?: string;
  sekolah?: string;       
  kelas_sekolah?: string; 
  asrama?: string;
  kamar?: string | number;
  
  // TAMBAHAN BARU: KELAS PESANTREN (Untuk Migrasi Awal)
  kelas_pesantren?: string; 
}

export async function importSantriMassal(dataSantri: SantriImportData[]) {
  const supabase = await createClient()

  if (!dataSantri || dataSantri.length === 0) {
    return { error: "Data kosong tidak bisa disimpan." }
  }

  // 1. AMBIL REFERENSI KELAS (Untuk Mapping Nama -> ID)
  // Kita butuh ID kelas untuk tabel riwayat_pendidikan
  const { data: kelasList } = await supabase
    .from('kelas')
    .select('id, nama_kelas')
  
  // Buat Map: "1-A" -> "UUID-xxxxx" (Case insensitive)
  const mapKelas = new Map()
  kelasList?.forEach(k => mapKelas.set(k.nama_kelas.trim().toLowerCase(), k.id))

  // 2. BERSIHKAN DATA SANTRI
  const cleanData = dataSantri.map(s => ({
    nis: String(s.nis).trim(),
    nama_lengkap: String(s.nama_lengkap).trim(),
    nik: s.nik ? String(s.nik).trim() : null,
    jenis_kelamin: String(s.jenis_kelamin).toUpperCase() === 'P' ? 'P' : 'L',
    tempat_lahir: s.tempat_lahir || null,
    tanggal_lahir: s.tanggal_lahir || null,
    nama_ayah: s.nama_ayah || null,
    nama_ibu: s.nama_ibu || null,
    alamat: s.alamat || null,
    status_global: 'aktif',
    sekolah: s.sekolah ? String(s.sekolah).toUpperCase().trim() : null,
    kelas_sekolah: s.kelas_sekolah ? String(s.kelas_sekolah).trim() : null,
    asrama: s.asrama ? String(s.asrama).toUpperCase().trim() : null,
    kamar: s.kamar ? String(s.kamar).trim() : null
    // Note: kelas_pesantren tidak dimasukkan ke tabel santri, tapi dipisah logicnya
  }))

  // 3. INSERT SANTRI
  // Kita gunakan .select() agar mendapatkan kembali ID santri yang baru dibuat
  const { data: insertedSantri, error } = await supabase
    .from('santri')
    .insert(cleanData)
    .select('id, nis') 
  
  if (error) {
    console.error("Gagal Import Santri:", error)
    if (error.code === '23505') {
      return { error: "Gagal: Ada NIS atau NIK yang sama (Duplikat) di database." }
    }
    return { error: `Gagal menyimpan: ${error.message}` }
  }

  // 4. INSERT RIWAYAT PENDIDIKAN (Untuk yang punya kolom kelas)
  if (insertedSantri && insertedSantri.length > 0) {
    const riwayatInserts: any[] = []

    // Map inserted santri by NIS untuk pencarian cepat
    const mapSantriId = new Map()
    insertedSantri.forEach(s => mapSantriId.set(s.nis, s.id))

    dataSantri.forEach(row => {
      const namaKelasInput = row.kelas_pesantren ? String(row.kelas_pesantren).trim() : null
      
      if (namaKelasInput) {
        const santriId = mapSantriId.get(String(row.nis).trim())
        const kelasId = mapKelas.get(namaKelasInput.toLowerCase())

        if (santriId && kelasId) {
          riwayatInserts.push({
            santri_id: santriId,
            kelas_id: kelasId,
            status_riwayat: 'aktif'
          })
        }
      }
    })

    if (riwayatInserts.length > 0) {
      const { error: errRiwayat } = await supabase
        .from('riwayat_pendidikan')
        .insert(riwayatInserts)
      
      if (errRiwayat) {
        console.error("Gagal buat riwayat kelas:", errRiwayat)
        // Kita tidak return error disini karena santri sudah berhasil dibuat.
        // Cukup log saja, atau beri info warning (opsional)
      }
    }
  }

  revalidatePath('/dashboard/santri')
  return { success: true, count: insertedSantri?.length || 0 }
}