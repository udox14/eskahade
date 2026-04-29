'use server'

import { execute, generateId, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const PENGELUARAN_PATH = '/dashboard/akademik/upk/pengeluaran'
const BELANJA_PATH = '/dashboard/akademik/upk/belanja'

type KategoriPengeluaran =
  | 'KONSUMSI'
  | 'TRANSPORT'
  | 'BAYAR_HUTANG_TOKO'
  | 'BAYAR_PINJAMAN_MODAL'
  | 'ROYALTI_PENULIS'
  | 'OPERASIONAL'
  | 'LAINNYA'

type PengeluaranPayload = {
  id?: string
  tanggal: string
  kategori: KategoriPengeluaran
  penerima?: string
  nominal: number
  belanjaId?: string
  katalogId?: number | null
  namaKitab?: string | null
  catatan?: string
}

type PengeluaranRow = {
  id: string
  tanggal: string
  waktu_catat: string
  kategori: KategoriPengeluaran
  penerima: string | null
  nominal: number
  belanja_id: string | null
  katalog_id: number | null
  nama_kitab: string | null
  catatan: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
  user_name: string | null
}

type OldPengeluaranRow = {
  id: string
  kategori: KategoriPengeluaran
  nominal: number
  belanja_id: string | null
}

type BelanjaHutangRow = {
  id: string
  tanggal: string
  jenis: string
  toko_nama: string | null
  total: number
  dibayar: number
  sisa_hutang: number
}

function toInt(value: unknown) {
  const parsed = parseInt(String(value ?? '0'), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeKategori(value: unknown): KategoriPengeluaran {
  if (
    value === 'KONSUMSI' ||
    value === 'TRANSPORT' ||
    value === 'BAYAR_HUTANG_TOKO' ||
    value === 'BAYAR_PINJAMAN_MODAL' ||
    value === 'ROYALTI_PENULIS' ||
    value === 'OPERASIONAL'
  ) return value
  return 'LAINNYA'
}

function statusPembayaran(total: number, dibayar: number) {
  if (dibayar <= 0) return 'HUTANG'
  if (dibayar >= total) return 'LUNAS'
  return 'SEBAGIAN'
}

async function ubahPembayaranHutangBelanja(belanjaId: string, delta: number): Promise<{ success: true } | { error: string }> {
  const row = await queryOne<BelanjaHutangRow>('SELECT * FROM upk_belanja WHERE id = ?', [belanjaId])
  if (!row) return { error: 'Data hutang toko tidak ditemukan.' }

  const dibayarBaru = toInt(row.dibayar) + delta
  if (dibayarBaru < 0) return { error: 'Pembayaran hutang toko tidak boleh kurang dari 0.' }
  if (dibayarBaru > toInt(row.total)) return { error: 'Nominal melebihi sisa hutang toko.' }

  const sisaBaru = Math.max(0, toInt(row.total) - dibayarBaru)
  await execute(
    'UPDATE upk_belanja SET dibayar = ?, sisa_hutang = ?, status_pembayaran = ?, updated_at = ? WHERE id = ?',
    [dibayarBaru, sisaBaru, statusPembayaran(toInt(row.total), dibayarBaru), now(), belanjaId]
  )

  return { success: true }
}

export async function getRingkasanPengeluaranUPK(tanggal = today()) {
  const harian = await queryOne<{
    total: number
    konsumsi: number
    transport: number
    hutang_toko: number
    hutang_modal: number
    royalti: number
  }>(`
    SELECT
      COALESCE(SUM(nominal), 0) AS total,
      COALESCE(SUM(CASE WHEN kategori = 'KONSUMSI' THEN nominal ELSE 0 END), 0) AS konsumsi,
      COALESCE(SUM(CASE WHEN kategori = 'TRANSPORT' THEN nominal ELSE 0 END), 0) AS transport,
      COALESCE(SUM(CASE WHEN kategori = 'BAYAR_HUTANG_TOKO' THEN nominal ELSE 0 END), 0) AS hutang_toko,
      COALESCE(SUM(CASE WHEN kategori = 'BAYAR_PINJAMAN_MODAL' THEN nominal ELSE 0 END), 0) AS hutang_modal,
      COALESCE(SUM(CASE WHEN kategori = 'ROYALTI_PENULIS' THEN nominal ELSE 0 END), 0) AS royalti
    FROM upk_pengeluaran
    WHERE tanggal = ?
  `, [tanggal])

  const hutangToko = await queryOne<{ total: number }>(
    'SELECT COALESCE(SUM(sisa_hutang), 0) AS total FROM upk_belanja WHERE sisa_hutang > 0',
    []
  )

  const hutangModal = await queryOne<{ total: number }>(`
    SELECT
      COALESCE((SELECT SUM(nominal) FROM upk_pemasukan WHERE kategori = 'PINJAMAN_MODAL'), 0)
      - COALESCE((SELECT SUM(nominal) FROM upk_pengeluaran WHERE kategori = 'BAYAR_PINJAMAN_MODAL'), 0)
      AS total
  `, [])

  return {
    tanggal,
    total: toInt(harian?.total),
    konsumsi: toInt(harian?.konsumsi),
    transport: toInt(harian?.transport),
    hutang_toko: toInt(harian?.hutang_toko),
    hutang_modal: toInt(harian?.hutang_modal),
    royalti: toInt(harian?.royalti),
    sisa_hutang_toko: toInt(hutangToko?.total),
    sisa_hutang_modal: Math.max(0, toInt(hutangModal?.total)),
  }
}

export async function getPengeluaranUPK(tanggal = today()) {
  return query<PengeluaranRow>(`
    SELECT p.*, u.full_name AS user_name
    FROM upk_pengeluaran p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.tanggal = ?
    ORDER BY p.waktu_catat DESC, p.created_at DESC
  `, [tanggal])
}

export async function getHutangTokoOptions() {
  return query<BelanjaHutangRow>(`
    SELECT id, tanggal, jenis, toko_nama, total, dibayar, sisa_hutang
    FROM upk_belanja
    WHERE sisa_hutang > 0
    ORDER BY tanggal ASC, created_at ASC
  `, [])
}

export async function getPinjamanModalOptions() {
  return query<{ sumber: string; total_pinjaman: number; total_dibayar: number; sisa: number }>(`
    SELECT
      COALESCE(p.sumber, 'Tanpa nama') AS sumber,
      COALESCE(SUM(p.nominal), 0) AS total_pinjaman,
      COALESCE((
        SELECT SUM(pg.nominal)
        FROM upk_pengeluaran pg
        WHERE pg.kategori = 'BAYAR_PINJAMAN_MODAL'
          AND COALESCE(pg.penerima, 'Tanpa nama') = COALESCE(p.sumber, 'Tanpa nama')
      ), 0) AS total_dibayar,
      COALESCE(SUM(p.nominal), 0) - COALESCE((
        SELECT SUM(pg.nominal)
        FROM upk_pengeluaran pg
        WHERE pg.kategori = 'BAYAR_PINJAMAN_MODAL'
          AND COALESCE(pg.penerima, 'Tanpa nama') = COALESCE(p.sumber, 'Tanpa nama')
      ), 0) AS sisa
    FROM upk_pemasukan p
    WHERE p.kategori = 'PINJAMAN_MODAL'
    GROUP BY COALESCE(p.sumber, 'Tanpa nama')
    HAVING sisa > 0
    ORDER BY sumber
  `, [])
}

export async function getKatalogRoyaltiOptions() {
  return query<{ id: number; nama_kitab: string; marhalah_nama: string | null }>(`
    SELECT uk.id, uk.nama_kitab, m.nama AS marhalah_nama
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    WHERE uk.is_active = 1
    ORDER BY m.urutan, uk.nama_kitab
  `, [])
}

export async function simpanPengeluaranUPK(payload: PengeluaranPayload): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const id = payload.id?.trim()
  const tanggal = payload.tanggal || today()
  const kategori = normalizeKategori(payload.kategori)
  const nominal = Math.max(0, toInt(payload.nominal))
  const belanjaId = kategori === 'BAYAR_HUTANG_TOKO' ? payload.belanjaId?.trim() || null : null
  const katalogId = kategori === 'ROYALTI_PENULIS' ? toInt(payload.katalogId) || null : null
  const namaKitab = kategori === 'ROYALTI_PENULIS' ? payload.namaKitab?.trim() || null : null

  if (nominal <= 0) return { error: 'Nominal pengeluaran harus lebih dari 0.' }
  if (kategori === 'BAYAR_HUTANG_TOKO' && !belanjaId) return { error: 'Pilih hutang toko yang dibayar.' }
  if (kategori === 'BAYAR_PINJAMAN_MODAL' && !payload.penerima?.trim()) return { error: 'Pilih atau isi pemberi pinjaman.' }
  if (kategori === 'ROYALTI_PENULIS' && !payload.penerima?.trim()) return { error: 'Nama penulis/penerima wajib diisi.' }

  const old = id
    ? await queryOne<OldPengeluaranRow>('SELECT id, kategori, nominal, belanja_id FROM upk_pengeluaran WHERE id = ?', [id])
    : null

  if (old?.kategori === 'BAYAR_HUTANG_TOKO' && old.belanja_id) {
    const reverse = await ubahPembayaranHutangBelanja(old.belanja_id, -toInt(old.nominal))
    if ('error' in reverse) return reverse
  }

  if (kategori === 'BAYAR_HUTANG_TOKO' && belanjaId) {
    const apply = await ubahPembayaranHutangBelanja(belanjaId, nominal)
    if ('error' in apply) {
      if (old?.kategori === 'BAYAR_HUTANG_TOKO' && old.belanja_id) {
        await ubahPembayaranHutangBelanja(old.belanja_id, toInt(old.nominal))
      }
      return apply
    }
  }

  if (id) {
    await execute(`
      UPDATE upk_pengeluaran
      SET tanggal = ?, kategori = ?, penerima = ?, nominal = ?, belanja_id = ?,
          katalog_id = ?, nama_kitab = ?, catatan = ?, updated_at = ?
      WHERE id = ?
    `, [tanggal, kategori, payload.penerima?.trim() || null, nominal, belanjaId,
        katalogId, namaKitab, payload.catatan?.trim() || null, now(), id])
  } else {
    await execute(`
      INSERT INTO upk_pengeluaran
        (id, tanggal, waktu_catat, kategori, penerima, nominal, belanja_id,
         katalog_id, nama_kitab, catatan, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [generateId(), tanggal, now(), kategori, payload.penerima?.trim() || null, nominal, belanjaId,
        katalogId, namaKitab, payload.catatan?.trim() || null, session?.id ?? null, now(), now()])
  }

  revalidatePath(PENGELUARAN_PATH)
  revalidatePath(BELANJA_PATH)
  return { success: true }
}

export async function hapusPengeluaranUPK(id: string): Promise<{ success: true } | { error: string }> {
  if (!id) return { error: 'Data pengeluaran tidak valid.' }
  const old = await queryOne<OldPengeluaranRow>('SELECT id, kategori, nominal, belanja_id FROM upk_pengeluaran WHERE id = ?', [id])
  if (!old) return { error: 'Data pengeluaran tidak ditemukan.' }

  if (old.kategori === 'BAYAR_HUTANG_TOKO' && old.belanja_id) {
    const reverse = await ubahPembayaranHutangBelanja(old.belanja_id, -toInt(old.nominal))
    if ('error' in reverse) return reverse
  }

  await execute('DELETE FROM upk_pengeluaran WHERE id = ?', [id])
  revalidatePath(PENGELUARAN_PATH)
  revalidatePath(BELANJA_PATH)
  return { success: true }
}
