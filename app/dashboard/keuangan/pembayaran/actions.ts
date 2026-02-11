'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Cari Santri (Search Bar)
export async function cariSantriKeuangan(keyword: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at')
    .eq('status_global', 'aktif')
    .ilike('nama_lengkap', `%${keyword}%`)
    .limit(5)

  return data?.map((s: any) => ({
    ...s,
    tahun_masuk_fix: s.tahun_masuk || new Date(s.created_at).getFullYear()
  })) || []
}

// 2. Ambil Info Tagihan Lengkap
export async function getInfoTagihan(santriId: string, tahunMasuk: number, tahunTagihan: number) {
  const supabase = await createClient()

  // A. Ambil Tarif Sesuai Angkatan
  const { data: tarif } = await supabase
    .from('biaya_settings')
    .select('jenis_biaya, nominal')
    .eq('tahun_angkatan', tahunMasuk)

  const harga: any = { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0 }
  tarif?.forEach((t: any) => harga[t.jenis_biaya] = t.nominal)

  // B. Ambil Riwayat Pembayaran
  const { data: bayar } = await supabase
    .from('pembayaran_tahunan')
    .select('jenis_biaya, nominal_bayar, tahun_tagihan')
    .eq('santri_id', santriId)

  // C. Hitung Status BANGUNAN
  const bayarBangunan = bayar?.filter((b: any) => b.jenis_biaya === 'BANGUNAN') || []
  const totalSudahBayarBangunan = bayarBangunan.reduce((sum: number, b: any) => sum + b.nominal_bayar, 0)
  const sisaBangunan = harga.BANGUNAN - totalSudahBayarBangunan

  // D. Hitung Status TAHUNAN
  const cekLunas = (jenis: string) => {
    return bayar?.some((b: any) => b.jenis_biaya === jenis && b.tahun_tagihan === tahunTagihan)
  }

  return {
    harga_angkatan: harga,
    bangunan: {
      total_wajib: harga.BANGUNAN,
      sudah_bayar: totalSudahBayarBangunan,
      sisa: sisaBangunan <= 0 ? 0 : sisaBangunan,
      status: sisaBangunan <= 0 ? 'LUNAS' : totalSudahBayarBangunan > 0 ? 'CICILAN' : 'BELUM'
    },
    tahunan: {
      KESEHATAN: { nominal: harga.KESEHATAN, lunas: cekLunas('KESEHATAN') },
      EHB: { nominal: harga.EHB, lunas: cekLunas('EHB') },
      EKSKUL: { nominal: harga.EKSKUL, lunas: cekLunas('EKSKUL') },
    }
  }
}

