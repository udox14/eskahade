'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. GETTERS
export async function getMarhalahList() {
  const supabase = await createClient()
  const { data } = await supabase.from('marhalah').select('*').order('urutan')
  return data || []
}

export async function getMapelList() {
  const supabase = await createClient()
  const { data } = await supabase.from('mapel').select('*').order('nama')
  return data || []
}

export async function getKitabList(marhalahId?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('kitab')
    .select(`
      id, 
      nama_kitab, 
      harga,
      marhalah(nama),
      mapel(nama)
    `)
    .order('nama_kitab')

  if (marhalahId) {
    query = query.eq('marhalah_id', marhalahId)
  }

  const { data } = await query
  return data || []
}

// 2. CRUD MANUAL
export async function tambahKitab(formData: FormData) {
  const supabase = await createClient()

  const nama = formData.get('nama_kitab') as string
  const marhalah = formData.get('marhalah_id') as string
  const mapel = formData.get('mapel_id') as string
  const harga = parseInt(formData.get('harga') as string) || 0 // BARU

  const { error } = await supabase.from('kitab').insert({
    nama_kitab: nama,
    marhalah_id: marhalah,
    mapel_id: mapel,
    harga: harga // BARU
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function hapusKitab(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('kitab').delete().eq('id', id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

// 3. UPDATE HARGA (Edit Cepat)
export async function updateHargaKitab(id: string, hargaBaru: number) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('kitab')
    .update({ harga: hargaBaru })
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

// 4. IMPORT EXCEL (Sekarang support Harga)
export async function importKitabMassal(dataExcel: any[]) {
  const supabase = await createClient()

  // Ambil referensi Marhalah & Mapel untuk mapping nama -> ID
  const { data: mrh } = await supabase.from('marhalah').select('id, nama')
  const { data: mpl } = await supabase.from('mapel').select('id, nama')

  const mapMarhalah = new Map()
  mrh?.forEach(m => mapMarhalah.set(m.nama.toLowerCase().trim(), m.id))

  const mapMapel = new Map()
  mpl?.forEach(m => mapMapel.set(m.nama.toLowerCase().trim(), m.id))

  const inserts: any[] = []
  let failCount = 0

  for (const row of dataExcel) {
    const namaKitab = row['NAMA KITAB'] || row['nama kitab']
    const namaMarhalah = row['MARHALAH'] || row['marhalah']
    const namaMapel = row['MAPEL'] || row['mapel']
    const harga = parseInt(row['HARGA'] || row['harga']) || 0 // BARU

    if (!namaKitab || !namaMarhalah || !namaMapel) {
        failCount++
        continue
    }

    const marhalahId = mapMarhalah.get(String(namaMarhalah).toLowerCase().trim())
    const mapelId = mapMapel.get(String(namaMapel).toLowerCase().trim())

    if (marhalahId && mapelId) {
        inserts.push({
            nama_kitab: namaKitab,
            marhalah_id: marhalahId,
            mapel_id: mapelId,
            harga: harga // BARU
        })
    } else {
        failCount++
    }
  }

  if (inserts.length === 0) return { error: "Tidak ada data valid (Cek penulisan Marhalah/Mapel)" }

  const { error } = await supabase.from('kitab').insert(inserts)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/master/kitab')
  return { success: true, count: inserts.length, failed: failCount }
}