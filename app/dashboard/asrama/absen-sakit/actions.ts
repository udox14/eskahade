'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper: Cek Restriksi
async function getUserRestriction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase.from('profiles').select('role, asrama_binaan').eq('id', user.id).single()
    if (data?.role === 'pengurus_asrama') return data.asrama_binaan
  }
  return null
}

// 1. Cari Santri di Asrama Tertentu (Untuk Input)
export async function cariSantriAsrama(keyword: string, asramaRequest: string) {
  const supabase = await createClient()
  
  // RESTRIKSI
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const { data } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, kamar, asrama')
    .eq('asrama', targetAsrama)
    .eq('status_global', 'aktif')
    .ilike('nama_lengkap', `%${keyword}%`)
    .limit(5)

  return data || []
}

// 2. Simpan Absen Sakit
export async function simpanAbsenSakit(santriId: string, keterangan: 'BELI_SURAT' | 'TIDAK_BELI') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0] 

  const { data: exist } = await supabase
    .from('absen_sakit')
    .select('id')
    .eq('santri_id', santriId)
    .eq('tanggal', today)
    .single()

  if (exist) return { error: "Santri ini sudah dicatat sakit hari ini." }

  const { error } = await supabase.from('absen_sakit').insert({
    santri_id: santriId,
    tanggal: today,
    keterangan,
    created_by: user?.id
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/asrama/absen-sakit')
  return { success: true }
}

// 3. Ambil Data Sakit Minggu Ini
export async function getListSakitMingguan(asramaRequest: string) {
  const supabase = await createClient()

  // RESTRIKSI
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  
  const monday = new Date(now.setDate(diff))
  monday.setHours(0,0,0,0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6) 
  sunday.setHours(23,59,59,999)

  const { data } = await supabase
    .from('absen_sakit')
    .select(`
      id, tanggal, keterangan, created_at,
      santri!inner (nama_lengkap, nis, kamar, asrama)
    `)
    .eq('santri.asrama', targetAsrama)
    .gte('tanggal', monday.toISOString().split('T')[0])
    .lte('tanggal', sunday.toISOString().split('T')[0])
    .order('created_at', { ascending: false })

  return data || []
}

// 4. Helper untuk Client (Get Restriction)
export async function getAsramaRestrictionClient() {
  return await getUserRestriction()
}

export async function hapusAbsenSakit(id: string) {
  const supabase = await createClient()
  await supabase.from('absen_sakit').delete().eq('id', id)
  revalidatePath('/dashboard/asrama/absen-sakit')
}