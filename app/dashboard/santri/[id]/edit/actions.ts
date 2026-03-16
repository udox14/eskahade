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
      jenis_kelamin = ?, nama_ayah = ?, nama_ibu = ?, alamat = ?,
      gol_darah = ?, alamat_lengkap = ?, kecamatan = ?, kab_kota = ?, provinsi = ?,
      jemaah = ?, no_wa_ortu = ?, tanggal_masuk = ?, tanggal_keluar = ?,
      sekolah = ?, kelas_sekolah = ?, asrama = ?, kamar = ?, updated_at = ?
    WHERE id = ?`,
    [
      formData.get('nis'), formData.get('nama_lengkap'), formData.get('nik') || null,
      formData.get('tempat_lahir') || null, formData.get('tanggal_lahir') || null,
      formData.get('jenis_kelamin'),
      formData.get('nama_ayah') || null, formData.get('nama_ibu') || null,
      formData.get('alamat') || null,
      formData.get('gol_darah') || null,
      formData.get('alamat_lengkap') || null,
      formData.get('kecamatan') || null,
      formData.get('kab_kota') || null,
      formData.get('provinsi') || null,
      formData.get('jemaah') || null,
      formData.get('no_wa_ortu') || null,
      formData.get('tanggal_masuk') || null,
      formData.get('tanggal_keluar') || null,
      formData.get('sekolah') || null, formData.get('kelas_sekolah') || null,
      formData.get('asrama') || null, formData.get('kamar') || null,
      now, id
    ]
  )

  revalidatePath('/dashboard/santri')
  revalidatePath(`/dashboard/santri/${id}`)
  redirect('/dashboard/santri')
}
