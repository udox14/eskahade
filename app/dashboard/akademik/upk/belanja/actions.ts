'use server'

import { execute, generateId, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const BELANJA_PATH = '/dashboard/akademik/upk/belanja'

type KatalogBelanjaRow = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  harga_beli: number
  harga_jual: number
  stok_lama: number
  stok_baru: number
  marhalah_nama: string | null
  toko_id: number | null
  toko_nama: string | null
}

type RencanaPayloadItem = {
  katalogId: number
  namaKitab: string
  marhalahId: number | null
  marhalahNama: string | null
  jumlahSantri: number
  stokLama: number
  stokBaru: number
  persenTarget: number
  saranQty: number
  qtyRencana: number
  hargaBeli: number
}

type BelanjaPayloadItem = {
  katalogId: number
  namaKitab: string
  marhalahId: number | null
  marhalahNama: string | null
  qty: number
  hargaBeli: number
}

type RencanaHitungRow = {
  katalog_id: number
  nama_kitab: string
  marhalah_id: number | null
  stok_lama: number
  stok_baru: number
  harga_beli: number
  marhalah_nama: string | null
  jumlah_santri: number
}

type RencanaListRow = {
  id: string
  tanggal: string
  nama: string
  persen_target: number
  status: string
  total_item: number
  total_estimasi: number
}

type BelanjaListRow = {
  id: string
  tanggal: string
  jenis: string
  toko_nama: string | null
  status_pembayaran: string
  total: number
  dibayar: number
  sisa_hutang: number
  total_item: number
}

