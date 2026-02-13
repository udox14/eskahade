'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Daftar Kitab (Grouped by Marhalah)
export async function getDaftarKitab() {
  const supabase = await createClient()
  
  // Ambil data raw
  const { data, error } = await supabase
    .from('kitab')
    .select(`
      id, 
      nama_kitab, 
      harga, 
      marhalah (id, nama, urutan)
    `)
  
  if (error || !data) {
    console.error("Error Fetch Kitab:", error)
    return {}
  }

  // Sorting Manual di JS (Lebih Aman)
  // 1. Sort by Nama Kitab
  data.sort((a, b) => a.nama_kitab.localeCompare(b.nama_kitab))

  // Grouping
  const grouped: Record<string, any[]> = {}
  
  data.forEach((k: any) => {
    // Handle join array/object
    const m = Array.isArray(k.marhalah) ? k.marhalah[0] : k.marhalah
    const mNama = m?.nama || 'Umum / Lainnya'
    const mUrut = m?.urutan || 999

    if (!grouped[mNama]) {
      // Simpan metadata urutan di array untuk sorting group nanti (trik)
      // Tapi karena return type Record<string, []>, kita sort keys nya di frontend atau di sini convert ke array of object
      // Untuk kemudahan frontend yang sudah ada, kita tetap return Record, tapi kita urutkan insert kuncinya (JS object keys order is insertion order mostly)
      grouped[mNama] = []
    }
    
    grouped[mNama].push({
        id: k.id,
        nama: k.nama_kitab, // Mapping ke 'nama' agar sesuai frontend
        harga: k.harga,
        urutan_marhalah: mUrut
    })
  })

  // Re-order Object Keys berdasarkan Urutan Marhalah
  const orderedGrouped: Record<string, any[]> = {}
  const keys = Object.keys(grouped).sort((a, b) => {
    const urutanA = grouped[a][0]?.urutan_marhalah || 999
    const urutanB = grouped[b][0]?.urutan_marhalah || 999
    return urutanA - urutanB
  })

  keys.forEach(key => {
    orderedGrouped[key] = grouped[key]
  })

  return orderedGrouped
}

// 2. Cari Santri
export async function cariSantri(keyword: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar')
    .eq('status_global', 'aktif')
    .ilike('nama_lengkap', `%${keyword}%`)
    .limit(5)
  return data || []
}

// 3. Simpan Transaksi Lengkap
export async function simpanTransaksiUPK(payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { 
    santriId, 
    namaPemesan, 
    infoTambahan, 
    totalTagihan, 
    totalBayar, 
    items 
  } = payload

  // Hitung status keuangan
  const diff = totalBayar - totalTagihan
  const kembalian = diff > 0 ? diff : 0
  const tunggakan = diff < 0 ? Math.abs(diff) : 0
  const lunas = tunggakan === 0

  // A. Insert Header
  const { data: trx, error: errTrx } = await supabase
    .from('upk_transaksi')
    .insert({
      santri_id: santriId,
      nama_pemesan: namaPemesan,
      info_tambahan: infoTambahan,
      total_tagihan: totalTagihan,
      total_bayar: totalBayar,
      sisa_kembalian: kembalian,
      sisa_tunggakan: tunggakan,
      status_lunas: lunas,
      created_by: user?.id
    })
    .select('id')
    .single()

  if (errTrx) return { error: errTrx.message }

  // B. Insert Items
  const itemsInsert = items.map((item: any) => ({
    transaksi_id: trx.id,
    kitab_id: item.id,
    harga_saat_ini: item.hargaAsli, 
    is_gratis: item.isGratis,
    status_serah: 'BELUM' 
  }))

  const { error: errItem } = await supabase.from('upk_item').insert(itemsInsert)

  if (errItem) return { error: "Gagal simpan item: " + errItem.message }

  revalidatePath('/dashboard/akademik/upk')
  return { success: true }
}