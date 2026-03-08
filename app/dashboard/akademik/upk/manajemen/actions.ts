'use server'

import { query, execute, now } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getListTransaksi(search: string, filterStatus: string) {
  let sql = `
    SELECT t.id, t.nama_pemesan, t.info_tambahan,
           t.total_tagihan, t.total_bayar,
           t.sisa_kembalian, t.sisa_tunggakan, t.status_lunas,
           t.created_at
    FROM upk_transaksi t
  `
  const params: any[] = []
  if (search) { sql += ' WHERE t.nama_pemesan LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY t.created_at DESC'

  const transaksi = await query<any>(sql, params)
  if (!transaksi.length) return []

  const trxIds = transaksi.map((t: any) => t.id)
  const ph = trxIds.map(() => '?').join(',')

  const items = await query<any>(`
    SELECT ui.id, ui.transaksi_id, ui.kitab_id, ui.status_serah, ui.is_gratis,
           k.nama_kitab
    FROM upk_item ui
    LEFT JOIN kitab k ON k.id = ui.kitab_id
    WHERE ui.transaksi_id IN (${ph})
  `, trxIds)

  const itemsByTrx = new Map<string, any[]>()
  items.forEach((item: any) => {
    if (!itemsByTrx.has(item.transaksi_id)) itemsByTrx.set(item.transaksi_id, [])
    itemsByTrx.get(item.transaksi_id)!.push(item)
  })

  const data = transaksi.map((trx: any) => {
    const trxItems = itemsByTrx.get(trx.id) || []
    return {
      ...trx,
      status_lunas: !!trx.status_lunas,
      upk_item: trxItems,
      total_item: trxItems.length,
      item_belum: trxItems.filter((i: any) => i.status_serah === 'BELUM').length,
      items_detail: trxItems,
      list_barang_belum: trxItems
        .filter((i: any) => i.status_serah === 'BELUM')
        .map((i: any) => i.nama_kitab)
        .join(', '),
    }
  })

  return data.filter((trx: any) => {
    const pendingBarang = trx.upk_item.some((i: any) => i.status_serah === 'BELUM')
    const adaHutang = trx.sisa_tunggakan > 0
    const adaKembalian = trx.sisa_kembalian > 0
    if (filterStatus === 'PENDING_BARANG') return pendingBarang
    if (filterStatus === 'HUTANG') return adaHutang
    if (filterStatus === 'KEMBALIAN') return adaKembalian
    return true
  })
}

export async function getRekapGudang() {
  const itemPending = await query<any>(`
    SELECT ui.is_gratis,
           k.id AS kitab_id, k.nama_kitab,
           m.nama AS marhalah_nama
    FROM upk_item ui
    LEFT JOIN kitab k ON k.id = ui.kitab_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ui.status_serah = 'BELUM'
  `, [])

  const rekap: Record<string, any> = {}
  itemPending.forEach((item: any) => {
    const key = item.kitab_id
    if (!rekap[key]) {
      rekap[key] = { id: key, nama: item.nama_kitab, marhalah: item.marhalah_nama || '-', total_butuh: 0, total_gratis: 0 }
    }
    rekap[key].total_butuh++
    if (item.is_gratis) rekap[key].total_gratis++
  })

  return Object.values(rekap).sort((a: any, b: any) => a.marhalah.localeCompare(b.marhalah))
}

export async function serahkanBarang(transaksiId: string): Promise<{ success: boolean } | { error: string }> {
  await execute(`
    UPDATE upk_item SET status_serah = 'SUDAH', tanggal_serah = ?
    WHERE transaksi_id = ? AND status_serah = 'BELUM'
  `, [now(), transaksiId])
  revalidatePath('/dashboard/akademik/upk/manajemen')
  return { success: true }
}

export async function serahkanBarangPartial(itemIds: string[]): Promise<{ success: boolean } | { error: string }> {
  if (!itemIds || !itemIds.length) return { error: 'Pilih minimal satu item.' }
  const ph = itemIds.map(() => '?').join(',')
  await execute(
    `UPDATE upk_item SET status_serah = 'SUDAH', tanggal_serah = ? WHERE id IN (${ph})`,
    [now(), ...itemIds]
  )
  revalidatePath('/dashboard/akademik/upk/manajemen')
  return { success: true }
}

export async function selesaikanKeuangan(transaksiId: string, jenis: 'LUNAS' | 'AMBIL_KEMBALIAN'): Promise<{ success: boolean } | { error: string }> {
  if (jenis === 'LUNAS') {
    await execute(
      'UPDATE upk_transaksi SET sisa_tunggakan = 0, status_lunas = 1 WHERE id = ?',
      [transaksiId]
    )
  } else {
    await execute(
      'UPDATE upk_transaksi SET sisa_kembalian = 0 WHERE id = ?',
      [transaksiId]
    )
  }
  revalidatePath('/dashboard/akademik/upk/manajemen')
  return { success: true }
}