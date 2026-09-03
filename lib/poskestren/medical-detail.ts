/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, queryOne } from '@/lib/db'

export async function medicalEventDetail(type:string,id:string) {
  if(type==='PEMERIKSAAN') {
    const visit=await queryOne<any>('SELECT * FROM poskestren_visit WHERE id=?',[id])
    const [stock,external,revisions]=await Promise.all([
      query<any>(`SELECT i.*,m.name AS medicine_name,m.base_unit AS unit,'STOCK' AS source_type,
        i.requested_quantity_base AS requested_quantity,i.dispensed_quantity_base AS dispensed_quantity,r.status AS delivery_status
        FROM poskestren_prescription r JOIN poskestren_prescription_item i ON i.prescription_id=r.id
        JOIN poskestren_medicine m ON m.id=i.medicine_id WHERE r.visit_id=?`,[id]),
      query<any>(`SELECT i.*,'EXTERNAL' AS source_type,i.quantity AS requested_quantity FROM poskestren_prescription r
        JOIN poskestren_prescription_external_item i ON i.prescription_id=r.id WHERE r.visit_id=?`,[id]),
      query<any>(`SELECT r.*,u.full_name AS revised_by_name FROM poskestren_visit_revision r
        LEFT JOIN users u ON u.id=r.revised_by WHERE r.visit_id=? ORDER BY revision_no DESC`,[id]),
    ])
    const snapshot=visit?.clinical_snapshot?JSON.parse(visit.clinical_snapshot):{}
    return {clinical:{...snapshot,complaint:visit.complaint,diagnosis:visit.diagnosis,treatment:visit.treatment,followUp:visit.follow_up,
      referralDestination:visit.referral_destination,referralNotes:visit.referral_notes,
      temperatureCelsius:snapshot.temperatureCelsius??visit.temperature_celsius,systolicPressure:snapshot.systolicPressure??visit.systolic_pressure,
      diastolicPressure:snapshot.diastolicPressure??visit.diastolic_pressure,weightKg:snapshot.weightKg??visit.weight_kg},
      medicines:[...stock,...external],revisions}
  }
  if(type==='VISIT_ASRAMA'||type==='OBSERVASI') {
    const dorm=type==='VISIT_ASRAMA'
    const [record,exams,legacy]=await Promise.all([
      queryOne<any>(dorm?'SELECT * FROM poskestren_dorm_visit WHERE id=?':'SELECT * FROM poskestren_observation WHERE id=?',[id]),
      query<any>(`SELECT e.*,p.full_name AS doctor_name FROM poskestren_clinical_exam e
        JOIN poskestren_personnel p ON p.id=e.personnel_id WHERE ${dorm?'dorm_visit_id':'observation_id'}=? ORDER BY examined_at,id`,[id]),
      query<any>(dorm?'SELECT * FROM poskestren_dorm_visit_medicine WHERE dorm_visit_id=?':'SELECT * FROM poskestren_observation_medicine WHERE observation_id=?',[id]),
    ])
    const details=await Promise.all(exams.map(async exam=>({...exam,clinical:JSON.parse(exam.clinical_json),
      medicines:await query<any>('SELECT * FROM poskestren_clinical_prescription_item WHERE exam_id=? ORDER BY id',[exam.id])})))
    return {clinical:dorm?{complaint:record.complaint,allergies:record.allergies_snapshot,diseaseHistory:record.disease_history_snapshot,
      notes:record.notes,temperatureCelsius:record.temperature_celsius,systolicPressure:record.systolic_pressure,
      diastolicPressure:record.diastolic_pressure,weightKg:record.weight_kg}:{...(record.clinical_snapshot?JSON.parse(record.clinical_snapshot):{}),complaint:record.symptoms,notes:record.notes,referralDestination:record.referral_destination},
      record,exams:details,medicines:legacy}
  }
  const record=await queryOne<any>('SELECT * FROM poskestren_outside_treatment WHERE id=?',[id])
  return {record,clinical:{complaint:record.complaint,notes:record.notes}}
}
