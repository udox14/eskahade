'use server'

import { execute, generateId, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

const KASIR_PATH = '/dashboard/akademik/upk/kasir'
type UnitUPK = 'PUTRA' | 'PUTRI'

type CartItemPayload = {
  katalogId: number
  namaKitab: string
  marhalahId: number | null
  marhalahNama: string | null
  qty: number
  hargaJual: number
}

type FinalItemPayload = {
  itemId: string
  qty: number
  diserahkan: boolean
}

type StockRow = {
  stok_lama: number
  stok_baru: number
}

type SantriKasirRow = {
  id: string
  nis: string
  nama_lengkap: string
  jenis_kelamin: string
  asrama: string | null
  kamar: string | null
  kelas_id: string | null
  nama_kelas: string | null
  marhalah_id: number | null
  marhalah_nama: string | null
}

type KatalogKasirRow = {
  id: number
  nama_kitab: string
  stok_lama: number
  stok_baru: number
  harga_jual: number
  is_active: number
  marhalah_nama: string | null
  is_default_flag: number
  linked_flag: number
  toko_nama: string | null
}

type AntrianRow = {
  id: string
  tanggal: string
  nomor: number
  unit: UnitUPK
  santri_id: string | null
  nis: string | null
  nama_santri: string
  kelas_id: string | null
  kelas_nama: string | null
  marhalah_id: number | null
  marhalah_nama: string | null
  total_tagihan: number
  total_bayar: number
  sisa_kembalian: number
  kembalian_ditahan: number
  sisa_tunggakan: number
  status: string
  catatan: string | null
}

type AntrianListRow = AntrianRow & {
  total_item: number
}

type AntrianItemRow = {
  id: string
  antrian_id: string
  katalog_id: number | null
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  qty: number
  harga_jual: number
  subtotal: number
  status_serah: string
  masuk_pesanan: number
  stok_lama: number | null
  stok_baru: number | null
}

function genderFromUnit(unit: UnitUPK) {
  return unit === 'PUTRA' ? 'L' : 'P'
}

function toInt(value: unknown) {
  const parsed = parseInt(String(value ?? '0'), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

async function kurangiStok(katalogId: number, qty: number, meta: { antrianId: string; itemId: string; unit: UnitUPK; catatan: string }) {
  if (qty <= 0) return
  const stok = await queryOne<StockRow>('SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?', [katalogId])
  if (!stok) return

  const dariLama = Math.min(stok.stok_lama || 0, qty)
  const sisa = qty - dariLama
  const dariBaru = Math.min(stok.stok_baru || 0, sisa)

  await execute(
    'UPDATE upk_katalog SET stok_lama = stok_lama - ?, stok_baru = stok_baru - ?, stok_updated_at = ?, updated_at = ? WHERE id = ?',
    [dariLama, dariBaru, now(), now(), katalogId]
  )

  await execute(`
    INSERT INTO upk_stok_mutasi
      (id, katalog_id, antrian_id, antrian_item_id, tanggal, unit, tipe, qty_lama, qty_baru, total_qty, catatan, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENJUALAN', ?, ?, ?, ?, ?, ?)
  `, [generateId(), katalogId, meta.antrianId, meta.itemId, today(), meta.unit, dariLama, dariBaru, dariLama + dariBaru, meta.catatan, (await getSession())?.id ?? null, now()])
}

export async function cariSantriUPK(unit: UnitUPK, keyword: string) {
  const trimmed = keyword.trim()
  if (trimmed.length < 2) return []

  return query<SantriKasirRow>(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.asrama, s.kamar,
           k.id AS kelas_id, k.nama_kelas, k.marhalah_id,
           m.nama AS marhalah_nama
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE s.status_global = 'aktif'
      AND s.jenis_kelamin = ?
      AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
    ORDER BY s.nama_lengkap
    LIMIT 12
  `, [genderFromUnit(unit), `%${trimmed}%`, `%${trimmed}%`])
}

export async function getKatalogKasir(marhalahId?: number | null) {
  const target = marhalahId ?? -1
  const rows = await query<KatalogKasirRow>(`
    SELECT uk.id, uk.nama_kitab, uk.stok_lama, uk.stok_baru,
           uk.harga_jual, uk.is_active,
           t.nama AS toko_nama,
           GROUP_CONCAT(DISTINCT m.nama) AS marhalah_nama,
           MAX(CASE WHEN km.marhalah_id = ? THEN km.is_default ELSE 0 END) AS is_default_flag,
           MAX(CASE WHEN km.marhalah_id = ? THEN 1 ELSE 0 END) AS linked_flag
    FROM upk_katalog uk
    LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id
    LEFT JOIN marhalah m ON m.id = km.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    WHERE uk.is_active = 1
    GROUP BY uk.id
    ORDER BY linked_flag DESC, uk.nama_kitab
  `, [target, target])

  return rows.map((row) => ({
    id: row.id,
    nama_kitab: row.nama_kitab,
    marhalah_id: marhalahId ?? null,
    marhalah_nama: row.marhalah_nama,
    harga_jual: row.harga_jual,
    toko_nama: row.toko_nama,
    jumlah_stok: (row.stok_lama || 0) + (row.stok_baru || 0),
    is_default: marhalahId ? !!row.is_default_flag : false,
    is_marhalah: marhalahId ? !!row.linked_flag : true,
  }))
}

export async function buatAntrianUPK(payload: {
  unit: UnitUPK
  santri: {
    id: string
    nis: string
    nama_lengkap: string
    kelas_id: string | null
    nama_kelas: string | null
    marhalah_id: number | null
    marhalah_nama: string | null
  }
  items: CartItemPayload[]
  catatan?: string
}): Promise<{ success: true; id: string; nomor: number } | { error: string }> {
  const session = await getSession()
  if (!payload.santri?.id) return { error: 'Pilih santri dulu.' }
  if (!payload.items.length) return { error: 'Pilih minimal satu kitab.' }

  const tanggal = today()
  const maxRow = await queryOne<{ nomor: number }>(
    'SELECT MAX(nomor) AS nomor FROM upk_antrian WHERE tanggal = ? AND unit = ?',
    [tanggal, payload.unit]
  )
  const nomor = (maxRow?.nomor || 0) + 1
  const antrianId = generateId()
  const totalTagihan = payload.items.reduce((sum, item) => sum + (Math.max(1, toInt(item.qty)) * Math.max(0, toInt(item.hargaJual))), 0)

  await execute(`
    INSERT INTO upk_antrian
      (id, tanggal, nomor, unit, santri_id, nis, nama_santri, kelas_id, kelas_nama,
       marhalah_id, marhalah_nama, total_tagihan, status, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ANTRIAN', ?, ?, ?, ?)
  `, [
    antrianId, tanggal, nomor, payload.unit, payload.santri.id, payload.santri.nis,
    payload.santri.nama_lengkap, payload.santri.kelas_id, payload.santri.nama_kelas,
    payload.santri.marhalah_id, payload.santri.marhalah_nama, totalTagihan,
    payload.catatan?.trim() || null, session?.id ?? null, now(), now(),
  ])

  for (const item of payload.items) {
    const qty = Math.max(1, toInt(item.qty))
    const harga = Math.max(0, toInt(item.hargaJual))
    const stok = await queryOne<StockRow>('SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?', [item.katalogId])
    const tersedia = (stok?.stok_lama || 0) + (stok?.stok_baru || 0)
    const masukPesanan = tersedia <= 0

    await execute(`
      INSERT INTO upk_antrian_item
        (id, antrian_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty, harga_jual, subtotal, status_serah, masuk_pesanan, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateId(), antrianId, item.katalogId, item.namaKitab, item.marhalahId, item.marhalahNama,
      qty, harga, qty * harga, masukPesanan ? 'BELUM' : 'SUDAH', masukPesanan ? 1 : 0, now(), now(),
    ])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_kasir',
    action: 'create',
    fiturHref: '/dashboard/akademik/upk/kasir',
    logKind: 'create',
    entityType: 'upk_antrian',
    entityId: antrianId,
    entityLabel: payload.santri.nama_lengkap,
    summary: `Membuat antrian UPK untuk ${payload.santri.nama_lengkap}`,
    details: {
      nomor,
      unit: payload.unit,
      total_item: payload.items.length,
      total_tagihan: totalTagihan,
    },
  })

  revalidatePath(KASIR_PATH)
  return { success: true, id: antrianId, nomor }
}

export async function getAntrianAktif(unit: UnitUPK, search = '') {
  const params: unknown[] = [today(), unit]
  let where = 'WHERE a.tanggal = ? AND a.unit = ? AND a.status = \'ANTRIAN\''
  if (search.trim()) {
    where += ' AND (a.nama_santri LIKE ? OR a.nis LIKE ? OR CAST(a.nomor AS TEXT) LIKE ?)'
    const like = `%${search.trim()}%`
    params.push(like, like, like)
  }

  const rows = await query<AntrianListRow>(`
    SELECT a.*, COUNT(ai.id) AS total_item
    FROM upk_antrian a
    LEFT JOIN upk_antrian_item ai ON ai.antrian_id = a.id
    ${where}
    GROUP BY a.id
    ORDER BY a.nomor ASC
    LIMIT 50
  `, params)
  return rows
}

export async function getAntrianDetail(id: string) {
  const antrian = await queryOne<AntrianRow>('SELECT * FROM upk_antrian WHERE id = ?', [id])
  if (!antrian) return null
  const items = await query<AntrianItemRow>(`
    SELECT ai.*, uk.stok_lama, uk.stok_baru
    FROM upk_antrian_item ai
    LEFT JOIN upk_katalog uk ON uk.id = ai.katalog_id
    WHERE ai.antrian_id = ?
    ORDER BY ai.nama_kitab
  `, [id])
  return {
    ...antrian,
    items: items.map((item) => ({
      ...item,
      jumlah_stok: (item.stok_lama || 0) + (item.stok_baru || 0),
    })),
  }
}

export async function selesaikanAntrianUPK(payload: {
  antrianId: string
  unit: UnitUPK
  totalBayar: number
  kembalianDitahan: boolean
  items: FinalItemPayload[]
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const antrian = await queryOne<AntrianRow>('SELECT * FROM upk_antrian WHERE id = ?', [payload.antrianId])
  if (!antrian) return { error: 'Antrian tidak ditemukan.' }
  if (antrian.status !== 'ANTRIAN') return { error: 'Antrian ini sudah diproses.' }

  const itemRows = await query<AntrianItemRow>('SELECT * FROM upk_antrian_item WHERE antrian_id = ?', [payload.antrianId])
  const finalById = new Map(payload.items.map(item => [item.itemId, item]))
  let totalTagihan = 0

  for (const row of itemRows) {
    const final = finalById.get(row.id)
    const qty = Math.max(0, toInt(final?.qty ?? row.qty))
    let diserahkan = final?.diserahkan ?? row.status_serah !== 'BELUM'

    // qty 0 = item dibatalkan
    if (qty === 0) {
      await execute(`
        UPDATE upk_antrian_item
        SET qty = 0, subtotal = 0, status_serah = 'BATAL', masuk_pesanan = 0, updated_at = ?
        WHERE id = ?
      `, [now(), row.id])
      continue
    }

    const subtotal = qty * toInt(row.harga_jual)
    totalTagihan += subtotal

    if (diserahkan && row.katalog_id) {
      const stok = await queryOne<StockRow>('SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?', [row.katalog_id])
      const tersedia = (stok?.stok_lama || 0) + (stok?.stok_baru || 0)
      if (tersedia < qty) diserahkan = false
    }

    await execute(`
      UPDATE upk_antrian_item
      SET qty = ?, subtotal = ?, status_serah = ?, masuk_pesanan = ?, updated_at = ?
      WHERE id = ?
    `, [qty, subtotal, diserahkan ? 'SUDAH' : 'BELUM', diserahkan ? 0 : 1, now(), row.id])

    if (diserahkan && row.katalog_id) {
      await kurangiStok(row.katalog_id, qty, {
        antrianId: payload.antrianId,
        itemId: row.id,
        unit: payload.unit,
        catatan: `Penjualan antrian ${String(antrian.nomor).padStart(3, '0')}`,
      })
    }
  }

  const totalBayar = Math.max(0, toInt(payload.totalBayar))
  const diff = totalBayar - totalTagihan
  const sisaKembalian = diff > 0 && payload.kembalianDitahan ? diff : 0
  const sisaTunggakan = diff < 0 ? Math.abs(diff) : 0

  await execute(`
    UPDATE upk_antrian
    SET total_tagihan = ?, total_bayar = ?, sisa_kembalian = ?, kembalian_ditahan = ?,
        sisa_tunggakan = ?, status = 'SELESAI', cashier_by = ?, paid_at = ?, updated_at = ?
    WHERE id = ?
  `, [totalTagihan, totalBayar, sisaKembalian, payload.kembalianDitahan ? 1 : 0,
      sisaTunggakan, session?.id ?? null, now(), now(), payload.antrianId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_kasir',
    action: 'payment',
    fiturHref: '/dashboard/akademik/upk/kasir',
    logKind: 'update',
    entityType: 'upk_antrian',
    entityId: payload.antrianId,
    entityLabel: antrian.nama_santri,
    summary: `Menyelesaikan antrian UPK ${String(antrian.nomor).padStart(3, '0')}`,
    details: {
      unit: payload.unit,
      total_item: itemRows.length,
      total_tagihan: totalTagihan,
      total_bayar: totalBayar,
      sisa_tunggakan: sisaTunggakan,
      sisa_kembalian: sisaKembalian,
      kembalian_ditahan: payload.kembalianDitahan,
    },
  })

  revalidatePath(KASIR_PATH)
  revalidatePath('/dashboard/akademik/upk/pesanan')
  return { success: true }
}
