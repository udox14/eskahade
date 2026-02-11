'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Semua Daftar Tarif (Grouped by Tahun)
export async function getDaftarTarif() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('biaya_settings')
    .select('*')
    .order('tahun_angkatan', { ascending: false })

  if (!data) return []

  // Grouping manual agar mudah ditampilkan (Satu tahun = satu objek)
  // Format: { 2024: { BANGUNAN: 1000, EHB: 100 }, 2025: { ... } }
  const grouped: Record<number, any> = {}

  data.forEach((item: any) => {
    if (!grouped[item.tahun_angkatan]) {
      grouped[item.tahun_angkatan] = { tahun: item.tahun_angkatan }
    }
    grouped[item.tahun_angkatan][item.jenis_biaya] = item.nominal
  })

  // Convert to array
  return Object.values(grouped).sort((a: any, b: any) => b.tahun - a.tahun)
}

// 2. Ambil Detail Tarif Satu Tahun (Untuk Form Edit)
export async function getTarifByTahun(tahun: number) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('biaya_settings')
    .select('jenis_biaya, nominal')
    .eq('tahun_angkatan', tahun)

  // Convert array db ke object simpel: { BANGUNAN: 1000000, ... }
  const result: any = {
    BANGUNAN: 0,
    KESEHATAN: 0,
    EHB: 0,
    EKSKUL: 0
  }

  data?.forEach((d: any) => {
    result[d.jenis_biaya] = d.nominal
  })

  return result
}

// 3. Simpan Tarif Massal (4 Item sekaligus)
export async function simpanTarif(tahun: number, tarifData: any) {
  const supabase = await createClient()

  // Kita upsert 4 baris sekaligus
  const upsertData = [
    { tahun_angkatan: tahun, jenis_biaya: 'BANGUNAN', nominal: tarifData.BANGUNAN },
    { tahun_angkatan: tahun, jenis_biaya: 'KESEHATAN', nominal: tarifData.KESEHATAN },
    { tahun_angkatan: tahun, jenis_biaya: 'EHB', nominal: tarifData.EHB },
    { tahun_angkatan: tahun, jenis_biaya: 'EKSKUL', nominal: tarifData.EKSKUL },
  ]

  const { error } = await supabase
    .from('biaya_settings')
    .upsert(upsertData, { onConflict: 'tahun_angkatan, jenis_biaya' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/keuangan/tarif')
  return { success: true }
}