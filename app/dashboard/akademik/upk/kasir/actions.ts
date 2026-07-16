'use server'

import { execute, generateId, getDB, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { toInt } from '@/lib/upk-utils'
import { revalidatePath } from 'next/cache'

const KASIR_PATH = '/dashboard/akademik/upk/kasir'
type UnitUPK = 'PUTRA' | 'PUTRI'
type JenisTransaksiUPK = 'PENJUALAN' | 'GRATIS_SANTRI' | 'GRATIS_GURU'

type CartItemPayload = {
  katalogId: number
  namaKitab: string
  marhalahId: number | null
  marhalahNama: string | null
  qty: number
  hargaBeli?: number
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
  prioritas_stok?: string | null
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
  harga_beli: number
  harga_jual: number
  is_active: number
  marhalah_nama: string | null
  is_default_flag: number
  linked_flag: number
  toko_nama: string | null
}

type GuruKasirRow = {
  id: number
  nama_lengkap: string
  gelar: string | null
  kode_guru: string | null
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
  jenis_transaksi?: JenisTransaksiUPK
  penerima_type?: string
  guru_id?: number | null
  harga_modal_total?: number
  pengeluaran_id?: string | null
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
  harga_modal?: number
  modal_subtotal?: number
  status_serah: string
  masuk_pesanan: number
  stok_lama: number | null
  stok_baru: number | null
}

function genderFromUnit(unit: UnitUPK) {
  return unit === 'PUTRA' ? 'L' : 'P'
}

async function hasColumn(table: string, column: string) {
  const columns = await query<{ name: string }>(`PRAGMA table_info(${table})`)
  return columns.some((row) => row.name === column)
}

async function kurangiStokDenganTipe(
  katalogId: number,
  qty: number,
  meta: { antrianId: string; itemId: string; unit: UnitUPK; tipe: string; catatan: string }
) {
  if (qty <= 0) return
  const hasPrioritasStok = await hasColumn('upk_katalog', 'prioritas_stok')
  const db = await getDB()

  let dariLama = 0
  let dariBaru = 0
  const MAX_ATTEMPTS = 3

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const stok = await queryOne<StockRow>(
      `SELECT stok_lama, stok_baru${hasPrioritasStok ? ', prioritas_stok' : ''} FROM upk_katalog WHERE id = ?`,
      [katalogId]
    )
    if (!stok) return

    if (hasPrioritasStok && stok.prioritas_stok === 'BARU') {
      dariBaru = Math.min(stok.stok_baru || 0, qty)
      const sisa = qty - dariBaru
      dariLama = Math.min(stok.stok_lama || 0, sisa)
    } else {
      dariLama = Math.min(stok.stok_lama || 0, qty)
      const sisa = qty - dariLama
      dariBaru = Math.min(stok.stok_baru || 0, sisa)
    }

    // Optimistic lock: hanya commit kalau stok belum berubah sejak dibaca (cegah lost update saat 2 transaksi bersamaan)
    const result = await db.prepare(
      'UPDATE upk_katalog SET stok_lama = stok_lama - ?, stok_baru = stok_baru - ?, stok_updated_at = ?, updated_at = ? WHERE id = ? AND stok_lama = ? AND stok_baru = ?'
    ).bind(dariLama, dariBaru, now(), now(), katalogId, stok.stok_lama || 0, stok.stok_baru || 0).run()

    if (result.meta?.changes) break
    if (attempt === MAX_ATTEMPTS - 1) {
      // fallback: tetap kurangi stok walau lock gagal terus, lebih baik dari diam-diam tidak mengurangi sama sekali
      await execute(
        'UPDATE upk_katalog SET stok_lama = stok_lama - ?, stok_baru = stok_baru - ?, stok_updated_at = ?, updated_at = ? WHERE id = ?',
        [dariLama, dariBaru, now(), now(), katalogId]
      )
    }
  }

  await execute(`
    INSERT INTO upk_stok_mutasi
      (id, katalog_id, antrian_id, antrian_item_id, tanggal, unit, tipe, qty_lama, qty_baru, total_qty, catatan, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [generateId(), katalogId, meta.antrianId, meta.itemId, today(), meta.unit, meta.tipe, dariLama, dariBaru, dariLama + dariBaru, meta.catatan, (await getSession())?.id ?? null, now()])
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

export async function cariGuruUPK(keyword: string) {
  const trimmed = keyword.trim()
  if (trimmed.length < 2) return []

  return query<GuruKasirRow>(`
    SELECT id, nama_lengkap, gelar, kode_guru
    FROM data_guru
    WHERE nama_lengkap LIKE ? OR kode_guru LIKE ?
    ORDER BY nama_lengkap
    LIMIT 12
  `, [`%${trimmed}%`, `%${trimmed}%`])
}

export async function getKatalogKasir(marhalahId?: number | null) {
  const target = marhalahId ?? -1
  const rows = await query<KatalogKasirRow>(`
    SELECT uk.id, uk.nama_kitab, uk.stok_lama, uk.stok_baru,
           uk.harga_beli, uk.harga_jual, uk.is_active,
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
    harga_beli: row.harga_beli,
    harga_jual: row.harga_jual,
    toko_nama: row.toko_nama,
    jumlah_stok: (row.stok_lama || 0) + (row.stok_baru || 0),
    is_default: marhalahId ? !!row.is_default_flag : false,
    is_marhalah: marhalahId ? !!row.linked_flag : true,
  }))
}

