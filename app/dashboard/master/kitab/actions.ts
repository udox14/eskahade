'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Data Kitab (Join Mapel & Marhalah)
export async function getKitabList() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('kitab')
    .select('*, mapel(nama), marhalah(nama, urutan)')
    .order('marhalah(urutan)')
    .order('mapel(nama)')
  
  return data || []
}

// 2. Ambil Referensi untuk Dropdown
export async function getReferensiKitab() {
  const supabase = await createClient()
  const { data: mapel } = await supabase.from('mapel').select('*').eq('aktif', true).order('nama')
  const { data: marhalah } = await supabase.from('marhalah').select('*').order('urutan')
  return { mapel, marhalah }
}

// 3. Simpan Kitab
export async function simpanKitab(formData: FormData) {
  const supabase = await createClient()
  
  const marhalah_id = formData.get('marhalah_id')
  const mapel_id = formData.get('mapel_id')
  const nama_kitab = formData.get('nama_kitab') as string

  // Upsert berdasarkan constraint unique (marhalah + mapel)
  const { error } = await supabase
    .from('kitab')
    .upsert({
      marhalah_id: Number(marhalah_id),
      mapel_id: Number(mapel_id),
      nama_kitab
    }, { onConflict: 'marhalah_id, mapel_id' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

// 4. Hapus Kitab
export async function hapusKitab(id: number) {
  const supabase = await createClient()
  await supabase.from('kitab').delete().eq('id', id)
  revalidatePath('/dashboard/master/kitab')
}