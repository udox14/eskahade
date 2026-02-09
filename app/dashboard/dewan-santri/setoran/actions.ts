'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

// 1. AMBIL DETAIL SETORAN BULAN TERTENTU
export async function getDetailSetoranBulan(bulan: number, tahun: number) {
  const supabase = await createClient()

  const startDate = new Date(tahun, bulan - 1, 1)
  const endDate = new Date(tahun, bulan, 0) 
  endDate.setHours(23, 59, 59, 999)

  // A. Ambil Data Transaksi (SPP Log)
  const { data: logs } = await supabase
    .from('spp_log')
    .select(`
      nominal_bayar,
      santri!inner(asrama)
    `)
    .gte('tanggal_bayar', startDate.toISOString())
    .lte('tanggal_bayar', endDate.toISOString())

  // B. Ambil Data Setoran (FIX: JOIN KE PROFILES)
  const { data: setoranExisting } = await supabase
    .from('spp_setoran')
    .select(`
      *,
      penerima:penerima_id (full_name)
    `)
    .eq('bulan', bulan)
    .eq('tahun', tahun)

  // C. Agregasi
  const result = ASRAMA_LIST.map(namaAsrama => {
    // 1. Hitung Total Sistem (Target)
    const transaksiAsrama = logs?.filter((l: any) => l.santri.asrama === namaAsrama) || []
    const totalSistem = transaksiAsrama.reduce((sum: number, item: any) => sum + item.nominal_bayar, 0)

    // 2. Cek Data Setoran (Aktual)
    const dataSetor = setoranExisting?.find(s => s.asrama === namaAsrama)

    let status = 'PENDING'
    if (dataSetor) {
      if (dataSetor.jumlah_aktual === dataSetor.jumlah_sistem) status = 'MATCH'
      else if (dataSetor.jumlah_aktual > dataSetor.jumlah_sistem) status = 'PLUS'
      else status = 'MINUS'
    } else {
        if (totalSistem === 0) status = 'EMPTY'
    }

    // FIX: Ambil nama penerima dari relasi object
    // Supabase join one-to-one kadang return object, kadang array 1 item. Kita handle keduanya.
    let namaPenerima = '-'
    if (dataSetor?.penerima) {
        const p = dataSetor.penerima
        namaPenerima = Array.isArray(p) ? p[0]?.full_name : p.full_name
    }

    return {
      asrama: namaAsrama,
      total_sistem: totalSistem,
      total_aktual: dataSetor?.jumlah_aktual || 0,
      penyetor: dataSetor?.nama_penyetor || '-',
      penerima: namaPenerima || 'Sistem', // Hasil fix nama
      tanggal_terima: dataSetor?.tanggal_terima,
      catatan: dataSetor?.catatan,
      status: status,
      is_done: !!dataSetor
    }
  })

  return result
}

// 2. SIMPAN / TERIMA SETORAN
export async function terimaSetoran(
  asrama: string, 
  bulan: number, 
  tahun: number, 
  jumlahSistem: number,
  jumlahAktual: number,
  namaPenyetor: string,
  catatan: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('spp_setoran')
    .upsert({
      asrama,
      bulan,
      tahun,
      jumlah_sistem: jumlahSistem,
      jumlah_aktual: jumlahAktual,
      nama_penyetor: namaPenyetor,
      catatan,
      penerima_id: user?.id,
      tanggal_terima: new Date().toISOString()
    }, { onConflict: 'asrama, bulan, tahun' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// 3. BATALKAN SETORAN
export async function batalkanSetoran(asrama: string, bulan: number, tahun: number) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('spp_setoran')
    .delete()
    .eq('asrama', asrama)
    .eq('bulan', bulan)
    .eq('tahun', tahun)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}