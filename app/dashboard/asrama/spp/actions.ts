'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Helper & Config
export async function getClientRestriction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase.from('profiles').select('role, asrama_binaan').eq('id', user.id).single()
    if (data?.role === 'pengurus_asrama') return data.asrama_binaan
  }
  return null
}

export async function getNominalSPP() {
  // Idealnya dari database settings, sementara hardcode/default
  return 70000 
}

// =========================================================================
// FUNGSI BARU: Untuk Widget Dashboard (Menghitung Total Anak yang Menunggak)
// =========================================================================
export async function getRingkasanTunggakan(asramaFilter?: string) {
  const supabase = await createClient()
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 1. Ambil santri aktif
  let query = supabase.from('santri').select('id').eq('status_global', 'aktif')
  if (asramaFilter && asramaFilter !== 'SEMUA') {
    query = query.eq('asrama', asramaFilter)
  }
  const { data: santriList } = await query
  
  if (!santriList || santriList.length === 0) return 0

  const santriIds = santriList.map(s => s.id)

  // 2. Ambil log bayar tahun ini
  const { data: logs } = await supabase
    .from('spp_log')
    .select('santri_id, bulan')
    .eq('tahun', tahun)
    .in('santri_id', santriIds)

  // 3. Hitung jumlah anak yang menunggak (minimal 1 bulan belum bayar s/d bulan ini)
  let penunggakCount = 0

  santriList.forEach(s => {
    const bayarAnak = logs?.filter(l => l.santri_id === s.id) || []
    let nunggak = false
    
    for(let i = 1; i <= currentMonth; i++) {
        if(!bayarAnak.some(l => l.bulan === i)) {
            nunggak = true
            break
        }
    }
    if (nunggak) penunggakCount++
  })

  return penunggakCount
}

// 2. Data Dashboard Monitoring (List View)
export async function getDashboardSPP(tahun: number, asrama: string) {
  const supabase = await createClient()
  const currentMonth = new Date().getMonth() + 1
  
  // A. Ambil Santri
  let query = supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar')
    .eq('status_global', 'aktif')
    .order('nama_lengkap')

  if (asrama && asrama !== 'SEMUA') {
    query = query.eq('asrama', asrama)
  }

  const { data: santriList } = await query
  if (!santriList) return []

  const santriIds = santriList.map(s => s.id)

  // B. Ambil Pembayaran Tahun Ini
  const { data: logs } = await supabase
    .from('spp_log')
    .select('santri_id, bulan')
    .eq('tahun', tahun)
    .in('santri_id', santriIds)

  // C. Hitung Status
  return santriList.map(s => {
    const bayarAnak = logs?.filter(l => l.santri_id === s.id) || []
    const bulanIniLunas = bayarAnak.some(l => l.bulan === currentMonth)
    
    // Hitung tunggakan (Januari s.d. Bulan Ini yg belum bayar)
    let tunggakan = 0
    // Asumsi tahun berjalan. Kalau tahun lalu, cek 1-12.
    const maxCheck = (tahun < new Date().getFullYear()) ? 12 : currentMonth
    
    for(let i=1; i<=maxCheck; i++) {
        if(!bayarAnak.some(l => l.bulan === i)) tunggakan++
    }

    return {
        ...s,
        bulan_ini_lunas: bulanIniLunas,
        jumlah_tunggakan: tunggakan,
        // Helper untuk sorting kamar
        kamar_num: parseInt(s.kamar) || 999 
    }
  })
}

// 3. Data Detail Santri (Payment View)
export async function getStatusSPP(santriId: string, tahun: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('spp_log')
    .select('id, bulan, tahun, nominal_bayar, tanggal_bayar, status_bayar')
    .eq('santri_id', santriId)
    .eq('tahun', tahun)
  return data || []
}

// 4. Bayar Manual (Detail View)
export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Cek duplikat
  const { data: exist } = await supabase
    .from('spp_log')
    .select('bulan')
    .eq('santri_id', santriId)
    .eq('tahun', tahun)
    .in('bulan', bulans)

  if (exist && exist.length > 0) {
    return { error: `Beberapa bulan sudah dibayar sebelumnya.` }
  }

  const inserts = bulans.map(b => ({
    santri_id: santriId,
    tahun,
    bulan: b,
    nominal_bayar: nominalPerBulan,
    penerima_id: user?.id,
    keterangan: 'Pembayaran Manual'
  }))

  const { error } = await supabase.from('spp_log').insert(inserts)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/asrama/spp')
  return { success: true }
}

// 5. Simpan Batch (List View - Fitur Baru)
export async function simpanSppBatch(listTransaksi: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!listTransaksi || listTransaksi.length === 0) return { error: "Tidak ada data." }

  const inserts = listTransaksi.map(item => ({
    santri_id: item.santriId,
    bulan: item.bulan,
    tahun: item.tahun,
    nominal_bayar: item.nominal,
    penerima_id: user?.id,
    keterangan: 'Pembayaran Cepat'
  }))

  const { error } = await supabase.from('spp_log').insert(inserts)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/asrama/spp')
  return { success: true, count: inserts.length }
}