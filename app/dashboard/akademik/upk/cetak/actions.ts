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

  // Query SQL standar yang kompatibel penuh dengan SQLite / D1
  const rows = await query<{
    katalog_id: number | null
    nama_kitab: string
    toko_nama: string | null
    harga_beli: number
    harga_jual: number
    qty_terjual: number
  }>(`
    WITH mutasi_terfilter AS (
      SELECT
        sm.katalog_id,
        ai.nama_kitab AS alt_nama_kitab,
        ai.harga_modal,
        ai.harga_jual AS alt_harga_jual,
        SUM(sm.${qtyColumn}) AS total_qty
      FROM upk_stok_mutasi sm
      JOIN upk_antrian a ON a.id = sm.antrian_id
      LEFT JOIN upk_antrian_item ai ON ai.id = sm.antrian_item_id
      WHERE ${conditions.join(' AND ')} AND sm.${qtyColumn} > 0
      GROUP BY sm.katalog_id, ai.nama_kitab
    )
    SELECT
      mf.katalog_id,
      COALESCE(uk.nama_kitab, mf.alt_nama_kitab) AS nama_kitab,
      t.nama AS toko_nama,
      COALESCE(uk.harga_beli, mf.harga_modal, 0) AS harga_beli,
      COALESCE(uk.harga_jual, mf.alt_harga_jual, 0) AS harga_jual,
      mf.total_qty AS qty_terjual
    FROM mutasi_terfilter mf
    LEFT JOIN upk_katalog uk ON uk.id = mf.katalog_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    WHERE mf.total_qty > 0
  `, params)

  // Agregasi di JS berdasarkan nama_kitab agar tidak ada baris ganda dan angka 100% presisi
  const mapByName = new Map<string, RekapTerjualItem>()
  for (const r of rows) {
    const rawName = (r.nama_kitab || 'Tanpa Nama').trim()
    const nameKey = rawName.toLowerCase()
    const qty = toInt(r.qty_terjual)
    const hBeli = toInt(r.harga_beli)
    const hJual = toInt(r.harga_jual)

    const existing = mapByName.get(nameKey)
    if (existing) {
      existing.qty_terjual += qty
      existing.modal += qty * hBeli
      existing.laba_kotor += qty * hJual
    } else {
      mapByName.set(nameKey, {
        katalog_id: r.katalog_id,
        nama_kitab: rawName,
        toko_nama: r.toko_nama ?? null,
        marhalah_nama: null,
        qty_terjual: qty,
        harga_beli: hBeli,
        harga_jual: hJual,
        modal: qty * hBeli,
        laba_kotor: qty * hJual,
      })
    }
  }

  return Array.from(mapByName.values()).sort((a, b) => a.nama_kitab.localeCompare(b.nama_kitab, 'id'))
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

  const rows = await query<{
    katalog_id: number
    nama_kitab: string
    toko_nama: string | null
    stok_lama: number
    stok_baru: number
    harga_beli: number
    harga_jual: number
  }>(`
    SELECT
      uk.id AS katalog_id,
      uk.nama_kitab,
      t.nama AS toko_nama,
      uk.stok_lama,
      uk.stok_baru,
      uk.harga_beli,
      uk.harga_jual
    FROM upk_katalog uk
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id
    WHERE ${conditions.join(' AND ')}
  `, params)

  // Agregasi di JS berdasarkan nama_kitab agar tidak ada baris ganda
  const mapByName = new Map<string, RekapTidakTerjualItem>()
  for (const r of rows) {
    const rawName = (r.nama_kitab || 'Tanpa Nama').trim()
    const nameKey = rawName.toLowerCase()
    const sLama = toInt(r.stok_lama)
    const sBaru = toInt(r.stok_baru)
    const hBeli = toInt(r.harga_beli)
    const hJual = toInt(r.harga_jual)

    const existing = mapByName.get(nameKey)
    if (existing) {
      existing.stok_lama += sLama
      existing.stok_baru += sBaru
      existing.stok_total += (sLama + sBaru)
      existing.nilai_asset_modal += (sLama + sBaru) * hBeli
      existing.nilai_asset_jual += (sLama + sBaru) * hJual
    } else {
      const sTotal = sLama + sBaru
      mapByName.set(nameKey, {
        katalog_id: r.katalog_id,
        nama_kitab: rawName,
        toko_nama: r.toko_nama ?? null,
        marhalah_nama: null,
        stok_lama: sLama,
        stok_baru: sBaru,
        stok_total: sTotal,
        harga_beli: hBeli,
        harga_jual: hJual,
        nilai_asset_modal: sTotal * hBeli,
        nilai_asset_jual: sTotal * hJual,
      })
    }
  }

  return Array.from(mapByName.values())
    .filter(item => item.stok_total > 0)
    .sort((a, b) => a.nama_kitab.localeCompare(b.nama_kitab, 'id'))
}

export { getDaftarKitabPerMarhalah }
