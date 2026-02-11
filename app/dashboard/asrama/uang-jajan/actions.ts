'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper Restriksi
async function getUserRestriction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase.from('profiles').select('role, asrama_binaan').eq('id', user.id).single()
    if (data?.role === 'pengurus_asrama') return data.asrama_binaan
  }
  return null
}

// 1. Ambil Data Dashboard (Saldo per Santri)
export async function getDashboardTabungan(asramaRequest: string) {
  const supabase = await createClient()
  
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  // A. Ambil Santri
  const { data: santriList } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, kamar, asrama')
    .eq('asrama', targetAsrama)
    .eq('status_global', 'aktif')
    .order('kamar')
    .order('nama_lengkap')

  if (!santriList || santriList.length === 0) return { santri: [], stats: null }

  const santriIds = santriList.map(s => s.id)

  // B. Ambil Semua Transaksi Santri Tersebut
  const { data: logs } = await supabase
    .from('tabungan_log')
    .select('santri_id, jenis, nominal, created_at')
    .in('santri_id', santriIds)

  // C. Hitung Saldo & Statistik
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let totalUangFisik = 0
  let masukBulanIni = 0
  let keluarBulanIni = 0

  const dataFinal = santriList.map(s => {
    const trans = logs?.filter(l => l.santri_id === s.id) || []
    
    let saldo = 0

    trans.forEach(t => {
      if (t.jenis === 'MASUK') {
        saldo += t.nominal
        if (t.created_at >= startMonth) masukBulanIni += t.nominal
      } else {
        saldo -= t.nominal
        if (t.created_at >= startMonth) keluarBulanIni += t.nominal
      }
    })

    totalUangFisik += saldo

    return {
      ...s,
      saldo,
      kamar_norm: parseInt(s.kamar) || 999
    }
  })

  return {
    santri: dataFinal,
    stats: {
      uang_fisik: totalUangFisik,
      masuk_bulan_ini: masukBulanIni,
      keluar_bulan_ini: keluarBulanIni
    }
  }
}

// 2. Simpan Transaksi Tunggal (Topup Saldo)
export async function simpanTopup(santriId: string, nominal: number, keterangan: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('tabungan_log').insert({
    santri_id: santriId,
    jenis: 'MASUK',
    nominal,
    keterangan: keterangan || 'Topup Saldo',
    created_by: user?.id
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

// 3. Simpan Jajan Massal (Batch)
export async function simpanJajanMassal(listTransaksi: { santriId: string, nominal: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (listTransaksi.length === 0) return { error: "Tidak ada data." }

  const dataInsert = listTransaksi.map(item => ({
    santri_id: item.santriId,
    jenis: 'KELUAR',
    nominal: item.nominal,
    keterangan: 'Jajan Harian',
    created_by: user?.id
  }))

  const { error } = await supabase.from('tabungan_log').insert(dataInsert)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true, count: listTransaksi.length }
}

// 4. BARU: Ambil Riwayat Transaksi Santri (Untuk Modal Detail/Koreksi)
export async function getRiwayatTabunganSantri(santriId: string) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('tabungan_log')
    .select('*, admin:created_by(full_name)')
    .eq('santri_id', santriId)
    .order('created_at', { ascending: false })
    .limit(10) // Ambil 10 transaksi terakhir saja untuk koreksi

  return data || []
}

// 5. BARU: Hapus Transaksi (Untuk Koreksi Salah Ketik)
export async function hapusTransaksi(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tabungan_log')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

// 6. Helper Client
export async function getClientRestriction() {
  return await getUserRestriction()
}