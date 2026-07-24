'use server'

import { query, execute } from '@/lib/db'
import { toInt } from '@/lib/upk-utils'
import { getDaftarKitabPerMarhalah } from '@/app/dashboard/akademik/upk/katalog/actions'

export type UnitUPK = 'PUTRA' | 'PUTRI'

export type RekapTerjualItem = {
  katalog_id: number | null
  nama_kitab: string
  toko_nama: string | null
  marhalah_nama: string | null
  qty_terjual: number
  harga_beli: number
  harga_jual: number
  modal: number       // qty_terjual * harga_beli
  laba_kotor: number  // qty_terjual * harga_jual (sesuai contoh gambar acuan)
}

export type RekapTidakTerjualItem = {
  katalog_id: number | null
  nama_kitab: string
  toko_nama: string | null
  marhalah_nama: string | null
  stok_lama: number
  stok_baru: number
  stok_total: number
  harga_beli: number
  harga_jual: number
  nilai_asset_modal: number // stok_total * harga_beli
  nilai_asset_jual: number  // stok_total * harga_jual
}

export async function ensureFiturAksesCetakUPK() {
  try {
    await execute(`
      INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
      VALUES ('UPK', 'Cetak', '/dashboard/akademik/upk/cetak', 'Printer', '["admin","sekpen","panitia_upk"]', 1, 8)
    `)
  } catch (err) {
    console.error('[Cetak UPK] Gagal registrasi fitur_akses:', err)
  }
}

export async function getRekapKitabTerjualData(filters?: {
  unit?: '' | UnitUPK
  tanggalDari?: string
  tanggalSampai?: string
  tipeStok: 'BARU' | 'LAMA'
}): Promise<RekapTerjualItem[]> {
  await ensureFiturAksesCetakUPK()

  const params: unknown[] = []
  const conditions: string[] = ["a.status = 'SELESAI'", "COALESCE(a.jenis_transaksi, 'PENJUALAN') = 'PENJUALAN'"]

  if (filters?.unit) {
    conditions.push('a.unit = ?')
    params.push(filters.unit)
  }
  if (filters?.tanggalDari) {
    conditions.push('a.tanggal >= ?')
    params.push(filters.tanggalDari)
  }
  if (filters?.tanggalSampai) {
    conditions.push('a.tanggal <= ?')
    params.push(filters.tanggalSampai)
  }

  const isStokBaru = filters?.tipeStok === 'BARU'
  const qtyColumn = isStokBaru ? 'sm.qty_baru' : 'sm.qty_lama'

  // Query agregasi berdasarkan LOWER(TRIM(nama_kitab)) agar tidak ada baris ganda
  const rows = await query<{
    katalog_id: number | null
    nama_kitab: string
    toko_nama: string | null
    marhalah_nama: string | null
    harga_beli: number
    harga_jual: number
    qty_terjual: number
  }>(`
    SELECT
      MAX(uk.id) AS katalog_id,
      MIN(COALESCE(uk.nama_kitab, ai.nama_kitab)) AS nama_kitab,
      MIN(t.nama) AS toko_nama,
      GROUP_CONCAT(DISTINCT m.nama) AS marhalah_nama,
      CAST(ROUND(AVG(COALESCE(uk.harga_beli, ai.harga_modal, 0))) AS INTEGER) AS harga_beli,
      CAST(ROUND(AVG(COALESCE(uk.harga_jual, ai.harga_jual, 0))) AS INTEGER) AS harga_jual,
      SUM(sm.${qtyColumn}) AS qty_terjual
    FROM upk_stok_mutasi sm
    JOIN upk_antrian a ON a.id = sm.antrian_id
    LEFT JOIN upk_antrian_item ai ON ai.id = sm.antrian_item_id
    LEFT JOIN upk_katalog uk ON uk.id = sm.katalog_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id
    LEFT JOIN marhalah m ON m.id = km.marhalah_id
    WHERE ${conditions.join(' AND ')} AND sm.${qtyColumn} > 0
    GROUP BY LOWER(TRIM(COALESCE(uk.nama_kitab, ai.nama_kitab)))
    ORDER BY MIN(COALESCE(uk.nama_kitab, ai.nama_kitab)) ASC
  `, params)

  return rows.map(r => {
    const qty = toInt(r.qty_terjual)
    const hBeli = toInt(r.harga_beli)
    const hJual = toInt(r.harga_jual)
    return {
      katalog_id: r.katalog_id,
      nama_kitab: r.nama_kitab,
      toko_nama: r.toko_nama,
      marhalah_nama: r.marhalah_nama,
      qty_terjual: qty,
      harga_beli: hBeli,
      harga_jual: hJual,
      modal: qty * hBeli,
      laba_kotor: qty * hJual, // Sesuai acuan format user: LABA KOTOR = QTY * HARGA JUAL
    }
  })
}

