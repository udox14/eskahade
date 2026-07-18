'use server'

import { query } from '@/lib/db'
import { toInt } from '@/lib/upk-utils'

type UnitUPK = 'PUTRA' | 'PUTRI'

type StatistikRow = {
  katalog_id: number | null
  nama_kitab: string
  is_active: number
  stok_lama: number
  stok_baru: number
  harga_beli: number
  harga_jual: number
  transaksi: number
  qty_terjual: number
  qty_sudah: number
  qty_belum: number
  qty_gratis: number
  omzet: number
}

export type StatistikKitabUPK = ReturnType<typeof mapRow>

function validDate(value: string | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : ''
}

/**
 * Satu round-trip dan satu scan item transaksi untuk seluruh statistik kitab.
 * Item historis yang kehilangan katalog_id tetap dipetakan ke katalog bila nama
 * kitabnya unik; sisanya tetap ditampilkan sebagai baris "historis".
 */
export async function getStatistikKitabUPK(filters?: {
  tanggalDari?: string
  tanggalSampai?: string
  unit?: '' | UnitUPK
}) {
  const tanggalDari = validDate(filters?.tanggalDari)
  const tanggalSampai = validDate(filters?.tanggalSampai)
  const params: unknown[] = []
  const conditions = ["a.status = 'SELESAI'"]

  if (tanggalDari) {
    conditions.push('a.tanggal >= ?')
    params.push(tanggalDari)
  }
  if (tanggalSampai) {
    conditions.push('a.tanggal <= ?')
    params.push(tanggalSampai)
  }
  if (filters?.unit) {
    conditions.push('a.unit = ?')
    params.push(filters.unit)
  }

  const rows = await query<StatistikRow>(`
    WITH katalog_nama_unik AS (
      SELECT lower(trim(nama_kitab)) AS nama_key, MIN(id) AS katalog_id
      FROM upk_katalog
      GROUP BY lower(trim(nama_kitab))
      HAVING COUNT(*) = 1
    ),
    item_terfilter AS (
      SELECT
        ai.antrian_id,
        COALESCE(ai.katalog_id, knu.katalog_id) AS katalog_id,
        ai.nama_kitab,
        ai.qty,
        ai.subtotal,
        ai.status_serah,
        COALESCE(a.jenis_transaksi, 'PENJUALAN') AS jenis_transaksi
      FROM upk_antrian a
      JOIN upk_antrian_item ai ON ai.antrian_id = a.id
      LEFT JOIN katalog_nama_unik knu
        ON ai.katalog_id IS NULL
       AND knu.nama_key = lower(trim(ai.nama_kitab))
      WHERE ${conditions.join(' AND ')} AND ai.qty > 0 AND ai.status_serah <> 'BATAL'
    ),
    agregat AS (
      SELECT
        katalog_id,
        MIN(nama_kitab) AS nama_kitab,
        COUNT(DISTINCT CASE WHEN jenis_transaksi = 'PENJUALAN' THEN antrian_id END) AS transaksi,
        SUM(CASE WHEN jenis_transaksi = 'PENJUALAN' THEN qty ELSE 0 END) AS qty_terjual,
        SUM(CASE WHEN jenis_transaksi = 'PENJUALAN' AND status_serah = 'SUDAH' THEN qty ELSE 0 END) AS qty_sudah,
        SUM(CASE WHEN jenis_transaksi = 'PENJUALAN' AND status_serah = 'BELUM' THEN qty ELSE 0 END) AS qty_belum,
        SUM(CASE WHEN jenis_transaksi IN ('GRATIS_SANTRI', 'GRATIS_GURU') THEN qty ELSE 0 END) AS qty_gratis,
        SUM(CASE WHEN jenis_transaksi = 'PENJUALAN' THEN subtotal ELSE 0 END) AS omzet
      FROM item_terfilter
      GROUP BY katalog_id, CASE WHEN katalog_id IS NULL THEN lower(trim(nama_kitab)) ELSE '' END
    )
    SELECT
      k.id AS katalog_id,
      k.nama_kitab,
      k.is_active,
      k.stok_lama,
      k.stok_baru,
      k.harga_beli,
      k.harga_jual,
      COALESCE(ag.transaksi, 0) AS transaksi,
      COALESCE(ag.qty_terjual, 0) AS qty_terjual,
      COALESCE(ag.qty_sudah, 0) AS qty_sudah,
      COALESCE(ag.qty_belum, 0) AS qty_belum,
      COALESCE(ag.qty_gratis, 0) AS qty_gratis,
      COALESCE(ag.omzet, 0) AS omzet
    FROM upk_katalog k
    LEFT JOIN agregat ag ON ag.katalog_id = k.id

    UNION ALL

    SELECT
      NULL AS katalog_id,
      ag.nama_kitab,
      0 AS is_active,
      0 AS stok_lama,
      0 AS stok_baru,
      0 AS harga_beli,
      0 AS harga_jual,
      ag.transaksi,
      ag.qty_terjual,
      ag.qty_sudah,
      ag.qty_belum,
      ag.qty_gratis,
      ag.omzet
    FROM agregat ag
    WHERE ag.katalog_id IS NULL

    ORDER BY qty_terjual DESC, nama_kitab ASC
  `, params)

  return rows.map(mapRow)
}

function mapRow(row: StatistikRow) {
  const stokLama = toInt(row.stok_lama)
  const stokBaru = toInt(row.stok_baru)
  const hargaBeli = toInt(row.harga_beli)
  const qtyTerjual = toInt(row.qty_terjual)
  const qtySudah = toInt(row.qty_sudah)
  const qtyBelum = toInt(row.qty_belum)

  return {
    katalog_id: row.katalog_id === null ? null : toInt(row.katalog_id),
    nama_kitab: row.nama_kitab,
    is_active: toInt(row.is_active),
    stok_lama: stokLama,
    stok_baru: stokBaru,
    stok_total: stokLama + stokBaru,
    harga_beli: hargaBeli,
    harga_jual: toInt(row.harga_jual),
    nilai_stok: (stokLama + stokBaru) * hargaBeli,
    transaksi: toInt(row.transaksi),
    qty_terjual: qtyTerjual,
    qty_sudah: qtySudah,
    qty_belum: qtyBelum,
    qty_gratis: toInt(row.qty_gratis),
    omzet: toInt(row.omzet),
    status_lain: Math.max(0, qtyTerjual - qtySudah - qtyBelum),
  }
}
