'use server'

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getDaftarPelanggaran() {
  return query<any>(`
    SELECT p.id, p.tanggal, p.jenis, p.deskripsi, p.poin,
           s.nama_lengkap, s.nis, s.status_global
    FROM pelanggaran p
    JOIN santri s ON s.id = p.santri_id
    ORDER BY p.tanggal DESC
    LIMIT 50
  `, [])
}

export async function cariSantri(keyword: string) {
  return query<any>(`
    SELECT id, nama_lengkap, nis, status_global, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
      AND (nama_lengkap LIKE ? OR nis = ?)
    LIMIT 5
  `, [`%${keyword}%`, keyword])
}

export async function getMasterPelanggaran() {
  return query<any>(`
    SELECT id, nama_pelanggaran, kategori, poin_default
    FROM master_pelanggaran
    ORDER BY kategori DESC, nama_pelanggaran
  `, [])
}

export async function simpanPelanggaran(formData: FormData) {
  const session = await getSession()

  const santriId = formData.get('santri_id') as string
  const masterId = formData.get('master_id') as string
  const deskripsiTambahan = formData.get('deskripsi') as string
  const tanggal = formData.get('tanggal') as string

  const masterData = await queryOne<any>(
    'SELECT id, nama_pelanggaran, kategori, poin FROM master_pelanggaran WHERE id = ?',
    [masterId]
  )
  if (!masterData) return { error: 'Jenis pelanggaran tidak valid atau sudah dihapus dari Master.' }

  const deskripsiFinal = `${masterData.nama_pelanggaran}. ${deskripsiTambahan}`

  await execute(`
    INSERT INTO pelanggaran (id, santri_id, jenis, deskripsi, tanggal, poin, penindak_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [generateId(), santriId, masterData.kategori, deskripsiFinal, tanggal, masterData.poin, session?.id ?? null])

  revalidatePath('/dashboard/keamanan')
  return { success: true }
}

export async function hapusPelanggaran(id: string) {
  await execute('DELETE FROM pelanggaran WHERE id = ?', [id])
  revalidatePath('/dashboard/keamanan')
}