export async function getRekapKitabTidakTerjualData(filters?: {
  filterStok?: 'SEMUA' | 'STOK_BARU' | 'STOK_LAMA'
  marhalahId?: number
}): Promise<RekapTidakTerjualItem[]> {
  await ensureFiturAksesCetakUPK()

  const params: unknown[] = []
  const conditions: string[] = ['uk.is_active = 1']

  if (filters?.filterStok === 'STOK_BARU') {
    conditions.push('uk.stok_baru > 0')
  } else if (filters?.filterStok === 'STOK_LAMA') {
    conditions.push('uk.stok_lama > 0')
  } else {
    conditions.push('(uk.stok_lama > 0 OR uk.stok_baru > 0)')
  }

  if (filters?.marhalahId) {
    conditions.push('km.marhalah_id = ?')
    params.push(filters.marhalahId)
  }

  // Agregasi per LOWER(TRIM(nama_kitab)) untuk mencegah duplikasi akibat relasi marhalah ganda
  const rows = await query<{
    katalog_id: number
    nama_kitab: string
    toko_nama: string | null
    marhalah_nama: string | null
    stok_lama: number
    stok_baru: number
    harga_beli: number
    harga_jual: number
  }>(`
    SELECT
      MAX(uk.id) AS katalog_id,
      MIN(uk.nama_kitab) AS nama_kitab,
      MIN(t.nama) AS toko_nama,
      GROUP_CONCAT(DISTINCT m.nama) AS marhalah_nama,
      SUM(uk.stok_lama) AS stok_lama,
      SUM(uk.stok_baru) AS stok_baru,
      CAST(ROUND(AVG(uk.harga_beli)) AS INTEGER) AS harga_beli,
      CAST(ROUND(AVG(uk.harga_jual)) AS INTEGER) AS harga_jual
    FROM upk_katalog uk
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id
    LEFT JOIN marhalah m ON m.id = km.marhalah_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY LOWER(TRIM(uk.nama_kitab))
    HAVING (SUM(uk.stok_lama) + SUM(uk.stok_baru)) > 0
    ORDER BY MIN(uk.nama_kitab) ASC
  `, params)

  return rows.map(r => {
    const sLama = toInt(r.stok_lama)
    const sBaru = toInt(r.stok_baru)
    const sTotal = sLama + sBaru
    const hBeli = toInt(r.harga_beli)
    const hJual = toInt(r.harga_jual)
    return {
      katalog_id: r.katalog_id,
      nama_kitab: r.nama_kitab,
      toko_nama: r.toko_nama,
      marhalah_nama: r.marhalah_nama,
      stok_lama: sLama,
      stok_baru: sBaru,
      stok_total: sTotal,
      harga_beli: hBeli,
      harga_jual: hJual,
      nilai_asset_modal: sTotal * hBeli,
      nilai_asset_jual: sTotal * hJual,
    }
  })
}

export { getDaftarKitabPerMarhalah }
