/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { requirePoskestrenFeature } from '@/lib/poskestren/access'
import { assertDate, cleanText, parseNonNegativeInteger, parsePositiveInteger } from '@/lib/poskestren/query'
import { prepareStockMutation } from '@/lib/poskestren/stock'
import { POSKESTREN_HREF } from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.medicine

function normalizedKey(value: string) {
  return (cleanText(value, 160) || '').toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')
}

function locationIdForDorm(asrama: string) {
  const key = normalizedKey(asrama).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
  return `pos-location-dorm-${key || 'unknown'}`
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

async function ensureDormLocation(asrama: string, actorId?: string | null) {
  const cleanAsrama = cleanText(asrama, 120)
  if (!cleanAsrama) throw new Error('Asrama wajib dipilih.')
  const key = normalizedKey(cleanAsrama)
  const existing = await queryOne<{ id: string; name: string; is_active: number }>(
    `SELECT id, name, is_active FROM poskestren_stock_location WHERE normalized_key = ?`,
    [key]
  )
  if (existing) {
    if (Number(existing.is_active) !== 1) throw new Error('Lokasi asrama sudah nonaktif.')
    return existing
  }
  const id = locationIdForDorm(cleanAsrama)
  const db = await getDB()
  await db.prepare(
    `INSERT OR IGNORE INTO poskestren_stock_location(
       id, location_type, name, normalized_key, asrama_name, created_by
     ) VALUES (?, 'DORM', ?, ?, ?, ?)`
  ).bind(id, cleanAsrama, key, cleanAsrama, actorId || null).run()
  return { id, name: cleanAsrama, is_active: 1 }
}

async function getLocation(locationId?: string | null) {
  const id = cleanText(locationId, 120) || 'pos-location-central'
  const location = await queryOne<any>(
    `SELECT id, location_type, name, normalized_key, asrama_name, is_active
     FROM poskestren_stock_location WHERE id = ?`,
    [id]
  )
  if (!location || Number(location.is_active) !== 1) throw new Error('Lokasi stok tidak ditemukan atau nonaktif.')
  return location
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function asInteger(value: unknown, label: string, minimum = 0) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`${label} harus berupa bilangan bulat${minimum ? ' positif' : ' tidak negatif'}.`)
  return parsed
}

export async function getMedicineWorkflowMasters() {
  await requirePoskestrenFeature(PATH)
  const [medicines, suppliers, locations, santri, guru, dorms] = await Promise.all([
    query<any>(
      `SELECT m.id, m.name, m.form, m.strength, m.base_unit, m.category,
              m.minimum_stock_base, m.total_stock_base,
              COALESCE((SELECT quantity_base FROM poskestren_medicine_location_stock
                        WHERE medicine_id = m.id AND location_id = 'pos-location-central'), 0) AS central_stock_base
       FROM poskestren_medicine m
       WHERE m.is_active = 1
       ORDER BY m.name COLLATE NOCASE, m.form, m.strength`
    ),
    query<any>(`SELECT id, name FROM poskestren_supplier WHERE is_active = 1 ORDER BY name COLLATE NOCASE`),
    query<any>(
      `SELECT id, location_type, name, asrama_name
       FROM poskestren_stock_location WHERE is_active = 1
       ORDER BY location_type, name COLLATE NOCASE`
    ),
    query<any>(
      `SELECT id, nama_lengkap, nis, asrama
       FROM santri WHERE status_global = 'aktif'
       ORDER BY nama_lengkap COLLATE NOCASE LIMIT 3000`
    ),
    query<any>(
      `SELECT id, nama_lengkap, gelar, kode_guru
       FROM data_guru ORDER BY nama_lengkap COLLATE NOCASE LIMIT 1000`
    ),
    query<any>(
      `SELECT DISTINCT TRIM(asrama) AS name
       FROM santri
       WHERE status_global = 'aktif' AND TRIM(COALESCE(asrama, '')) <> ''
       ORDER BY name COLLATE NOCASE`
    ),
  ])
  return { medicines, suppliers, locations, santri, guru, dorms }
}

