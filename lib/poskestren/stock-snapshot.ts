import { generateId, getDB } from '@/lib/db'

import { cleanText } from './query'
import type { PoskestrenStockMovementType } from './types'

type DbLike = Awaited<ReturnType<typeof getDB>>

/**
 * Menyiapkan mutasi dari snapshot stok yang telah dibaca secara bulk.
 * Form multi-obat memakai helper ini agar tidak melakukan query per baris.
 */
export function prepareStockMutationFromSnapshot(
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
  }
) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error('Mutasi stok harus berupa bilangan bulat selain nol.')
  }
  const after = Number(input.stockBefore) + input.quantityDelta
  if (after < 0) {
    throw new Error(`Stok ${input.medicineName} tidak cukup. Tersedia ${input.stockBefore}.`)
  }
  return {
    medicineId: input.medicineId,
    medicineName: input.medicineName,
    quantityDelta: input.quantityDelta,
    stockBefore: input.stockBefore,
    stockAfter: after,
    statements: [
      db.prepare(
        `UPDATE poskestren_medicine
         SET total_stock_base = ?, updated_at = datetime('now')
         WHERE id = ? AND total_stock_base = ?`
      ).bind(after, input.medicineId, input.stockBefore),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by
         ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        input.actorId
      ),
    ],
  }
}
