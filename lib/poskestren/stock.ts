import { stockGuard } from './clinical'
import { generateId, queryOne } from '@/lib/db'

import { cleanText, parsePositiveInteger } from './query'
import type {
  ClinicalMedicineDraftItem,
  PoskestrenStockMovementType,
} from './types'

type DbLike = Awaited<ReturnType<typeof import('@/lib/db').getDB>>

export type PreparedStockMutation = {
  medicineId: string
  medicineName: string
  quantityDelta: number
  stockBefore: number
  stockAfter: number
  locationId: string
  locationBefore: number
  locationAfter: number
  statements: D1PreparedStatement[]
}

export function normalizeClinicalMedicines(items: ClinicalMedicineDraftItem[] = []) {
  return items.slice(0, 50).map((item, index) => {
    const sourceType = item.sourceType === 'EXTERNAL' ? 'EXTERNAL' : 'STOCK'
    const medicineId = cleanText(item.medicineId, 100)
    const locationId = cleanText(item.locationId, 120)
    const medicineName = cleanText(item.medicineName, 200)
    const dosage = cleanText(item.dosage, 200)
    const notes = cleanText(item.notes, 300)
    const quantityBase = sourceType === 'STOCK'
      ? parsePositiveInteger(item.quantityBase, `Jumlah obat baris ${index + 1}`)
      : null
    if (sourceType === 'STOCK' && !medicineId) {
      throw new Error(`Pilih obat stok pada baris ${index + 1}.`)
    }
    if (sourceType === 'EXTERNAL' && !medicineName) {
      throw new Error(`Nama obat eksternal pada baris ${index + 1} wajib diisi.`)
    }
    return { sourceType, medicineId, locationId, medicineName, quantityBase, dosage, notes }
  })
}

export async function prepareStockMutation(
  db: DbLike,
  input: {
    medicineId: string
    quantityDelta: number
    movementType: PoskestrenStockMovementType
    movementDate: string
    referenceType: string
    referenceId: string
    actorId: string
    notes?: string | null
    locationId?: string | null
    preferredAsrama?: string | null
  }
): Promise<PreparedStockMutation> {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error('Mutasi stok harus berupa bilangan bulat selain nol.')
  }
  const medicine = await queryOne<{
    id: string
    name: string
    total_stock_base: number
    is_active: number
  }>(
    `SELECT id, name, total_stock_base, is_active
     FROM poskestren_medicine
     WHERE id = ?`,
    [input.medicineId]
  )
  if (!medicine || Number(medicine.is_active) !== 1) {
    throw new Error('Obat stok tidak ditemukan atau sudah nonaktif.')
  }

  let locationId = cleanText(input.locationId, 120) || ''
  if (!locationId && input.preferredAsrama) {
    const asramaKey = (cleanText(input.preferredAsrama, 120) || '').toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')
    const preferred = await queryOne<{ id: string; is_active: number }>(
      `SELECT id, is_active FROM poskestren_stock_location
       WHERE normalized_key = ? AND location_type = 'DORM'`,
      [asramaKey]
    )
    if (preferred && Number(preferred.is_active) === 1) {
      const preferredStock = await queryOne<{ quantity_base: number }>(
        `SELECT quantity_base FROM poskestren_medicine_location_stock
         WHERE medicine_id = ? AND location_id = ?`,
        [input.medicineId, preferred.id]
      )
      if (input.quantityDelta > 0 || Number(preferredStock?.quantity_base || 0) >= Math.abs(input.quantityDelta)) {
        locationId = preferred.id
      }
    }
  }
  locationId ||= 'pos-location-central'
  const location = await queryOne<{ id: string; name: string; is_active: number }>(
    `SELECT id, name, is_active FROM poskestren_stock_location WHERE id = ?`,
    [locationId]
  )
  if (!location || Number(location.is_active) !== 1) {
    throw new Error('Lokasi stok tidak ditemukan atau sudah nonaktif.')
  }
  const locationStock = await queryOne<{ quantity_base: number }>(
    `SELECT quantity_base FROM poskestren_medicine_location_stock
     WHERE medicine_id = ? AND location_id = ?`,
    [input.medicineId, locationId]
  )

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM poskestren_stock_movement
     WHERE reference_type = ? AND reference_id = ? AND medicine_id = ? AND movement_type = ?
     LIMIT 1`,
    [input.referenceType, input.referenceId, input.medicineId, input.movementType]
  )
  if (existing) {
    return {
      medicineId: medicine.id,
      medicineName: medicine.name,
      quantityDelta: 0,
      stockBefore: Number(medicine.total_stock_base),
      stockAfter: Number(medicine.total_stock_base),
      locationId,
      locationBefore: Number(locationStock?.quantity_base || 0),
      locationAfter: Number(locationStock?.quantity_base || 0),
      statements: [
],
    }
  }

  const before = Number(medicine.total_stock_base)
  const after = before + input.quantityDelta
  const locationBefore = Number(locationStock?.quantity_base || 0)
  const locationAfter = locationBefore + input.quantityDelta
  if (locationAfter < 0) {
    throw new Error(`Stok ${medicine.name} di ${location.name} tidak cukup. Tersedia ${locationBefore}.`)
  }
  if (after < 0) {
    throw new Error(`Stok ${medicine.name} tidak cukup. Tersedia ${before}.`)
  }
  const movementId = generateId()
  return {
    medicineId: medicine.id,
    medicineName: medicine.name,
    quantityDelta: input.quantityDelta,
    stockBefore: before,
    stockAfter: after,
    locationId,
    locationBefore,
    locationAfter,
    statements: [
      stockGuard(db, medicine.id, before, locationId, locationBefore),
      db.prepare(
        `INSERT OR IGNORE INTO poskestren_medicine_location_stock(
           medicine_id, location_id, quantity_base
         ) VALUES (?, ?, 0)`
      ).bind(medicine.id, locationId),
      db.prepare(
        `UPDATE poskestren_medicine_location_stock
         SET quantity_base = quantity_base + ?, updated_at = datetime('now')
         WHERE medicine_id = ? AND location_id = ? AND quantity_base + ? >= 0`
      ).bind(input.quantityDelta, medicine.id, locationId, input.quantityDelta),
      db.prepare(
        `UPDATE poskestren_medicine
         SET total_stock_base = total_stock_base + ?, updated_at = datetime('now')
         WHERE id = ? AND total_stock_base + ? >= 0`
      ).bind(input.quantityDelta, medicine.id, input.quantityDelta),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by,
           location_id
         ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        movementId,
        medicine.id,
        input.movementDate,
        input.movementType,
        input.quantityDelta,
        before,
        after,
        input.referenceType,
        input.referenceId,
        cleanText(input.notes, 500),
        input.actorId,
        locationId
      ),
    ],
  }
}