export async function getMedicineLocationBalances(locationId: string) {
  await requirePoskestrenFeature(PATH)
  const location = await getLocation(locationId)
  return query<any>(
    `SELECT m.id, m.name, m.form, m.strength, m.base_unit,
            COALESCE(mls.quantity_base, 0) AS counted_quantity
     FROM poskestren_medicine m
     LEFT JOIN poskestren_medicine_location_stock mls
       ON mls.medicine_id = m.id AND mls.location_id = ?
     WHERE m.is_active = 1
     ORDER BY m.name COLLATE NOCASE, m.form, m.strength`,
    [location.id]
  )
}

export async function createQuickMedicineIssue(input: {
  issueDate: string
  recipientType: 'SANTRI' | 'GURU'
  santriId?: string
  guruId?: number | string
  sourceLocationId: string
  purpose: 'PRIBADI' | 'RESEP_DOKTER' | 'LAINNYA'
  notes?: string
  idempotencyKey?: string
  items: Array<{ medicineId: string; quantity: number }>
}) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const issueDate = assertDate(input.issueDate)
  if (!['SANTRI', 'GURU'].includes(input.recipientType)) return { success: false as const, error: 'Jenis penerima tidak valid.' }
  if (!['PRIBADI', 'RESEP_DOKTER', 'LAINNYA'].includes(input.purpose)) return { success: false as const, error: 'Tujuan obat tidak valid.' }
  const source = await getLocation(input.sourceLocationId)
  const issueId = cleanText(input.idempotencyKey, 120) || generateId()
  const existing = await queryOne<{ id: string }>('SELECT id FROM poskestren_medicine_issue WHERE id = ?', [issueId])
  if (existing) return { success: true as const, id: issueId, idempotent: true as const }

  let recipientName = ''
  let santriId: string | null = null
  let guruId: number | null = null
  let asramaSnapshot: string | null = null
  if (input.recipientType === 'SANTRI') {
    santriId = cleanText(input.santriId, 120) || null
    const recipient = santriId
      ? await queryOne<{ id: string; nama_lengkap: string; asrama: string | null }>(
        `SELECT id, nama_lengkap, asrama FROM santri WHERE id = ? AND status_global = 'aktif'`,
        [santriId]
      )
      : null
    if (!recipient) return { success: false as const, error: 'Santri wajib dipilih dan harus aktif.' }
    recipientName = recipient.nama_lengkap
    asramaSnapshot = cleanText(recipient.asrama, 120) || null
  } else {
    const parsedGuruId = Number(input.guruId)
    guruId = Number.isInteger(parsedGuruId) && parsedGuruId > 0 ? parsedGuruId : null
    const recipient = guruId
      ? await queryOne<{ id: number; nama_lengkap: string }>('SELECT id, nama_lengkap FROM data_guru WHERE id = ?', [guruId])
      : null
    if (!recipient) return { success: false as const, error: 'Guru wajib dipilih dan harus valid.' }
    recipientName = recipient.nama_lengkap
  }

  if (!Array.isArray(input.items) || input.items.length === 0) return { success: false as const, error: 'Minimal satu obat wajib diisi.' }
  const items = input.items.slice(0, 100).map((item, index) => ({
    medicineId: cleanText(item.medicineId, 120) || '',
    quantity: parsePositiveInteger(item.quantity, `Jumlah obat baris ${index + 1}`),
  }))
  if (items.some(item => !item.medicineId)) return { success: false as const, error: 'Obat wajib dipilih pada setiap baris.' }
  if (new Set(items.map(item => item.medicineId)).size !== items.length) return { success: false as const, error: 'Obat yang sama tidak boleh diulang.' }

  const db = await getDB()
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_medicine_issue(
         id, issue_date, recipient_type, santri_id, guru_id, recipient_name,
         asrama_snapshot, source_location_id, purpose, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(issueId, issueDate, input.recipientType, santriId, guruId, recipientName, asramaSnapshot, source.id, input.purpose, cleanText(input.notes, 500), session.id),
  ]
  for (const item of items) {
    const itemId = generateId()
    const mutation = await prepareStockMutation(db, {
      medicineId: item.medicineId,
      quantityDelta: -item.quantity,
      movementType: 'PATIENT',
      movementDate: issueDate,
      referenceType: 'QUICK_MEDICINE_ISSUE',
      referenceId: itemId,
      actorId: session.id,
      notes: `${input.purpose} · ${recipientName}`,
      locationId: source.id,
    })
    statements.push(
      ...mutation.statements,
      db.prepare(
        `INSERT INTO poskestren_medicine_issue_item(id, issue_id, medicine_id, quantity_base)
         VALUES (?, ?, ?, ?)`
      ).bind(itemId, issueId, item.medicineId, item.quantity)
    )
  }
  await db.batch(statements)
  await audit(session, 'create', 'poskestren_medicine_issue', issueId, `Obat keluar untuk ${recipientName}`, {
    recipient_type: input.recipientType,
    source_location_id: source.id,
    item_count: items.length,
  })
  refresh()
  return { success: true as const, id: issueId }
}

