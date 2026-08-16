/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { requirePoskestrenFeature } from '@/lib/poskestren/access'
import {
  assertDate,
  cleanText,
  decodeCursor,
  encodeCursor,
  normalizePoskestrenListQuery,
  parsePositiveInteger,
} from '@/lib/poskestren/query'
import { POSKESTREN_HREF, type PoskestrenListQuery } from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.medicine

function normalizedMedicineKey(name: string, form: string, strength: string) {
  return [name, form, strength]
    .map(value => (cleanText(value, 160) || '').toLocaleLowerCase('id-ID').replace(/\s+/g, ' '))
    .join('|')
}

function refresh() {
  revalidatePath(PATH)
  revalidatePath(POSKESTREN_HREF.reports)
  revalidatePath(POSKESTREN_HREF.examination)
  revalidatePath(POSKESTREN_HREF.observation)
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

export async function getSimpleMedicineCatalog(input: PoskestrenListQuery = {}) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.status === 'active') where.push('is_active = 1')
  if (normalized.status === 'inactive') where.push('is_active = 0')
  if (normalized.status === 'empty') where.push('total_stock_base = 0')
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(name LIKE ? OR form LIKE ? OR strength LIKE ?)')
    params.push(like, like, like)
  }
  const rows = await query<any>(
    `SELECT id, name, category, form, strength, base_unit, minimum_stock_base,
            total_stock_base,
            COALESCE((SELECT quantity_base FROM poskestren_medicine_location_stock
                      WHERE medicine_id = poskestren_medicine.id
                        AND location_id = 'pos-location-central'), 0) AS central_stock_base,
            COALESCE((SELECT SUM(mls.quantity_base)
                      FROM poskestren_medicine_location_stock mls
                      JOIN poskestren_stock_location sl ON sl.id = mls.location_id
                      WHERE mls.medicine_id = poskestren_medicine.id
                        AND sl.location_type = 'DORM' AND sl.is_active = 1), 0) AS dorm_stock_base,
            is_active, created_at, updated_at
     FROM poskestren_medicine
     WHERE ${where.join(' AND ')}
     ORDER BY is_active DESC, name COLLATE NOCASE, id
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  return {
    items: rows.slice(0, normalized.limit),
    hasMore: rows.length > normalized.limit,
    truncated: normalized.isAll && rows.length > normalized.limit,
  }
}

export async function saveSimpleMedicine(input: {
  id?: string
  name: string
  form: string
  strength?: string
  isActive?: boolean
}) {
  const session = await requirePoskestrenFeature(PATH, input.id ? 'update' : 'create')
  const name = cleanText(input.name, 150)
  const form = cleanText(input.form, 80)
  const strength = cleanText(input.strength, 80) || ''
  if (!name || !form) return { success: false as const, error: 'Nama obat dan bentuk wajib diisi.' }
  const normalizedKey = normalizedMedicineKey(name, form, strength)
  const duplicate = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_medicine
     WHERE normalized_key = ? AND id <> ? LIMIT 1`,
    [normalizedKey, input.id || '']
  )
  if (duplicate) return { success: false as const, error: 'Obat dengan nama, bentuk, dan kekuatan yang sama sudah ada.' }

  const id = input.id || generateId()
  const db = await getDB()
  const statements: D1PreparedStatement[] = []
  if (input.id) {
    const exists = await queryOne<{ id: string }>('SELECT id FROM poskestren_medicine WHERE id = ?', [id])
    if (!exists) return { success: false as const, error: 'Obat tidak ditemukan.' }
    statements.push(db.prepare(
      `UPDATE poskestren_medicine
       SET name = ?, form = ?, strength = ?, base_unit = ?, normalized_key = ?,
           is_active = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(name, form, strength, form, normalizedKey, input.isActive === false ? 0 : 1, id))
  } else {
    statements.push(db.prepare(
      `INSERT INTO poskestren_medicine(
         id, name, form, strength, base_unit, normalized_key, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name, form, strength, form, normalizedKey, session.id))
  }
  statements.push(
    db.prepare(
      `INSERT OR IGNORE INTO poskestren_medicine_location_stock(
         medicine_id, location_id, quantity_base
       ) VALUES (?, 'pos-location-central', 0)`
    ).bind(id)
  )
  statements.push(
    db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'MEDICINE' AND entity_id = ?`).bind(id),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('MEDICINE', ?, ?)`
    ).bind(id, [name, form, strength].filter(Boolean).join(' '))
  )
  await db.batch(statements)
  await audit(session, input.id ? 'update' : 'create', 'poskestren_medicine', id, `${input.id ? 'Memperbarui' : 'Menambah'} obat ${name}`)
  refresh()
  return { success: true as const, id }
}

