/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { requirePoskestrenClinicalWrite } from '@/lib/poskestren/access'
import { cleanText, parsePositiveInteger } from '@/lib/poskestren/query'
import { prepareStockMutation } from '@/lib/poskestren/stock'

const PATH = '/dashboard/poskestren/pemeriksaan'

function refresh() {
  revalidatePath(PATH)
  revalidatePath('/dashboard/poskestren/obat')
  revalidatePath('/dashboard/poskestren/observasi')
}

export async function getPreventiveMedicineOptions() {
  await requirePoskestrenClinicalWrite()
  return query<{
    id: string
    name: string
    form: string
    strength: string | null
    total_stock_base: number
  }>(
    `SELECT id, name, form, strength, total_stock_base
     FROM poskestren_medicine
     WHERE is_active = 1
     ORDER BY name COLLATE NOCASE, form COLLATE NOCASE, strength COLLATE NOCASE, id
     LIMIT 500`,
    []
  )
}

export async function getPreventiveProgramMedicines(programId: string) {
  await requirePoskestrenClinicalWrite()
  return query<any>(
    `SELECT rxi.id, rxi.medicine_id, rxi.requested_quantity_base,
            rxi.dispensed_quantity_base, rxi.dosage, rxi.notes,
            m.name AS medicine_name, m.form, m.strength
     FROM poskestren_prescription rx
     JOIN poskestren_prescription_item rxi ON rxi.prescription_id = rx.id
     JOIN poskestren_medicine m ON m.id = rxi.medicine_id
     WHERE rx.program_id = ?
     ORDER BY rxi.created_at DESC, rxi.id DESC`,
    [programId]
  )
}

export async function addPreventiveMedicine(input: {
  programId: string
  medicineId: string
  quantityBase: number | string
  dosage?: string
  notes?: string
  referenceId?: string
}) {
  const session = await requirePoskestrenClinicalWrite()
  const programId = cleanText(input.programId, 100)
  const medicineId = cleanText(input.medicineId, 100)
  const dosage = cleanText(input.dosage, 200)
  const notes = cleanText(input.notes, 300)
  const quantity = parsePositiveInteger(input.quantityBase, 'Jumlah obat')
  if (!programId || !medicineId) return { success: false as const, error: 'Program dan obat wajib dipilih.' }

  const program = await queryOne<{ id: string; title: string; program_date: string }>(
    `SELECT id, title, program_date FROM poskestren_preventive_program WHERE id = ?`,
    [programId]
  )
  if (!program) return { success: false as const, error: 'Program preventif tidak ditemukan.' }

  const referenceId = cleanText(input.referenceId, 100) || generateId()
  const existing = await queryOne<{ id: string; program_id: string }>(
    `SELECT id, program_id FROM poskestren_prescription WHERE id = ?`,
    [referenceId]
  )
  if (existing) {
    if (existing.program_id !== programId) return { success: false as const, error: 'Referensi pemakaian obat sudah digunakan.' }
    return { success: true as const, id: existing.id, idempotent: true as const }
  }

  const db = await getDB()
  const medicine = await queryOne<{ id: string; name: string; total_stock_base: number; is_active: number }>(
    `SELECT id, name, total_stock_base, is_active FROM poskestren_medicine WHERE id = ?`,
    [medicineId]
  )
  if (!medicine || Number(medicine.is_active) !== 1) return { success: false as const, error: 'Obat stok tidak ditemukan atau nonaktif.' }
  if (Number(medicine.total_stock_base) < quantity) {
    return { success: false as const, error: `Stok ${medicine.name} tidak cukup. Tersedia ${medicine.total_stock_base}.` }
  }

  const itemId = generateId()
  const mutation = await prepareStockMutation(db, {
    medicineId,
    quantityDelta: -quantity,
    movementType: 'PREVENTIVE',
    movementDate: String(program.program_date).slice(0, 10),
    referenceType: 'PREVENTIVE_MEDICINE',
    referenceId,
    actorId: session.id,
    notes: dosage || notes,
  })
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO poskestren_prescription(id, program_id, status, created_by)
       VALUES (?, ?, 'DISPENSED', ?)`
    ).bind(referenceId, programId, session.id),
    ...mutation.statements,
    db.prepare(
      `INSERT INTO poskestren_prescription_item(
         id, prescription_id, medicine_id, dosage, requested_quantity_base,
         dispensed_quantity_base, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(itemId, referenceId, medicineId, dosage, quantity, quantity, notes),
  ]
  await db.batch(statements)
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren',
    action: 'create',
    fiturHref: PATH,
    logKind: 'create',
    entityType: 'poskestren_preventive_medicine',
    entityId: itemId,
    summary: `Mencatat pemakaian ${medicine.name} pada program preventif ${program.title}`,
    details: { program_id: programId, medicine_id: medicineId, quantity },
  })
  refresh()
  return { success: true as const, id: itemId, idempotent: false as const }
}
