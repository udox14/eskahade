'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. AMBIL DATA DISTRIBUSI (List Transaksi)
export async function getListTransaksi(search: string, filterStatus: string) {
  const supabase = await createClient()

  let query = supabase
    .from('upk_transaksi')
    .select(`
      id,
      nama_pemesan,
      info_tambahan,
      total_tagihan,
      total_bayar,
      sisa_kembalian,
      sisa_tunggakan,
      status_lunas,
      created_at,
      upk_item (
        id, kitab_id, status_serah, is_gratis, 
        kitab(nama_kitab)
      )
    `)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('nama_pemesan', `%${search}%`)
  }

  const { data } = await query
  if (!data) return []

  // Filter Client Side
  const filtered = data.filter((trx: any) => {
    const pendingBarang = trx.upk_item.some((i: any) => i.status_serah === 'BELUM')
    const adaHutang = trx.sisa_tunggakan > 0
    const adaKembalian = trx.sisa_kembalian > 0

    if (filterStatus === 'PENDING_BARANG') return pendingBarang
    if (filterStatus === 'HUTANG') return adaHutang
    if (filterStatus === 'KEMBALIAN') return adaKembalian
    return true
  })

  // Format data
  return filtered.map((trx: any) => ({
    ...trx,
    total_item: trx.upk_item.length,
    item_belum: trx.upk_item.filter((i: any) => i.status_serah === 'BELUM').length,
    items_detail: trx.upk_item, 
    list_barang_belum: trx.upk_item
        .filter((i: any) => i.status_serah === 'BELUM')
        .map((i: any) => i.kitab?.nama_kitab)
        .join(', ')
  }))
}

// 2. AMBIL REKAP GUDANG
export async function getRekapGudang() {
  const supabase = await createClient()

  const { data: itemPending } = await supabase
    .from('upk_item')
    .select(`
      is_gratis,
      kitab (id, nama_kitab, marhalah(nama))
    `)
    .eq('status_serah', 'BELUM')

  const rekap: Record<string, any> = {}

  itemPending?.forEach((item: any) => {
    const namaKitab = item.kitab?.nama_kitab || 'Unknown'
    const marhalah = item.kitab?.marhalah?.nama || '-'
    const key = item.kitab?.id

    if (!rekap[key]) {
        rekap[key] = {
            id: key,
            nama: namaKitab,
            marhalah: marhalah,
            total_butuh: 0,
            total_gratis: 0
        }
    }

    rekap[key].total_butuh++
    if (item.is_gratis) rekap[key].total_gratis++
  })

  return Object.values(rekap).sort((a, b) => a.marhalah.localeCompare(b.marhalah))
}

// 3. UPDATE STATUS SERAH (FULL SATU TRANSAKSI)
export async function serahkanBarang(transaksiId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('upk_item')
    .update({ 
        status_serah: 'SUDAH',
        tanggal_serah: new Date().toISOString()
    })
    .eq('transaksi_id', transaksiId)
    .eq('status_serah', 'BELUM')

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik/upk/manajemen')
  return { success: true }
}

// 4. UPDATE STATUS SERAH (PARTIAL)
export async function serahkanBarangPartial(itemIds: string[]) {
  const supabase = await createClient()
  
  if (!itemIds || itemIds.length === 0) return { error: "Pilih minimal satu item." }

  const { error } = await supabase
    .from('upk_item')
    .update({ 
        status_serah: 'SUDAH',
        tanggal_serah: new Date().toISOString()
    })
    .in('id', itemIds) 

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik/upk/manajemen')
  return { success: true }
}

// 5. UPDATE KEUANGAN
export async function selesaikanKeuangan(transaksiId: string, jenis: 'LUNAS' | 'AMBIL_KEMBALIAN') {
  const supabase = await createClient()
  
  const updateData: any = {}
  if (jenis === 'LUNAS') {
    updateData.sisa_tunggakan = 0
    updateData.status_lunas = true
  } else {
    updateData.sisa_kembalian = 0
  }

  const { error } = await supabase
    .from('upk_transaksi')
    .update(updateData)
    .eq('id', transaksiId)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik/upk/manajemen')
  return { success: true }
}