export async function buatTransaksiGratisUPK(payload: {
  unit: UnitUPK
  jenis: 'GRATIS_SANTRI' | 'GRATIS_GURU'
  santri?: {
    id: string
    nis: string
    nama_lengkap: string
    kelas_id: string | null
    nama_kelas: string | null
    marhalah_id: number | null
    marhalah_nama: string | null
  } | null
  guru?: {
    id: number
    nama_lengkap: string
    gelar: string | null
    kode_guru: string | null
  } | null
  items: CartItemPayload[]
  catatan?: string
}): Promise<{ success: true; id: string; nomor: number } | { error: string }> {
  const session = await getSession()
  if (payload.jenis === 'GRATIS_SANTRI' && !payload.santri?.id) return { error: 'Pilih santri dulu.' }
  if (payload.jenis === 'GRATIS_GURU' && !payload.guru?.id) return { error: 'Pilih guru dulu.' }
  const items = payload.items.filter(item => toInt(item.qty) > 0)
  if (!items.length) return { error: 'Pilih minimal satu kitab.' }

  const tanggal = today()
  const maxRow = await queryOne<{ nomor: number }>(
    'SELECT MAX(nomor) AS nomor FROM upk_antrian WHERE tanggal = ? AND unit = ?',
    [tanggal, payload.unit]
  )
  const nomor = (maxRow?.nomor || 0) + 1
  const antrianId = generateId()
  const penerimaNama = payload.jenis === 'GRATIS_GURU'
    ? payload.guru?.nama_lengkap || 'Guru'
    : payload.santri?.nama_lengkap || 'Santri'
  const modalTotal = items.reduce((sum, item) => {
    const qty = toInt(item.qty)
    const modal = Math.max(0, toInt(item.hargaBeli))
    return sum + qty * modal
  }, 0)

  const pengeluaranId = generateId()
  await execute(`
    INSERT INTO upk_pengeluaran
      (id, tanggal, waktu_catat, kategori, penerima, nominal, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'KITAB_GRATIS', ?, ?, ?, ?, ?, ?)
  `, [
    pengeluaranId, tanggal, now(), penerimaNama, modalTotal,
    `${payload.jenis === 'GRATIS_GURU' ? 'Kitab gratis guru' : 'Kitab gratis santri'} - transaksi ${String(nomor).padStart(3, '0')}${payload.catatan?.trim() ? `: ${payload.catatan.trim()}` : ''}`,
    session?.id ?? null, now(), now(),
  ])

  await execute(`
    INSERT INTO upk_antrian
      (id, tanggal, nomor, unit, santri_id, nis, nama_santri, kelas_id, kelas_nama,
       marhalah_id, marhalah_nama, total_tagihan, total_bayar, status, catatan,
       created_by, cashier_by, paid_at, updated_at, jenis_transaksi, penerima_type, guru_id,
       harga_modal_total, pengeluaran_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'SELESAI', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    antrianId, tanggal, nomor, payload.unit,
    payload.santri?.id ?? null,
    payload.santri?.nis ?? payload.guru?.kode_guru ?? null,
    penerimaNama,
    payload.santri?.kelas_id ?? null,
    payload.santri?.nama_kelas ?? null,
    payload.santri?.marhalah_id ?? null,
    payload.santri?.marhalah_nama ?? null,
    payload.catatan?.trim() || null,
    session?.id ?? null,
    session?.id ?? null,
    now(),
    now(),
    payload.jenis,
    payload.jenis === 'GRATIS_GURU' ? 'GURU' : 'SANTRI',
    payload.guru?.id ?? null,
    modalTotal,
    pengeluaranId,
    now(),
  ])

  for (const item of items) {
    const qty = toInt(item.qty)
    const hargaModal = Math.max(0, toInt(item.hargaBeli))
    const stok = await queryOne<StockRow>('SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?', [item.katalogId])
    const tersedia = (stok?.stok_lama || 0) + (stok?.stok_baru || 0)
    const masukPesanan = tersedia < qty
    const itemId = generateId()

    await execute(`
      INSERT INTO upk_antrian_item
        (id, antrian_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty,
         harga_jual, subtotal, harga_modal, modal_subtotal, status_serah, masuk_pesanan,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)
    `, [
      itemId, antrianId, item.katalogId, item.namaKitab, item.marhalahId, item.marhalahNama,
      qty, hargaModal, qty * hargaModal, masukPesanan ? 'BELUM' : 'SUDAH', masukPesanan ? 1 : 0,
      now(), now(),
    ])

    if (!masukPesanan) {
      await kurangiStokDenganTipe(item.katalogId, qty, {
        antrianId,
        itemId,
        unit: payload.unit,
        tipe: 'KITAB_GRATIS',
        catatan: `${payload.jenis === 'GRATIS_GURU' ? 'Kitab gratis guru' : 'Kitab gratis santri'} ${String(nomor).padStart(3, '0')}`,
      })
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_kasir',
    action: 'free_transaction',
    fiturHref: '/dashboard/akademik/upk/kasir',
    logKind: 'create',
    entityType: 'upk_antrian',
    entityId: antrianId,
    entityLabel: penerimaNama,
    summary: `Mencatat kitab gratis UPK untuk ${penerimaNama}`,
    details: {
      nomor,
      unit: payload.unit,
      jenis: payload.jenis,
      total_item: items.length,
      harga_modal_total: modalTotal,
      pengeluaran_id: pengeluaranId,
    },
  })

  revalidatePath(KASIR_PATH)
  revalidatePath('/dashboard/akademik/upk/riwayat')
  revalidatePath('/dashboard/akademik/upk/pengeluaran')
  return { success: true, id: antrianId, nomor }
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
  const items = payload.items.filter(item => toInt(item.qty) > 0)
  if (!items.length) return { error: 'Pilih minimal satu kitab.' }

  const tanggal = today()
  const maxRow = await queryOne<{ nomor: number }>(
    'SELECT MAX(nomor) AS nomor FROM upk_antrian WHERE tanggal = ? AND unit = ?',
    [tanggal, payload.unit]
  )
  const nomor = (maxRow?.nomor || 0) + 1
  const antrianId = generateId()
  const totalTagihan = items.reduce((sum, item) => sum + (toInt(item.qty) * Math.max(0, toInt(item.hargaJual))), 0)

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

  for (const item of items) {
    const qty = toInt(item.qty)
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
      total_item: items.length,
      total_tagihan: totalTagihan,
    },
  })

  revalidatePath(KASIR_PATH)
  return { success: true, id: antrianId, nomor }
}

export async function getAntrianAktif(unit: UnitUPK, search = '', tanggal = '') {
  const params: unknown[] = [unit]
  let where = 'WHERE a.unit = ? AND a.status = \'ANTRIAN\''
  if (/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    where += ' AND a.tanggal = ?'
    params.push(tanggal)
  }
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
    ORDER BY a.tanggal DESC, a.nomor ASC
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
      await kurangiStokDenganTipe(row.katalog_id, qty, {
        antrianId: payload.antrianId,
        itemId: row.id,
        unit: payload.unit,
        tipe: 'PENJUALAN',
        catatan: `Penjualan antrian ${String(antrian.nomor).padStart(3, '0')}`,
      })
    }
  }

  const totalBayar = Math.max(0, toInt(payload.totalBayar))
  const diff = totalBayar - totalTagihan
  const sisaKembalian = diff > 0 && payload.kembalianDitahan ? diff : 0
  const sisaTunggakan = diff < 0 ? Math.abs(diff) : 0
  const actualBayar = diff > 0 && !payload.kembalianDitahan ? totalTagihan : totalBayar

  await execute(`
    UPDATE upk_antrian
    SET total_tagihan = ?, total_bayar = ?, sisa_kembalian = ?, kembalian_ditahan = ?,
        sisa_tunggakan = ?, status = 'SELESAI', cashier_by = ?, paid_at = ?, updated_at = ?
    WHERE id = ?
  `, [totalTagihan, actualBayar, sisaKembalian, payload.kembalianDitahan ? 1 : 0,
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
      total_bayar: actualBayar,
      sisa_tunggakan: sisaTunggakan,
      sisa_kembalian: sisaKembalian,
      kembalian_ditahan: payload.kembalianDitahan,
    },
  })

  revalidatePath(KASIR_PATH)
  revalidatePath('/dashboard/akademik/upk/pesanan')
  return { success: true }
}

export async function batalkanAntrianUPK(antrianId: string): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const antrian = await queryOne<AntrianRow>('SELECT * FROM upk_antrian WHERE id = ?', [antrianId])
  if (!antrian) return { error: 'Antrian tidak ditemukan.' }
  if (antrian.status !== 'ANTRIAN') return { error: 'Hanya antrian yang belum diproses yang bisa dibatalkan.' }

  await execute(`
    UPDATE upk_antrian_item
    SET qty = 0, subtotal = 0, status_serah = 'BATAL', masuk_pesanan = 0, updated_at = ?
    WHERE antrian_id = ?
  `, [now(), antrianId])

  await execute(`
    UPDATE upk_antrian
    SET status = 'BATAL', updated_at = ?
    WHERE id = ?
  `, [now(), antrianId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_kasir',
    action: 'cancel',
    fiturHref: '/dashboard/akademik/upk/kasir',
    logKind: 'update',
    entityType: 'upk_antrian',
    entityId: antrianId,
    entityLabel: antrian.nama_santri,
    summary: `Membatalkan antrian UPK ${String(antrian.nomor).padStart(3, '0')}`,
    details: {
      unit: antrian.unit,
    },
  })

  revalidatePath(KASIR_PATH)
  revalidatePath('/dashboard/akademik/upk/pesanan')
  return { success: true }
}
