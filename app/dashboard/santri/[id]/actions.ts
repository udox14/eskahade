'use server'
import { createClient } from '@/lib/supabase/server'

// 1. Data Utama (Biodata)
export async function getProfilSantri(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('santri')
    .select('*')
    .eq('id', id)
    .single()
  return { data, error }
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

// 5. Data Keuangan / SPP (BARU)
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