/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { canPoskestrenDelete, isPoskestrenBendahara, requirePoskestrenFeature } from '@/lib/poskestren/access'
import {
  assertDate,
  cleanText,
  decodeCursor,
  encodeCursor,
  normalizePoskestrenListQuery,
  parseNonNegativeInteger,
  parsePositiveInteger,
  toFtsPrefixQuery,
} from '@/lib/poskestren/query'
import {
  POSKESTREN_HREF,
  type PoskestrenListQuery,
  type PoskestrenStockMovementType,
} from '@/lib/poskestren/types'

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

export async function getMedicineCatalog(input: PoskestrenListQuery = {}) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.status === 'active') where.push('m.is_active = 1')
  if (normalized.status === 'inactive') where.push('m.is_active = 0')
  if (normalized.status === 'low') where.push('m.total_stock_base <= m.minimum_stock_base')
  if (normalized.status === 'empty') where.push('m.total_stock_base = 0')
  if (normalized.q) {
    const fts = toFtsPrefixQuery(normalized.q)
    where.push(`m.id IN (
      SELECT entity_id FROM poskestren_search_fts
      WHERE entity_type = 'MEDICINE' AND poskestren_search_fts MATCH ?
    )`)
    params.push(fts || '""')
  }

  const rows = await query<any>(
    `SELECT m.id, m.name, m.generic_name, m.category, m.form, m.strength,
            m.base_unit, m.minimum_stock_base, m.total_stock_base, m.is_active,
            m.notes, m.created_at, m.updated_at,
            MIN(CASE WHEN b.remaining_quantity > 0 THEN b.expires_on END) AS nearest_expiry,
            COUNT(CASE WHEN b.remaining_quantity > 0 THEN 1 END) AS active_batch_count,
            GROUP_CONCAT(DISTINCT uc.unit_name || '=' || uc.factor_to_base) AS conversions
     FROM poskestren_medicine m
     LEFT JOIN poskestren_medicine_batch b ON b.medicine_id = m.id
     LEFT JOIN poskestren_unit_conversion uc ON uc.medicine_id = m.id
     WHERE ${where.join(' AND ')}
     GROUP BY m.id
     ORDER BY m.is_active DESC, m.name COLLATE NOCASE
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  return {
    items: rows.slice(0, normalized.limit),
    hasMore,
    truncated: normalized.isAll && hasMore,
    limit: normalized.limit,
  }
}

export async function saveMedicine(input: {
  id?: string
  name: string
  genericName?: string
  category?: string
  form?: string
  strength?: string
  baseUnit: string
  minimumStockBase?: number
  notes?: string
  isActive?: boolean
}) {
  const session = await requirePoskestrenFeature(PATH, input.id ? 'update' : 'create')
  const name = cleanText(input.name, 150)
  const baseUnit = cleanText(input.baseUnit, 40)
  if (!name || !baseUnit) return { success: false as const, error: 'Nama dan satuan dasar wajib diisi.' }
  const minimum = parseNonNegativeInteger(input.minimumStockBase || 0, 'Stok minimum')
  const id = input.id || generateId()
  const db = await getDB()
  if (input.id) {
    const exists = await queryOne<{ id: string }>('SELECT id FROM poskestren_medicine WHERE id = ?', [id])
    if (!exists) return { success: false as const, error: 'Obat tidak ditemukan.' }
    await db.prepare(
      `UPDATE poskestren_medicine
       SET name = ?, generic_name = ?, category = ?, form = ?, strength = ?,
           base_unit = ?, minimum_stock_base = ?, notes = ?, is_active = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      name,
      cleanText(input.genericName, 150),
      cleanText(input.category, 100),
      cleanText(input.form, 80),
      cleanText(input.strength, 80),
      baseUnit,
      minimum,
      cleanText(input.notes),
      input.isActive === false ? 0 : 1,
      id
    ).run()
  } else {
    await db.prepare(
      `INSERT INTO poskestren_medicine(
         id, name, generic_name, category, form, strength, base_unit,
         minimum_stock_base, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      name,
      cleanText(input.genericName, 150),
      cleanText(input.category, 100),
      cleanText(input.form, 80),
      cleanText(input.strength, 80),
      baseUnit,
      minimum,
      cleanText(input.notes),
      session.id
    ).run()
  }
  await db.batch([
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'MEDICINE' AND entity_id = ?`).bind(id),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('MEDICINE', ?, ?)`
    ).bind(id, [name, input.genericName, input.category, input.form, input.strength, input.notes].filter(Boolean).join(' ')),
  ])
  await audit(session, input.id ? 'update' : 'create', 'poskestren_medicine', id, `${input.id ? 'Memperbarui' : 'Menambah'} obat ${name}`)
  refresh()
  return { success: true as const, id }
}

export async function saveUnitConversion(input: {
  medicineId: string
  unitName: string
  factorToBase: number
}) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const unitName = cleanText(input.unitName, 40)
  if (!unitName) return { success: false as const, error: 'Nama satuan wajib diisi.' }
  const factor = parsePositiveInteger(input.factorToBase, 'Faktor konversi')
  const medicine = await queryOne<{ name: string }>('SELECT name FROM poskestren_medicine WHERE id = ?', [input.medicineId])
  if (!medicine) return { success: false as const, error: 'Obat tidak ditemukan.' }
  await (await getDB()).prepare(
    `INSERT INTO poskestren_unit_conversion(id, medicine_id, unit_name, factor_to_base)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(medicine_id, unit_name)
     DO UPDATE SET factor_to_base = excluded.factor_to_base`
  ).bind(generateId(), input.medicineId, unitName, factor).run()
  await audit(session, 'update', 'poskestren_medicine', input.medicineId, `Mengatur konversi ${medicine.name}: 1 ${unitName} = ${factor}`)
  refresh()
  return { success: true as const }
}

export async function getMedicineMasterOptions() {
  await requirePoskestrenFeature(PATH)
  const [medicines, suppliers, accounts, preventivePrograms] = await Promise.all([
    query<any>(
      `SELECT m.id, m.name, m.base_unit, m.total_stock_base,
              GROUP_CONCAT(uc.unit_name || '|' || uc.factor_to_base, ';;') AS conversions
       FROM poskestren_medicine m
       LEFT JOIN poskestren_unit_conversion uc ON uc.medicine_id = m.id
       WHERE m.is_active = 1
       GROUP BY m.id ORDER BY m.name`
    ),
    query<any>(`SELECT id, name, phone FROM poskestren_supplier WHERE is_active = 1 ORDER BY name`),
    query<any>(`SELECT id, name, account_type FROM poskestren_cash_account WHERE is_active = 1 ORDER BY name`),
    query<any>(
      `SELECT id, title, program_date FROM poskestren_preventive_program
       WHERE status IN ('ACTIVE','COMPLETED')
       ORDER BY program_date DESC, created_at DESC LIMIT 100`
    ),
  ])
  return { medicines, suppliers, accounts, preventivePrograms }
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

export async function getPurchases(input: PoskestrenListQuery = {}) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.from) { where.push('p.purchase_date >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('p.purchase_date <= ?'); params.push(normalized.to) }
  if (normalized.status) { where.push('(p.status = ? OR p.payment_status = ?)'); params.push(normalized.status, normalized.status) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(p.supplier_name LIKE ? OR p.notes LIKE ? OR EXISTS (SELECT 1 FROM poskestren_purchase_item pi JOIN poskestren_medicine m ON m.id = pi.medicine_id WHERE pi.purchase_id = p.id AND m.name LIKE ?))')
    params.push(like, like, like)
  }
  const cursor = decodeCursor(normalized.cursor)
  if (cursor && cursor.length === 3) {
    where.push(`(
      p.purchase_date < ? OR
      (p.purchase_date = ? AND p.created_at < ?) OR
      (p.purchase_date = ? AND p.created_at = ? AND p.id < ?)
    )`)
    params.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }
  const rows = await query<any>(
    `SELECT p.id, p.purchase_date, p.supplier_id, p.supplier_name, p.status,
            p.payment_status, p.total_rupiah, p.notes, p.finance_transaction_id,
            p.received_at, p.created_at,
            COUNT(pi.id) AS item_count,
            GROUP_CONCAT(m.name || ' (' || pi.quantity_package || ' ' || pi.unit_name || ')', ', ') AS item_summary
     FROM poskestren_purchase p
     LEFT JOIN poskestren_purchase_item pi ON pi.purchase_id = p.id
     LEFT JOIN poskestren_medicine m ON m.id = pi.medicine_id
     WHERE ${where.join(' AND ')}
     GROUP BY p.id
     ORDER BY p.purchase_date DESC, p.created_at DESC, p.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return { items, hasMore, nextCursor: hasMore && last ? encodeCursor([last.purchase_date, last.created_at, last.id]) : null, truncated: normalized.isAll && hasMore }
}

