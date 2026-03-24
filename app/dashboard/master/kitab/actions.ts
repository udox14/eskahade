'use server'

import { query, queryOne, batch } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList, getCachedMapelAll, getCachedTahunAjaranAktif, getCachedTahunAjaranList } from '@/lib/cache/master'

// Pakai cache untuk data yang jarang berubah
export { getCachedMarhalahList as getMarhalahList }
export { getCachedMapelAll as getMapelList }
export { getCachedTahunAjaranAktif as getTahunAjaranAktif }
export { getCachedTahunAjaranList as getTahunAjaranList }

export async function getKitabList(marhalahId?: string, tahunAjaranId?: number) {
  let tahunId = tahunAjaranId
  if (!tahunId) {
    const aktif = await getCachedTahunAjaranAktif()
    tahunId = aktif?.id
  }

  let sql = `
    SELECT k.id, k.nama_kitab, k.harga, k.tahun_ajaran_id,
           m.nama as marhalah_nama, mp.nama as mapel_nama,
           ta.nama as tahun_ajaran_nama
    FROM kitab k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN mapel mp ON k.mapel_id = mp.id
    LEFT JOIN tahun_ajaran ta ON k.tahun_ajaran_id = ta.id
  `
  const conditions: string[] = []
  const params: any[] = []

  if (tahunId) { conditions.push('k.tahun_ajaran_id = ?'); params.push(tahunId) }
  if (marhalahId) { conditions.push('k.marhalah_id = ?'); params.push(marhalahId) }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY m.urutan, mp.nama, k.nama_kitab'

  return await query<any>(sql, params)
}

export async function tambahKitab(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const nama = formData.get('nama_kitab') as string
  const marhalah = formData.get('marhalah_id') as string
  const mapel = formData.get('mapel_id') as string
  const harga = parseInt(formData.get('harga') as string) || 0

  const aktif = await getCachedTahunAjaranAktif()
  if (!aktif) return { error: 'Tidak ada tahun ajaran aktif. Aktifkan tahun ajaran terlebih dahulu.' }

  await query(
    'INSERT INTO kitab (nama_kitab, marhalah_id, mapel_id, harga, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?)',
    [nama, marhalah, mapel, harga, aktif.id]
  )

  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function hapusKitab(id: string): Promise<{ success: boolean } | { error: string }> {
  const used = await queryOne<any>('SELECT id FROM upk_item WHERE kitab_id = ? LIMIT 1', [id])
  if (used) return { error: 'Kitab ini sudah pernah digunakan di transaksi UPK dan tidak bisa dihapus.' }

  await query('DELETE FROM kitab WHERE id = ?', [id])
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function updateHargaKitab(id: string, hargaBaru: number): Promise<{ success: boolean } | { error: string }> {
  await query('UPDATE kitab SET harga = ? WHERE id = ?', [hargaBaru, id])
  revalidatePath('/dashboard/master/kitab')
  return { success: true }
}

export async function importKitabMassal(dataExcel: any[]): Promise<{ success: boolean; count: number; failed: number } | { error: string }> {
  const aktif = await getCachedTahunAjaranAktif()
  if (!aktif) return { error: 'Tidak ada tahun ajaran aktif. Aktifkan tahun ajaran terlebih dahulu.' }

  // Pakai cache untuk marhalah dan mapel
  const [mrh, mpl] = await Promise.all([
    getCachedMarhalahList(),
    getCachedMapelAll(),
  ])

  const mapMarhalah = new Map(mrh.map((m: any) => [m.nama.toLowerCase().trim(), m.id]))
  const mapMapel = new Map(mpl.map((m: any) => [m.nama.toLowerCase().trim(), m.id]))

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
      inserts.push([namaKitab, marhalahId, mapelId, harga, aktif.id])
    } else {
      failCount++
    }
  }

  if (inserts.length === 0) return { error: 'Tidak ada data valid (Cek penulisan Marhalah/Mapel)' }

  await batch(inserts.map(row => ({
    sql: 'INSERT INTO kitab (nama_kitab, marhalah_id, mapel_id, harga, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?)',
    params: row,
  })))

  revalidatePath('/dashboard/master/kitab')
  return { success: true, count: inserts.length, failed: failCount }
}
