'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB } from '@/lib/db'
import { requirePoskestrenFeature } from '@/lib/poskestren/access'
import { assertDate, cleanText } from '@/lib/poskestren/query'
import { prepareStockMutation } from '@/lib/poskestren/stock'
import { POSKESTREN_HREF, type PoskestrenStockMovementType } from '@/lib/poskestren/types'

export async function createSimpleStockAdjustment(input: {
  medicineId: string
  movementDate: string
  quantityDelta: number
  reason: 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGED' | 'LOST'
  notes: string
  locationId?: string
}) {
  const session = await requirePoskestrenFeature(POSKESTREN_HREF.medicine, 'update')
  const movementDate = assertDate(input.movementDate)
  const quantityDelta = Number(input.quantityDelta)
  const notes = cleanText(input.notes, 500)
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    return { success: false as const, error: 'Jumlah mutasi wajib berupa bilangan bulat selain nol.' }
  }
  if (!['ADJUSTMENT', 'EXPIRED', 'DAMAGED', 'LOST'].includes(input.reason)) {
    return { success: false as const, error: 'Alasan mutasi tidak valid.' }
  }
  if (input.reason !== 'ADJUSTMENT' && quantityDelta > 0) {
    return { success: false as const, error: 'Kedaluwarsa, rusak, dan hilang wajib mengurangi stok.' }
  }

  if (!notes) return { success: false as const, error: 'Catatan/alasan wajib diisi.' }

  const db = await getDB()
  const movementType: PoskestrenStockMovementType = input.reason === 'ADJUSTMENT'
    ? quantityDelta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'
    : input.reason
  const referenceId = generateId()
  const mutation = await prepareStockMutation(db, {
    medicineId: input.medicineId,
    quantityDelta,
    movementType,
    movementDate,
    referenceType: 'MANUAL_ADJUSTMENT',
    referenceId,
    actorId: session.id,
    notes,
    locationId: input.locationId,
  })
  await db.batch(mutation.statements)
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_obat',
    action: 'update',
    fiturHref: POSKESTREN_HREF.medicine,
    logKind: 'update',
    entityType: 'poskestren_stock_movement',
    entityId: referenceId,
    summary: `Penyesuaian stok ${mutation.medicineName}`,
    details: {
      quantity_delta: quantityDelta,
      stock_before: mutation.stockBefore,
      stock_after: mutation.stockAfter,
      reason: input.reason,
    },
  })
  revalidatePath(POSKESTREN_HREF.medicine)
  revalidatePath(POSKESTREN_HREF.reports)
  return { success: true as const }
}