export type MedicineImportRow = {
  rowNumber: number
  id?: string
  name?: string
  form?: string
  strength?: string
}

export async function importMedicineRows(inputRows: MedicineImportRow[]) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return { success: false as const, error: 'Data impor kosong.' }
  }
  if (inputRows.length > 1000) {
    return { success: false as const, error: 'Impor dibatasi maksimal 1.000 baris.' }
  }

  const rows = inputRows.map(row => {
    const id = cleanText(row.id, 100) || ''
    const name = cleanText(row.name, 150) || ''
    const form = cleanText(row.form, 80) || ''
    const strength = cleanText(row.strength, 80) || ''
    return {
      rowNumber: Number(row.rowNumber) || 0,
      id,
      name,
      form,
      strength,
      key: name && form ? normalizedMedicineKey(name, form, strength) : '',
    }
  })
  const ids = [...new Set(rows.map(row => row.id).filter((value): value is string => Boolean(value)))]
  const keys = [...new Set(rows.map(row => row.key).filter((value): value is string => Boolean(value)))]
  const existing: Array<{ id: string; normalized_key: string | null }> = []
  for (let index = 0; index < Math.max(ids.length, keys.length); index += 80) {
    const idChunk = ids.slice(index, index + 80)
    const keyChunk = keys.slice(index, index + 80)
    const clauses: string[] = []
    const params: string[] = []
    if (idChunk.length) {
      clauses.push(`id IN (${idChunk.map(() => '?').join(',')})`)
      params.push(...idChunk)
    }
    if (keyChunk.length) {
      clauses.push(`normalized_key IN (${keyChunk.map(() => '?').join(',')})`)
      params.push(...keyChunk)
    }
    if (clauses.length) {
      existing.push(...await query<{ id: string; normalized_key: string | null }>(
        `SELECT id, normalized_key FROM poskestren_medicine WHERE ${clauses.join(' OR ')}`,
        params
      ))
    }
  }
  const byId = new Map(existing.map(row => [row.id, row]))
  const byKey = new Map(existing.filter(row => row.normalized_key).map(row => [row.normalized_key!, row]))
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  const result = { created: 0, updated: 0, duplicate: 0, invalid: 0, errors: [] as Array<{ rowNumber: number; message: string }> }
  const mutations: Array<{ mode: 'create' | 'update'; id: string; name: string; form: string; strength: string; key: string }> = []

  for (const row of rows) {
    if (!row.name || !row.form) {
      result.invalid++
      result.errors.push({ rowNumber: row.rowNumber, message: 'Nama Obat dan Bentuk wajib diisi.' })
      continue
    }
    if ((row.id && seenIds.has(row.id)) || seenKeys.has(row.key)) {
      result.duplicate++
      result.errors.push({ rowNumber: row.rowNumber, message: 'Duplikat di dalam file.' })
      continue
    }
    if (row.id) seenIds.add(row.id)
    seenKeys.add(row.key)
    const target = row.id ? byId.get(row.id) : byKey.get(row.key)
    if (row.id && !target) {
      result.invalid++
      result.errors.push({ rowNumber: row.rowNumber, message: 'ID Obat tidak ditemukan.' })
      continue
    }
    mutations.push({
      mode: target ? 'update' : 'create',
      id: target?.id || generateId(),
      name: row.name,
      form: row.form,
      strength: row.strength,
      key: row.key,
    })
  }

  const db = await getDB()
  const statements: D1PreparedStatement[] = []
  for (const row of mutations) {
    if (row.mode === 'update') {
      statements.push(db.prepare(
        `UPDATE poskestren_medicine
         SET name = ?, form = ?, strength = ?, base_unit = ?, normalized_key = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).bind(row.name, row.form, row.strength, row.form, row.key, row.id))
      result.updated++
    } else {
      statements.push(db.prepare(
        `INSERT INTO poskestren_medicine(
           id, name, form, strength, base_unit, normalized_key, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(row.id, row.name, row.form, row.strength, row.form, row.key, session.id))
      result.created++
    }
    statements.push(
      db.prepare(
        `INSERT OR IGNORE INTO poskestren_medicine_location_stock(
           medicine_id, location_id, quantity_base
         ) VALUES (?, 'pos-location-central', 0)`
      ).bind(row.id)
    )
    statements.push(
      db.prepare(`DELETE FROM poskestren_search_fts WHERE entity_type = 'MEDICINE' AND entity_id = ?`).bind(row.id),
      db.prepare(
        `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
         VALUES ('MEDICINE', ?, ?)`
      ).bind(row.id, [row.name, row.form, row.strength].filter(Boolean).join(' '))
    )
  }
  for (let index = 0; index < statements.length; index += 75) {
    await db.batch(statements.slice(index, index + 75))
  }
  await audit(session, 'create', 'poskestren_medicine_import', generateId(), 'Impor Excel katalog obat', result)
  refresh()
  return { success: true as const, ...result }
}

export async function getSimpleMedicineMasters() {
  await requirePoskestrenFeature(PATH)
  const [medicines, suppliers, locations] = await Promise.all([
    query<any>(
      `SELECT id, name, form, strength, base_unit, minimum_stock_base, total_stock_base,
              COALESCE((SELECT quantity_base FROM poskestren_medicine_location_stock
                        WHERE medicine_id = poskestren_medicine.id
                          AND location_id = 'pos-location-central'), 0) AS central_stock_base
       FROM poskestren_medicine WHERE is_active = 1
       ORDER BY name COLLATE NOCASE`
    ),
    query<any>(
      `SELECT id, name FROM poskestren_supplier WHERE is_active = 1
       ORDER BY name COLLATE NOCASE`
    ),
    query<any>(
      `SELECT id, location_type, name, asrama_name
       FROM poskestren_stock_location WHERE is_active = 1
       ORDER BY location_type, name COLLATE NOCASE`
    ),
  ])
  return { medicines, suppliers, locations }
}

export async function createAndReceiveSimplePurchase(input: {
  purchaseDate: string
  supplierId?: string
  supplierName?: string
  notes?: string
  items: Array<{ medicineId: string; quantity: number }>
}) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const purchaseDate = assertDate(input.purchaseDate)
  if (!input.items?.length) return { success: false as const, error: 'Minimal satu obat wajib diisi.' }
  const items = input.items.slice(0, 100).map((item, index) => ({
    medicineId: cleanText(item.medicineId, 100) || '',
    quantity: parsePositiveInteger(item.quantity, `Jumlah baris ${index + 1}`),
  }))
  if (items.some(item => !item.medicineId)) return { success: false as const, error: 'Pilih obat pada setiap baris.' }
  if (new Set(items.map(item => item.medicineId)).size !== items.length) {
    return { success: false as const, error: 'Obat yang sama tidak boleh diulang dalam satu belanja.' }
  }
  const medicineIds = items.map(item => item.medicineId)
  const medicines = await query<{ id: string; name: string; form: string; total_stock_base: number; central_stock_base: number }>(
    `SELECT m.id, m.name, m.form, m.total_stock_base,
            COALESCE((SELECT quantity_base FROM poskestren_medicine_location_stock
                      WHERE medicine_id = m.id AND location_id = 'pos-location-central'), 0) AS central_stock_base
     FROM poskestren_medicine m
     WHERE is_active = 1 AND id IN (${medicineIds.map(() => '?').join(',')})`,
    medicineIds
  )
  if (medicines.length !== medicineIds.length) return { success: false as const, error: 'Ada obat yang tidak valid.' }
  const medicineMap = new Map(medicines.map(row => [row.id, row]))
  const supplier = input.supplierId
    ? await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM poskestren_supplier WHERE id = ? AND is_active = 1',
      [input.supplierId]
    )
    : null
  const supplierName = supplier?.name || cleanText(input.supplierName, 150)
  if (!supplierName) return { success: false as const, error: 'Supplier wajib diisi.' }

  const purchaseId = generateId()
  const now = new Date().toISOString()
  const db = await getDB()
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_purchase(
         id, purchase_date, supplier_id, supplier_name, status, payment_status,
         total_rupiah, notes, created_by, received_by, received_at, updated_at
       ) VALUES (?, ?, ?, ?, 'RECEIVED', 'UNPOSTED', 0, ?, ?, ?, ?, ?)`
    ).bind(
      purchaseId, purchaseDate, supplier?.id || null, supplierName,
      cleanText(input.notes), session.id, session.id, now, now
    ),
  ]
  for (const item of items) {
    const medicine = medicineMap.get(item.medicineId)!
    const itemId = generateId()
    const before = Number(medicine.total_stock_base)
    const centralBefore = Number(medicine.central_stock_base)
    const after = before + item.quantity
    const centralAfter = centralBefore + item.quantity
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_purchase_item(
           id, purchase_id, medicine_id, unit_name, factor_to_base,
           quantity_package, quantity_base, unit_price, subtotal_rupiah, batch_number
         ) VALUES (?, ?, ?, ?, 1, ?, ?, 0, 0, '')`
      ).bind(itemId, purchaseId, item.medicineId, medicine.form, item.quantity, item.quantity),
      db.prepare(
        `INSERT OR IGNORE INTO poskestren_medicine_location_stock(
           medicine_id, location_id, quantity_base
         ) VALUES (?, 'pos-location-central', 0)`
      ).bind(item.medicineId),
      db.prepare(
        `UPDATE poskestren_medicine_location_stock
         SET quantity_base = quantity_base + ?, updated_at = datetime('now')
         WHERE medicine_id = ? AND location_id = 'pos-location-central'`
      ).bind(item.quantity, item.medicineId),
      db.prepare(
        `UPDATE poskestren_medicine
         SET total_stock_base = total_stock_base + ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(item.quantity, item.medicineId),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by,
           location_id
         ) VALUES (?, ?, NULL, ?, 'PURCHASE', ?, ?, ?, 'PURCHASE_ITEM', ?, ?, ?, 'pos-location-central')`
      ).bind(
        generateId(), item.medicineId, purchaseDate, item.quantity, before, after,
        itemId, `Belanja dari ${supplierName}`, session.id
      )
    )
  }
  await db.batch(statements)
  await audit(session, 'create', 'poskestren_purchase', purchaseId, `Mencatat belanja obat dari ${supplierName}`, {
    item_count: items.length,
  })
  refresh()
  return { success: true as const, id: purchaseId }
}

