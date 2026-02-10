'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Cari Santri
export async function cariSantri(keyword: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar, tempat_lahir, tanggal_lahir, alamat, nama_ayah, sekolah, kelas_sekolah')
    .eq('status_global', 'aktif')
    .ilike('nama_lengkap', `%${keyword}%`)
    .limit(5)
  return data || []
}

// 2. Hitung Detail Tunggakan SPP
export async function cekTunggakanSantri(santriId: string) {
  const supabase = await createClient()
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  
  const { data: logs } = await supabase
    .from('spp_log')
    .select('bulan, nominal_bayar')
    .eq('santri_id', santriId)
    .eq('tahun', tahun)

  const bulanNunggak: string[] = []
  let totalHutang = 0
  const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

  for (let i = 1; i <= currentMonth; i++) {
    const isLunas = logs?.some(l => l.bulan === i)
    if (!isLunas) {
      bulanNunggak.push(BULAN_NAMA[i-1])
      totalHutang += 70000 
    }
  }

  return {
    adaTunggakan: bulanNunggak.length > 0,
    listBulan: bulanNunggak.join(", "),
    total: totalHutang,
    tahun: tahun
  }
}

// 3. Catat Surat Keluar (History)
export async function catatSuratKeluar(santriId: string, jenis: string, detail: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('riwayat_surat').insert({
    santri_id: santriId,
    jenis_surat: jenis,
    detail_info: detail,
    created_by: user?.id
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/dewan-santri/surat')
  return { success: true }
}

// 4. Ambil Riwayat Surat (Filter Bulan/Tahun)
export async function getRiwayatSurat(bulan: number, tahun: number) {
  const supabase = await createClient()

  // Range tanggal dalam bulan tersebut
  const startDate = new Date(tahun, bulan - 1, 1).toISOString()
  const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString()

  const { data } = await supabase
    .from('riwayat_surat')
    .select(`
      id, 
      jenis_surat, 
      detail_info, 
      created_at,
      santri (nama_lengkap, asrama),
      admin:created_by (full_name)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  return data || []
}

// 5. BARU: Hapus Riwayat Surat
export async function hapusRiwayatSurat(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('riwayat_surat')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/dewan-santri/surat')
  return { success: true }
}