// 3. Proses Pembayaran Manual
export async function bayarTagihan(
  santriId: string, 
  jenis: string, 
  nominal: number, 
  tahunTagihan: number | null,
  keterangan: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (jenis !== 'BANGUNAN' && tahunTagihan) {
    const { data: exist } = await supabase.from('pembayaran_tahunan')
      .select('id')
      .eq('santri_id', santriId)
      .eq('jenis_biaya', jenis)
      .eq('tahun_tagihan', tahunTagihan)
      .single()
    
    if (exist) return { error: `Tagihan ${jenis} tahun ${tahunTagihan} sudah lunas sebelumnya.` }
  }

  const { error } = await supabase.from('pembayaran_tahunan').insert({
    santri_id: santriId,
    jenis_biaya: jenis,
    tahun_tagihan: tahunTagihan,
    nominal_bayar: nominal,
    penerima_id: user?.id,
    keterangan
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/keuangan/pembayaran')
  return { success: true }
}

// 4. DATA MONITORING (Tabel Lengkap)
export async function getMonitoringPembayaran(asrama: string, kamar: string, search: string, tahunTagihan: number) {
  const supabase = await createClient()

  // A. Ambil Tarif Bangunan Semua Angkatan (Cache sederhana)
  // Biar gak query berulang-ulang dalam loop
  const { data: settings } = await supabase.from('biaya_settings').select('tahun_angkatan, jenis_biaya, nominal')
  const mapTarifBangunan = new Map<number, number>()
  settings?.forEach(s => {
    if (s.jenis_biaya === 'BANGUNAN') mapTarifBangunan.set(s.tahun_angkatan, s.nominal)
  })

  // B. Ambil Santri Sesuai Filter
  let query = supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at')
    .eq('status_global', 'aktif')
    .order('nama_lengkap')

  if (asrama && asrama !== 'SEMUA') query = query.eq('asrama', asrama)
  if (kamar && kamar !== 'SEMUA') query = query.eq('kamar', kamar)
  if (search) query = query.ilike('nama_lengkap', `%${search}%`)

  const { data: santriList } = await query
  if (!santriList || santriList.length === 0) return []

  const santriIds = santriList.map(s => s.id)

  // C. Ambil Pembayaran (Bangunan & Tahunan Ini)
  // Kita split query biar aman dan jelas
  const { data: payBangunan } = await supabase
    .from('pembayaran_tahunan')
    .select('santri_id, nominal_bayar')
    .in('santri_id', santriIds)
    .eq('jenis_biaya', 'BANGUNAN')

  const { data: payTahunan } = await supabase
    .from('pembayaran_tahunan')
    .select('santri_id, jenis_biaya')
    .in('santri_id', santriIds)
    .eq('tahun_tagihan', tahunTagihan)

  // D. Gabungkan Data
  const result = santriList.map((s: any) => {
    const tahunMasuk = s.tahun_masuk || new Date(s.created_at).getFullYear()
    
    // Status Bangunan
    const targetBangunan = mapTarifBangunan.get(tahunMasuk) || 0
    const totalBayarBangunan = payBangunan?.filter(p => p.santri_id === s.id).reduce((sum, p) => sum + p.nominal_bayar, 0) || 0
    
    let statusBangunan = 'BELUM'
    if (targetBangunan > 0) {
        if (totalBayarBangunan >= targetBangunan) statusBangunan = 'LUNAS'
        else if (totalBayarBangunan > 0) statusBangunan = 'CICIL'
    } else {
        statusBangunan = '-' // Tidak ada tarif bangunan
    }

    // Status Tahunan
    const bayarIni = payTahunan?.filter(p => p.santri_id === s.id) || []
    const lunasEHB = bayarIni.some(p => p.jenis_biaya === 'EHB')
    const lunasKes = bayarIni.some(p => p.jenis_biaya === 'KESEHATAN')
    const lunasEkskul = bayarIni.some(p => p.jenis_biaya === 'EKSKUL')

    return {
      ...s,
      tahun_masuk_fix: tahunMasuk,
      status_bangunan: statusBangunan,
      lunas_ehb: lunasEHB,
      lunas_kesehatan: lunasKes,
      lunas_ekskul: lunasEkskul,
      is_full_tahunan: lunasEHB && lunasKes && lunasEkskul
    }
  })

  return result
}

// 5. BAYAR LUNAS SEMUA (One Click)
export async function bayarLunasSetahun(santriId: string, tahunTagihan: number, tahunMasuk: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // A. Ambil Tarif
  const { data: tarif } = await supabase
    .from('biaya_settings')
    .select('jenis_biaya, nominal')
    .eq('tahun_angkatan', tahunMasuk)
    .in('jenis_biaya', ['KESEHATAN', 'EHB', 'EKSKUL'])

  if (!tarif || tarif.length === 0) return { error: "Tarif belum diatur untuk angkatan ini." }

  // B. Cek yg sudah bayar
  const { data: sudahBayar } = await supabase
    .from('pembayaran_tahunan')
    .select('jenis_biaya')
    .eq('santri_id', santriId)
    .eq('tahun_tagihan', tahunTagihan)

  const sudahList = sudahBayar?.map(b => b.jenis_biaya) || []

  // C. Siapkan Data Insert
  const toInsert: any[] = []
  let totalNominal = 0

  tarif.forEach((t: any) => {
    if (!sudahList.includes(t.jenis_biaya) && t.nominal > 0) {
      toInsert.push({
        santri_id: santriId,
        jenis_biaya: t.jenis_biaya,
        tahun_tagihan: tahunTagihan,
        nominal_bayar: t.nominal,
        penerima_id: user?.id,
        keterangan: `Pelunasan Otomatis ${tahunTagihan}`
      })
      totalNominal += t.nominal
    }
  })

  if (toInsert.length === 0) return { error: "Santri ini sudah lunas semua tagihan tahunan." }

  const { error } = await supabase.from('pembayaran_tahunan').insert(toInsert)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/keuangan/pembayaran')
  return { success: true, count: toInsert.length, total: totalNominal }
}