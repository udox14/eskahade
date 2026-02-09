'use server'

import { createClient } from '@/lib/supabase/server'
// Kita gunakan Client Admin untuk bypass RLS saat ambil list user
import { createClient as createAdminClient } from '@supabase/supabase-js' 
import { revalidatePath } from 'next/cache'

// 1. Ambil Daftar Kelas beserta Wali Kelasnya saat ini
export async function getDaftarKelas() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('kelas')
    .select(`
      id, 
      nama_kelas, 
      marhalah(nama), 
      wali_kelas:wali_kelas_id(id, full_name)
    `)
    .order('nama_kelas')
  
  return data || []
}

// 2. Ambil User Kandidat (Role: Wali Kelas, Sekpen, atau Admin)
// PERBAIKAN: Gunakan Admin Client agar semua user terbaca tanpa terhalang RLS
export async function getKandidatWaliKelas() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Service Role Key missing");
      return [];
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['wali_kelas', 'sekpen', 'admin']) 
    .order('full_name')
  
  return data || []
}

// 3. Simpan Pemetaan
export async function setWaliKelas(kelasId: string, userId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('kelas')
    .update({ wali_kelas_id: userId })
    .eq('id', kelasId)
  
  if (error) return { error: error.message }

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}