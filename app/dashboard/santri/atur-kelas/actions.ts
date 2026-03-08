'use server'

import { query } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function simpanSantriKeKelas(kelasId: string, santriIds: string[]) {
  if (!kelasId || santriIds.length === 0) return { error: 'Pilih kelas dan minimal satu santri.' }

  const now = new Date().toISOString()
  try {
    for (const santriId of santriIds) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), santriId, kelasId, 'aktif', now]
      )
    }
  } catch (err: any) {
    return { error: 'Gagal menyimpan data.' }
  }

  revalidatePath('/dashboard/santri/atur-kelas')
  return { success: true }
}

export async function simpanPenempatanBatch(dataPenempatan: { santri_id: string; kelas_id: string }[]) {
  if (!dataPenempatan || dataPenempatan.length === 0) return { error: 'Data kosong.' }

  const now = new Date().toISOString()
  try {
    for (const item of dataPenempatan) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), item.santri_id, item.kelas_id, 'aktif', now]
      )
    }
  } catch (err: any) {
    return { error: 'Gagal menyimpan data batch. Pastikan santri belum punya kelas.' }
  }

  revalidatePath('/dashboard/santri/atur-kelas')
  return { success: true, count: dataPenempatan.length }
}