'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper: Cek apakah user terbatas pada satu asrama?
export async function getUserRestriction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, asrama_binaan')
      .eq('id', user.id)
      .single()
    
    // Jika Pengurus Asrama, kembalikan nama asramanya
    if (profile?.role === 'pengurus_asrama') {
      return profile.asrama_binaan
    }
  }
  return null // Admin/Sekpen/dll bebas (null restriction)
}

// Ambil data santri per asrama + Status Absen + Status Izin
export async function getDataAbsenMalam(asramaRequest: string) {
  const supabase = await createClient()

  // CEK RESTRIKSI: Jika user punya asrama binaan, paksa gunakan itu
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  // 1. Ambil Santri di Asrama tersebut
  const { data: santriList } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, kamar')
    .eq('asrama', targetAsrama)
    .eq('status_global', 'aktif')
    .order('kamar') 
    .order('nama_lengkap')

  if (!santriList || santriList.length === 0) return []

  const santriIds = santriList.map(s => s.id)

  // 2. Ambil Absen Malam (Hanya status)
  const { data: absenList } = await supabase
    .from('absen_asrama')
    .select('santri_id, status, updated_at')
    .in('santri_id', santriIds)

  // 3. Ambil Izin yang SEDANG AKTIF saat ini
  const { data: izinList } = await supabase
    .from('perizinan')
    .select('santri_id, jenis')
    .eq('status', 'AKTIF') 
    .in('santri_id', santriIds)

  // 4. Gabungkan Data (Merge)
  const todayResetTime = new Date()
  todayResetTime.setHours(12, 0, 0, 0) 
  if (new Date() < todayResetTime) {
    todayResetTime.setDate(todayResetTime.getDate() - 1)
  }

  const result = santriList.map(s => {
    const izin = izinList?.find(i => i.santri_id === s.id)
    const absenDB = absenList?.find(a => a.santri_id === s.id)
    
    let statusFinal = 'BELUM'
    let isIzin = false

    if (izin) {
      statusFinal = `IZIN: ${izin.jenis}`
      isIzin = true
    } else if (absenDB) {
      const dbTime = new Date(absenDB.updated_at)
      if (dbTime > todayResetTime) {
        statusFinal = absenDB.status 
      }
    }

    return {
      ...s,
      status: statusFinal,
      is_izin: isIzin,
      kamar_norm: normalizeKamar(s.kamar) 
    }
  })

  return result
}

// Simpan Absen (Upsert)
export async function updateAbsenMalam(santriId: string, status: 'HADIR' | 'TIDAK') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('absen_asrama')
    .upsert({
      santri_id: santriId,
      status: status,
      updated_at: new Date().toISOString(), 
      created_by: user?.id
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true }
}

function normalizeKamar(k: string) {
  const num = parseInt(k)
  return isNaN(num) ? 999 : num
}