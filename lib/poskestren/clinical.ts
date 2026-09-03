import { generateId, getDB, query } from '@/lib/db'
import { cleanText } from './query'
import type { PrescriptionDraftItem } from './types'
export type ClinicalInput = {
 complaint: string; diagnosisId?: string; diagnosis?: string; treatment?: string; followUp?: string;
 referralDestination?: string; referralNotes?: string; notes?: string; allergies?: string; diseaseHistory?: string;
 temperatureCelsius?: number | null; systolicPressure?: number | null; diastolicPressure?: number | null; weightKg?: number | null;
}
export function normalizeClinical(input: ClinicalInput) {
 const numeric = (v: number | null | undefined, max: number) => {
  if (v == null) return null
  if (!Number.isFinite(v) || v <= 0 || v > max) throw new Error('Tanda vital tidak valid.')
  return v
 }
 const result = {
  complaint: cleanText(input.complaint), diagnosisId: cleanText(input.diagnosisId), diagnosis: cleanText(input.diagnosis),
  treatment: cleanText(input.treatment), followUp: cleanText(input.followUp),
  referralDestination: cleanText(input.referralDestination,200), referralNotes: cleanText(input.referralNotes),
  notes: cleanText(input.notes), allergies: cleanText(input.allergies), diseaseHistory: cleanText(input.diseaseHistory),
  temperatureCelsius: numeric(input.temperatureCelsius,50), systolicPressure: numeric(input.systolicPressure,350),
  diastolicPressure: numeric(input.diastolicPressure,250), weightKg: numeric(input.weightKg,500),
 }
 if (!result.complaint) throw new Error('Keluhan wajib diisi.')
 return result
}
export async function normalizePrescription(items: PrescriptionDraftItem[] = []) {
 if (items.length > 50) throw new Error('Maksimal 50 obat per resep.')
 const ids = items.filter(i => i.sourceType !== 'EXTERNAL').map(i => i.medicineId)
 if (new Set(ids).size !== ids.length) throw new Error('Obat katalog yang sama tidak boleh diulang.')
 const catalog = ids.length ? await query<{id:string; name:string; base_unit:string}>(
  'SELECT id,name,base_unit FROM poskestren_medicine WHERE is_active=1 AND id IN ('+ids.map(()=>'?').join(',')+')',ids,
 ) : []
 return items.map(item => {
  const quantity = Number(item.requestedQuantityBase)
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Jumlah obat harus bilangan bulat positif.')
  const external = item.sourceType === 'EXTERNAL'
  const medicine = catalog.find(m=>m.id===item.medicineId)
  const name = external ? cleanText(item.medicineName,200) : medicine?.name
  if (!name) throw new Error('Nama obat eksternal wajib diisi atau pilih obat katalog aktif.')
  return {sourceType: external ? 'EXTERNAL' as const : 'STOCK' as const, medicineId: external ? null : medicine!.id,
   medicineName:name, unit: external ? cleanText(item.unit,40)||'unit' : medicine!.base_unit,
   quantity, dosage:cleanText(item.dosage,200), notes:cleanText(item.notes,300)}
 })
}
export function claim(db: Awaited<ReturnType<typeof getDB>>, id:string, condition='1', params:unknown[]=[]) {
 return db.prepare('INSERT INTO poskestren_operation(id,valid) VALUES (?,CASE WHEN '+condition+' THEN 1 ELSE 0 END)').bind(id,...params)
}
export function stockGuard(db: Awaited<ReturnType<typeof getDB>>, medicineId:string,total:number,locationId:string,local:number) {
 return claim(db,'stock:'+generateId(),'EXISTS (SELECT 1 FROM poskestren_medicine WHERE id=? AND total_stock_base=?) AND COALESCE((SELECT quantity_base FROM poskestren_medicine_location_stock WHERE medicine_id=? AND location_id=?),0)=?',
 [medicineId,total,medicineId,locationId,local])
}