export async function getSimplePurchases(input: PoskestrenListQuery = {}) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.from) { where.push('p.purchase_date >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('p.purchase_date <= ?'); params.push(normalized.to) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push(`(p.supplier_name LIKE ? OR p.notes LIKE ? OR EXISTS (
      SELECT 1 FROM poskestren_purchase_item pi
      JOIN poskestren_medicine m ON m.id = pi.medicine_id
      WHERE pi.purchase_id = p.id AND m.name LIKE ?
    ))`)
    params.push(like, like, like)
  }
  const cursor = decodeCursor(normalized.cursor)
  if (cursor?.length === 3) {
    where.push(`(p.purchase_date < ? OR (p.purchase_date = ? AND p.created_at < ?)
      OR (p.purchase_date = ? AND p.created_at = ? AND p.id < ?))`)
    params.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }
  const rows = await query<any>(
    `SELECT p.id, p.purchase_date, p.supplier_name, p.status, p.notes, p.created_at,
            COUNT(pi.id) AS item_count,
            GROUP_CONCAT(m.name || ' (' || pi.quantity_base || ' ' || m.form || ')', ', ') AS item_summary
     FROM poskestren_purchase p
     LEFT JOIN poskestren_purchase_item pi ON pi.purchase_id = p.id
     LEFT JOIN poskestren_medicine m ON m.id = pi.medicine_id
     WHERE ${where.join(' AND ')}
     GROUP BY p.id
     ORDER BY p.purchase_date DESC, p.created_at DESC, p.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return {
    items,
    hasMore: rows.length > normalized.limit,
    nextCursor: rows.length > normalized.limit && last
      ? encodeCursor([last.purchase_date, last.created_at, last.id])
      : null,
  }
}

