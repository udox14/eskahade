'use server'

import { query } from '@/lib/db'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function tambahJenisPelanggaran(formData: FormData) {
  const kategori = formData.get('kategori') as string
  const nama = formData.get('nama_pelanggaran') as string
  const poin = Number(formData.get('poin'))

  await query(
    'INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin) VALUES (?, ?, ?)',
    [kategori, nama, poin]
  )

  revalidateTag('master-pelanggaran', 'everything') // invalidasi KV cache
  revalidatePath('/dashboard/master/pelanggaran')
  return { success: true }
}

export async function hapusJenisPelanggaran(id: number) {
  try {
    await query('DELETE FROM master_pelanggaran WHERE id = ?', [id])
    revalidateTag('master-pelanggaran', 'everything') // invalidasi KV cache
    revalidatePath('/dashboard/master/pelanggaran')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || "Gagal menghapus data" }
  }
}