'use server'

import { execute, generateId, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const PEMASUKAN_PATH = '/dashboard/akademik/upk/pemasukan'

type KategoriPemasukan = 'SETORAN_PENJUALAN' | 'PINJAMAN_MODAL' | 'LAINNYA'

type PemasukanPayload = {
  id?: string
  tanggal: string
  kategori: KategoriPemasukan
  sumber?: string
  nominal: number
  penjualanSeharusnya?: number
  catatan?: string
}

type PenjualanRow = {
  total_transaksi: number
  total_tagihan: number
  total_bayar: number
  total_tunggakan: number
  total_kembalian_ditahan: number
}

type PemasukanRow = {
  id: string
  tanggal: string
  waktu_catat: string
  kategori: KategoriPemasukan
  sumber: string | null
  nominal: number
  penjualan_seharusnya: number
  selisih: number
  catatan: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
  user_name: string | null
}

function toInt(value: unknown) {
  const parsed = parseInt(String(value ?? '0'), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeKategori(value: unknown): KategoriPemasukan {
  if (value === 'PINJAMAN_MODAL' || value === 'LAINNYA') return value
  return 'SETORAN_PENJUALAN'
}

export async function getRingkasanPenjualanUPK(tanggal = today()) {
  const row = await queryOne<PenjualanRow>(`
    SELECT
      COUNT(*) AS total_transaksi,
      COALESCE(SUM(total_tagihan), 0) AS total_tagihan,
      COALESCE(SUM(total_bayar), 0) AS total_bayar,
      COALESCE(SUM(sisa_tunggakan), 0) AS total_tunggakan,
      COALESCE(SUM(sisa_kembalian), 0) AS total_kembalian_ditahan
    FROM upk_antrian
    WHERE tanggal = ? AND status = 'SELESAI'
  `, [tanggal])

  const pemasukan = await queryOne<{
    total_setoran: number
    total_pinjaman: number
    total_lainnya: number
  }>(`
    SELECT
      COALESCE(SUM(CASE WHEN kategori = 'SETORAN_PENJUALAN' THEN nominal ELSE 0 END), 0) AS total_setoran,
      COALESCE(SUM(CASE WHEN kategori = 'PINJAMAN_MODAL' THEN nominal ELSE 0 END), 0) AS total_pinjaman,
      COALESCE(SUM(CASE WHEN kategori = 'LAINNYA' THEN nominal ELSE 0 END), 0) AS total_lainnya
    FROM upk_pemasukan
    WHERE tanggal = ?
  `, [tanggal])

  const penjualanSeharusnya = toInt(row?.total_bayar)
  const totalSetoran = toInt(pemasukan?.total_setoran)

  return {
    tanggal,
    total_transaksi: toInt(row?.total_transaksi),
    total_tagihan: toInt(row?.total_tagihan),
    total_bayar: penjualanSeharusnya,
    total_tunggakan: toInt(row?.total_tunggakan),
    total_kembalian_ditahan: toInt(row?.total_kembalian_ditahan),
    total_setoran: totalSetoran,
    total_pinjaman: toInt(pemasukan?.total_pinjaman),
    total_lainnya: toInt(pemasukan?.total_lainnya),
    sisa_belum_direkap: Math.max(0, penjualanSeharusnya - totalSetoran),
    selisih: totalSetoran - penjualanSeharusnya,
  }
}

export async function getPemasukanUPK(tanggal = today()) {
  return query<PemasukanRow>(`
    SELECT p.*, u.full_name AS user_name
    FROM upk_pemasukan p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.tanggal = ?
    ORDER BY p.waktu_catat DESC, p.created_at DESC
  `, [tanggal])
}

export async function simpanPemasukanUPK(payload: PemasukanPayload): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const id = payload.id?.trim()
  const tanggal = payload.tanggal || today()
  const kategori = normalizeKategori(payload.kategori)
  const nominal = Math.max(0, toInt(payload.nominal))
  const penjualanSeharusnya = kategori === 'SETORAN_PENJUALAN'
    ? Math.max(0, toInt(payload.penjualanSeharusnya))
    : 0
  const selisih = kategori === 'SETORAN_PENJUALAN' ? nominal - penjualanSeharusnya : 0

  if (nominal <= 0) return { error: 'Nominal pemasukan harus lebih dari 0.' }

  if (id) {
    await execute(`
      UPDATE upk_pemasukan
      SET tanggal = ?, kategori = ?, sumber = ?, nominal = ?, penjualan_seharusnya = ?, selisih = ?,
          catatan = ?, updated_at = ?
      WHERE id = ?
    `, [tanggal, kategori, payload.sumber?.trim() || null, nominal,
        penjualanSeharusnya, selisih, payload.catatan?.trim() || null, now(), id])
  } else {
    await execute(`
      INSERT INTO upk_pemasukan
        (id, tanggal, waktu_catat, kategori, sumber, nominal, penjualan_seharusnya,
         selisih, catatan, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [generateId(), tanggal, now(), kategori, payload.sumber?.trim() || null, nominal,
        penjualanSeharusnya, selisih, payload.catatan?.trim() || null, session?.id ?? null, now(), now()])
  }

  revalidatePath(PEMASUKAN_PATH)
  return { success: true }
}

export async function hapusPemasukanUPK(id: string): Promise<{ success: true } | { error: string }> {
  if (!id) return { error: 'Data pemasukan tidak valid.' }
  await execute('DELETE FROM upk_pemasukan WHERE id = ?', [id])
  revalidatePath(PEMASUKAN_PATH)
  return { success: true }
}
