'use server'

import { query, queryOne } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getSantriById(id: string) {
  const data = await queryOne('SELECT * FROM santri WHERE id = ?', [id])
  return { data, error: data ? null : 'Santri tidak ditemukan' }
}

export async function updateSantri(id: string, formData: FormData) {
  const now = new Date().toISOString()

  await query(
    `UPDATE santri SET
      nis = ?, nama_lengkap = ?, nik = ?, tempat_lahir = ?, tanggal_lahir = ?,
      jenis_kelamin = ?, nama_ayah = ?, nama_ibu = ?, alamat = ?, status_global = ?,
      sekolah = ?, kelas_sekolah = ?, asrama = ?, kamar = ?, updated_at = ?
    WHERE id = ?`,
    [
      formData.get('nis'), formData.get('nama_lengkap'), formData.get('nik'),
      formData.get('tempat_lahir'), formData.get('tanggal_lahir'), formData.get('jenis_kelamin'),
      formData.get('nama_ayah'), formData.get('nama_ibu'), formData.get('alamat'),
      formData.get('status_global'), formData.get('sekolah'), formData.get('kelas_sekolah'),
      formData.get('asrama'), formData.get('kamar'), now, id
    ]
  )

  revalidatePath('/dashboard/santri')
  revalidatePath(`/dashboard/santri/${id}`)
  redirect('/dashboard/santri')
}