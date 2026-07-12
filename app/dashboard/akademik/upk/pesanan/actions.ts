'use server'

import { execute, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { toInt } from '@/lib/upk-utils'
import { kurangiStokDenganTipe } from '@/lib/upk-stok'
import { revalidatePath } from 'next/cache'

const PESANAN_PATH = '/dashboard/akademik/upk/pesanan'
const KASIR_PATH = '/dashboard/akademik/upk/kasir'
const KATALOG_PATH = '/dashboard/akademik/upk/katalog'

type UnitUPK = 'PUTRA' | 'PUTRI'

type SantriAggRow = {
  santri_id: string
  nis: string | null
  nama_santri: string
  unit: UnitUPK
  kelas_nama: string | null
  marhalah_nama: string | null
  jml_kitab: number
  jml_item: number
  jml_nota: number
  total_nilai: number
  total_tunggakan: number
  total_kembalian: number
}

type AntrianRow = {
  id: string
  tanggal: string
  nomor: number
  unit: UnitUPK
  santri_id: string | null
  nama_santri: string
  total_tagihan: number
  total_bayar: number
  sisa_kembalian: number
  kembalian_ditahan: number
  sisa_tunggakan: number
  status: string
}

type ItemRow = {
  id: string
  antrian_id: string
  katalog_id: number | null
  nama_kitab: string
  qty: number
  harga_jual: number
  subtotal: number
  status_serah: string
  masuk_pesanan: number
  stok_lama: number | null
  stok_baru: number | null
}

type StockRow = { stok_lama: number; stok_baru: number }

function likeParam(value: string) {
  return `%${value.trim()}%`
}

function unitSearchClause(unit: '' | UnitUPK, search: string, params: unknown[]) {
  const conditions: string[] = []
  if (unit) {
    conditions.push('a.unit = ?')
    params.push(unit)
  }
  if (search.trim()) {
    conditions.push('(a.nama_santri LIKE ? OR a.nis LIKE ?)')
    const like = likeParam(search)
    params.push(like, like)
  }
  return conditions.length ? ` AND ${conditions.join(' AND ')}` : ''
}

// ── Tab 1: santri dengan kitab belum diserahkan (pesanan / stok habis) ──
export async function getPesananBelumSerah(unit: '' | UnitUPK = '', search = '') {
  const params: unknown[] = []
  const extra = unitSearchClause(unit, search, params)
  const rows = await query<SantriAggRow>(`
    SELECT a.santri_id, a.nis, a.nama_santri, a.unit,
           MAX(a.kelas_nama) AS kelas_nama, MAX(a.marhalah_nama) AS marhalah_nama,
           SUM(ai.qty) AS jml_kitab, COUNT(ai.id) AS jml_item,
           SUM(ai.subtotal) AS total_nilai
    FROM upk_antrian a
    JOIN upk_antrian_item ai ON ai.antrian_id = a.id
    WHERE a.status = 'SELESAI' AND a.santri_id IS NOT NULL
      AND ai.status_serah = 'BELUM' AND ai.qty > 0${extra}
    GROUP BY a.santri_id
    ORDER BY a.nama_santri
  `, params)
  return rows.map(mapAgg)
}

// ── Tab 2: santri dengan tunggakan ──
export async function getTunggakanSantri(unit: '' | UnitUPK = '', search = '') {
  const params: unknown[] = []
  const extra = unitSearchClause(unit, search, params)
  const rows = await query<SantriAggRow>(`
    SELECT a.santri_id, a.nis, a.nama_santri, a.unit,
           MAX(a.kelas_nama) AS kelas_nama, MAX(a.marhalah_nama) AS marhalah_nama,
           COUNT(a.id) AS jml_nota, SUM(a.sisa_tunggakan) AS total_tunggakan
    FROM upk_antrian a
    WHERE a.status = 'SELESAI' AND a.santri_id IS NOT NULL
      AND a.sisa_tunggakan > 0${extra}
    GROUP BY a.santri_id
    ORDER BY total_tunggakan DESC
  `, params)
  return rows.map(mapAgg)
}

// ── Tab 3: santri dengan kembalian ditahan ──
export async function getKembalianDitahan(unit: '' | UnitUPK = '', search = '') {
  const params: unknown[] = []
  const extra = unitSearchClause(unit, search, params)
  const rows = await query<SantriAggRow>(`
    SELECT a.santri_id, a.nis, a.nama_santri, a.unit,
           MAX(a.kelas_nama) AS kelas_nama, MAX(a.marhalah_nama) AS marhalah_nama,
           COUNT(a.id) AS jml_nota, SUM(a.sisa_kembalian) AS total_kembalian
    FROM upk_antrian a
    WHERE a.status = 'SELESAI' AND a.santri_id IS NOT NULL
      AND a.kembalian_ditahan = 1 AND a.sisa_kembalian > 0${extra}
    GROUP BY a.santri_id
    ORDER BY total_kembalian DESC
  `, params)
  return rows.map(mapAgg)
}

function mapAgg(row: SantriAggRow) {
  return {
    santri_id: row.santri_id,
    nis: row.nis,
    nama_santri: row.nama_santri,
    unit: row.unit,
    kelas_nama: row.kelas_nama,
    marhalah_nama: row.marhalah_nama,
    jml_kitab: toInt(row.jml_kitab),
    jml_item: toInt(row.jml_item),
    jml_nota: toInt(row.jml_nota),
    total_nilai: toInt(row.total_nilai),
    total_tunggakan: toInt(row.total_tunggakan),
    total_kembalian: toInt(row.total_kembalian),
  }
}

// ── Detail 1 santri: semua nota SELESAI + item-nya (stok terkini) ──
export async function getDetailSantriUPK(santriId: string) {
  const antrian = await query<AntrianRow>(`
    SELECT id, tanggal, nomor, unit, santri_id, nama_santri, total_tagihan, total_bayar,
           sisa_kembalian, kembalian_ditahan, sisa_tunggakan, status
    FROM upk_antrian
    WHERE santri_id = ? AND status = 'SELESAI'
    ORDER BY tanggal DESC, nomor DESC
  `, [santriId])
  if (!antrian.length) return { antrian: [] }

  const ids = antrian.map((a) => a.id)
  const placeholders = ids.map(() => '?').join(',')
  const items = await query<ItemRow>(`
    SELECT ai.id, ai.antrian_id, ai.katalog_id, ai.nama_kitab, ai.qty, ai.harga_jual,
           ai.subtotal, ai.status_serah, ai.masuk_pesanan,
           uk.stok_lama, uk.stok_baru
    FROM upk_antrian_item ai
    LEFT JOIN upk_katalog uk ON uk.id = ai.katalog_id
    WHERE ai.antrian_id IN (${placeholders}) AND ai.qty > 0
    ORDER BY ai.nama_kitab
  `, ids)

  const itemByAntrian = new Map<string, ReturnType<typeof mapItem>[]>()
  for (const it of items) {
    const arr = itemByAntrian.get(it.antrian_id) ?? []
    arr.push(mapItem(it))
    itemByAntrian.set(it.antrian_id, arr)
  }

  return {
    antrian: antrian.map((a) => ({
      id: a.id,
      tanggal: a.tanggal,
      nomor: a.nomor,
      unit: a.unit,
      total_tagihan: toInt(a.total_tagihan),
      total_bayar: toInt(a.total_bayar),
      sisa_kembalian: toInt(a.sisa_kembalian),
      kembalian_ditahan: toInt(a.kembalian_ditahan),
      sisa_tunggakan: toInt(a.sisa_tunggakan),
      items: itemByAntrian.get(a.id) ?? [],
    })),
  }
}

function mapItem(it: ItemRow) {
  return {
    id: it.id,
    katalog_id: it.katalog_id,
    nama_kitab: it.nama_kitab,
    qty: toInt(it.qty),
    harga_jual: toInt(it.harga_jual),
    subtotal: toInt(it.subtotal),
    status_serah: it.status_serah,
    masuk_pesanan: toInt(it.masuk_pesanan),
    stok: (it.stok_lama || 0) + (it.stok_baru || 0),
  }
}

// ── Aksi: serahkan 1 item pesanan (stok berkurang, catat mutasi) ──
export async function serahkanPesanan(payload: { itemId: string }): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const item = await queryOne<ItemRow & { unit: UnitUPK; nomor: number; nama_santri: string }>(`
    SELECT ai.*, a.unit AS unit, a.nomor AS nomor, a.nama_santri AS nama_santri
    FROM upk_antrian_item ai
    JOIN upk_antrian a ON a.id = ai.antrian_id
    WHERE ai.id = ?
  `, [payload.itemId])
  if (!item) return { error: 'Item tidak ditemukan.' }
  if (item.status_serah !== 'BELUM') return { error: 'Item ini sudah diserahkan atau dibatalkan.' }

  const qty = toInt(item.qty)
  if (qty <= 0) return { error: 'Qty tidak valid.' }

  if (item.katalog_id) {
    const stok = await queryOne<StockRow>('SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?', [item.katalog_id])
    const tersedia = (stok?.stok_lama || 0) + (stok?.stok_baru || 0)
    if (tersedia < qty) return { error: `Stok belum cukup (tersedia ${tersedia}, butuh ${qty}).` }

    await kurangiStokDenganTipe(item.katalog_id, qty, {
      antrianId: item.antrian_id,
      itemId: item.id,
      unit: item.unit,
      tipe: 'PESANAN_SERAH',
      catatan: `Serah pesanan antrian ${String(item.nomor).padStart(3, '0')}`,
    })
  }

  await execute(`
    UPDATE upk_antrian_item
    SET status_serah = 'SUDAH', masuk_pesanan = 0, updated_at = ?
    WHERE id = ?
  `, [now(), payload.itemId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_pesanan',
    action: 'serah',
    fiturHref: PESANAN_PATH,
    logKind: 'update',
    entityType: 'upk_antrian_item',
    entityId: payload.itemId,
    entityLabel: item.nama_santri,
    summary: `Serah pesanan ${item.nama_kitab} - ${item.nama_santri}`,
    details: { antrian_id: item.antrian_id, nama_kitab: item.nama_kitab, qty },
  })

  revalidatePath(PESANAN_PATH)
  revalidatePath(KASIR_PATH)
  revalidatePath(KATALOG_PATH)
  return { success: true }
}