export async function createPurchase(input: {
  purchaseDate: string
  supplierId?: string
  supplierName?: string
  notes?: string
  items: Array<{
    medicineId: string
    unitName: string
    factorToBase: number
    quantityPackage: number
    unitPrice: number
    batchNumber: string
    expiresOn?: string
  }>
}) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const date = assertDate(input.purchaseDate)
  if (!input.items?.length) return { success: false as const, error: 'Minimal satu item belanja wajib diisi.' }
  const items = input.items.slice(0, 50).map(item => {
    const factor = parsePositiveInteger(item.factorToBase, 'Faktor konversi')
    const quantityPackage = parsePositiveInteger(item.quantityPackage, 'Jumlah kemasan')
    const unitPrice = parseNonNegativeInteger(item.unitPrice, 'Harga satuan')
    const batchNumber = cleanText(item.batchNumber, 100)
    if (!item.medicineId || !batchNumber) throw new Error('Obat dan nomor batch wajib diisi.')
    return {
      ...item,
      factor,
      quantityPackage,
      unitPrice,
      batchNumber,
      quantityBase: factor * quantityPackage,
      subtotal: unitPrice * quantityPackage,
      expiresOn: item.expiresOn ? assertDate(item.expiresOn, 'Tanggal kedaluwarsa') : null,
    }
  })
  const medicineIds = [...new Set(items.map(item => item.medicineId))]
  const validMedicines = await query<{ id: string }>(
    `SELECT id FROM poskestren_medicine
     WHERE is_active = 1 AND id IN (${medicineIds.map(() => '?').join(',')})`,
    medicineIds
  )
  if (validMedicines.length !== medicineIds.length) return { success: false as const, error: 'Ada obat yang tidak valid.' }
  const supplier = input.supplierId
    ? await queryOne<{ id: string; name: string }>('SELECT id, name FROM poskestren_supplier WHERE id = ? AND is_active = 1', [input.supplierId])
    : null
  const supplierName = supplier?.name || cleanText(input.supplierName, 150)
  if (!supplierName) return { success: false as const, error: 'Supplier wajib diisi.' }

  const id = generateId()
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  const db = await getDB()
  await db.batch([
    db.prepare(
      `INSERT INTO poskestren_purchase(
         id, purchase_date, supplier_id, supplier_name, total_rupiah, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, date, supplier?.id || null, supplierName, total, cleanText(input.notes), session.id),
    ...items.map(item => db.prepare(
      `INSERT INTO poskestren_purchase_item(
         id, purchase_id, medicine_id, unit_name, factor_to_base, quantity_package,
         quantity_base, unit_price, subtotal_rupiah, batch_number, expires_on
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      generateId(), id, item.medicineId, cleanText(item.unitName, 40) || '', item.factor,
      item.quantityPackage, item.quantityBase, item.unitPrice, item.subtotal,
      item.batchNumber, item.expiresOn
    )),
  ])
  await audit(session, 'create', 'poskestren_purchase', id, `Membuat draft belanja obat ${supplierName}`, {
    item_count: items.length,
    total_rupiah: total,
  })
  refresh()
  return { success: true as const, id }
}

