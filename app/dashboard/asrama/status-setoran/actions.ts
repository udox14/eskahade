'use server'

import { createClient } from '@/lib/supabase/server'

// Helper Restriksi Asrama
async function getUserRestriction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase.from('profiles').select('role, asrama_binaan').eq('id', user.id).single()
    if (data?.role === 'pengurus_asrama') return data.asrama_binaan
  }
  return null
}

export async function getStatusSetoranSaya(tahun: number) {
  const supabase = await createClient()
  
  // 1. Cek Asrama User
  const asrama = await getUserRestriction()

  if (!asrama) {
    return { error: "Anda tidak memiliki akses asrama binaan." }
  }

  const { data } = await supabase
    .from('spp_setoran')
    .select('bulan, tanggal_terima, penerima:penerima_id(full_name)')
    .eq('asrama', asrama)
    .eq('tahun', tahun)
    .order('bulan')

  // Mapping 1-12
  const statusBulan: Record<number, any> = {}
  
  data?.forEach((d: any) => {
    // FIX BUILD ERROR: Handle join array/object secara eksplisit
    // Supabase kadang mengembalikan array [{full_name: '...'}] atau object {full_name: '...'}
    const p = d.penerima
    const namaPenerima = Array.isArray(p) ? p[0]?.full_name : p?.full_name

    statusBulan[d.bulan] = {
      lunas: true,
      tanggal: d.tanggal_terima,
      penerima: namaPenerima || 'Sistem'
    }
  })

  return { asrama, data: statusBulan }
}