'use server'

import { execute, query, queryOne, now } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList, getCachedTahunAjaranAktif } from '@/lib/cache/master'

export { getCachedMarhalahList as getMarhalahList }

const KATALOG_PATH = '/dashboard/akademik/upk/katalog'

type KatalogRow = {
  id: number
  kitab_id: number | null
  nama_kitab: string
  marhalah_id: number
  toko_id: number | null
  stok_lama: number
  stok_baru: number
  harga_beli: number
  harga_jual: number
  is_active: number
  catatan: string | null
  stok_updated_at: string | null
  updated_at: string | null
  created_at: string
  marhalah_nama: string | null
  marhalah_urutan: number | null
  toko_nama: string | null
  master_nama_kitab: string | null
}

type TokoRow = {
  id: number
  nama: string
  is_active: number
  created_at: string
  updated_at: string | null
}

type MasterKitabOption = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  marhalah_urutan: number | null
}

type KatalogStockSnapshot = {
  stok_lama: number
  stok_baru: number
  stok_updated_at: string | null
}

function toInt(value: FormDataEntryValue | null) {
  const parsed = parseInt(String(value ?? '').replace(/\./g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableInt(value: FormDataEntryValue | null) {
  const parsed = parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function getKatalogUPK(search = '', filterMarhalah = '', filterStatus = 'SEMUA') {
  let sql = `
    SELECT uk.id, uk.kitab_id, uk.nama_kitab, uk.marhalah_id, uk.toko_id,
           uk.stok_lama, uk.stok_baru, uk.harga_beli, uk.harga_jual,
           uk.is_active, uk.catatan, uk.stok_updated_at, uk.updated_at, uk.created_at,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           t.nama AS toko_nama,
           k.nama_kitab AS master_nama_kitab
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN kitab k ON k.id = uk.kitab_id
  `
  const conditions: string[] = []
  const params: unknown[] = []

  if (search.trim()) {
    conditions.push('(uk.nama_kitab LIKE ? OR t.nama LIKE ? OR uk.catatan LIKE ?)')
    const like = `%${search.trim()}%`
    params.push(like, like, like)
  }
  if (filterMarhalah) {
    conditions.push('uk.marhalah_id = ?')
    params.push(filterMarhalah)
  }
  if (filterStatus === 'AKTIF') conditions.push('uk.is_active = 1')
  if (filterStatus === 'NONAKTIF') conditions.push('uk.is_active = 0')

  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`
  sql += ' ORDER BY uk.is_active DESC, m.urutan, uk.nama_kitab'

  const rows = await query<KatalogRow>(sql, params)
  return rows.map((row) => {
    const jumlahStok = (row.stok_lama || 0) + (row.stok_baru || 0)
    const modal = jumlahStok * (row.harga_beli || 0)
    const labaKotor = jumlahStok * (row.harga_jual || 0)
    return {
      ...row,
      is_active: !!row.is_active,
      jumlah_stok: jumlahStok,
      modal,
      laba_kotor: labaKotor,
      laba_bersih: labaKotor - modal,
    }
  })
}

export async function getTokoList(includeInactive = false) {
  const rows = await query<TokoRow>(
    `SELECT id, nama, is_active, created_at, updated_at
     FROM upk_toko
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY is_active DESC, nama`,
    []
  )
  return rows.map((row) => ({ ...row, is_active: !!row.is_active }))
}

export async function getMasterKitabOptions() {
  const aktif = await getCachedTahunAjaranAktif()
  const params: unknown[] = []
  let where = ''
  if (aktif?.id) {
    where = 'WHERE k.tahun_ajaran_id = ?'
    params.push(aktif.id)
  }

  return query<MasterKitabOption>(`
    SELECT k.id, k.nama_kitab, k.marhalah_id,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan
    FROM kitab k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    ${where}
    ORDER BY m.urutan, k.nama_kitab
  `, params)
}

export async function simpanKatalogUPK(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const id = toNullableInt(formData.get('id'))
  const kitabId = toNullableInt(formData.get('kitab_id'))
  const namaKitab = String(formData.get('nama_kitab') ?? '').trim()
  const marhalahId = toNullableInt(formData.get('marhalah_id'))
  const tokoId = toNullableInt(formData.get('toko_id'))
  const stokLama = toInt(formData.get('stok_lama'))
  const stokBaru = toInt(formData.get('stok_baru'))
  const hargaBeli = toInt(formData.get('harga_beli'))
  const hargaJual = toInt(formData.get('harga_jual'))
  const isActive = formData.get('is_active') === 'on' ? 1 : 0
  const catatan = String(formData.get('catatan') ?? '').trim()

  if (!namaKitab) return { error: 'Nama kitab wajib diisi.' }
  if (!marhalahId) return { error: 'Marhalah wajib dipilih.' }
  if (stokLama < 0 || stokBaru < 0) return { error: 'Stok tidak boleh minus.' }
  if (hargaBeli < 0 || hargaJual < 0) return { error: 'Harga tidak boleh minus.' }

  const duplicate = kitabId
    ? await queryOne<{ id: number }>(
        'SELECT id FROM upk_katalog WHERE kitab_id = ? AND (? IS NULL OR id <> ?) LIMIT 1',
        [kitabId, id, id]
      )
    : null
  if (duplicate) return { error: 'Kitab dari master tersebut sudah ada di Katalog UPK.' }

  const timestamp = now()
  if (id) {
    const currentStock = await queryOne<KatalogStockSnapshot>(
      'SELECT stok_lama, stok_baru, stok_updated_at FROM upk_katalog WHERE id = ?',
      [id]
    )
    const stockChanged = !currentStock || currentStock.stok_lama !== stokLama || currentStock.stok_baru !== stokBaru
    const stockUpdatedAt = stockChanged ? timestamp : currentStock.stok_updated_at

    await execute(`
      UPDATE upk_katalog
      SET kitab_id = ?, nama_kitab = ?, marhalah_id = ?, toko_id = ?,
          stok_lama = ?, stok_baru = ?, harga_beli = ?, harga_jual = ?,
          is_active = ?, catatan = ?, stok_updated_at = ?, updated_at = ?
      WHERE id = ?
    `, [kitabId, namaKitab, marhalahId, tokoId, stokLama, stokBaru, hargaBeli, hargaJual,
        isActive, catatan || null, stockUpdatedAt, timestamp, id])
  } else {
    await execute(`
      INSERT INTO upk_katalog
        (kitab_id, nama_kitab, marhalah_id, toko_id, stok_lama, stok_baru,
         harga_beli, harga_jual, is_active, catatan, stok_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [kitabId, namaKitab, marhalahId, tokoId, stokLama, stokBaru, hargaBeli, hargaJual,
        isActive, catatan || null, timestamp, timestamp, timestamp])
  }

  revalidatePath(KATALOG_PATH)
  return { success: true }
}

export async function hapusKatalogUPK(id: number): Promise<{ success: boolean } | { error: string }> {
  await execute('DELETE FROM upk_katalog WHERE id = ?', [id])
  revalidatePath(KATALOG_PATH)
  return { success: true }
}

export async function simpanTokoUPK(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const id = toNullableInt(formData.get('id'))
  const nama = String(formData.get('nama') ?? '').trim()
  const isActive = formData.get('is_active') === 'on' ? 1 : 0
  if (!nama) return { error: 'Nama toko wajib diisi.' }

  const duplicate = await queryOne<{ id: number }>(
    'SELECT id FROM upk_toko WHERE lower(nama) = lower(?) AND (? IS NULL OR id <> ?) LIMIT 1',
    [nama, id, id]
  )
  if (duplicate) return { error: 'Nama toko sudah ada.' }

  if (id) {
    await execute('UPDATE upk_toko SET nama = ?, is_active = ?, updated_at = ? WHERE id = ?', [nama, isActive, now(), id])
  } else {
    await execute('INSERT INTO upk_toko (nama, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)', [nama, isActive, now(), now()])
  }

  revalidatePath(KATALOG_PATH)
  return { success: true }
}

export async function hapusTokoUPK(id: number): Promise<{ success: boolean } | { error: string }> {
  const used = await queryOne<{ id: number }>('SELECT id FROM upk_katalog WHERE toko_id = ? LIMIT 1', [id])
  if (used) return { error: 'Toko sudah dipakai di katalog. Nonaktifkan saja jika tidak digunakan lagi.' }

  await execute('DELETE FROM upk_toko WHERE id = ?', [id])
  revalidatePath(KATALOG_PATH)
  return { success: true }
}