// ── Aksi: catat pelunasan tunggakan (update nota saja) ──
export async function bayarTunggakan(payload: { antrianId: string; nominal: number }): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const nominal = toInt(payload.nominal)
  if (nominal <= 0) return { error: 'Nominal harus lebih dari 0.' }

  const antrian = await queryOne<AntrianRow>('SELECT * FROM upk_antrian WHERE id = ?', [payload.antrianId])
  if (!antrian) return { error: 'Transaksi tidak ditemukan.' }
  if (antrian.status !== 'SELESAI') return { error: 'Hanya transaksi selesai yang bisa ditagih.' }
  const sisa = toInt(antrian.sisa_tunggakan)
  if (sisa <= 0) return { error: 'Transaksi ini tidak punya tunggakan.' }
  if (nominal > sisa) return { error: `Nominal melebihi tunggakan (Rp ${sisa.toLocaleString('id-ID')}).` }

  const sisaBaru = sisa - nominal
  await execute(`
    UPDATE upk_antrian
    SET total_bayar = total_bayar + ?, sisa_tunggakan = ?, updated_at = ?
    WHERE id = ?
  `, [nominal, sisaBaru, now(), payload.antrianId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_pesanan',
    action: 'bayar',
    fiturHref: PESANAN_PATH,
    logKind: 'update',
    entityType: 'upk_antrian',
    entityId: payload.antrianId,
    entityLabel: antrian.nama_santri,
    summary: `Bayar tunggakan ${String(antrian.nomor).padStart(3, '0')} - ${antrian.nama_santri}`,
    details: { nominal, sisa_sebelum: sisa, sisa_sesudah: sisaBaru },
  })

  revalidatePath(PESANAN_PATH)
  revalidatePath(KASIR_PATH)
  return { success: true }
}

