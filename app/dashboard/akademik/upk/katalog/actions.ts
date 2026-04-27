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
  stok_updated_at: string | null
}

type ImportRow = Record<string, unknown>

type MarhalahRow = {
  id: number
  nama: string
}

function toInt(value: FormDataEntryValue | null) {
  const parsed = parseInt(String(value ?? '').replace(/\./g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toImportInt(value: unknown) {
  const cleaned = String(value ?? '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .trim()
  const parsed = parseInt(cleaned, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function keyText(value: unknown) {
  return cleanText(value).toLowerCase()
}

function pick(row: ImportRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key]
  }
  return ''
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
  const hargaBeli = toInt(formData.get('harga_beli'))
  const hargaJual = toInt(formData.get('harga_jual'))
  const isActive = formData.get('is_active') === 'on' ? 1 : 0
  const catatan = String(formData.get('catatan') ?? '').trim()

  if (!namaKitab) return { error: 'Nama kitab wajib diisi.' }
  if (!marhalahId) return { error: 'Marhalah wajib dipilih.' }
  if (stokLama < 0) return { error: 'Stok tidak boleh minus.' }
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
      'SELECT stok_lama, stok_updated_at FROM upk_katalog WHERE id = ?',
      [id]
    )
    const stockChanged = !currentStock || currentStock.stok_lama !== stokLama
    const stockUpdatedAt = stockChanged ? timestamp : currentStock.stok_updated_at

    await execute(`
      UPDATE upk_katalog
      SET kitab_id = ?, nama_kitab = ?, marhalah_id = ?, toko_id = ?,
          stok_lama = ?, harga_beli = ?, harga_jual = ?,
          is_active = ?, catatan = ?, stok_updated_at = ?, updated_at = ?
      WHERE id = ?
    `, [kitabId, namaKitab, marhalahId, tokoId, stokLama, hargaBeli, hargaJual,
        isActive, catatan || null, stockUpdatedAt, timestamp, id])
  } else {
    await execute(`
      INSERT INTO upk_katalog
        (kitab_id, nama_kitab, marhalah_id, toko_id, stok_lama, stok_baru,
         harga_beli, harga_jual, is_active, catatan, stok_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [kitabId, namaKitab, marhalahId, tokoId, stokLama, 0, hargaBeli, hargaJual,
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

export async function importKatalogUPK(rows: ImportRow[]): Promise<{ success: boolean; inserted: number; updated: number; failed: number; errors: string[] } | { error: string }> {
  if (!rows.length) return { error: 'File Excel belum berisi data.' }

  const [marhalahRows, tokoRows, masterRows, katalogRows] = await Promise.all([
    query<MarhalahRow>('SELECT id, nama FROM marhalah', []),
    query<TokoRow>('SELECT id, nama, is_active, created_at, updated_at FROM upk_toko', []),
    getMasterKitabOptions(),
    query<{ id: number; kitab_id: number | null; nama_kitab: string; marhalah_id: number }>(
      'SELECT id, kitab_id, nama_kitab, marhalah_id FROM upk_katalog',
      []
    ),
  ])

  const marhalahByName = new Map(marhalahRows.map(m => [keyText(m.nama), m]))
  const tokoByName = new Map(tokoRows.map(t => [keyText(t.nama), t]))
  const masterByNameAndMarhalah = new Map(masterRows.map(k => [`${keyText(k.nama_kitab)}|||${k.marhalah_id}`, k]))
  const katalogByKitabId = new Map(katalogRows.filter(k => k.kitab_id).map(k => [k.kitab_id, k]))
  const katalogByNameAndMarhalah = new Map(katalogRows.map(k => [`${keyText(k.nama_kitab)}|||${k.marhalah_id}`, k]))

  let inserted = 0
  let updated = 0
  let failed = 0
  const errors: string[] = []
  const timestamp = now()

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const rowNumber = index + 2
    const namaKitab = cleanText(pick(row, ['NAMA KITAB', 'Nama Kitab', 'nama kitab', 'KITAB', 'Kitab']))
    const marhalahNama = cleanText(pick(row, ['MARHALAH', 'Marhalah', 'marhalah']))
    const tokoNama = cleanText(pick(row, ['TOKO', 'Toko', 'toko']))
    const stokLama = toImportInt(pick(row, ['STOK LAMA', 'Stok Lama', 'stok lama']))
    const hargaBeli = toImportInt(pick(row, ['HARGA BELI', 'Harga Beli', 'harga beli']))
    const hargaJual = toImportInt(pick(row, ['HARGA JUAL', 'Harga Jual', 'harga jual']))
    const catatan = cleanText(pick(row, ['CATATAN', 'Catatan', 'catatan']))

    if (!namaKitab || !marhalahNama) {
      failed++
      errors.push(`Baris ${rowNumber}: nama kitab dan marhalah wajib diisi.`)
      continue
    }

    const marhalah = marhalahByName.get(keyText(marhalahNama))
    if (!marhalah) {
      failed++
      errors.push(`Baris ${rowNumber}: marhalah "${marhalahNama}" tidak ditemukan.`)
      continue
    }

    let tokoId: number | null = null
    if (tokoNama) {
      let toko = tokoByName.get(keyText(tokoNama))
      if (!toko) {
        await execute('INSERT INTO upk_toko (nama, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)', [tokoNama, timestamp, timestamp])
        toko = await queryOne<TokoRow>('SELECT id, nama, is_active, created_at, updated_at FROM upk_toko WHERE lower(nama) = lower(?) LIMIT 1', [tokoNama]) ?? undefined
        if (toko) tokoByName.set(keyText(toko.nama), toko)
      }
      tokoId = toko?.id ?? null
    }

    const master = masterByNameAndMarhalah.get(`${keyText(namaKitab)}|||${marhalah.id}`)
    const existing = master?.id
      ? katalogByKitabId.get(master.id) ?? katalogByNameAndMarhalah.get(`${keyText(namaKitab)}|||${marhalah.id}`)
      : katalogByNameAndMarhalah.get(`${keyText(namaKitab)}|||${marhalah.id}`)

    if (existing) {
      const currentStock = await queryOne<KatalogStockSnapshot>(
        'SELECT stok_lama, stok_updated_at FROM upk_katalog WHERE id = ?',
        [existing.id]
      )
      const stockChanged = !currentStock || currentStock.stok_lama !== stokLama
      const stockUpdatedAt = stockChanged ? timestamp : currentStock.stok_updated_at

      await execute(`
        UPDATE upk_katalog
        SET kitab_id = ?, nama_kitab = ?, marhalah_id = ?, toko_id = ?,
            stok_lama = ?, harga_beli = ?, harga_jual = ?,
            is_active = 1, catatan = ?, stok_updated_at = ?, updated_at = ?
        WHERE id = ?
      `, [master?.id ?? existing.kitab_id ?? null, namaKitab, marhalah.id, tokoId,
          stokLama, hargaBeli, hargaJual, catatan || null, stockUpdatedAt, timestamp, existing.id])
      updated++
    } else {
      await execute(`
        INSERT INTO upk_katalog
          (kitab_id, nama_kitab, marhalah_id, toko_id, stok_lama, stok_baru,
           harga_beli, harga_jual, is_active, catatan, stok_updated_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `, [master?.id ?? null, namaKitab, marhalah.id, tokoId, stokLama, 0,
          hargaBeli, hargaJual, catatan || null, timestamp, timestamp, timestamp])

      const insertedRow = await queryOne<{ id: number; kitab_id: number | null; nama_kitab: string; marhalah_id: number }>(
        'SELECT id, kitab_id, nama_kitab, marhalah_id FROM upk_katalog WHERE lower(nama_kitab) = lower(?) AND marhalah_id = ? ORDER BY id DESC LIMIT 1',
        [namaKitab, marhalah.id]
      )
      if (insertedRow) {
        if (insertedRow.kitab_id) katalogByKitabId.set(insertedRow.kitab_id, insertedRow)
        katalogByNameAndMarhalah.set(`${keyText(insertedRow.nama_kitab)}|||${insertedRow.marhalah_id}`, insertedRow)
      }
      inserted++
    }
  }

  if (inserted === 0 && updated === 0) {
    return { error: errors[0] || 'Tidak ada baris valid untuk diimport.' }
  }

  revalidatePath(KATALOG_PATH)
  return { success: true, inserted, updated, failed, errors: errors.slice(0, 8) }
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
