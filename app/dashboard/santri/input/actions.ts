'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Tipe data dengan tambahan Kelas Pesantren
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
  
  // KOLOM TAMBAHAN UNTUK MIGRASI
  kelas_pesantren?: string; 
}

export async function importSantriMassal(dataSantri: SantriImportData[]) {
  const supabase = await createClient()

  if (!dataSantri || dataSantri.length === 0) {
    return { error: "Data kosong tidak bisa disimpan." }
  }

  // 1. AMBIL REFERENSI KELAS (Mapping Nama -> ID)
  // Tujuannya agar kalau di excel ditulis "1-A", kita tahu ID-nya berapa di database
  const { data: kelasList } = await supabase
    .from('kelas')
    .select('id, nama_kelas')
  
  const mapKelas = new Map()
  kelasList?.forEach(k => mapKelas.set(k.nama_kelas.trim().toLowerCase(), k.id))

  // 2. DATA CLEANING
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
  }))

  // 3. INSERT SANTRI
  const { data: inserted, error } = await supabase
    .from('santri')
    .insert(cleanData)
    .select('id, nis') // Ambil ID yang baru dibuat
  
  if (error) {
    if (error.code === '23505') {
      return { error: "Gagal: Ada NIS yang sama (Duplikat) di database." }
    }
    return { error: `Gagal menyimpan: ${error.message}` }
  }

  // 4. INSERT KELAS OTOMATIS (MIGRASI)
  // Jika insert santri sukses, cek apakah ada data kelas di excelnya?
  if (inserted && inserted.length > 0) {
    const riwayatInserts: any[] = []
    
    // Map ID Santri berdasarkan NIS untuk pencarian cepat
    const mapSantriId = new Map()
    inserted.forEach(s => mapSantriId.set(s.nis, s.id))

    // Loop data excel asli untuk cek kolom kelas
    dataSantri.forEach(row => {
      const namaKelasInput = row.kelas_pesantren ? String(row.kelas_pesantren).trim() : null
      
      if (namaKelasInput) {
        const santriId = mapSantriId.get(String(row.nis).trim())
        const kelasId = mapKelas.get(namaKelasInput.toLowerCase()) // Cari ID kelas di Map

        // Jika santri berhasil diinsert DAN kelasnya ditemukan di database
        if (santriId && kelasId) {
          riwayatInserts.push({
            santri_id: santriId,
            kelas_id: kelasId,
            status_riwayat: 'aktif'
          })
        }
      }
    })

    // Eksekusi insert riwayat
    if (riwayatInserts.length > 0) {
      await supabase.from('riwayat_pendidikan').insert(riwayatInserts)
    }
  }

  revalidatePath('/dashboard/santri')
  return { success: true, count: inserted?.length || 0 }
}