export async function receivePurchase(purchaseId: string) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const purchase = await queryOne<{ id: string; status: string; supplier_name: string; purchase_date: string }>(
    `SELECT id, status, supplier_name, purchase_date FROM poskestren_purchase WHERE id = ?`,
    [purchaseId]
  )
  if (!purchase || purchase.status !== 'DRAFT') return { success: false as const, error: 'Belanja bukan draft atau tidak ditemukan.' }
  const items = await query<any>(
    `SELECT pi.id, pi.medicine_id, pi.quantity_base, pi.subtotal_rupiah, pi.batch_number,
            pi.expires_on, m.total_stock_base
     FROM poskestren_purchase_item pi
     JOIN poskestren_medicine m ON m.id = pi.medicine_id
     WHERE pi.purchase_id = ?`,
    [purchaseId]
  )
  if (!items.length) return { success: false as const, error: 'Item belanja kosong.' }
  const duplicateBatch = await queryOne<{ batch_number: string }>(
    `SELECT pi.batch_number
     FROM poskestren_purchase_item pi
     JOIN poskestren_medicine_batch b
       ON b.medicine_id = pi.medicine_id AND b.batch_number = pi.batch_number
     WHERE pi.purchase_id = ?
     LIMIT 1`,
    [purchaseId]
  )
  if (duplicateBatch) return { success: false as const, error: `Batch ${duplicateBatch.batch_number} sudah ada.` }

  const db = await getDB()
  const running = new Map<string, number>()
  const statements: any[] = []
  for (const item of items) {
    const before = running.has(item.medicine_id)
      ? running.get(item.medicine_id)!
      : Number(item.total_stock_base)
    const after = before + Number(item.quantity_base)
    running.set(item.medicine_id, after)
    const batchId = generateId()
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_medicine_batch(
           id, medicine_id, purchase_item_id, batch_number, expires_on,
           purchase_price_base, initial_quantity, remaining_quantity
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        batchId, item.medicine_id, item.id, item.batch_number, item.expires_on,
        Math.round(Number(item.subtotal_rupiah) / Number(item.quantity_base)),
        item.quantity_base, item.quantity_base
      ),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by
         ) VALUES (?, ?, ?, ?, 'PURCHASE', ?, ?, ?, 'PURCHASE', ?, ?, ?)`
      ).bind(
        generateId(), item.medicine_id, batchId, purchase.purchase_date,
        item.quantity_base, before, after, purchase.id,
        `Penerimaan dari ${purchase.supplier_name}`, session.id
      )
    )
  }
  for (const [medicineId, after] of running) {
    statements.push(
      db.prepare(
        `UPDATE poskestren_medicine
         SET total_stock_base = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(after, medicineId)
    )
  }
  statements.push(
    db.prepare(
      `UPDATE poskestren_purchase
       SET status = 'RECEIVED', received_by = ?, received_at = ?, updated_at = ?
       WHERE id = ? AND status = 'DRAFT'`
    ).bind(session.id, new Date().toISOString(), new Date().toISOString(), purchase.id)
  )
  await db.batch(statements)
  await audit(session, 'update', 'poskestren_purchase', purchase.id, `Menerima belanja obat ${purchase.supplier_name}`, {
    item_count: items.length,
  })
  refresh()
  return { success: true as const }
}