type HutangBelanjaRow = {
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

function statusPembayaran(total: number, dibayar: number) {
  if (dibayar <= 0) return 'HUTANG'
  if (dibayar >= total) return 'LUNAS'
  return 'SEBAGIAN'
}

export async function getKatalogBelanja() {
  const rows = await query<KatalogBelanjaRow>(`
    SELECT uk.id, uk.nama_kitab, uk.marhalah_id, uk.harga_beli, uk.harga_jual,
           uk.stok_lama, uk.stok_baru, uk.toko_id,
           m.nama AS marhalah_nama, t.nama AS toko_nama
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    WHERE uk.is_active = 1
    ORDER BY m.urutan, uk.nama_kitab
  `, [])
  return rows.map(row => ({
    ...row,
    jumlah_stok: (row.stok_lama || 0) + (row.stok_baru || 0),
  }))
}

export async function getTokoBelanja() {
  return query<{ id: number; nama: string }>(
    'SELECT id, nama FROM upk_toko WHERE is_active = 1 ORDER BY nama',
    []
  )
}

export async function hitungRencanaBelanja(persenTarget: number) {
  const persen = Math.max(1, Math.min(100, toInt(persenTarget)))
  const rows = await query<RencanaHitungRow>(`
    SELECT uk.id AS katalog_id, uk.nama_kitab, uk.marhalah_id, uk.stok_lama, uk.stok_baru, uk.harga_beli,
           m.nama AS marhalah_nama, COUNT(DISTINCT s.id) AS jumlah_santri
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    LEFT JOIN kelas k ON k.marhalah_id = uk.marhalah_id
    LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    WHERE uk.is_active = 1
    GROUP BY uk.id
    ORDER BY m.urutan, uk.nama_kitab
  `, [])

  return rows.map((row) => {
    const jumlahSantri = toInt(row.jumlah_santri)
    const stokLama = toInt(row.stok_lama)
    const target = Math.ceil(jumlahSantri * persen / 100)
    const saranQty = Math.max(0, target - stokLama)
    return {
      katalog_id: row.katalog_id,
      nama_kitab: row.nama_kitab,
      marhalah_id: row.marhalah_id,
      marhalah_nama: row.marhalah_nama,
      jumlah_santri: jumlahSantri,
      stok_lama: stokLama,
      stok_baru: toInt(row.stok_baru),
      persen_target: persen,
      saran_qty: saranQty,
      qty_rencana: saranQty,
      harga_beli: toInt(row.harga_beli),
      subtotal: saranQty * toInt(row.harga_beli),
    }
  })
}

export async function simpanRencanaBelanja(payload: {
  nama: string
  persenTarget: number
  catatan?: string
  items: RencanaPayloadItem[]
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const items = payload.items.filter(item => toInt(item.qtyRencana) > 0)
  if (!items.length) return { error: 'Tidak ada item rencana yang qty-nya lebih dari 0.' }

  const id = generateId()
  const persen = Math.max(1, Math.min(100, toInt(payload.persenTarget)))
  await execute(`
    INSERT INTO upk_rencana_belanja
      (id, tanggal, nama, persen_target, status, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)
  `, [id, today(), payload.nama.trim() || `Rencana ${today()}`, persen, payload.catatan?.trim() || null, session?.id ?? null, now(), now()])

  for (const item of items) {
    const qty = Math.max(0, toInt(item.qtyRencana))
    const harga = Math.max(0, toInt(item.hargaBeli))
    await execute(`
      INSERT INTO upk_rencana_belanja_item
        (id, rencana_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama,
         jumlah_santri, stok_lama, stok_baru, persen_target, saran_qty, qty_rencana,
         harga_beli, subtotal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [generateId(), id, item.katalogId, item.namaKitab, item.marhalahId, item.marhalahNama,
        toInt(item.jumlahSantri), toInt(item.stokLama), toInt(item.stokBaru), persen,
        toInt(item.saranQty), qty, harga, qty * harga, now(), now()])
  }

  revalidatePath(BELANJA_PATH)
  return { success: true }
}

export async function getRencanaList() {
  return query<RencanaListRow>(`
    SELECT r.*, COUNT(i.id) AS total_item, COALESCE(SUM(i.subtotal), 0) AS total_estimasi
    FROM upk_rencana_belanja r
    LEFT JOIN upk_rencana_belanja_item i ON i.rencana_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 20
  `, [])
}

export async function simpanBelanja(payload: {
  tanggal: string
  jenis: 'AWAL' | 'TAMBAHAN'
  tokoId: number | null
  tokoNama?: string | null
  dibayar: number
  catatan?: string
  items: BelanjaPayloadItem[]
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const items = payload.items.filter(item => toInt(item.qty) > 0)
  if (!items.length) return { error: 'Pilih minimal satu kitab yang dibeli.' }

  const toko = payload.tokoId
    ? await queryOne<{ id: number; nama: string }>('SELECT id, nama FROM upk_toko WHERE id = ?', [payload.tokoId])
    : null
  const total = items.reduce((sum, item) => sum + toInt(item.qty) * toInt(item.hargaBeli), 0)
  const dibayar = Math.max(0, Math.min(total, toInt(payload.dibayar)))
  const sisaHutang = Math.max(0, total - dibayar)
  const status = statusPembayaran(total, dibayar)
  const belanjaId = generateId()
  const tanggal = payload.tanggal || today()

  await execute(`
    INSERT INTO upk_belanja
      (id, tanggal, jenis, toko_id, toko_nama, status_pembayaran, total, dibayar, sisa_hutang, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [belanjaId, tanggal, payload.jenis, toko?.id ?? null, toko?.nama ?? payload.tokoNama ?? null, status, total, dibayar, sisaHutang, payload.catatan?.trim() || null, session?.id ?? null, now(), now()])

  for (const item of items) {
    const qty = Math.max(0, toInt(item.qty))
    const harga = Math.max(0, toInt(item.hargaBeli))
    await execute(`
      INSERT INTO upk_belanja_item
        (id, belanja_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty, harga_beli, subtotal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [generateId(), belanjaId, item.katalogId, item.namaKitab, item.marhalahId, item.marhalahNama, qty, harga, qty * harga, now(), now()])

    await execute(`
      UPDATE upk_katalog
      SET stok_baru = stok_baru + ?, harga_beli = ?, toko_id = COALESCE(?, toko_id),
          stok_updated_at = ?, updated_at = ?
      WHERE id = ?
    `, [qty, harga, toko?.id ?? null, now(), now(), item.katalogId])
  }

  revalidatePath(BELANJA_PATH)
  revalidatePath('/dashboard/akademik/upk/katalog')
  return { success: true }
}

export async function getBelanjaList() {
  return query<BelanjaListRow>(`
    SELECT b.*, COUNT(i.id) AS total_item
    FROM upk_belanja b
    LEFT JOIN upk_belanja_item i ON i.belanja_id = b.id
    GROUP BY b.id
    ORDER BY b.tanggal DESC, b.created_at DESC
    LIMIT 50
  `, [])
}

export async function getHutangBelanja() {
  return query<HutangBelanjaRow>(`
    SELECT *
    FROM upk_belanja
    WHERE sisa_hutang > 0
    ORDER BY tanggal ASC, created_at ASC
  `, [])
}

export async function bayarHutangBelanja(id: string, nominal: number): Promise<{ success: true } | { error: string }> {
  const row = await queryOne<{ id: string; total: number; dibayar: number; sisa_hutang: number }>('SELECT * FROM upk_belanja WHERE id = ?', [id])
  if (!row) return { error: 'Data belanja tidak ditemukan.' }

  const bayar = Math.max(0, toInt(nominal))
  if (bayar <= 0) return { error: 'Nominal bayar harus lebih dari 0.' }
  const dibayarBaru = Math.min(row.total, row.dibayar + bayar)
  const sisaBaru = Math.max(0, row.total - dibayarBaru)
  await execute(
    'UPDATE upk_belanja SET dibayar = ?, sisa_hutang = ?, status_pembayaran = ?, updated_at = ? WHERE id = ?',
    [dibayarBaru, sisaBaru, statusPembayaran(row.total, dibayarBaru), now(), id]
  )

  revalidatePath(BELANJA_PATH)
  return { success: true }
}
