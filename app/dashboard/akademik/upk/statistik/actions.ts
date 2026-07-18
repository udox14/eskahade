'use server'

import { query } from '@/lib/db'
import { ensureActivityLogSchema } from '@/lib/activity-log'
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

type PerformaUserRow = {
  user_key: string
  user_id: string | null
  nama_user: string
  pesanan_dibuat: number
  pesanan_selesai: number
  catatan_dibuat: number
  kitab_diserahkan: number
  tindak_lanjut: number
  entri_operasional: number
  koreksi: number
  total_aktivitas: number
  hari_aktif: number
  nilai_ditangani: number
  rata_menit: number
  aktivitas_terakhir: string | null
}

export type PerformaUserUPK = ReturnType<typeof mapPerformaUserRow>

function validDate(value: string | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : ''
}

/**
 * Performa user menggabungkan data transaksi (sumber angka kasir yang paling
 * akurat) dengan activity log (penyerahan pesanan dan pekerjaan operasional).
 * Actor yang user-nya sudah dihapus tetap ditampilkan memakai nama historis.
 */
export async function getPerformaUserUPK(filters?: {
  tanggalDari?: string
  tanggalSampai?: string
  unit?: '' | UnitUPK
}) {
  await ensureActivityLogSchema()

  const tanggalDari = validDate(filters?.tanggalDari)
  const tanggalSampai = validDate(filters?.tanggalSampai)
  const logConditions = ["al.status = 'success'", "al.module LIKE 'akademik_upk_%'"]
  const antrianConditions = ['1 = 1']
  const params: unknown[] = []

  if (tanggalDari) {
    logConditions.push("date(al.created_at, '+7 hours') >= ?")
    params.push(tanggalDari)
  }
  if (tanggalSampai) {
    logConditions.push("date(al.created_at, '+7 hours') <= ?")
    params.push(tanggalSampai)
  }
  if (filters?.unit) {
    logConditions.push(`COALESCE(
      json_extract(al.details_json, '$.unit'),
      direct_antrian.unit,
      item_antrian.unit
    ) = ?`)
    params.push(filters.unit)
  }
  if (tanggalDari) {
    antrianConditions.push('a.tanggal >= ?')
    params.push(tanggalDari)
  }
  if (tanggalSampai) {
    antrianConditions.push('a.tanggal <= ?')
    params.push(tanggalSampai)
  }
  if (filters?.unit) {
    antrianConditions.push('a.unit = ?')
    params.push(filters.unit)
  }

  const rows = await query<PerformaUserRow>(`
    WITH log_terfilter AS (
      SELECT
        COALESCE(al.actor_user_id, 'nama:' || COALESCE(al.actor_name, 'Tanpa nama')) AS user_key,
        al.actor_user_id AS user_id,
        COALESCE(u.full_name, al.actor_name, u.email, 'Tanpa nama') AS nama_user,
        al.created_at,
        al.module,
        al.action,
        al.details_json
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.actor_user_id
      LEFT JOIN upk_antrian direct_antrian
        ON al.entity_type = 'upk_antrian' AND direct_antrian.id = al.entity_id
      LEFT JOIN upk_antrian_item direct_item
        ON al.entity_type = 'upk_antrian_item' AND direct_item.id = al.entity_id
      LEFT JOIN upk_antrian item_antrian ON item_antrian.id = direct_item.antrian_id
      WHERE ${logConditions.join(' AND ')}
    ),
    antrian_terfilter AS (
      SELECT a.*
      FROM upk_antrian a
      WHERE ${antrianConditions.join(' AND ')}
    ),
    user_terlibat AS (
      SELECT user_key, user_id, nama_user FROM log_terfilter
      UNION
      SELECT a.created_by, a.created_by, COALESCE(u.full_name, u.email, 'Tanpa nama')
      FROM antrian_terfilter a JOIN users u ON u.id = a.created_by
      UNION
      SELECT a.cashier_by, a.cashier_by, COALESCE(u.full_name, u.email, 'Tanpa nama')
      FROM antrian_terfilter a JOIN users u ON u.id = a.cashier_by
    ),
    log_agregat AS (
      SELECT
        user_key,
        SUM(CASE WHEN module = 'akademik_upk_pesanan' AND action = 'serah'
          THEN COALESCE(CAST(json_extract(details_json, '$.qty') AS INTEGER), 1) ELSE 0 END) AS kitab_diserahkan,
        SUM(CASE WHEN module = 'akademik_upk_pesanan' AND action IN ('bayar', 'serah_kembalian') THEN 1 ELSE 0 END) AS tindak_lanjut,
        SUM(CASE WHEN module IN ('akademik_upk_pemasukan', 'akademik_upk_pengeluaran', 'akademik_upk_belanja')
          AND action IN ('create', 'update', 'payment') THEN 1 ELSE 0 END) AS entri_operasional,
        SUM(CASE WHEN action IN ('cancel', 'void', 'delete') THEN 1 ELSE 0 END) AS koreksi,
        COUNT(*) AS total_aktivitas,
        COUNT(DISTINCT date(created_at, '+7 hours')) AS hari_aktif,
        MAX(created_at) AS aktivitas_terakhir
      FROM log_terfilter
      GROUP BY user_key
    ),
    dibuat_agregat AS (
      SELECT
        created_by AS user_key,
        COUNT(*) AS pesanan_dibuat,
        SUM(CASE WHEN trim(COALESCE(catatan, '')) <> '' THEN 1 ELSE 0 END) AS catatan_dibuat
      FROM antrian_terfilter
      WHERE created_by IS NOT NULL
      GROUP BY created_by
    ),
    selesai_agregat AS (
      SELECT
        cashier_by AS user_key,
        COUNT(*) AS pesanan_selesai,
        SUM(CASE WHEN COALESCE(jenis_transaksi, 'PENJUALAN') = 'PENJUALAN' THEN total_tagihan ELSE 0 END) AS nilai_ditangani,
        AVG(CASE WHEN paid_at IS NOT NULL AND created_at IS NOT NULL
          THEN MAX(0, (julianday(paid_at) - julianday(created_at)) * 1440.0) END) AS rata_menit,
        MAX(paid_at) AS pembayaran_terakhir
      FROM antrian_terfilter
      WHERE status = 'SELESAI' AND cashier_by IS NOT NULL
      GROUP BY cashier_by
    )
    SELECT
      ut.user_key,
      MAX(ut.user_id) AS user_id,
      MAX(ut.nama_user) AS nama_user,
      COALESCE(MAX(da.pesanan_dibuat), 0) AS pesanan_dibuat,
      COALESCE(MAX(sa.pesanan_selesai), 0) AS pesanan_selesai,
      COALESCE(MAX(da.catatan_dibuat), 0) AS catatan_dibuat,
      COALESCE(MAX(la.kitab_diserahkan), 0) AS kitab_diserahkan,
      COALESCE(MAX(la.tindak_lanjut), 0) AS tindak_lanjut,
      COALESCE(MAX(la.entri_operasional), 0) AS entri_operasional,
      COALESCE(MAX(la.koreksi), 0) AS koreksi,
      COALESCE(MAX(la.total_aktivitas), 0) AS total_aktivitas,
      COALESCE(MAX(la.hari_aktif), 0) AS hari_aktif,
      COALESCE(MAX(sa.nilai_ditangani), 0) AS nilai_ditangani,
      COALESCE(MAX(sa.rata_menit), 0) AS rata_menit,
      CASE
        WHEN MAX(la.aktivitas_terakhir) IS NULL THEN MAX(sa.pembayaran_terakhir)
        WHEN MAX(sa.pembayaran_terakhir) IS NULL THEN MAX(la.aktivitas_terakhir)
        WHEN MAX(la.aktivitas_terakhir) >= MAX(sa.pembayaran_terakhir) THEN MAX(la.aktivitas_terakhir)
        ELSE MAX(sa.pembayaran_terakhir)
      END AS aktivitas_terakhir
    FROM user_terlibat ut
    LEFT JOIN log_agregat la ON la.user_key = ut.user_key
    LEFT JOIN dibuat_agregat da ON da.user_key = ut.user_key
    LEFT JOIN selesai_agregat sa ON sa.user_key = ut.user_key
    GROUP BY ut.user_key
    ORDER BY pesanan_selesai DESC, total_aktivitas DESC, nama_user ASC
  `, params)

  return rows.map(mapPerformaUserRow)
}

function mapPerformaUserRow(row: PerformaUserRow) {
  return {
    user_key: row.user_key,
    user_id: row.user_id,
    nama_user: row.nama_user,
    pesanan_dibuat: toInt(row.pesanan_dibuat),
    pesanan_selesai: toInt(row.pesanan_selesai),
    catatan_dibuat: toInt(row.catatan_dibuat),
    kitab_diserahkan: toInt(row.kitab_diserahkan),
    tindak_lanjut: toInt(row.tindak_lanjut),
    entri_operasional: toInt(row.entri_operasional),
    koreksi: toInt(row.koreksi),
    total_aktivitas: toInt(row.total_aktivitas),
    hari_aktif: toInt(row.hari_aktif),
    nilai_ditangani: toInt(row.nilai_ditangani),
    rata_menit: Math.round(Number(row.rata_menit) || 0),
    aktivitas_terakhir: row.aktivitas_terakhir,
  }
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