export async function createDormStockTransfer(input: {
  transferDate: string
  sourceLocationId: string
  destinationAsrama: string
  notes?: string
  idempotencyKey?: string
  items: Array<{ medicineId: string; quantity: number }>
}) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const transferDate = assertDate(input.transferDate)
  const source = await getLocation(input.sourceLocationId)
  const destination = await ensureDormLocation(input.destinationAsrama, session.id)
  if (source.id === destination.id) return { success: false as const, error: 'Lokasi asal dan tujuan harus berbeda.' }
  const transferId = cleanText(input.idempotencyKey, 120) || generateId()
  const existing = await queryOne<{ id: string }>('SELECT id FROM poskestren_stock_transfer WHERE id = ?', [transferId])
  if (existing) return { success: true as const, id: transferId, idempotent: true as const }
  if (!input.items?.length) return { success: false as const, error: 'Minimal satu obat wajib ditransfer.' }
  const items = input.items.slice(0, 100).map((item, index) => ({
    medicineId: cleanText(item.medicineId, 120),
    quantity: parsePositiveInteger(item.quantity, `Jumlah transfer baris ${index + 1}`),
  }))
  if (items.some(item => !item.medicineId)) return { success: false as const, error: 'Obat wajib dipilih pada setiap baris.' }
  if (new Set(items.map(item => item.medicineId)).size !== items.length) return { success: false as const, error: 'Obat yang sama tidak boleh diulang.' }

  const ids = items.map(item => item.medicineId)
  const medicines = await query<any>(
    `SELECT id, name FROM poskestren_medicine WHERE is_active = 1 AND id IN (${ids.map(() => '?').join(',')})`,
    ids
  )
  if (medicines.length !== ids.length) return { success: false as const, error: 'Ada obat yang tidak valid.' }
  const medicineNames = new Map(medicines.map(item => [item.id, item.name]))
  const db = await getDB()
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_stock_transfer(
         id, source_location_id, destination_location_id, transfer_date, status, notes, created_by
       ) VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?)`
    ).bind(transferId, source.id, destination.id, transferDate, cleanText(input.notes, 500), session.id),
  ]
  for (const item of items) {
    const stocks = await query<any>(
      `SELECT location_id, quantity_base
       FROM poskestren_medicine_location_stock
       WHERE medicine_id = ? AND location_id IN (?, ?)`,
      [item.medicineId, source.id, destination.id]
    )
    const sourceBefore = asNumber(stocks.find(row => row.location_id === source.id)?.quantity_base)
    const destinationBefore = asNumber(stocks.find(row => row.location_id === destination.id)?.quantity_base)
    const sourceAfter = sourceBefore - item.quantity
    if (sourceAfter < 0) return { success: false as const, error: `Stok ${medicineNames.get(item.medicineId)} di ${source.name} tidak cukup. Tersedia ${sourceBefore}.` }
    const destinationAfter = destinationBefore + item.quantity
    statements.push(
      db.prepare(`INSERT OR IGNORE INTO poskestren_medicine_location_stock(medicine_id, location_id, quantity_base) VALUES (?, ?, 0)`).bind(item.medicineId, source.id),
      db.prepare(`INSERT OR IGNORE INTO poskestren_medicine_location_stock(medicine_id, location_id, quantity_base) VALUES (?, ?, 0)`).bind(item.medicineId, destination.id),
      db.prepare(
        `UPDATE poskestren_medicine_location_stock
         SET quantity_base = ?, updated_at = datetime('now')
         WHERE medicine_id = ? AND location_id = ? AND quantity_base = ?`
      ).bind(sourceAfter, item.medicineId, source.id, sourceBefore),
      db.prepare(
        `UPDATE poskestren_medicine_location_stock
         SET quantity_base = ?, updated_at = datetime('now')
         WHERE medicine_id = ? AND location_id = ? AND quantity_base = ?`
      ).bind(destinationAfter, item.medicineId, destination.id, destinationBefore),
      db.prepare(
        `INSERT INTO poskestren_stock_transfer_item(
           id, transfer_id, medicine_id, quantity_base, source_before, source_after,
           destination_before, destination_after
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(generateId(), transferId, item.medicineId, item.quantity, sourceBefore, sourceAfter, destinationBefore, destinationAfter)
    )
  }
  await db.batch(statements)
  await audit(session, 'create', 'poskestren_stock_transfer', transferId, `Transfer stok ke ${destination.name}`, {
    source_location_id: source.id,
    destination_location_id: destination.id,
    item_count: items.length,
  })
  refresh()
  return { success: true as const, id: transferId }
}

