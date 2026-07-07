'use server'

import { execute, generateId, getDB, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { toInt, statusPembayaran } from '@/lib/upk-utils'
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
  marhalah_ids: string | null
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
  katalogId: number | null
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
  toko_nama: string | null
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

export async function getKatalogBelanja() {
  const rows = await query<KatalogBelanjaRow>(`
    SELECT uk.id, uk.nama_kitab, uk.harga_beli, uk.harga_jual,
           uk.stok_lama, uk.stok_baru, uk.toko_id,
           GROUP_CONCAT(DISTINCT m.nama) AS marhalah_nama,
           GROUP_CONCAT(DISTINCT km.marhalah_id) AS marhalah_ids,
           t.nama AS toko_nama
    FROM upk_katalog uk
    LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id
    LEFT JOIN marhalah m ON m.id = km.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    WHERE uk.is_active = 1
    GROUP BY uk.id
    ORDER BY uk.nama_kitab
  `, [])
  return rows.map(row => ({
    ...row,
    marhalah_id: null,
    marhalah_ids: row.marhalah_ids || '',
    jumlah_stok: (row.stok_lama || 0) + (row.stok_baru || 0),
  }))
}

export async function getTokoBelanja() {
  return query<{ id: number; nama: string }>(
    'SELECT id, nama FROM upk_toko WHERE is_active = 1 ORDER BY nama',
    []
  )
}

export async function getMarhalahBelanja() {
  return query<{ id: number; nama: string }>('SELECT id, nama FROM marhalah ORDER BY urutan', [])
}

export async function hitungRencanaBelanja(persenTarget: number) {
  const persen = Math.max(1, Math.min(100, toInt(persenTarget)))
  const rows = await query<RencanaHitungRow>(`
    SELECT uk.id AS katalog_id, uk.nama_kitab, uk.stok_lama, uk.stok_baru, uk.harga_beli,
           t.nama AS toko_nama,
           GROUP_CONCAT(DISTINCT m.nama) AS marhalah_nama,
           COUNT(DISTINCT s.id) AS jumlah_santri
    FROM upk_katalog uk
    LEFT JOIN upk_katalog_marhalah km ON km.katalog_id = uk.id
    LEFT JOIN marhalah m ON m.id = km.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN upk_katalog_marhalah km_def ON km_def.katalog_id = uk.id AND km_def.is_default = 1
    LEFT JOIN kelas k ON k.marhalah_id = km_def.marhalah_id
    LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    WHERE uk.is_active = 1
    GROUP BY uk.id
    ORDER BY uk.nama_kitab
  `, [])

  return rows.map((row) => {
    const jumlahSantri = toInt(row.jumlah_santri)
    const stokLama = toInt(row.stok_lama)
    const target = Math.ceil(jumlahSantri * persen / 100)
    const saranQty = Math.max(0, target - stokLama)
    return {
      katalog_id: row.katalog_id,
      nama_kitab: row.nama_kitab,
      marhalah_id: null,
      marhalah_nama: row.marhalah_nama,
      toko_nama: row.toko_nama,
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

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_belanja',
    action: 'create',
    fiturHref: '/dashboard/akademik/upk/belanja',
    logKind: 'create',
    entityType: 'upk_rencana_belanja',
    entityId: id,
    entityLabel: payload.nama.trim() || `Rencana ${today()}`,
    summary: `Membuat rencana belanja UPK ${items.length} item`,
    details: {
      persen_target: persen,
      total_item: items.length,
      total_estimasi: items.reduce((sum, item) => sum + (Math.max(0, toInt(item.qtyRencana)) * Math.max(0, toInt(item.hargaBeli))), 0),
    },
  })

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

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_belanja',
    action: 'create',
    fiturHref: '/dashboard/akademik/upk/belanja',
    logKind: 'create',
    entityType: 'upk_belanja',
    entityId: belanjaId,
    entityLabel: toko?.nama ?? payload.tokoNama ?? `Belanja ${tanggal}`,
    summary: `Mencatat belanja UPK ${items.length} item`,
    details: {
      tanggal,
      jenis: payload.jenis,
      toko: toko?.nama ?? payload.tokoNama ?? null,
      total,
      dibayar,
      sisa_hutang: sisaHutang,
    },
  })

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
  const session = await getSession()
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

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_belanja',
    action: 'payment',
    fiturHref: '/dashboard/akademik/upk/belanja',
    logKind: 'update',
    entityType: 'upk_belanja',
    entityId: id,
    entityLabel: 'Pembayaran hutang belanja',
    summary: `Membayar hutang belanja UPK sebesar ${bayar}`,
    details: {
      nominal_bayar: bayar,
      dibayar_sebelumnya: row.dibayar,
      dibayar_setelah: dibayarBaru,
      sisa_hutang: sisaBaru,
    },
  })

  revalidatePath(BELANJA_PATH)
  return { success: true }
}

