/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { requirePoskestrenClinicalWrite } from '@/lib/poskestren/access'
import { claim, normalizeClinical, normalizePrescription, type ClinicalInput } from '@/lib/poskestren/clinical'
import { parseWibDateTime, toWibDateInputValue } from '@/lib/date/wib'
import { prepareStockMutation } from '@/lib/poskestren/stock'
import type { PrescriptionDraftItem } from '@/lib/poskestren/types'

function refresh() {
  for (const path of ['pemeriksaan','observasi','obat','cetak','laporan']) revalidatePath('/dashboard/poskestren/'+path)
}
async function audit(session:any,id:string,summary:string) {
  await logActivity({actor:actorFromSession(session),module:'poskestren_pemeriksaan',action:'update',
    fiturHref:'/dashboard/poskestren/pemeriksaan',logKind:'update',entityType:'poskestren_clinical_exam',entityId:id,summary})
}
export async function getClinicalDoctor() {
  const session = await requirePoskestrenClinicalWrite()
  return queryOne<{id:string;full_name:string}>(
    "SELECT id,full_name FROM poskestren_personnel WHERE user_id=? AND personnel_type='MEDICAL' AND is_active=1",[session.id])
}
async function requireDoctor() {
  const session = await requirePoskestrenClinicalWrite()
  const doctor = await getClinicalDoctor()
  if (!doctor) throw new Error('Pemeriksaan dan resep harus diinput dokter dengan akun personel medis aktif.')
  return {session,doctor}
}
export async function registerDormVisit(input: ClinicalInput & {santriId:string;visitedAt:string;requestId:string}) {
  const session = await requirePoskestrenClinicalWrite()
  const data = normalizeClinical(input)
  const date = parseWibDateTime(input.visitedAt)
  if (Number.isNaN(date.getTime()) || !input.requestId) throw new Error('Tanggal dan identitas permintaan wajib diisi.')
  const patient = await queryOne<any>(`SELECT p.id,p.allergies,p.special_conditions FROM poskestren_patient p
    JOIN santri s ON s.id=p.santri_id WHERE s.id=? AND s.status_global='aktif'`,[input.santriId])
  if(!patient) throw new Error('Profil santri aktif tidak ditemukan.')
  const existing = await queryOne<{id:string;patient_id:string}>('SELECT id,patient_id FROM poskestren_dorm_visit WHERE id=?',[input.requestId])
  if(existing) {if(existing.patient_id!==patient.id)throw new Error('Identitas pendaftaran sudah digunakan.');return {success:true as const,id:existing.id}}
  const db = await getDB()
  await db.batch([
    claim(db,'register-dorm:'+input.requestId),
    db.prepare(`INSERT INTO poskestren_dorm_visit(id,patient_id,visited_at,temperature_celsius,systolic_pressure,
      diastolic_pressure,weight_kg,complaint,disease_history_snapshot,allergies_snapshot,notes,status,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'MENUNGGU',?)`).bind(input.requestId,patient.id,date.toISOString(),data.temperatureCelsius,
      data.systolicPressure,data.diastolicPressure,data.weightKg,data.complaint,
      input.diseaseHistory===undefined?patient.special_conditions:data.diseaseHistory,
      input.allergies===undefined?patient.allergies:data.allergies,data.notes,session.id),
  ])
  await audit(session,input.requestId,'Mendaftarkan Visit Asrama')
  refresh()
  return {success:true as const,id:input.requestId}
}
export async function getDormVisitDetail(id:string) {
  await requirePoskestrenClinicalWrite()
  const visit = await queryOne<any>(`SELECT dv.*,s.nama_lengkap,p.santri_id,p.allergies,p.special_conditions
    FROM poskestren_dorm_visit dv JOIN poskestren_patient p ON p.id=dv.patient_id JOIN santri s ON s.id=p.santri_id WHERE dv.id=?`,[id])
  if(!visit) throw new Error('Visit tidak ditemukan.')
  const exam = await queryOne<any>('SELECT * FROM poskestren_clinical_exam WHERE dorm_visit_id=?',[id])
  const medicines = exam ? await query<any>('SELECT * FROM poskestren_clinical_prescription_item WHERE exam_id=?',[exam.id])
    : await query<any>('SELECT * FROM poskestren_dorm_visit_medicine WHERE dorm_visit_id=?',[id])
  return {visit,exam,medicines}
}
export async function beginDormExamination(id:string) {
  const {session,doctor} = await requireDoctor()
  const db = await getDB()
  const visit = await queryOne<any>('SELECT status,personnel_id FROM poskestren_dorm_visit WHERE id=?',[id])
  if(visit?.status==='DIPERIKSA'&&visit.personnel_id===doctor.id) return {success:true as const}
  if(visit?.status!=='MENUNGGU') throw new Error('Visit tidak lagi menunggu.')
  const result = await db.prepare("UPDATE poskestren_dorm_visit SET status='DIPERIKSA',personnel_id=?,updated_by=?,updated_at=datetime('now') WHERE id=? AND status='MENUNGGU'").bind(doctor.id,session.id,id).run()
  if(!result.meta.changes) throw new Error('Visit sudah diambil dokter lain. Muat ulang.')
  refresh()
  return {success:true as const}
}
export async function completeClinicalExamination(input: ClinicalInput & {
  source:'VISIT_ASRAMA'|'OBSERVASI'; sourceId:string;requestId:string; prescriptionItems:PrescriptionDraftItem[]
}) {
  const {session,doctor} = await requireDoctor()
  const data = normalizeClinical(input)
  const diagnosis = await queryOne<{name:string}>('SELECT name FROM poskestren_diagnosis WHERE id=? AND is_active=1',[input.diagnosisId||''])
  if(!diagnosis) throw new Error('Pilih diagnosis aktif.')
  data.diagnosis=diagnosis.name
  const medicines=await normalizePrescription(input.prescriptionItems)
  const dorm=input.source==='VISIT_ASRAMA'
  if(!dorm&&input.source!=='OBSERVASI') throw new Error('Sumber tidak valid.')
  const source=await queryOne<any>(dorm?'SELECT * FROM poskestren_dorm_visit WHERE id=?':'SELECT * FROM poskestren_observation WHERE id=?',[input.sourceId])
  if(!source || (dorm?(source.status!=='DIPERIKSA'||source.personnel_id!==doctor.id):source.status!=='ACTIVE')) throw new Error('Pelayanan tidak aktif atau bukan milik dokter ini.')
  if(!input.requestId) throw new Error('Identitas permintaan wajib diisi.')
  const db=await getDB(), now=new Date().toISOString()
  const condition=dorm?"EXISTS(SELECT 1 FROM poskestren_dorm_visit WHERE id=? AND status='DIPERIKSA' AND personnel_id=?)":"EXISTS(SELECT 1 FROM poskestren_observation WHERE id=? AND status='ACTIVE')"
  const statements=[claim(db,'clinical:'+input.requestId,condition,dorm?[source.id,doctor.id]:[source.id]),
    db.prepare(`INSERT INTO poskestren_clinical_exam(id,dorm_visit_id,observation_id,personnel_id,examined_at,clinical_json,delivery_status,created_by)
      VALUES(?,?,?,?,?,?,?,?)`).bind(input.requestId,dorm?source.id:null,dorm?null:source.id,doctor.id,now,JSON.stringify(data),medicines.some(m=>m.sourceType==='STOCK')?'PENDING':'NONE',session.id)]
  for(const m of medicines) statements.push(db.prepare(`INSERT INTO poskestren_clinical_prescription_item(id,exam_id,source_type,medicine_id,medicine_name,unit,requested_quantity,dosage,notes) VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(generateId(),input.requestId,m.sourceType,m.medicineId,m.medicineName,m.unit,m.quantity,m.dosage,m.notes))
  if(dorm) statements.push(db.prepare("UPDATE poskestren_dorm_visit SET status='SELESAI',completed_at=?,updated_by=?,updated_at=? WHERE id=?").bind(now,session.id,now,source.id))
  await db.batch(statements)
  await audit(session,input.requestId,dorm?'Menyelesaikan pemeriksaan Visit Asrama':'Mencatat pemeriksaan Observasi tanpa honor')
  refresh()
  return {success:true as const}
}
export async function getClinicalDeliveryQueue() {
  await requirePoskestrenClinicalWrite()
  return query<any>(`SELECT e.id,e.examined_at,e.clinical_json,s.nama_lengkap,s.asrama,
    CASE WHEN e.dorm_visit_id IS NOT NULL THEN 'VISIT_ASRAMA' ELSE 'OBSERVASI' END AS source,
    pp.full_name AS doctor_name FROM poskestren_clinical_exam e
    LEFT JOIN poskestren_dorm_visit dv ON dv.id=e.dorm_visit_id LEFT JOIN poskestren_observation o ON o.id=e.observation_id
    JOIN poskestren_patient p ON p.id=COALESCE(dv.patient_id,o.patient_id) JOIN santri s ON s.id=p.santri_id
    JOIN poskestren_personnel pp ON pp.id=e.personnel_id WHERE e.delivery_status='PENDING' ORDER BY e.examined_at,e.id`)
}
export async function getClinicalPrescription(examId:string) {
  await requirePoskestrenClinicalWrite()
  return query<any>('SELECT * FROM poskestren_clinical_prescription_item WHERE exam_id=? ORDER BY id',[examId])
}
export async function deliverClinicalPrescription(input:{examId:string;items:Array<{id:string;quantity:number}>}) {
  const session=await requirePoskestrenClinicalWrite()
  const exam=await queryOne<any>(`SELECT e.*,s.asrama FROM poskestren_clinical_exam e
    LEFT JOIN poskestren_dorm_visit dv ON dv.id=e.dorm_visit_id LEFT JOIN poskestren_observation o ON o.id=e.observation_id
    JOIN poskestren_patient p ON p.id=COALESCE(dv.patient_id,o.patient_id) JOIN santri s ON s.id=p.santri_id WHERE e.id=?`,[input.examId])
  if(!exam||exam.delivery_status!=='PENDING') throw new Error('Resep tidak menunggu penyerahan atau sudah diserahkan.')
  const items=await getClinicalPrescription(exam.id), stock=items.filter(i=>i.source_type==='STOCK')
  if(input.items.length!==stock.length||new Set(input.items.map(i=>i.id)).size!==stock.length) throw new Error('Isi jumlah setiap obat resep.')
  const db=await getDB(),now=new Date().toISOString()
  const statements=[claim(db,'clinical-delivery:'+exam.id,"EXISTS(SELECT 1 FROM poskestren_clinical_exam WHERE id=? AND delivery_status='PENDING')",[exam.id])]
  for(const item of input.items) {
    const row=stock.find(r=>r.id===item.id)
    if(!row||!Number.isInteger(item.quantity)||item.quantity<0||item.quantity>row.requested_quantity) throw new Error('Jumlah penyerahan tidak valid.')
    if(item.quantity>0) {
      const mutation=await prepareStockMutation(db,{medicineId:row.medicine_id,quantityDelta:-item.quantity,movementType:'PATIENT',movementDate:toWibDateInputValue(now),referenceType:'CLINICAL_PRESCRIPTION',referenceId:row.id,actorId:session.id,preferredAsrama:exam.asrama,notes:row.dosage})
      statements.push(...mutation.statements)
      if(exam.observation_id) statements.push(db.prepare(`INSERT INTO poskestren_observation_medicine(id,observation_id,administered_at,source_type,medicine_id,medicine_name,quantity_base,dosage,notes,created_by) VALUES(?,?,?,'STOCK',?,?,?,?,?,?)`)
        .bind(generateId(),exam.observation_id,now,row.medicine_id,row.medicine_name,item.quantity,row.dosage,row.notes,session.id))
    }
    statements.push(db.prepare('UPDATE poskestren_clinical_prescription_item SET dispensed_quantity=? WHERE id=?').bind(item.quantity,row.id))
  }
  statements.push(db.prepare("UPDATE poskestren_clinical_exam SET delivery_status='DONE',delivered_at=?,delivered_by=? WHERE id=?").bind(now,session.id,exam.id))
  await db.batch(statements)
  await audit(session,exam.id,'Menyerahkan obat resep klinis')
  refresh()
  return {success:true as const}
}
