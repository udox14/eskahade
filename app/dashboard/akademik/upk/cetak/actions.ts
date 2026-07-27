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

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const cols = await query<{ name: string }>(`PRAGMA table_info(${table})`)
    return cols.some(c => c.name === column)
  } catch {
    return false
  }
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

  const hasJenisTransaksi = await hasColumn('upk_antrian', 'jenis_transaksi')
  const hasPrioritasStok = await hasColumn('upk_katalog', 'prioritas_stok')

  const params: unknown[] = []
  const conditions: string[] = ["a.status = 'SELESAI'"]

  if (hasJenisTransaksi) {
    conditions.push("COALESCE(a.jenis_transaksi, 'PENJUALAN') = 'PENJUALAN'")
  }

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
  const qtyColumn = isStokBaru ? 'qty_baru' : 'qty_lama'

  // 1. Coba ambil dari upk_stok_mutasi (penelusuran presisi stok baru vs lama)
  let rows: {
    katalog_id: number | null
    nama_kitab: string
    toko_nama: string | null
    harga_beli: number
    harga_jual: number
    qty_terjual: number
  }[] = []

  try {
    rows = await query<{
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
          ai.harga_jual AS alt_harga_jual,
          SUM(sm.${qtyColumn}) AS total_qty
        FROM upk_stok_mutasi sm
        JOIN upk_antrian a ON a.id = sm.antrian_id
        LEFT JOIN upk_antrian_item ai ON ai.id = sm.antrian_item_id
        WHERE ${conditions.join(' AND ')} AND sm.${qtyColumn} > 0
        GROUP BY sm.katalog_id, ai.nama_kitab, ai.harga_jual
      )
      SELECT
        mf.katalog_id,
        COALESCE(uk.nama_kitab, mf.alt_nama_kitab) AS nama_kitab,
        t.nama AS toko_nama,
        COALESCE(uk.harga_beli, 0) AS harga_beli,
        COALESCE(uk.harga_jual, mf.alt_harga_jual, 0) AS harga_jual,
        mf.total_qty AS qty_terjual
      FROM mutasi_terfilter mf
      LEFT JOIN upk_katalog uk ON uk.id = mf.katalog_id
      LEFT JOIN upk_toko t ON t.id = uk.toko_id
      WHERE mf.total_qty > 0
    `, params)
  } catch (err) {
    console.warn('[Cetak UPK] Query stok mutasi tidak menghasilkan data atau gagal, menggunakan fallback antrian_item:', err)
  }

  // 2. Fallback: jika stok mutasi belum pernah terisi di DB, ambil dari upk_antrian_item langsung
  if (!rows || rows.length === 0) {
    const fallbackConditions = [...conditions]
    if (hasPrioritasStok) {
      if (isStokBaru) {
        fallbackConditions.push("uk.prioritas_stok = 'BARU'")
      } else {
        fallbackConditions.push("COALESCE(uk.prioritas_stok, 'LAMA') <> 'BARU'")
      }
    }

    try {
      rows = await query<{
        katalog_id: number | null
        nama_kitab: string
        toko_nama: string | null
        harga_beli: number
        harga_jual: number
        qty_terjual: number
      }>(`
        SELECT
          ai.katalog_id,
          COALESCE(uk.nama_kitab, ai.nama_kitab) AS nama_kitab,
          t.nama AS toko_nama,
          COALESCE(uk.harga_beli, 0) AS harga_beli,
          COALESCE(uk.harga_jual, ai.harga_jual, 0) AS harga_jual,
          SUM(ai.qty) AS qty_terjual
        FROM upk_antrian a
        JOIN upk_antrian_item ai ON ai.antrian_id = a.id
        LEFT JOIN upk_katalog uk ON uk.id = ai.katalog_id
        LEFT JOIN upk_toko t ON t.id = uk.toko_id
        WHERE ${fallbackConditions.join(' AND ')} AND ai.qty > 0
        GROUP BY ai.katalog_id, ai.nama_kitab, ai.harga_jual
      `, params)
    } catch (err) {
      console.error('[Cetak UPK] Fallback query antrian_item gagal:', err)
      rows = []
    }
  }

  // Agregasi per katalog/toko agar kitab dengan nama sama dari toko berbeda tidak tergabung.
  const mapByName = new Map<string, RekapTerjualItem>()
  for (const r of rows) {
    const rawName = (r.nama_kitab || 'Tanpa Nama').trim()
    const tokoKey = (r.toko_nama || 'Tanpa Toko').trim().toLowerCase()
    const nameKey = `${r.katalog_id ?? 'tanpa-katalog'}::${rawName.toLowerCase()}::${tokoKey}`
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

  let joinKm = ''
  if (filters?.marhalahId) {
    joinKm = 'LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id'
    conditions.push('km.marhalah_id = ?')
    params.push(filters.marhalahId)
  }

  let rows: {
    katalog_id: number
    nama_kitab: string
    toko_nama: string | null
    stok_lama: number
    stok_baru: number
    harga_beli: number
    harga_jual: number
  }[] = []

  try {
    rows = await query<{
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
      ${joinKm}
      WHERE ${conditions.join(' AND ')}
    `, params)
  } catch (err) {
    console.error('[Cetak UPK] Gagal query rekap kitab tidak terjual:', err)
    return []
  }

  // Agregasi per katalog/toko agar stok toko tidak tercampur.
  const mapByName = new Map<string, RekapTidakTerjualItem>()
  for (const r of rows) {
    const rawName = (r.nama_kitab || 'Tanpa Nama').trim()
    const tokoKey = (r.toko_nama || 'Tanpa Toko').trim().toLowerCase()
    const nameKey = `${r.katalog_id}::${rawName.toLowerCase()}::${tokoKey}`
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

export type RekapPemasukanItem = {
  id: string
  tanggal: string
  waktu_catat: string
  kategori: string
  sumber: string | null
  nominal: number
  penjualan_seharusnya: number
  selisih: number
  catatan: string | null
  user_name: string | null
}

export type RekapPengeluaranItem = {
  id: string
  tanggal: string
  waktu_catat: string
  kategori: string
  penerima: string | null
  nominal: number
  belanja_id: string | null
  katalog_id: number | null
  nama_kitab: string | null
  catatan: string | null
  user_name: string | null
}

export async function getRekapPemasukanData(filters?: {
  tanggalDari?: string
  tanggalSampai?: string
  kategori?: string
}): Promise<RekapPemasukanItem[]> {
  await ensureFiturAksesCetakUPK()

  const params: unknown[] = []
  const conditions: string[] = []

  if (filters?.tanggalDari) {
    conditions.push('p.tanggal >= ?')
    params.push(filters.tanggalDari)
  }
  if (filters?.tanggalSampai) {
    conditions.push('p.tanggal <= ?')
    params.push(filters.tanggalSampai)
  }
  if (filters?.kategori && filters.kategori !== 'SEMUA') {
    conditions.push('p.kategori = ?')
    params.push(filters.kategori)
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<RekapPemasukanItem>(`
    SELECT p.id, p.tanggal, p.waktu_catat, p.kategori, p.sumber, p.nominal,
           p.penjualan_seharusnya, p.selisih, p.catatan, u.full_name AS user_name
    FROM upk_pemasukan p
    LEFT JOIN users u ON u.id = p.created_by
    ${whereSql}
    ORDER BY p.tanggal DESC, p.waktu_catat DESC
  `, params)
}

export async function getRekapPengeluaranData(filters?: {
  tanggalDari?: string
  tanggalSampai?: string
  kategori?: string
}): Promise<RekapPengeluaranItem[]> {
  await ensureFiturAksesCetakUPK()

  const params: unknown[] = []
  const conditions: string[] = []

  if (filters?.tanggalDari) {
    conditions.push('p.tanggal >= ?')
    params.push(filters.tanggalDari)
  }
  if (filters?.tanggalSampai) {
    conditions.push('p.tanggal <= ?')
    params.push(filters.tanggalSampai)
  }
  if (filters?.kategori && filters.kategori !== 'SEMUA') {
    conditions.push('p.kategori = ?')
    params.push(filters.kategori)
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<RekapPengeluaranItem>(`
    SELECT p.id, p.tanggal, p.waktu_catat, p.kategori, p.penerima, p.nominal,
           p.belanja_id, p.katalog_id, p.nama_kitab, p.catatan, u.full_name AS user_name
    FROM upk_pengeluaran p
    LEFT JOIN users u ON u.id = p.created_by
    ${whereSql}
    ORDER BY p.tanggal DESC, p.waktu_catat DESC
  `, params)
}

export { getDaftarKitabPerMarhalah }
