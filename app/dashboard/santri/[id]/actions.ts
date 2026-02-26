'use server'

import { createClient } from '@/lib/supabase/server'

// 1. Data Utama (Biodata + Foto + Info Kelas)
// Fungsi ini menggabungkan 'getProfilSantri' lama dengan update foto/kelas baru
export async function getSantriDetail(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('santri')
    .select(`
      *,
      riwayat_pendidikan (
        id,
        status_riwayat,
        kelas (
           id, 
           nama_kelas, 
           marhalah (nama)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  // Cari kelas aktif untuk ditampilkan di header profil
  const kelasAktif = data.riwayat_pendidikan?.find((r: any) => r.status_riwayat === 'aktif')?.kelas
  
  const infoKelas = kelasAktif 
    ? `${kelasAktif.nama_kelas} (${kelasAktif.marhalah?.nama})` 
    : 'Belum Masuk Kelas'

  return {
    ...data,
    info_kelas: infoKelas
  }
}

// 2. Data Akademik (Riwayat Kelas + Nilai per Semester)
export async function getRiwayatAkademik(santriId: string) {
  const supabase = await createClient()
  
  const { data: riwayat } = await supabase
    .from('riwayat_pendidikan')
    .select(`
      id, 
      status_riwayat, 
      kelas (nama_kelas, marhalah(nama), tahun_ajaran(nama)),
      ranking (ranking_kelas, predikat, rata_rata)
    `)
    .eq('santri_id', santriId)
    .order('created_at', { ascending: false })

  if (!riwayat) return []

  const historyWithGrades = await Promise.all(riwayat.map(async (r: any) => {
    const { data: nilai } = await supabase
      .from('nilai_akademik')
      .select('mapel(nama), nilai, semester')
      .eq('riwayat_pendidikan_id', r.id)
      .order('semester')
      
    return {
      ...r,
      nilai_detail: nilai || []
    }
  }))

  return historyWithGrades
}

// 3. Data Pelanggaran
export async function getRiwayatPelanggaran(santriId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pelanggaran')
    .select('*')
    .eq('santri_id', santriId)
    .order('tanggal', { ascending: false })
  return data || []
}

// 4. Data Perizinan
export async function getRiwayatPerizinan(santriId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('perizinan')
    .select('*')
    .eq('santri_id', santriId)
    .order('created_at', { ascending: false })
  return data || []
}

// 5. Data Keuangan / SPP
export async function getRiwayatSPP(santriId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('spp_log')
    .select('*, penerima:penerima_id(full_name)')
    .eq('santri_id', santriId)
    .order('tahun', { ascending: false })
    .order('bulan', { ascending: false })
  return data || []
}

// 6. Data Tabungan (Tambahan dari fitur Uang Jajan)
export async function getRiwayatTabungan(santriId: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('tabungan_log')
        .select('*')
        .eq('santri_id', santriId)
        .order('created_at', { ascending: false })
    return data || []
}