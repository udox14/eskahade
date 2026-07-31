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
  statements: D1PreparedStatement[]
}

export function normalizeClinicalMedicines(items: ClinicalMedicineDraftItem[] = []) {
  return items.slice(0, 50).map((item, index) => {
    const sourceType = item.sourceType === 'EXTERNAL' ? 'EXTERNAL' : 'STOCK'
    const medicineId = cleanText(item.medicineId, 100)
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
    return { sourceType, medicineId, medicineName, quantityBase, dosage, notes }
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
      statements: [],
    }
  }

  const before = Number(medicine.total_stock_base)
  const after = before + input.quantityDelta
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
    statements: [
      db.prepare(
        `UPDATE poskestren_medicine
         SET total_stock_base = ?, updated_at = datetime('now')
         WHERE id = ? AND total_stock_base = ?`
      ).bind(after, medicine.id, before),
      db.prepare(
        `INSERT INTO poskestren_stock_movement(
           id, medicine_id, batch_id, movement_date, movement_type, quantity_delta,
           stock_before, stock_after, reference_type, reference_id, notes, created_by
         ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        input.actorId
      ),
    ],
  }
}
