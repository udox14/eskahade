import { stockGuard } from './clinical'
import { generateId, getDB, queryOne } from '@/lib/db'

import { cleanText } from './query'
import type { PoskestrenStockMovementType } from './types'

type DbLike = Awaited<ReturnType<typeof getDB>>

/**
 * Menyiapkan mutasi dari snapshot stok yang telah dibaca secara bulk.
 * Form multi-obat memakai helper ini agar tidak melakukan query per baris.
 */
export async function prepareStockMutationFromSnapshot(
  db: DbLike,
  input: {
    medicineId: string
    medicineName: string
    stockBefore: number
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
): Promise<{
  medicineId: string
  medicineName: string
  quantityDelta: number
  stockBefore: number
  stockAfter: number
  statements: D1PreparedStatement[]
}> {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error('Mutasi stok harus berupa bilangan bulat selain nol.')
  }
  const after = Number(input.stockBefore) + input.quantityDelta
  if (after < 0) {
    throw new Error(`Stok ${input.medicineName} tidak cukup. Tersedia ${input.stockBefore}.`)
  }
  let locationId = input.locationId || ''
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
  const location = await queryOne<{ quantity_base: number }>(
    `SELECT quantity_base FROM poskestren_medicine_location_stock
     WHERE medicine_id = ? AND location_id = ?`,
    [input.medicineId, locationId]
  )
  const locationBefore = Number(location?.quantity_base || 0)
  const locationAfter = locationBefore + input.quantityDelta
  if (locationAfter < 0) {
    throw new Error(`Stok ${input.medicineName} di lokasi tidak cukup. Tersedia ${locationBefore}.`)
  }
  return {
    medicineId: input.medicineId,
    medicineName: input.medicineName,
    quantityDelta: input.quantityDelta,
    stockBefore: input.stockBefore,
    stockAfter: after,
    statements: [
      stockGuard(db, input.medicineId, input.stockBefore, locationId, locationBefore),
      db.prepare(
        `INSERT OR IGNORE INTO poskestren_medicine_location_stock(
           medicine_id, location_id, quantity_base
         ) VALUES (?, ?, 0)`
      ).bind(input.medicineId, locationId),
      db.prepare(
        `UPDATE poskestren_medicine_location_stock
         SET quantity_base = quantity_base + ?, updated_at = datetime('now')
         WHERE medicine_id = ? AND location_id = ? AND quantity_base + ? >= 0`
      ).bind(input.quantityDelta, input.medicineId, locationId, input.quantityDelta),
      db.prepare(
        `UPDATE poskestren_medicine
         SET total_stock_base = total_stock_base + ?, updated_at = datetime('now')
         WHERE id = ? AND total_stock_base + ? >= 0`
      ).bind(input.quantityDelta, input.medicineId, input.quantityDelta),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by,
           location_id
         ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        input.medicineId,
        input.movementDate,
        input.movementType,
        input.quantityDelta,
        input.stockBefore,
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
