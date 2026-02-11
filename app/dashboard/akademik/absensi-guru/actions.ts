'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Daftar Marhalah (Untuk Filter)
export async function getMarhalahList() {
  const supabase = await createClient()
  const { data } = await supabase.from('marhalah').select('*').order('urutan')
  return data || []
}

// 2. Ambil Daftar Kelas & Guru Terplot (Filtered)
export async function getJurnalGuru(startDate: string, endDate: string, marhalahId?: string) {
  const supabase = await createClient()

  // Query Kelas
  let query = supabase
    .from('kelas')
    .select(`
      id, 
      nama_kelas, 
      marhalah(id, nama),
      guru_shubuh:guru_shubuh_id(id, nama_lengkap),
      guru_ashar:guru_ashar_id(id, nama_lengkap),
      guru_maghrib:guru_maghrib_id(id, nama_lengkap)
    `)
    .order('nama_kelas')

  // Filter by Marhalah
  if (marhalahId) {
    query = query.eq('marhalah_id', marhalahId)
  }

  const { data: kelasList } = await query

  if (!kelasList) return { list: [], absensi: {} }

  // Ambil data absensi
  const { data: absensi } = await supabase
    .from('absensi_guru')
    .select('*')
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)
    // Optimasi: Filter absensi hanya untuk kelas yang diambil (jika perlu, tapi filter date sudah cukup kuat)

  // Mapping
  const absensiMap: Record<string, any> = {}
  absensi?.forEach((a: any) => {
    const key = `${a.kelas_id}-${a.tanggal}`
    absensiMap[key] = {
      shubuh: a.shubuh,
      ashar: a.ashar,
      maghrib: a.maghrib
    }
  })

  return {
    list: kelasList,
    absensi: absensiMap
  }
}

// 3. Simpan Absensi Guru
export async function simpanAbsensiGuru(payload: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (payload.length === 0) return { error: "Tidak ada data untuk disimpan" }

  const dataInsert = payload.map(item => ({
    kelas_id: item.kelas_id,
    guru_id: item.guru_id_wali, 
    tanggal: item.tanggal,
    shubuh: item.shubuh,
    ashar: item.ashar,
    maghrib: item.maghrib,
    updated_by: user?.id
  }))

  const { error } = await supabase
    .from('absensi_guru')
    .upsert(dataInsert, { onConflict: 'kelas_id, tanggal' })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik/absensi-guru')
  return { success: true }
}