export async function hapusBelanja(id: string): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const belanjaRow = await queryOne<{ id: string; total: number; dibayar: number; toko_nama: string | null; tanggal: string }>('SELECT * FROM upk_belanja WHERE id = ?', [id])
  if (!belanjaRow) return { error: 'Data belanja tidak ditemukan.' }

  const items = await query<{ katalog_id: number; qty: number }>('SELECT katalog_id, qty FROM upk_belanja_item WHERE belanja_id = ?', [id])

  for (const item of items) {
    if (item.katalog_id) {
      await execute(`
        UPDATE upk_katalog
        SET stok_baru = MAX(0, stok_baru - ?),
            stok_updated_at = ?,
            updated_at = ?
        WHERE id = ?
      `, [item.qty, now(), now(), item.katalog_id])
    }
  }

  await execute('DELETE FROM upk_belanja WHERE id = ?', [id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_belanja',
    action: 'delete',
    fiturHref: BELANJA_PATH,
    logKind: 'delete',
    entityType: 'upk_belanja',
    entityId: id,
    entityLabel: belanjaRow.toko_nama || `Belanja ${belanjaRow.tanggal}`,
    summary: `Menghapus riwayat belanja UPK`,
    details: {
      id,
      tanggal: belanjaRow.tanggal,
      toko: belanjaRow.toko_nama,
      total: belanjaRow.total,
      dibayar: belanjaRow.dibayar,
      items_reverted: items.length,
    },
  })

  revalidatePath(BELANJA_PATH)
  revalidatePath('/dashboard/akademik/upk/katalog')
  return { success: true }
}

export async function getBelanjaItems(belanjaId: string) {
  return query<{
    id: string
    katalog_id: number | null
    nama_kitab: string
    marhalah_nama: string | null
    qty: number
    qty_retur: number
    harga_beli: number
    subtotal: number
    is_consignment: number
  }>(`
    SELECT bi.id, bi.katalog_id, bi.nama_kitab, bi.marhalah_nama, bi.qty, bi.qty_retur, bi.harga_beli, bi.subtotal,
           COALESCE(uk.is_consignment, 0) AS is_consignment
    FROM upk_belanja_item bi
    LEFT JOIN upk_katalog uk ON uk.id = bi.katalog_id
    WHERE bi.belanja_id = ?
    ORDER BY bi.nama_kitab
  `, [belanjaId])
}

export async function getBelanjaDetail(id: string) {
  const header = await queryOne<{
    id: string
    tanggal: string
    jenis: string
    toko_id: number | null
    toko_nama: string | null
    catatan: string | null
    dibayar: number
    total: number
    sisa_hutang: number
  }>('SELECT * FROM upk_belanja WHERE id = ?', [id])
  if (!header) return null

  const items = await query<{
    id: string
    katalog_id: number | null
    nama_kitab: string
    marhalah_id: number | null
    marhalah_nama: string | null
    qty: number
    qty_retur: number
    harga_beli: number
    subtotal: number
  }>(`
    SELECT id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty, qty_retur, harga_beli, subtotal
    FROM upk_belanja_item
    WHERE belanja_id = ?
    ORDER BY nama_kitab
  `, [id])

  return { header, items }
}

