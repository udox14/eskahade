'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Santri untuk List (Dengan Filter)
export async function getSantriForFoto(search: string, asrama: string, kamar: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar, foto_url')
    .eq('status_global', 'aktif')
    .order('nama_lengkap')
    
  // Filter Search
  if (search) {
    query = query.ilike('nama_lengkap', `%${search}%`)
  }

  // Filter Asrama
  if (asrama && asrama !== 'SEMUA') {
    query = query.eq('asrama', asrama)
  }

  // Filter Kamar
  if (kamar && kamar !== 'SEMUA') {
    query = query.eq('kamar', kamar)
  }

  // Limit hasil agar tidak berat (misal 50 per load jika tanpa filter spesifik)
  // Tapi kalau sudah filter kamar, biasanya sedikit, jadi aman.
  query = query.limit(100)

  const { data } = await query
  
  // Sort manual: Yang belum ada foto taruh paling atas
  if (data) {
    data.sort((a, b) => {
        if (!a.foto_url && b.foto_url) return -1
        if (a.foto_url && !b.foto_url) return 1
        return 0
    })
  }

  return data || []
}

// 2. Upload Foto ke Storage & Update DB
export async function uploadFotoSantri(formData: FormData) {
  const supabase = await createClient()
  
  const file = formData.get('file') as File
  const santriId = formData.get('santriId') as string
  
  if (!file || !santriId) return { error: "File atau ID tidak valid" }

  // A. Upload ke Storage
  const fileName = `${santriId}_${Date.now()}.jpg`
  const { error: uploadError } = await supabase
    .storage
    .from('foto-santri')
    .upload(fileName, file, {
        upsert: true,
        contentType: 'image/jpeg'
    })

  if (uploadError) return { error: "Gagal upload storage: " + uploadError.message }

  // B. Dapatkan Public URL
  const { data: urlData } = supabase
    .storage
    .from('foto-santri')
    .getPublicUrl(fileName)

  const publicUrl = urlData.publicUrl

  // C. Simpan URL ke Tabel Santri
  const { error: dbError } = await supabase
    .from('santri')
    .update({ foto_url: publicUrl })
    .eq('id', santriId)

  if (dbError) return { error: "Gagal update database: " + dbError.message }

  revalidatePath('/dashboard/santri') 
  revalidatePath('/dashboard/santri/foto')
  return { success: true, url: publicUrl }
}