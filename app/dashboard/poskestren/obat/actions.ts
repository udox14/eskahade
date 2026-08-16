/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, queryOne } from '@/lib/db'
import { canPoskestrenDelete, requirePoskestrenFeature } from '@/lib/poskestren/access'
import { cleanText } from '@/lib/poskestren/query'
import { POSKESTREN_HREF } from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.medicine
const refresh = () => {
  revalidatePath(PATH)
  revalidatePath(POSKESTREN_HREF.reports)
}

async function audit(
  session: Awaited<ReturnType<typeof requirePoskestrenFeature>>,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  details?: Record<string, unknown>
) {
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_obat',
    action,
    fiturHref: PATH,
    logKind: action === 'create' ? 'create' : 'update',
    entityType,
    entityId,
    summary,
    details,
  })
}

export async function saveSupplier(input: { name: string; phone?: string; address?: string }) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const name = cleanText(input.name, 150)
  if (!name) return { success: false as const, error: 'Nama supplier wajib diisi.' }
  const id = generateId()
  try {
    await (await getDB()).prepare(
      `INSERT INTO poskestren_supplier(id, name, phone, address, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, name, cleanText(input.phone, 80), cleanText(input.address), session.id).run()
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Supplier sudah ada.' }
    throw error
  }
  await audit(session, 'create', 'poskestren_supplier', id, `Menambah supplier ${name}`)
  refresh()
  return { success: true as const, id }
}

export async function deleteMedicine(id: string) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  if (!canPoskestrenDelete(session)) {
    return { success: false as const, error: 'Hanya Admin, Ketua, Sekretaris, atau Bendahara POSKESTREN yang dapat menghapus obat.' }
  }
  const medicine = await queryOne<{ id: string; name: string; total_stock_base: number }>(
    'SELECT id, name, total_stock_base FROM poskestren_medicine WHERE id = ?',
    [id]
  )
  if (!medicine) return { success: false as const, error: 'Obat tidak ditemukan.' }

  // Tolak hapus jika masih ada stok tersisa
  if (Number(medicine.total_stock_base) > 0) {
    return { success: false as const, error: `Stok obat masih ${medicine.total_stock_base} unit. Habiskan atau sesuaikan stok terlebih dahulu sebelum menghapus.` }
  }

  // Tolak hapus jika obat ini pernah muncul di transaksi mana pun — semua tabel
  // di bawah punya FK medicine_id tanpa ON DELETE, jadi DELETE akan gagal dengan
  // "FOREIGN KEY constraint failed" mentah kalau tidak dicek lebih dulu.
  const usage = await queryOne<{
    movements: number
    purchases: number
    prescriptions: number
    orders: number
    issues: number
    transfers: number
    stocktakes: number
  }>(
    `SELECT
       (SELECT COUNT(*) FROM poskestren_stock_movement WHERE medicine_id = ?) AS movements,
       (SELECT COUNT(*) FROM poskestren_purchase_item WHERE medicine_id = ?) AS purchases,
       (SELECT COUNT(*) FROM poskestren_prescription_item WHERE medicine_id = ?) AS prescriptions,
       (SELECT COUNT(*) FROM poskestren_medicine_order_item WHERE medicine_id = ?) AS orders,
       (SELECT COUNT(*) FROM poskestren_medicine_issue_item WHERE medicine_id = ?) AS issues,
       (SELECT COUNT(*) FROM poskestren_stock_transfer_item WHERE medicine_id = ?) AS transfers,
       (SELECT COUNT(*) FROM poskestren_stocktake_item WHERE medicine_id = ?) AS stocktakes`,
    [id, id, id, id, id, id, id]
  )
  const totalUsage = Object.values(usage || {}).reduce((sum, n) => sum + Number(n || 0), 0)
  if (totalUsage > 0) {
    return { success: false as const, error: 'Obat ini sudah pernah dipakai dalam transaksi (mutasi stok, resep, pembelian, atau opname) dan tidak dapat dihapus. Nonaktifkan saja.' }
  }

  const db = await getDB()
  await db.batch([
    db.prepare('DELETE FROM poskestren_unit_conversion WHERE medicine_id = ?').bind(id),
    db.prepare('DELETE FROM poskestren_medicine_batch WHERE medicine_id = ?').bind(id),
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'MEDICINE' AND entity_id = ?`).bind(id),
    db.prepare('DELETE FROM poskestren_medicine WHERE id = ?').bind(id),
  ])

  await audit(session, 'delete', 'poskestren_medicine', id, `Menghapus obat ${medicine.name}`)
  refresh()
  return { success: true as const }
}
