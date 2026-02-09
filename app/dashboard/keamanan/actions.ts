'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Daftar Pelanggaran (Terbaru)
export async function getDaftarPelanggaran() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pelanggaran')
    .select(`
      id,
      tanggal,
      jenis,
      deskripsi,
      poin,
      santri (
        nama_lengkap,
        nis,
        status_global
      )
    `)
    .order('tanggal', { ascending: false })
    .limit(50)

  if (error) console.error(error)
  return data || []
}

// 2. Cari Santri
export async function cariSantri(keyword: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, status_global, asrama, kamar')
    .or(`nama_lengkap.ilike.%${keyword}%,nis.eq.${keyword}`)
    .eq('status_global', 'aktif')
    .limit(5)

  return data || []
}

// 3. Ambil Master Pelanggaran (DINAMIS)
export async function getMasterPelanggaran() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('master_pelanggaran')
    .select('*')
    .order('kategori', { ascending: false }) // Berat di atas
    .order('nama_pelanggaran')

  return data || []
}

// 4. Simpan Pelanggaran
export async function simpanPelanggaran(formData: FormData) {
  const supabase = await createClient()
  
  const santriId = formData.get('santri_id') as string
  const masterId = formData.get('master_id') as string
  const deskripsiTambahan = formData.get('deskripsi') as string
  const tanggal = formData.get('tanggal') as string

  // Validasi: Ambil detail dari Master untuk memastikan Poin & Jenis benar
  const { data: masterData } = await supabase
    .from('master_pelanggaran')
    .select('*')
    .eq('id', masterId)
    .single()

  if (!masterData) return { error: "Jenis pelanggaran tidak valid atau sudah dihapus dari Master." }

  // Gabungkan deskripsi
  const deskripsiFinal = `${masterData.nama_pelanggaran}. ${deskripsiTambahan}`

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('pelanggaran').insert({
    santri_id: santriId,
    jenis: masterData.kategori, // Ambil kategori asli dari master
    deskripsi: deskripsiFinal,
    tanggal: tanggal,
    poin: masterData.poin,      // Ambil poin asli dari master
    penindak_id: user?.id
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/keamanan')
  return { success: true }
}

export async function hapusPelanggaran(id: string) {
  const supabase = await createClient()
  await supabase.from('pelanggaran').delete().eq('id', id)
  revalidatePath('/dashboard/keamanan')
}