export async function createBulkStocktake(input: {
  opnameDate: string
  locationId: string
  notes?: string
  idempotencyKey?: string
  items: Array<{ medicineId: string; countedQuantity: number }>
}) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const opnameDate = assertDate(input.opnameDate)
  const location = await getLocation(input.locationId)
  const stocktakeId = cleanText(input.idempotencyKey, 120) || generateId()
  const existing = await queryOne<{ id: string }>('SELECT id FROM poskestren_stocktake WHERE id = ?', [stocktakeId])
  if (existing) return { success: true as const, id: stocktakeId, idempotent: true as const }
  if (!input.items?.length) return { success: false as const, error: 'Minimal satu baris opname wajib diisi.' }
  const items = input.items.slice(0, 1000).map((item, index) => ({
    medicineId: cleanText(item.medicineId, 120) || '',
    countedQuantity: parseNonNegativeInteger(item.countedQuantity, `Saldo fisik baris ${index + 1}`),
  }))
  if (items.some(item => !item.medicineId)) return { success: false as const, error: 'Obat wajib dipilih.' }
  if (new Set(items.map(item => item.medicineId)).size !== items.length) return { success: false as const, error: 'Obat yang sama tidak boleh diulang.' }
  const ids = items.map(item => item.medicineId)
  const medicines = await query<any>(
    `SELECT id, name FROM poskestren_medicine WHERE is_active = 1 AND id IN (${ids.map(() => '?').join(',')})`,
    ids
  )
  if (medicines.length !== ids.length) return { success: false as const, error: 'Ada obat yang tidak valid.' }
  const db = await getDB()
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_stocktake(id, opname_date, location_id, status, notes, created_by)
       VALUES (?, ?, ?, 'POSTED', ?, ?)`
    ).bind(stocktakeId, opnameDate, location.id, cleanText(input.notes, 500), session.id),
  ]
  for (const item of items) {
    const current = await queryOne<{ quantity_base: number }>(
      `SELECT quantity_base FROM poskestren_medicine_location_stock WHERE medicine_id = ? AND location_id = ?`,
      [item.medicineId, location.id]
    )
    const before = asNumber(current?.quantity_base)
    const delta = item.countedQuantity - before
    const itemId = generateId()
    if (delta !== 0) {
      const mutation = await prepareStockMutation(db, {
        medicineId: item.medicineId,
        quantityDelta: delta,
        movementType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        movementDate: opnameDate,
        referenceType: 'STOCKTAKE_ITEM',
        referenceId: itemId,
        actorId: session.id,
        notes: cleanText(input.notes, 500) || `Opname ${location.name}`,
        locationId: location.id,
      })
      statements.push(...mutation.statements)
    }
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_stocktake_item(
           id, stocktake_id, medicine_id, counted_quantity, before_quantity, delta_quantity
         ) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(itemId, stocktakeId, item.medicineId, item.countedQuantity, before, delta)
    )
  }
  await db.batch(statements)
  await audit(session, 'update', 'poskestren_stocktake', stocktakeId, `Opname ${location.name}`, {
    location_id: location.id,
    item_count: items.length,
  })
  refresh()
  return { success: true as const, id: stocktakeId }
}

export async function getMedicinePlanning(input: { year: number }) {
  await requirePoskestrenFeature(PATH)
  const year = asInteger(input.year, 'Tahun', 2000)
  if (year > 2100) throw new Error('Tahun perencanaan tidak valid.')
  const rows = await query<any>(
    `SELECT m.id, m.name, m.form, m.strength, m.base_unit, m.category,
            m.minimum_stock_base, m.total_stock_base,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '01' THEN -sm.quantity_delta ELSE 0 END) AS jan,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '02' THEN -sm.quantity_delta ELSE 0 END) AS feb,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '03' THEN -sm.quantity_delta ELSE 0 END) AS mar,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '04' THEN -sm.quantity_delta ELSE 0 END) AS apr,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '05' THEN -sm.quantity_delta ELSE 0 END) AS mei,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '06' THEN -sm.quantity_delta ELSE 0 END) AS jun,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '07' THEN -sm.quantity_delta ELSE 0 END) AS jul,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '08' THEN -sm.quantity_delta ELSE 0 END) AS aug,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '09' THEN -sm.quantity_delta ELSE 0 END) AS sep,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '10' THEN -sm.quantity_delta ELSE 0 END) AS oct,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '11' THEN -sm.quantity_delta ELSE 0 END) AS nov,
            SUM(CASE WHEN strftime('%m', sm.movement_date) = '12' THEN -sm.quantity_delta ELSE 0 END) AS des
     FROM poskestren_medicine m
     LEFT JOIN poskestren_stock_movement sm
       ON sm.medicine_id = m.id
      AND sm.quantity_delta < 0
      AND sm.movement_type IN ('PATIENT','PREVENTIVE')
      AND strftime('%Y', sm.movement_date) = ?
     WHERE m.is_active = 1
     GROUP BY m.id
     ORDER BY m.name COLLATE NOCASE, m.form, m.strength`,
    [String(year)]
  )
  return rows.map(row => {
    const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'des']
      .map(month => asNumber(row[month]))
    const total = months.reduce((sum, value) => sum + value, 0)
    const ca = total / 3
    const dailyAverage = ca / 30
    const safetyStock = ca * 0.2
    const leadTimeStock = dailyAverage * 10
    const planningQuantity = ca + safetyStock + leadTimeStock - asNumber(row.total_stock_base)
    return {
      ...row,
      months,
      total_usage: total,
      ca_quantity: ca,
      daily_average: dailyAverage,
      safety_stock: safetyStock,
      lead_time_stock: leadTimeStock,
      planning_quantity: planningQuantity,
      total_stock_base: asNumber(row.total_stock_base),
    }
  })
}

function cleanOrderItems(items: any[]) {
  if (!Array.isArray(items) || !items.length) throw new Error('Minimal satu obat wajib dimasukkan ke pesanan.')
  const cleaned = items.slice(0, 1000).map((item, index) => ({
    medicineId: cleanText(item.medicineId, 120),
    unitName: cleanText(item.unitName, 80) || 'UNIT',
    totalUsage: asNumber(item.totalUsage),
    caQuantity: asNumber(item.caQuantity),
    dailyAverage: asNumber(item.dailyAverage),
    safetyStock: asNumber(item.safetyStock),
    leadTimeStock: asNumber(item.leadTimeStock),
    totalStockSnapshot: asInteger(item.totalStockSnapshot, `Stok snapshot baris ${index + 1}`),
    planningQuantity: asNumber(item.planningQuantity),
    orderQuantity: asInteger(item.orderQuantity, `Jumlah pemesanan baris ${index + 1}`),
    notes: cleanText(item.notes, 300),
  }))
  if (cleaned.some(item => !item.medicineId)) throw new Error('Obat wajib dipilih pada setiap baris pesanan.')
  if (new Set(cleaned.map(item => item.medicineId)).size !== cleaned.length) throw new Error('Obat yang sama tidak boleh diulang dalam pesanan.')
  return cleaned
}

export async function createMedicineOrder(input: {
  planYear: number
  orderDate: string
  supplierId?: string
  supplierName?: string
  notes?: string
  idempotencyKey?: string
  items: Array<Record<string, unknown>>
}) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const planYear = asInteger(input.planYear, 'Tahun', 2000)
  if (planYear > 2100) return { success: false as const, error: 'Tahun perencanaan tidak valid.' }
  const orderDate = assertDate(input.orderDate)
  const orderId = cleanText(input.idempotencyKey, 120) || generateId()
  const existing = await queryOne<{ id: string }>('SELECT id FROM poskestren_medicine_order WHERE id = ?', [orderId])
  if (existing) return { success: true as const, id: orderId, idempotent: true as const }
  let supplier: { id: string; name: string } | null = null
  if (input.supplierId) {
    supplier = await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM poskestren_supplier WHERE id = ? AND is_active = 1',
      [cleanText(input.supplierId, 120)]
    )
    if (!supplier) return { success: false as const, error: 'Supplier tersimpan tidak valid.' }
  }
  const supplierName = supplier?.name || cleanText(input.supplierName, 150) || null
  const items = cleanOrderItems(input.items)
  const ids = items.map(item => item.medicineId)
  const medicines = await query<any>(
    `SELECT id, form, base_unit FROM poskestren_medicine WHERE is_active = 1 AND id IN (${ids.map(() => '?').join(',')})`,
    ids
  )
  if (medicines.length !== ids.length) return { success: false as const, error: 'Ada obat pesanan yang tidak valid.' }
  const medicineMap = new Map(medicines.map(item => [item.id, item]))
  const db = await getDB()
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_medicine_order(
         id, plan_year, order_date, status, supplier_id, supplier_name, notes, created_by
       ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?)`
    ).bind(orderId, planYear, orderDate, supplier?.id || null, supplierName, cleanText(input.notes, 500), session.id),
  ]
  for (const item of items) {
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_medicine_order_item(
           id, order_id, medicine_id, unit_name, total_usage, ca_quantity,
           daily_average, safety_stock, lead_time_stock, total_stock_snapshot,
           planning_quantity, order_quantity, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(), orderId, item.medicineId, item.unitName || medicineMap.get(item.medicineId)?.base_unit || 'UNIT',
        item.totalUsage, item.caQuantity, item.dailyAverage, item.safetyStock, item.leadTimeStock,
        item.totalStockSnapshot, item.planningQuantity, item.orderQuantity, item.notes
      )
    )
  }
  await db.batch(statements)
  await audit(session, 'create', 'poskestren_medicine_order', orderId, `Membuat draft pesanan obat`, { item_count: items.length })
  refresh()
  return { success: true as const, id: orderId }
}