// ── Aksi: serahkan kembalian yang ditahan ──
export async function serahkanKembalian(payload: { antrianId: string }): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const antrian = await queryOne<AntrianRow>('SELECT * FROM upk_antrian WHERE id = ?', [payload.antrianId])
  if (!antrian) return { error: 'Transaksi tidak ditemukan.' }
  if (antrian.status !== 'SELESAI') return { error: 'Hanya transaksi selesai yang bisa diproses.' }
  if (!toInt(antrian.kembalian_ditahan) || toInt(antrian.sisa_kembalian) <= 0) {
    return { error: 'Tidak ada kembalian yang ditahan.' }
  }

  const nominal = toInt(antrian.sisa_kembalian)
  await execute(`
    UPDATE upk_antrian
    SET kembalian_ditahan = 0, sisa_kembalian = 0, updated_at = ?
    WHERE id = ?
  `, [now(), payload.antrianId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_pesanan',
    action: 'serah_kembalian',
    fiturHref: PESANAN_PATH,
    logKind: 'update',
    entityType: 'upk_antrian',
    entityId: payload.antrianId,
    entityLabel: antrian.nama_santri,
    summary: `Serah kembalian ${String(antrian.nomor).padStart(3, '0')} - ${antrian.nama_santri}`,
    details: { nominal },
  })

  revalidatePath(PESANAN_PATH)
  revalidatePath(KASIR_PATH)
  return { success: true }
}
