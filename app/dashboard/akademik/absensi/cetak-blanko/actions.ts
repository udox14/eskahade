'use server'

import { createClient } from '@/lib/supabase/server'

// 1. Ambil Daftar Kelas untuk Dropdown
export async function getKelasForCetak() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('kelas')
    .select('id, nama_kelas, marhalah(nama)')

  return (data || []).sort((a: any, b: any) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
}

// 2. BARU: Ambil Daftar Marhalah
export async function getMarhalahForCetak() {
  const supabase = await createClient()
  const { data } = await supabase.from('marhalah').select('*').order('urutan')
  return data || []
}

// 3. Ambil Data Detail Kelas & Daftar Santri (SATUAN)
export async function getDataBlanko(kelasId: string) {
  const supabase = await createClient()

  // A. Ambil Detail Kelas
  const { data: kelas, error: errKelas } = await supabase
    .from('kelas')
    .select(`
      nama_kelas,
      marhalah(nama),
      guru_shubuh:guru_shubuh_id(nama_lengkap),
      guru_ashar:guru_ashar_id(nama_lengkap),
      guru_maghrib:guru_maghrib_id(nama_lengkap)
    `)
    .eq('id', kelasId)
    .single()

  if (errKelas || !kelas) return { error: "Kelas tidak ditemukan" }

  // B. Ambil Santri
  const { data: riwayat } = await supabase
    .from('riwayat_pendidikan')
    .select(`
      santri:santri_id (
        id, nama_lengkap, nis, asrama, kamar, sekolah, kelas_sekolah
      )
    `)
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')

  // C. Ekstrak & Sort
  let santriList = riwayat?.map((r: any) => {
     return Array.isArray(r.santri) ? r.santri[0] : r.santri
  }).filter(Boolean) || []

  santriList.sort((a: any, b: any) => a.nama_lengkap.localeCompare(b.nama_lengkap))

  return { kelas, santriList }
}

// 4. BARU: Ambil Data Blanko Massal (PER MARHALAH)
export async function getDataBlankoMassal(marhalahId: string) {
  const supabase = await createClient()

  // A. Ambil Semua Kelas di Marhalah ini
  const { data: kelasList } = await supabase
    .from('kelas')
    .select(`
      id,
      nama_kelas,
      marhalah(nama),
      guru_shubuh:guru_shubuh_id(nama_lengkap),
      guru_ashar:guru_ashar_id(nama_lengkap),
      guru_maghrib:guru_maghrib_id(nama_lengkap)
    `)
    .eq('marhalah_id', marhalahId)
    .order('id')

  const sortedKelasList = (kelasList || []).sort((a: any, b: any) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
  if (!sortedKelasList || sortedKelasList.length === 0) return { error: "Tidak ada kelas di tingkat ini." }

  // B. Ambil data santri untuk setiap kelas (Parallel)
  const result = await Promise.all(sortedKelasList.map(async (kelas) => {
      const { data: riwayat } = await supabase
        .from('riwayat_pendidikan')
        .select(`
          santri:santri_id (
            id, nama_lengkap, nis, asrama, kamar, sekolah, kelas_sekolah
          )
        `)
        .eq('kelas_id', kelas.id)
        .eq('status_riwayat', 'aktif')

      let santriList = riwayat?.map((r: any) => {
         return Array.isArray(r.santri) ? r.santri[0] : r.santri
      }).filter(Boolean) || []

      santriList.sort((a: any, b: any) => a.nama_lengkap.localeCompare(b.nama_lengkap))

      return { kelas, santriList }
  }))

  return { massal: result }
}