export async function setMedicineOrderStatus(input: { orderId: string; status: 'ORDERED' | 'CANCELLED' }) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const orderId = cleanText(input.orderId, 120)
  if (!orderId || !['ORDERED', 'CANCELLED'].includes(input.status)) return { success: false as const, error: 'Status pesanan tidak valid.' }
  const order = await queryOne<{ id: string; status: string }>('SELECT id, status FROM poskestren_medicine_order WHERE id = ?', [orderId])
  if (!order) return { success: false as const, error: 'Pesanan tidak ditemukan.' }
  if (['RECEIVED', 'CANCELLED'].includes(order.status)) return { success: false as const, error: 'Pesanan sudah final.' }
  const db = await getDB()
  await db.prepare(
    `UPDATE poskestren_medicine_order SET status = ?, updated_at = datetime('now') WHERE id = ? AND status NOT IN ('RECEIVED','CANCELLED')`
  ).bind(input.status, orderId).run()
  await audit(session, 'update', 'poskestren_medicine_order', orderId, `Mengubah status pesanan menjadi ${input.status}`)
  refresh()
  return { success: true as const }
}

export async function getMedicineOrders(input: { year?: number } = {}) {
  await requirePoskestrenFeature(PATH)
  const year = input.year ? asInteger(input.year, 'Tahun', 2000) : null
  const rows = await query<any>(
    `SELECT o.id, o.plan_year, o.order_date, o.status, o.supplier_name, o.notes, o.created_at,
            COUNT(oi.id) AS item_count,
            SUM(oi.order_quantity) AS order_quantity,
            SUM(oi.received_quantity) AS received_quantity,
            GROUP_CONCAT(m.name || ' (' || oi.order_quantity || ' ' || oi.unit_name || ')', ', ') AS item_summary
     FROM poskestren_medicine_order o
     LEFT JOIN poskestren_medicine_order_item oi ON oi.order_id = o.id
     LEFT JOIN poskestren_medicine m ON m.id = oi.medicine_id
     WHERE (? IS NULL OR o.plan_year = ?)
     GROUP BY o.id
     ORDER BY o.order_date DESC, o.created_at DESC, o.id DESC
     LIMIT 200`,
    [year, year]
  )
  return rows
}

