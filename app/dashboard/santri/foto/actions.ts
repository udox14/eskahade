'use server'

import { query } from '@/lib/db'
import { uploadToR2, deleteFromR2 } from '@/lib/r2/upload'
import { revalidatePath } from 'next/cache'

export async function getSantriForFoto(search: string, asrama: string, kamar: string) {
  let sql = `SELECT id, nama_lengkap, nis, asrama, kamar, foto_url
    FROM santri WHERE status_global = 'aktif'`
  const params: any[] = []

  if (search) { sql += ' AND nama_lengkap LIKE ?'; params.push(`%${search}%`) }
  if (asrama && asrama !== 'SEMUA') { sql += ' AND asrama = ?'; params.push(asrama) }
  if (kamar && kamar !== 'SEMUA') { sql += ' AND kamar = ?'; params.push(kamar) }

  sql += ' ORDER BY nama_lengkap LIMIT 100'

  const data = await query<any>(sql, params)

  data.sort((a: any, b: any) => {
    if (!a.foto_url && b.foto_url) return -1
    if (a.foto_url && !b.foto_url) return 1
    return 0
  })

  return data
}

export async function uploadFotoSantri(formData: FormData) {
  const file = formData.get('file') as File
  const santriId = formData.get('santriId') as string

  if (!file || !santriId) return { error: 'File atau ID tidak valid' }

  // Cek foto lama untuk dihapus
  const existing = await query<{ foto_url: string | null }>(
    'SELECT foto_url FROM santri WHERE id = ?', [santriId]
  )
  const fotoLama = existing[0]?.foto_url

  // Upload ke R2
  const result = await uploadToR2(file, santriId)

  if ('error' in result) return { error: 'Gagal upload foto: ' + result.error }

  // Hapus foto lama dari R2 jika ada
  if (fotoLama) await deleteFromR2(fotoLama)

  // Update URL di database
  await query(
    'UPDATE santri SET foto_url = ?, updated_at = ? WHERE id = ?',
    [result.url, new Date().toISOString(), santriId]
  )

  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/santri/foto')
  return { success: true, url: result.url }
}