export async function getSimpleStockMovements(
  input: PoskestrenListQuery & { medicineId?: string; movementType?: string } = {}
) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (input.medicineId) { where.push('sm.medicine_id = ?'); params.push(input.medicineId) }
  if (input.movementType && input.movementType !== 'TRANSFER') { where.push('sm.movement_type = ?'); params.push(input.movementType) }
  if (normalized.from) { where.push('sm.movement_date >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('sm.movement_date <= ?'); params.push(normalized.to) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(m.name LIKE ? OR sm.notes LIKE ? OR sm.reference_id LIKE ?)')
    params.push(like, like, like)
  }
  const cursor = decodeCursor(normalized.cursor)
  if (cursor?.length === 3) {
    where.push(`(sm.movement_date < ? OR (sm.movement_date = ? AND sm.created_at < ?)
      OR (sm.movement_date = ? AND sm.created_at = ? AND sm.id < ?))`)
    params.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }
  const rows = input.movementType === 'TRANSFER' ? [] : await query<any>(
    `SELECT sm.id, sm.id AS sort_id, sm.movement_date, sm.movement_type, sm.quantity_delta,
            sm.stock_before, sm.stock_after, sm.reference_type, sm.reference_id,
            sm.location_id, sl.name AS location_name,
            sm.notes, sm.created_at, m.name AS medicine_name, m.form,
            CASE
              WHEN sm.reference_type LIKE 'QUICK_%' THEN 'TRANSAKSI CEPAT'
              WHEN sm.reference_type LIKE 'DORM_%' THEN 'OBSERVASI ASRAMA'
              WHEN sm.reference_type LIKE 'PREVENTIVE_%' THEN 'PREVENTIF'
              WHEN sm.reference_type LIKE 'PRESCRIPTION_%' THEN 'PEMERIKSAAN'
              WHEN sm.reference_type = 'PURCHASE_ITEM' THEN 'BELANJA'
              WHEN sm.reference_type = 'STOCKTAKE_ITEM' THEN 'OPNAME'
              ELSE 'OBAT'
            END AS source_module
     FROM poskestren_stock_movement sm
     JOIN poskestren_medicine m ON m.id = sm.medicine_id
     LEFT JOIN poskestren_stock_location sl ON sl.id = sm.location_id
     WHERE ${where.join(' AND ')}
     ORDER BY sm.movement_date DESC, sm.created_at DESC, sm.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const transferWhere = ['t.status = \'COMPLETED\'']
  const transferParams: unknown[] = []
  if (input.medicineId) { transferWhere.push('ti.medicine_id = ?'); transferParams.push(input.medicineId) }
  if (normalized.from) { transferWhere.push('t.transfer_date >= ?'); transferParams.push(normalized.from) }
  if (normalized.to) { transferWhere.push('t.transfer_date <= ?'); transferParams.push(normalized.to) }
  if (normalized.q) {
    const like = `%${normalized.q}%`
    transferWhere.push('(m.name LIKE ? OR t.notes LIKE ? OR sl.name LIKE ? OR dl.name LIKE ?)')
    transferParams.push(like, like, like, like)
  }
  // Kartu Stok menggabungkan dua sumber (movement + transfer) di satu cursor
  // gabungan, jadi cursor 3-bagian yang sama harus diterapkan ke KEDUA query,
  // memakai id mentah masing-masing tabel (ti.id, bukan id gabungan 'transfer-...').
  if (cursor?.length === 3) {
    transferWhere.push(`(t.transfer_date < ? OR (t.transfer_date = ? AND t.created_at < ?)
      OR (t.transfer_date = ? AND t.created_at = ? AND ti.id < ?))`)
    transferParams.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }
  const transfers = input.movementType && input.movementType !== 'TRANSFER' ? [] : await query<any>(
    `SELECT 'transfer-' || ti.id AS id, ti.id AS sort_id, t.transfer_date AS movement_date,
            'TRANSFER' AS movement_type, ti.quantity_base AS quantity_delta,
            0 AS stock_before, 0 AS stock_after, 'STOCK_TRANSFER' AS reference_type,
            t.id AS reference_id, t.source_location_id AS location_id,
            sl.name AS location_name, dl.name AS destination_name,
            ('Transfer ' || sl.name || ' → ' || dl.name) AS notes,
            t.created_at, m.name AS medicine_name, m.form,
            'TRANSFER ASRAMA' AS source_module
     FROM poskestren_stock_transfer t
     JOIN poskestren_stock_transfer_item ti ON ti.transfer_id = t.id
     JOIN poskestren_medicine m ON m.id = ti.medicine_id
     JOIN poskestren_stock_location sl ON sl.id = t.source_location_id
     JOIN poskestren_stock_location dl ON dl.id = t.destination_location_id
     WHERE ${transferWhere.join(' AND ')}
     ORDER BY t.transfer_date DESC, t.created_at DESC, ti.id DESC
     LIMIT ?`,
    [...transferParams, normalized.limit + 1]
  )
  const combined = [...rows, ...transfers].sort((left, right) => {
    const date = String(right.movement_date).localeCompare(String(left.movement_date))
    if (date) return date
    const created = String(right.created_at).localeCompare(String(left.created_at))
    return created || String(right.sort_id).localeCompare(String(left.sort_id))
  })
  const items = combined.slice(0, normalized.limit)
  const last = items.at(-1)
  return {
    items,
    hasMore: combined.length > normalized.limit,
    nextCursor: combined.length > normalized.limit && last
      ? encodeCursor([last.movement_date, last.created_at, last.sort_id])
      : null,
  }
}