export async function getMedicineOrderForReceiving(orderId: string) {
  await requirePoskestrenFeature(PATH)
  const order = await queryOne<any>(
    `SELECT o.id, o.plan_year, o.order_date, o.status, o.supplier_id, o.supplier_name, o.notes
     FROM poskestren_medicine_order o WHERE o.id = ?`,
    [cleanText(orderId, 120)]
  )
  if (!order) return null
  const items = await query<any>(
    `SELECT oi.id, oi.medicine_id, m.name, m.form, m.strength, oi.unit_name,
            oi.order_quantity, oi.received_quantity,
            oi.order_quantity - oi.received_quantity AS remaining_quantity
     FROM poskestren_medicine_order_item oi
     JOIN poskestren_medicine m ON m.id = oi.medicine_id
     WHERE oi.order_id = ? ORDER BY m.name COLLATE NOCASE`,
    [order.id]
  )
  return { order, items }
}

export async function receiveMedicineOrder(input: {
  orderId: string
  purchaseDate: string
  supplierId?: string
  supplierName?: string
  notes?: string
  receiptId?: string
  items: Array<{ orderItemId: string; quantity: number }>
}) {
  const session = await requirePoskestrenFeature(PATH, 'create')
  const orderId = cleanText(input.orderId, 120)
  const purchaseDate = assertDate(input.purchaseDate)
  const purchaseId = cleanText(input.receiptId, 120) || generateId()
  const existingPurchase = await queryOne<{ id: string }>('SELECT id FROM poskestren_purchase WHERE id = ?', [purchaseId])
  if (existingPurchase) return { success: true as const, id: purchaseId, idempotent: true as const }
  const order = await queryOne<any>(
    `SELECT id, status, supplier_id, supplier_name FROM poskestren_medicine_order WHERE id = ?`,
    [orderId]
  )
  if (!order) return { success: false as const, error: 'Pesanan tidak ditemukan.' }
  if (['CANCELLED', 'RECEIVED'].includes(order.status)) return { success: false as const, error: 'Pesanan sudah tidak dapat diterima.' }
  const cleanedItems = (input.items || []).slice(0, 1000).map((item, index) => ({
    orderItemId: cleanText(item.orderItemId, 120),
    quantity: parsePositiveInteger(item.quantity, `Jumlah penerimaan baris ${index + 1}`),
  }))
  if (!cleanedItems.length) return { success: false as const, error: 'Masukkan jumlah barang yang datang.' }
  if (new Set(cleanedItems.map(item => item.orderItemId)).size !== cleanedItems.length) return { success: false as const, error: 'Item pesanan tidak boleh diulang.' }
  const supplier = input.supplierId
    ? await queryOne<{ id: string; name: string }>('SELECT id, name FROM poskestren_supplier WHERE id = ? AND is_active = 1', [cleanText(input.supplierId, 120)])
    : null
  const supplierName = supplier?.name || cleanText(input.supplierName, 150) || order.supplier_name
  if (!supplierName) return { success: false as const, error: 'Supplier saat penerimaan wajib dikonfirmasi.' }
  const itemIds = cleanedItems.map(item => item.orderItemId)
  const orderItems = await query<any>(
    `SELECT oi.id, oi.order_id, oi.medicine_id, oi.unit_name, oi.order_quantity, oi.received_quantity,
            m.name, m.form, m.total_stock_base,
            COALESCE((SELECT quantity_base FROM poskestren_medicine_location_stock
                      WHERE medicine_id = m.id AND location_id = 'pos-location-central'), 0) AS central_stock_base
     FROM poskestren_medicine_order_item oi
     JOIN poskestren_medicine m ON m.id = oi.medicine_id
     WHERE oi.order_id = ? AND oi.id IN (${itemIds.map(() => '?').join(',')})`,
    [orderId, ...itemIds]
  )
  if (orderItems.length !== itemIds.length) return { success: false as const, error: 'Ada item penerimaan yang tidak berasal dari pesanan.' }
  const itemMap = new Map(orderItems.map(item => [item.id, item]))
  for (const item of cleanedItems) {
    const orderItem = itemMap.get(item.orderItemId)
    const remaining = Number(orderItem.order_quantity) - Number(orderItem.received_quantity)
    if (item.quantity > remaining) return { success: false as const, error: `Penerimaan ${orderItem.name} melebihi sisa pesanan (${remaining}).` }
  }
  const db = await getDB()
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_purchase(
         id, purchase_date, supplier_id, supplier_name, status, payment_status,
         total_rupiah, notes, created_by, received_by, received_at, updated_at
       ) VALUES (?, ?, ?, ?, 'RECEIVED', 'UNPOSTED', 0, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(purchaseId, purchaseDate, supplier?.id || null, supplierName, cleanText(input.notes, 500), session.id, session.id),
  ]
  const receivedByItemId = new Map(cleanedItems.map(item => [item.orderItemId, item.quantity]))
  for (const item of cleanedItems) {
    const orderItem = itemMap.get(item.orderItemId)
    const before = Number(orderItem.total_stock_base)
    const centralBefore = Number(orderItem.central_stock_base)
    const after = before + item.quantity
    const centralAfter = centralBefore + item.quantity
    const purchaseItemId = generateId()
    statements.push(
      db.prepare(
        `INSERT INTO poskestren_purchase_item(
           id, purchase_id, medicine_id, unit_name, factor_to_base,
           quantity_package, quantity_base, unit_price, subtotal_rupiah, batch_number, order_item_id
         ) VALUES (?, ?, ?, ?, 1, ?, ?, 0, 0, '', ?)`
      ).bind(purchaseItemId, purchaseId, orderItem.medicine_id, orderItem.unit_name || orderItem.form, item.quantity, item.quantity, item.orderItemId),
      db.prepare(`INSERT OR IGNORE INTO poskestren_medicine_location_stock(medicine_id, location_id, quantity_base) VALUES (?, 'pos-location-central', 0)`).bind(orderItem.medicine_id),
      db.prepare(
        `UPDATE poskestren_medicine_location_stock
         SET quantity_base = ?, updated_at = datetime('now')
         WHERE medicine_id = ? AND location_id = 'pos-location-central' AND quantity_base = ?`
      ).bind(centralAfter, orderItem.medicine_id, centralBefore),
      db.prepare(
        `UPDATE poskestren_medicine SET total_stock_base = ?, updated_at = datetime('now')
         WHERE id = ? AND total_stock_base = ?`
      ).bind(after, orderItem.medicine_id, before),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by,
           location_id
         ) VALUES (?, ?, NULL, ?, 'PURCHASE', ?, ?, ?, 'PURCHASE_ITEM', ?, ?, ?, 'pos-location-central')`
      ).bind(generateId(), orderItem.medicine_id, purchaseDate, item.quantity, before, after, purchaseItemId, `Penerimaan pesanan ${orderId}`, session.id),
      db.prepare(
        `UPDATE poskestren_medicine_order_item
         SET received_quantity = received_quantity + ?
         WHERE id = ? AND order_quantity - received_quantity >= ?`
      ).bind(item.quantity, item.orderItemId, item.quantity)
    )
  }
  const allItems = await query<any>('SELECT id, order_quantity, received_quantity FROM poskestren_medicine_order_item WHERE order_id = ?', [orderId])
  const finalStatus = allItems.every(item => Number(item.received_quantity) + Number(receivedByItemId.get(item.id) || 0) >= Number(item.order_quantity))
    ? 'RECEIVED'
    : 'PARTIAL'
  statements.push(
    db.prepare(`UPDATE poskestren_medicine_order SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(finalStatus, orderId)
  )
  await db.batch(statements)
  await audit(session, 'create', 'poskestren_purchase', purchaseId, `Menerima pesanan obat ${orderId}`, {
    order_id: orderId,
    item_count: cleanedItems.length,
    status: finalStatus,
  })
  refresh()
  return { success: true as const, id: purchaseId, orderStatus: finalStatus }
}