export async function postPurchasePayment(input: {
  purchaseId: string
  accountId: string
  receiptUrl?: string
}) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  if (!isPoskestrenBendahara(session)) return { success: false as const, error: 'Hanya Bendahara POSKESTREN yang dapat memposting pembayaran.' }
  const purchase = await queryOne<{ id: string; purchase_date: string; supplier_name: string; status: string; payment_status: string; total_rupiah: number }>(
    `SELECT id, purchase_date, supplier_name, status, payment_status, total_rupiah
     FROM poskestren_purchase WHERE id = ?`,
    [input.purchaseId]
  )
  if (!purchase || purchase.status !== 'RECEIVED') return { success: false as const, error: 'Belanja harus diterima sebelum dibayar.' }
  if (purchase.payment_status === 'POSTED') return { success: true as const, alreadyPosted: true }
  const account = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_cash_account WHERE id = ? AND is_active = 1`,
    [input.accountId]
  )
  if (!account) return { success: false as const, error: 'Akun kas tidak valid.' }
  const txId = generateId()
  const db = await getDB()
  await db.batch([
    db.prepare(
      `INSERT INTO poskestren_finance_transaction(
         id, transaction_date, transaction_type, account_id, category_id,
         amount_rupiah, counterparty, description, receipt_url,
         source_type, source_id, created_by
       ) VALUES (?, ?, 'EXPENSE', ?, 'pos-expense-medicine', ?, ?, ?, ?, 'MEDICINE_PURCHASE', ?, ?)`
    ).bind(
      txId, purchase.purchase_date, input.accountId, purchase.total_rupiah,
      purchase.supplier_name, `Belanja obat ${purchase.supplier_name}`,
      cleanText(input.receiptUrl, 500), purchase.id, session.id
    ),
    db.prepare(
      `UPDATE poskestren_purchase
       SET payment_status = 'POSTED', finance_transaction_id = ?, updated_at = ?
       WHERE id = ? AND payment_status = 'UNPOSTED'`
    ).bind(txId, new Date().toISOString(), purchase.id),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('FINANCE', ?, ?)`
    ).bind(txId, `Belanja obat ${purchase.supplier_name}`),
  ])
  await audit(session, 'update', 'poskestren_purchase', purchase.id, `Memposting pembayaran belanja ${purchase.supplier_name}`, {
    finance_transaction_id: txId,
    total_rupiah: purchase.total_rupiah,
  })
  refresh()
  revalidatePath(POSKESTREN_HREF.finance)
  return { success: true as const, id: txId }
}

