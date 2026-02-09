'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ... (Fungsi simpanSantriKeKelas yang lama biarkan saja) ...
export async function simpanSantriKeKelas(kelasId: string, santriIds: string[]) {
  const supabase = await createClient()

  if (!kelasId || santriIds.length === 0) {
    return { error: "Pilih kelas dan minimal satu santri." }
  }

  const dataInsert = santriIds.map(id => ({
    santri_id: id,
    kelas_id: kelasId,
    status_riwayat: 'aktif'
  }))

  const { error } = await supabase
    .from('riwayat_pendidikan')
    .insert(dataInsert)

  if (error) {
    console.error("Gagal atur kelas:", error)
    return { error: "Gagal menyimpan data." }
  }

  revalidatePath('/dashboard/santri/atur-kelas')
  return { success: true }
}

// --- TAMBAHAN BARU UNTUK EXCEL ---
export async function simpanPenempatanBatch(dataPenempatan: { santri_id: string, kelas_id: string }[]) {
  const supabase = await createClient()

  if (!dataPenempatan || dataPenempatan.length === 0) {
    return { error: "Data kosong." }
  }

  // Tambahkan status default
  const dataInsert = dataPenempatan.map(item => ({
    santri_id: item.santri_id,
    kelas_id: item.kelas_id,
    status_riwayat: 'aktif'
  }))

  const { error } = await supabase
    .from('riwayat_pendidikan')
    .insert(dataInsert)

  if (error) {
    console.error("Gagal Batch Import:", error)
    return { error: "Gagal menyimpan data batch. Pastikan santri belum punya kelas." }
  }

  revalidatePath('/dashboard/santri/atur-kelas')
  return { success: true, count: dataInsert.length }
}