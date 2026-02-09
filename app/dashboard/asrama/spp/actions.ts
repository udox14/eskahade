'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

// 1. Ambil Setting Nominal Aktif
export async function getNominalSPP() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('spp_settings')
    .select('nominal')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .single()
  
  return data?.nominal || 70000 
}

// 2. Ambil Status Pembayaran Santri
export async function getStatusSPP(santriId: string, tahun: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('spp_log')
    .select('bulan, nominal_bayar, tanggal_bayar, penerima:penerima_id(full_name)')
    .eq('santri_id', santriId)
    .eq('tahun', tahun)
  return data || []
}

// 3. Proses Pembayaran
export async function bayarSPP(santriId: string, tahun: number, bulanList: number[], nominalPerBulan: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!bulanList.length) return { error: "Pilih minimal satu bulan." }

  const dataInsert = bulanList.map(bulan => ({
    santri_id: santriId,
    bulan: bulan,
    tahun: tahun,
    nominal_bayar: nominalPerBulan,
    penerima_id: user?.id,
    tanggal_bayar: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('spp_log')
    .insert(dataInsert)

  if (error) {
    if (error.code === '23505') return { error: "Salah satu bulan yang dipilih sudah lunas." }
    return { error: error.message }
  }

  revalidatePath('/dashboard/asrama/spp')
  return { success: true, total: bulanList.length * nominalPerBulan }
}

// 4. DATA MONITORING (DASHBOARD)
export async function getDashboardSPP(tahun: number, asramaRequest: string) {
  const supabase = await createClient()
  
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  let query = supabase
    .from('santri')
    .select('id, nama_lengkap, nis, kamar, asrama')
    .eq('status_global', 'aktif')
    .order('kamar')
    .order('nama_lengkap')

  if (targetAsrama) {
    query = query.eq('asrama', targetAsrama)
  }

  const { data: santriList } = await query
  if (!santriList || santriList.length === 0) return []

  const santriIds = santriList.map(s => s.id)

  const { data: logs } = await supabase
    .from('spp_log')
    .select('santri_id, bulan')
    .eq('tahun', tahun)
    .in('santri_id', santriIds)

  const currentMonth = new Date().getMonth() + 1
  const checkYear = new Date().getFullYear()
  let effectiveCurrentMonth = currentMonth
  
  if (tahun < checkYear) effectiveCurrentMonth = 13 
  if (tahun > checkYear) effectiveCurrentMonth = 0

  const result = santriList.map(s => {
    const bayar = logs?.filter(l => l.santri_id === s.id) || []
    
    const isLunasThisMonth = tahun === checkYear 
      ? bayar.some(l => l.bulan === currentMonth)
      : (tahun < checkYear ? true : false)

    let tunggakan = 0
    const limitCek = effectiveCurrentMonth > 12 ? 12 : effectiveCurrentMonth - 1
    
    for (let i = 1; i <= limitCek; i++) {
        if (!bayar.some(l => l.bulan === i)) {
            tunggakan++
        }
    }

    return {
        ...s,
        bulan_ini_lunas: isLunasThisMonth,
        jumlah_tunggakan: tunggakan,
        kamar_norm: parseInt(s.kamar) || 999
    }
  })

  return result
}

// 5. Helper Client
export async function getClientRestriction() {
  return await getUserRestriction()
}

// 6. BARU: Hitung Total Penunggak (Untuk Dashboard Utama)
export async function getRingkasanTunggakan(asrama?: string) {
  const supabase = await createClient()
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const limitBulan = currentMonth - 1 // Bulan lalu

  if (limitBulan < 1) return 0 // Awal tahun, belum ada tunggakan

  // A. Ambil Santri
  let query = supabase.from('santri').select('id').eq('status_global', 'aktif')
  if (asrama) query = query.eq('asrama', asrama)
  
  const { data: santriList } = await query
  if (!santriList || santriList.length === 0) return 0
  
  const santriIds = santriList.map(s => s.id)

  // B. Ambil Pembayaran (Yang sudah bayar bulan 1 s.d. bulan lalu)
  const { data: logs } = await supabase
    .from('spp_log')
    .select('santri_id, bulan')
    .eq('tahun', tahun)
    .in('santri_id', santriIds)
    .lte('bulan', limitBulan) 
    
  // C. Hitung siapa yang punya 'lubang' pembayaran
  let jumlahPenunggak = 0
  
  santriIds.forEach(id => {
    const bayar = logs?.filter(l => l.santri_id === id) || []
    // Jumlah bayar harus sama dengan jumlah bulan yang sudah lewat
    // Contoh: Sekarang Maret (Bulan 3). Limit = 2 (Jan, Feb).
    // Jika bayar < 2, berarti nunggak.
    // (Asumsi data unik per bulan sudah dijaga database)
    if (bayar.length < limitBulan) {
      jumlahPenunggak++
    }
  })

  return jumlahPenunggak
}