export async function getStockMovements(input: PoskestrenListQuery & { medicineId?: string; movementType?: string } = {}) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.from) { where.push('sm.movement_date >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('sm.movement_date <= ?'); params.push(normalized.to) }
  if (input.medicineId) { where.push('sm.medicine_id = ?'); params.push(input.medicineId) }
  if (input.movementType) { where.push('sm.movement_type = ?'); params.push(input.movementType) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(m.name LIKE ? OR b.batch_number LIKE ? OR sm.notes LIKE ? OR sm.reference_id LIKE ?)')
    params.push(like, like, like, like)
  }
  const cursor = decodeCursor(normalized.cursor)
  if (cursor && cursor.length === 3) {
    where.push(`(
      sm.movement_date < ? OR
      (sm.movement_date = ? AND sm.created_at < ?) OR
      (sm.movement_date = ? AND sm.created_at = ? AND sm.id < ?)
    )`)
    params.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }
  const rows = await query<any>(
    `SELECT sm.id, sm.movement_date, sm.movement_type, sm.quantity_delta,
            sm.stock_before, sm.stock_after, sm.reference_type, sm.reference_id,
            sm.notes, sm.created_at, m.name AS medicine_name, m.base_unit,
            b.batch_number, b.expires_on
     FROM poskestren_stock_movement sm
     JOIN poskestren_medicine m ON m.id = sm.medicine_id
     LEFT JOIN poskestren_medicine_batch b ON b.id = sm.batch_id
     WHERE ${where.join(' AND ')}
     ORDER BY sm.movement_date DESC, sm.created_at DESC, sm.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return { items, hasMore, nextCursor: hasMore && last ? encodeCursor([last.movement_date, last.created_at, last.id]) : null, truncated: normalized.isAll && hasMore }
}

export async function createManualStockMovement(input: {
  medicineId: string
  movementDate: string
  movementType: Exclude<PoskestrenStockMovementType, 'PURCHASE' | 'PATIENT'>
  quantityBase: number
  notes: string
  referenceId?: string
}) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const date = assertDate(input.movementDate)
  const quantity = parsePositiveInteger(input.quantityBase, 'Jumlah')
  const notes = cleanText(input.notes, 500)
  if (!notes) return { success: false as const, error: 'Catatan/alasan wajib diisi.' }
  const allowed = ['PREVENTIVE','EXPIRED','DAMAGED','LOST','ADJUSTMENT_IN','ADJUSTMENT_OUT','REVERSAL']
  if (!allowed.includes(input.movementType)) return { success: false as const, error: 'Jenis mutasi tidak valid.' }
  const referenceId = cleanText(input.referenceId, 100)
  if (input.movementType === 'PREVENTIVE') {
    if (!referenceId) return { success: false as const, error: 'Program preventif wajib dipilih.' }
    const program = await queryOne<{ id: string }>(
      `SELECT id FROM poskestren_preventive_program
       WHERE id = ? AND status IN ('ACTIVE','COMPLETED')`,
      [referenceId]
    )
    if (!program) return { success: false as const, error: 'Program preventif tidak valid.' }
  }
  const referenceType = input.movementType === 'PREVENTIVE' ? 'PREVENTIVE_PROGRAM' : 'MANUAL'
  const medicine = await queryOne<{ id: string; name: string; total_stock_base: number }>(
    `SELECT id, name, total_stock_base FROM poskestren_medicine WHERE id = ?`,
    [input.medicineId]
  )
  if (!medicine) return { success: false as const, error: 'Obat tidak ditemukan.' }
  const isIn = input.movementType === 'ADJUSTMENT_IN' || (input.movementType === 'REVERSAL' && quantity > 0)
  if (!isIn && Number(medicine.total_stock_base) < quantity) {
    return { success: false as const, error: 'Stok tidak mencukupi.' }
  }
  const db = await getDB()
  const statements: any[] = []
  let runningStock = Number(medicine.total_stock_base)
  let remaining = quantity
  if (isIn) {
    const batchId = generateId()
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_medicine_batch(
           id, medicine_id, batch_number, initial_quantity, remaining_quantity
         ) VALUES (?, ?, ?, ?, ?)`
      ).bind(batchId, medicine.id, `ADJ-${Date.now()}`, quantity, quantity),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(generateId(), medicine.id, batchId, date, input.movementType, quantity, runningStock, runningStock + quantity, referenceType, referenceId, notes, session.id)
    )
    runningStock += quantity
  } else {
    const batches = await query<{ id: string; remaining_quantity: number }>(
      `SELECT id, remaining_quantity
       FROM poskestren_medicine_batch
       WHERE medicine_id = ? AND remaining_quantity > 0
       ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END, expires_on, created_at`,
      [medicine.id]
    )
    for (const batch of batches) {
      if (remaining <= 0) break
      const take = Math.min(remaining, Number(batch.remaining_quantity))
      statements.push(
        db.prepare(`UPDATE poskestren_medicine_batch SET remaining_quantity = remaining_quantity - ? WHERE id = ?`).bind(take, batch.id),
        db.prepare(
          `INSERT INTO poskestren_stock_movement(
             id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
             stock_before, stock_after, reference_type, reference_id, notes, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(generateId(), medicine.id, batch.id, date, input.movementType, -take, runningStock, runningStock - take, referenceType, referenceId, notes, session.id)
      )
      runningStock -= take
      remaining -= take
    }
  }
  statements.push(
    db.prepare(
      `UPDATE poskestren_medicine
       SET total_stock_base = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(runningStock, medicine.id)
  )
  await db.batch(statements)
  await audit(session, 'update', 'poskestren_medicine', medicine.id, `Mutasi stok ${medicine.name}: ${input.movementType}`, {
    quantity_base: quantity,
    stock_after: runningStock,
  })
  refresh()
  return { success: true as const }
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