export async function updateBelanja(payload: {
  id: string
  tanggal: string
  jenis: 'AWAL' | 'TAMBAHAN'
  tokoId: number | null
  tokoNama?: string | null
  catatan?: string
  items: (BelanjaPayloadItem & { itemId?: string; qtyRetur?: number })[]
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const belanjaRow = await queryOne<{ id: string; dibayar: number }>('SELECT * FROM upk_belanja WHERE id = ?', [payload.id])
  if (!belanjaRow) return { error: 'Data belanja tidak ditemukan.' }

  const items = payload.items.filter(item => toInt(item.qty) > 0)
  if (!items.length) return { error: 'Pilih minimal satu kitab yang dibeli.' }

  const oldItems = await query<{ id: string; katalog_id: number | null; qty: number; qty_retur: number }>(
    'SELECT id, katalog_id, qty, qty_retur FROM upk_belanja_item WHERE belanja_id = ?', [payload.id]
  )
  const oldById = new Map(oldItems.map(row => [row.id, row]))
  const keptIds = new Set(items.filter(item => item.itemId).map(item => item.itemId as string))

  for (const oldItem of oldItems) {
    if (keptIds.has(oldItem.id)) continue
    if (oldItem.qty_retur > 0) {
      return { error: `Item dengan retur ${oldItem.qty_retur} tidak bisa dihapus dari belanja.` }
    }
  }

  for (const item of items) {
    if (!item.itemId) continue
    const old = oldById.get(item.itemId)
    if (old && toInt(item.qty) < old.qty_retur) {
      return { error: `${item.namaKitab}: qty tidak boleh kurang dari retur yang sudah dilakukan (${old.qty_retur}).` }
    }
  }

  const toko = payload.tokoId
    ? await queryOne<{ id: number; nama: string }>('SELECT id, nama FROM upk_toko WHERE id = ?', [payload.tokoId])
    : null
  const tanggal = payload.tanggal || today()

  // Hapus item lama yang tidak ada lagi di payload (sudah divalidasi qty_retur = 0)
  for (const oldItem of oldItems) {
    if (keptIds.has(oldItem.id)) continue
    if (oldItem.katalog_id) {
      await execute(`
        UPDATE upk_katalog
        SET stok_baru = MAX(0, stok_baru - ?), stok_updated_at = ?, updated_at = ?
        WHERE id = ?
      `, [oldItem.qty, now(), now(), oldItem.katalog_id])
    }
    await execute('DELETE FROM upk_belanja_item WHERE id = ?', [oldItem.id])
  }

  let total = 0
  for (const item of items) {
    const qty = Math.max(0, toInt(item.qty))
    const harga = Math.max(0, toInt(item.hargaBeli))
    const qtyRetur = item.itemId ? (oldById.get(item.itemId)?.qty_retur ?? 0) : 0
    total += (qty - qtyRetur) * harga

    if (item.itemId && oldById.has(item.itemId)) {
      const old = oldById.get(item.itemId)!
      const delta = qty - old.qty
      await execute(
        'UPDATE upk_belanja_item SET qty = ?, harga_beli = ?, subtotal = ?, updated_at = ? WHERE id = ?',
        [qty, harga, qty * harga, now(), item.itemId]
      )
      if (old.katalog_id && delta !== 0) {
        await execute(`
          UPDATE upk_katalog
          SET stok_baru = MAX(0, stok_baru + ?), stok_updated_at = ?, updated_at = ?
          WHERE id = ?
        `, [delta, now(), now(), old.katalog_id])
      }
    } else {
      await execute(`
        INSERT INTO upk_belanja_item
          (id, belanja_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty, harga_beli, subtotal, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [generateId(), payload.id, item.katalogId, item.namaKitab, item.marhalahId, item.marhalahNama, qty, harga, qty * harga, now(), now()])

      if (item.katalogId) {
        await execute(`
          UPDATE upk_katalog
          SET stok_baru = stok_baru + ?, harga_beli = ?, toko_id = COALESCE(?, toko_id),
              stok_updated_at = ?, updated_at = ?
          WHERE id = ?
        `, [qty, harga, toko?.id ?? null, now(), now(), item.katalogId])
      }
    }
  }

  const sisaHutang = Math.max(0, total - belanjaRow.dibayar)
  const status = statusPembayaran(total, belanjaRow.dibayar)

  await execute(`
    UPDATE upk_belanja
    SET tanggal = ?, jenis = ?, toko_id = ?, toko_nama = ?, total = ?, sisa_hutang = ?, status_pembayaran = ?, catatan = ?, updated_at = ?
    WHERE id = ?
  `, [tanggal, payload.jenis, toko?.id ?? null, toko?.nama ?? payload.tokoNama ?? null, total, sisaHutang, status, payload.catatan?.trim() || null, now(), payload.id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_belanja',
    action: 'update',
    fiturHref: BELANJA_PATH,
    logKind: 'update',
    entityType: 'upk_belanja',
    entityId: payload.id,
    entityLabel: toko?.nama ?? payload.tokoNama ?? `Belanja ${tanggal}`,
    summary: `Mengubah belanja UPK ${items.length} item`,
    details: { tanggal, jenis: payload.jenis, toko: toko?.nama ?? payload.tokoNama ?? null, total, sisa_hutang: sisaHutang },
  })

  revalidatePath(BELANJA_PATH)
  revalidatePath('/dashboard/akademik/upk/katalog')
  return { success: true }
}

export async function returBelanjaItem(belanjaItemId: string, qtyToReturn: number): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const bi = await queryOne<{
    id: string
    belanja_id: string
    katalog_id: number | null
    nama_kitab: string
    qty: number
    qty_retur: number
    harga_beli: number
  }>('SELECT * FROM upk_belanja_item WHERE id = ?', [belanjaItemId])

  if (!bi) return { error: 'Item belanja tidak ditemukan.' }

  const parent = await queryOne<{
    id: string
    total: number
    dibayar: number
    sisa_hutang: number
    toko_nama: string | null
    tanggal: string
  }>('SELECT * FROM upk_belanja WHERE id = ?', [bi.belanja_id])

  if (!parent) return { error: 'Data belanja tidak ditemukan.' }

  const qty = Math.max(0, toInt(qtyToReturn))
  if (qty <= 0) return { error: 'Jumlah retur harus lebih dari 0.' }

  const maxQty = bi.qty - (bi.qty_retur || 0)
  if (qty > maxQty) return { error: `Jumlah retur (${qty}) melebihi batas maksimal (${maxQty}).` }

  const katalog = bi.katalog_id
    ? await queryOne<{ id: number; stok_lama: number; stok_baru: number; is_consignment: number }>('SELECT * FROM upk_katalog WHERE id = ?', [bi.katalog_id])
    : null

  if (bi.katalog_id && !katalog) return { error: 'Katalog item tidak ditemukan.' }

  if (katalog) {
    if (!katalog.is_consignment) {
      return { error: 'Kitab ini bukan barang konsinyasi.' }
    }
    if (qty > katalog.stok_baru) {
      return { error: `Stok baru saat ini (${katalog.stok_baru}) tidak mencukupi untuk diretur sebanyak ${qty}. (Stok lama tidak termasuk konsinyasi)` }
    }

    const newStokBaru = katalog.stok_baru - qty
    const newStokLama = katalog.stok_lama

    const db = await getDB()
    const stokResult = await db.prepare(`
      UPDATE upk_katalog
      SET stok_baru = ?, stok_lama = ?, stok_updated_at = ?, updated_at = ?
      WHERE id = ? AND stok_baru = ?
    `).bind(newStokBaru, newStokLama, now(), now(), bi.katalog_id, katalog.stok_baru).run()

    if (!stokResult.meta?.changes) {
      return { error: 'Stok katalog baru saja berubah, silakan coba lagi.' }
    }
  }

  const newQtyRetur = (bi.qty_retur || 0) + qty
  const db = await getDB()
  const itemResult = await db.prepare(
    'UPDATE upk_belanja_item SET qty_retur = ?, updated_at = ? WHERE id = ? AND qty_retur = ?'
  ).bind(newQtyRetur, now(), belanjaItemId, bi.qty_retur || 0).run()

  if (!itemResult.meta?.changes) {
    return { error: 'Data item belanja baru saja berubah, silakan coba lagi.' }
  }

  const returnedValue = qty * bi.harga_beli
  const newTotal = Math.max(0, parent.total - returnedValue)
  const newSisaHutang = Math.max(0, parent.sisa_hutang - returnedValue)
  const newStatus = statusPembayaran(newTotal, parent.dibayar)

  await execute(`
    UPDATE upk_belanja
    SET total = ?, sisa_hutang = ?, status_pembayaran = ?, updated_at = ?
    WHERE id = ?
  `, [newTotal, newSisaHutang, newStatus, now(), bi.belanja_id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_belanja',
    action: 'update',
    fiturHref: BELANJA_PATH,
    logKind: 'update',
    entityType: 'upk_belanja_item',
    entityId: belanjaItemId,
    entityLabel: `${bi.nama_kitab} (Retur)`,
    summary: `Mencatat retur belanja kitab ${bi.nama_kitab} sebanyak ${qty} pcs`,
    details: {
      belanja_id: bi.belanja_id,
      kitab: bi.nama_kitab,
      qty_returned: qty,
      value_returned: returnedValue,
      parent_total_after: newTotal,
      parent_hutang_after: newSisaHutang,
    },
  })

  revalidatePath(BELANJA_PATH)
  revalidatePath('/dashboard/akademik/upk/katalog')
  return { success: true }
}
