'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDataRapor(kelasId: string, semester: number) {
  const supabase = await createClient()

  // 1. Ambil Data Santri + Kelas + Wali Kelas
  const { data: listSantri } = await supabase
    .from('riwayat_pendidikan')
    .select(`
      id,
      santri (nama_lengkap, nis, nama_ayah),
      kelas (id, nama_kelas, marhalah(id, nama), wali_kelas:wali_kelas_id(full_name)),
      ranking (ranking_kelas, predikat, rata_rata, catatan_wali_kelas)
    `)
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .eq('ranking.semester', semester)
    .order('santri(nama_lengkap)')

  if (!listSantri || listSantri.length === 0) return []

  const riwayatIds = listSantri.map(s => s.id)

  // 2. Ambil Nilai Akademik
  const { data: nilaiAkademik } = await supabase
    .from('nilai_akademik')
    .select('riwayat_pendidikan_id, mapel_id, mapel(nama), nilai')
    .in('riwayat_pendidikan_id', riwayatIds)
    .eq('semester', semester)
    .order('mapel(nama)')

  // 3. Ambil Rekap Absensi
  const { data: absensi } = await supabase
    .from('absensi_harian')
    .select('riwayat_pendidikan_id, shubuh, ashar, maghrib')
    .in('riwayat_pendidikan_id', riwayatIds)

  // 4. Kitab (Safely extract marhalah ID)
  // Ambil sample kelas dari data pertama
  const firstData = listSantri[0]
  const klsSample = Array.isArray(firstData.kelas) ? firstData.kelas[0] : firstData.kelas
  const mrhSample = Array.isArray(klsSample?.marhalah) ? klsSample.marhalah[0] : klsSample?.marhalah
  
  let listKitab: any[] = []
  if (mrhSample?.id) {
    const { data: kitab } = await supabase.from('kitab').select('mapel_id, nama_kitab').eq('marhalah_id', mrhSample.id)
    listKitab = kitab || []
  }

  // GABUNGKAN DATA
  const dataRapor = listSantri.map(s => {
    // Nilai & Absen Logic (Sama)
    const nilainya = nilaiAkademik?.filter(n => n.riwayat_pendidikan_id === s.id) || []
    const absennya = absensi?.filter(a => a.riwayat_pendidikan_id === s.id) || []
    
    let sakit = 0, izin = 0, alfa = 0
    absennya.forEach(row => { 
        if (row.shubuh === 'S') sakit++; if (row.shubuh === 'I') izin++; if (row.shubuh === 'A') alfa++; 
        if (row.ashar === 'S') sakit++; if (row.ashar === 'I') izin++; if (row.ashar === 'A') alfa++; 
        if (row.maghrib === 'S') sakit++; if (row.maghrib === 'I') izin++; if (row.maghrib === 'A') alfa++; 
    })

    // Handle Join Data (Array vs Object Check)
    const santriData = Array.isArray(s.santri) ? s.santri[0] : s.santri
    const kelasData = Array.isArray(s.kelas) ? s.kelas[0] : s.kelas
    const rankData = Array.isArray(s.ranking) ? s.ranking[0] : s.ranking

    // FIX UTAMA: Handle Wali Kelas
    const rawWali = kelasData?.wali_kelas
    const waliObj = Array.isArray(rawWali) ? rawWali[0] : rawWali
    const waliKelasNama = waliObj?.full_name || ".........................."

    return {
      id: s.id,
      santri: santriData,
      kelas: kelasData,
      wali_kelas_nama: waliKelasNama,
      ranking: rankData || { ranking_kelas: '-', predikat: '-', rata_rata: 0 },
      nilai: nilainya.map(n => {
        const mapelData = Array.isArray(n.mapel) ? n.mapel[0] : n.mapel
        const kitabData = listKitab.find((k: any) => k.mapel_id === n.mapel_id)
        
        return { 
            mapel: mapelData?.nama || 'Tanpa Nama', 
            kitab: kitabData?.nama_kitab || '-', 
            angka: n.nilai 
        }
      }),
      absen: { sakit, izin, alfa }
    }
  })

  return dataRapor
}

export async function getKelasList() {
  const supabase = await createClient()
  const { data } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas')
  return data || []
}