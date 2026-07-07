'use server'

import { execute, generateId, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { toInt } from '@/lib/upk-utils'
import { revalidatePath } from 'next/cache'

const RIWAYAT_PATH = '/dashboard/akademik/upk/riwayat'
const KASIR_PATH = '/dashboard/akademik/upk/kasir'

type UnitUPK = 'PUTRA' | 'PUTRI'
type JenisTransaksiUPK = 'PENJUALAN' | 'GRATIS_SANTRI' | 'GRATIS_GURU'

type RiwayatRow = {
  id: string
  tanggal: string
  nomor: number
  unit: UnitUPK
  nis: string | null
  nama_santri: string
  kelas_nama: string | null
  marhalah_nama: string | null
  total_tagihan: number
  total_bayar: number
  sisa_kembalian: number
  kembalian_ditahan: number
  sisa_tunggakan: number
  status: string
  catatan: string | null
  jenis_transaksi: JenisTransaksiUPK
  penerima_type: string
  guru_id: number | null
  harga_modal_total: number
  pengeluaran_id: string | null
  paid_at: string | null
  void_reason: string | null
  voided_at: string | null
  cashier_name: string | null
  voided_by_name: string | null
  total_item: number
}

type RiwayatItemRow = {
  id: string
  katalog_id: number | null
  nama_kitab: string
  qty: number
  harga_jual: number
  subtotal: number
  harga_modal: number
  modal_subtotal: number
  status_serah: string
  masuk_pesanan: number
}

type MutasiPenjualanRow = {
  id: string
  katalog_id: number | null
  antrian_item_id: string | null
  qty_lama: number
  qty_baru: number
  total_qty: number
}

function likeParam(value: string) {
  return `%${value.trim()}%`
}

export async function getRiwayatTransaksiUPK(filters?: {
  tanggalDari?: string
  tanggalSampai?: string
  unit?: '' | UnitUPK
  status?: 'SEMUA' | 'SELESAI' | 'VOID'
  jenis?: 'PENJUALAN' | 'GRATIS'
  search?: string
}) {
  const params: unknown[] = []
  const conditions = ["a.status IN ('SELESAI', 'VOID')"]

  if (filters?.tanggalDari) {
    conditions.push('a.tanggal >= ?')
    params.push(filters.tanggalDari)
  }
  if (filters?.tanggalSampai) {
    conditions.push('a.tanggal <= ?')
    params.push(filters.tanggalSampai)
  }
  if (filters?.unit) {
    conditions.push('a.unit = ?')
    params.push(filters.unit)
  }
  if (filters?.status && filters.status !== 'SEMUA') {
    conditions.push('a.status = ?')
    params.push(filters.status)
  }
  if (filters?.jenis === 'PENJUALAN') {
    conditions.push("COALESCE(a.jenis_transaksi, 'PENJUALAN') = 'PENJUALAN'")
  }
  if (filters?.jenis === 'GRATIS') {
    conditions.push("COALESCE(a.jenis_transaksi, 'PENJUALAN') IN ('GRATIS_SANTRI', 'GRATIS_GURU')")
  }
  if (filters?.search?.trim()) {
    conditions.push('(a.nama_santri LIKE ? OR a.nis LIKE ? OR CAST(a.nomor AS TEXT) LIKE ?)')
    const like = likeParam(filters.search)
    params.push(like, like, like)
  }

  const rows = await query<RiwayatRow>(`
    SELECT a.*, cashier.full_name AS cashier_name, voider.full_name AS voided_by_name,
           COUNT(ai.id) AS total_item
    FROM upk_antrian a
    LEFT JOIN upk_antrian_item ai ON ai.antrian_id = a.id
    LEFT JOIN users cashier ON cashier.id = a.cashier_by
    LEFT JOIN users voider ON voider.id = a.voided_by
    WHERE ${conditions.join(' AND ')}
    GROUP BY a.id
    ORDER BY COALESCE(a.paid_at, a.updated_at, a.created_at) DESC
  `, params)

  return rows.map((row) => ({
    ...row,
    total_tagihan: toInt(row.total_tagihan),
    total_bayar: toInt(row.total_bayar),
    sisa_kembalian: toInt(row.sisa_kembalian),
    kembalian_ditahan: toInt(row.kembalian_ditahan),
    sisa_tunggakan: toInt(row.sisa_tunggakan),
    harga_modal_total: toInt(row.harga_modal_total),
    total_item: toInt(row.total_item),
  }))
}

export async function getDetailTransaksiUPK(id: string) {
  const transaksi = await queryOne<RiwayatRow>(`
    SELECT a.*, cashier.full_name AS cashier_name, voider.full_name AS voided_by_name,
           COUNT(ai.id) AS total_item
    FROM upk_antrian a
    LEFT JOIN upk_antrian_item ai ON ai.antrian_id = a.id
    LEFT JOIN users cashier ON cashier.id = a.cashier_by
    LEFT JOIN users voider ON voider.id = a.voided_by
    WHERE a.id = ?
    GROUP BY a.id
  `, [id])
  if (!transaksi) return null

  const items = await query<RiwayatItemRow>(`
    SELECT id, katalog_id, nama_kitab, qty, harga_jual, subtotal, status_serah, masuk_pesanan
    FROM upk_antrian_item
    WHERE antrian_id = ?
    ORDER BY nama_kitab
  `, [id])

  return {
    ...transaksi,
    total_tagihan: toInt(transaksi.total_tagihan),
    total_bayar: toInt(transaksi.total_bayar),
    sisa_kembalian: toInt(transaksi.sisa_kembalian),
    kembalian_ditahan: toInt(transaksi.kembalian_ditahan),
    sisa_tunggakan: toInt(transaksi.sisa_tunggakan),
    harga_modal_total: toInt(transaksi.harga_modal_total),
    total_item: toInt(transaksi.total_item),
    items: items.map((item) => ({
      ...item,
      qty: toInt(item.qty),
      harga_jual: toInt(item.harga_jual),
      subtotal: toInt(item.subtotal),
      harga_modal: toInt(item.harga_modal),
      modal_subtotal: toInt(item.modal_subtotal),
      masuk_pesanan: toInt(item.masuk_pesanan),
    })),
  }
}

export async function voidTransaksiUPK(payload: {
  id: string
  alasan: string
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const alasan = payload.alasan.trim()
  if (!payload.id) return { error: 'Transaksi tidak valid.' }
  if (alasan.length < 5) return { error: 'Alasan void minimal 5 karakter.' }

  const transaksi = await queryOne<RiwayatRow>('SELECT * FROM upk_antrian WHERE id = ?', [payload.id])
  if (!transaksi) return { error: 'Transaksi tidak ditemukan.' }
  if (transaksi.status === 'VOID') return { error: 'Transaksi ini sudah di-void.' }
  if (transaksi.status !== 'SELESAI') return { error: 'Hanya transaksi selesai yang bisa di-void.' }

  const mutasi = await query<MutasiPenjualanRow>(`
    SELECT id, katalog_id, antrian_item_id, qty_lama, qty_baru, total_qty
    FROM upk_stok_mutasi
    WHERE antrian_id = ? AND tipe IN ('PENJUALAN', 'KITAB_GRATIS')
  `, [payload.id])

  for (const row of mutasi) {
    if (!row.katalog_id) continue
    const qtyLama = Math.max(0, toInt(row.qty_lama))
    const qtyBaru = Math.max(0, toInt(row.qty_baru))
    const totalQty = qtyLama + qtyBaru
    if (totalQty <= 0) continue

    await execute(`
      UPDATE upk_katalog
      SET stok_lama = stok_lama + ?, stok_baru = stok_baru + ?, stok_updated_at = ?, updated_at = ?
      WHERE id = ?
    `, [qtyLama, qtyBaru, now(), now(), row.katalog_id])

    await execute(`
      INSERT INTO upk_stok_mutasi
        (id, katalog_id, antrian_id, antrian_item_id, tanggal, unit, tipe, qty_lama, qty_baru, total_qty, catatan, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'VOID_PENJUALAN', ?, ?, ?, ?, ?, ?)
    `, [
      generateId(), row.katalog_id, payload.id, row.antrian_item_id, today(), transaksi.unit,
      qtyLama, qtyBaru, totalQty, `Void transaksi ${String(transaksi.nomor).padStart(3, '0')}: ${alasan}`,
      session?.id ?? null, now(),
    ])
  }

  await execute(`
    UPDATE upk_antrian
    SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?, updated_at = ?
    WHERE id = ?
  `, [alasan, session?.id ?? null, now(), now(), payload.id])

  if (transaksi.pengeluaran_id && transaksi.jenis_transaksi !== 'PENJUALAN') {
    await execute('DELETE FROM upk_pengeluaran WHERE id = ?', [transaksi.pengeluaran_id])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_riwayat',
    action: 'void',
    fiturHref: RIWAYAT_PATH,
    logKind: 'update',
    entityType: 'upk_antrian',
    entityId: payload.id,
    entityLabel: transaksi.nama_santri,
    summary: `Void transaksi UPK ${String(transaksi.nomor).padStart(3, '0')} - ${transaksi.nama_santri}`,
    details: {
      unit: transaksi.unit,
      tanggal: transaksi.tanggal,
      total_tagihan: transaksi.total_tagihan,
      total_bayar: transaksi.total_bayar,
      jenis_transaksi: transaksi.jenis_transaksi,
      harga_modal_total: transaksi.harga_modal_total,
      alasan,
      restored_mutasi: mutasi.length,
    },
  })

  revalidatePath(RIWAYAT_PATH)
  revalidatePath(KASIR_PATH)
  revalidatePath('/dashboard/akademik/upk/katalog')
  revalidatePath('/dashboard/akademik/upk/pemasukan')
  return { success: true }
}
