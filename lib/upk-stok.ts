import { execute, generateId, getDB, now, query, queryOne, today } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type StockRow = {
  stok_lama: number
  stok_baru: number
  prioritas_stok?: string | null
}

async function hasColumn(table: string, column: string) {
  const columns = await query<{ name: string }>(`PRAGMA table_info(${table})`)
  return columns.some((row) => row.name === column)
}

/**
 * Kurangi stok katalog (hormati prioritas_stok LAMA/BARU) lalu catat mutasi.
 * Dipakai kasir (PENJUALAN) & penyerahan pesanan (PESANAN_SERAH).
 */
export async function kurangiStokDenganTipe(
  katalogId: number,
  qty: number,
  meta: { antrianId: string; itemId: string; unit: string; tipe: string; catatan: string }
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
