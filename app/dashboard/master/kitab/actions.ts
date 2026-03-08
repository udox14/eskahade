'use server'

import { query, queryOne } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getMarhalahList() {
  return await query('SELECT * FROM marhalah ORDER BY urutan')
}

export async function getMapelList() {
  return await query('SELECT * FROM mapel ORDER BY nama')
}

export async function getKitabList(marhalahId?: string) {
  if (marhalahId) {
    return await query<any>(`
      SELECT k.id, k.nama_kitab, k.harga, m.nama as marhalah_nama, mp.nama as mapel_nama
      FROM kitab k
      LEFT JOIN marhalah m ON k.marhalah_id = m.id
      LEFT JOIN mapel mp ON k.mapel_id = mp.id
      WHERE k.marhalah_id = ?
      ORDER BY k.nama_kitab
    `, [marhalahId])
  }
  return await query<any>(`
    SELECT k.id, k.nama_kitab, k.harga, m.nama as marhalah_nama, mp.nama as mapel_nama
    FROM kitab k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN mapel mp ON k.mapel_id = mp.id
    ORDER BY k.nama_kitab
  `)
}

export async function tambahKitab(formData: FormData) {
  const nama = formData.get('nama_kitab') as string
  const marhalah = formData.get('marhalah_id') as string
  const mapel = formData.get('mapel_id') as string
  const harga = parseInt(formData.get('harga') as string) || 0

  await query(
    'INSERT INTO kitab (id, nama_kitab, marhalah_id, mapel_id, harga) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), nama, marhalah, mapel, harga]
  )

  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function hapusKitab(id: string) {
  await query('DELETE FROM kitab WHERE id = ?', [id])
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function updateHargaKitab(id: string, hargaBaru: number) {
  await query('UPDATE kitab SET harga = ? WHERE id = ?', [hargaBaru, id])
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function importKitabMassal(dataExcel: any[]) {
  const mrh = await query<{ id: string; nama: string }>('SELECT id, nama FROM marhalah')
  const mpl = await query<{ id: string; nama: string }>('SELECT id, nama FROM mapel')

  const mapMarhalah = new Map(mrh.map(m => [m.nama.toLowerCase().trim(), m.id]))
  const mapMapel = new Map(mpl.map(m => [m.nama.toLowerCase().trim(), m.id]))

  const inserts: any[] = []
  let failCount = 0

  for (const row of dataExcel) {
    const namaKitab = row['NAMA KITAB'] || row['nama kitab']
    const namaMarhalah = row['MARHALAH'] || row['marhalah']
    const namaMapel = row['MAPEL'] || row['mapel']
    const harga = parseInt(row['HARGA'] || row['harga']) || 0

    if (!namaKitab || !namaMarhalah || !namaMapel) { failCount++; continue }

    const marhalahId = mapMarhalah.get(String(namaMarhalah).toLowerCase().trim())
    const mapelId = mapMapel.get(String(namaMapel).toLowerCase().trim())

    if (marhalahId && mapelId) {
      inserts.push([crypto.randomUUID(), namaKitab, marhalahId, mapelId, harga])
    } else {
      failCount++
    }
  }

  if (inserts.length === 0) return { error: 'Tidak ada data valid (Cek penulisan Marhalah/Mapel)' }

  for (const row of inserts) {
    await query(
      'INSERT INTO kitab (id, nama_kitab, marhalah_id, mapel_id, harga) VALUES (?, ?, ?, ?, ?)',
      row
    )
  }

  revalidatePath('/dashboard/master/kitab')
  return { success: true, count: inserts.length, failed: failCount }
}