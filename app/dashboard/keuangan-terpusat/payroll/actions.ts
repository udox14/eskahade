'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, query, queryOne } from '@/lib/db'
import { financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import {
  approvePayrollPeriod,
  calculatePayrollPeriod,
  createPayrollPeriod,
  createPayrollPolicy,
  createTeacherCompensation,
  deleteTeachingAttendance,
  lockPayrollAttendance,
  upsertTeachingAttendance,
  verifyTeachingAttendance,
} from '@/lib/finance/payroll'
import { syncFinanceTeacherSnapshots } from '@/lib/finance/snapshots'
import { runBulk } from '@/lib/finance/bulk'

const PATH = '/dashboard/keuangan-terpusat/payroll'
const refresh = () => revalidatePath(PATH)

export async function calculatePayrollAction(id:string){const s=await requireFinanceAccess('CONFIGURE');const r=await calculatePayrollPeriod(id,s.id);if(r.success)refresh();return r}
export async function createPayrollPeriodAction(periodKey:string){const s=await requireFinanceAccess('CONFIGURE');const r=await createPayrollPeriod(periodKey,s.id);if(r.success)refresh();return r}
export async function lockPayrollAttendanceAction(id:string){const s=await requireFinanceAccess('CONFIGURE');const r=await lockPayrollAttendance(id,s.id);if(r.success)refresh();return r}
export async function approvePayrollAction(id:string){const s=await requireFinanceAccess('CHECK');const r=await approvePayrollPeriod(id,s.id);if(r.success)refresh();return r}

export async function createPayrollPolicyAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const mode=String(form.get('fixedSalaryMode')) as 'UNCHANGED'|'DEDUCT_ABSENCE'|'ATTENDANCE_THRESHOLD'
  const r=await createPayrollPolicy({
    effectiveFrom:String(form.get('effectiveFrom')),
    fixedSalaryMode:mode,
    thresholdPercent:mode==='ATTENDANCE_THRESHOLD'?Number(form.get('thresholdPercent')):null,
    substitutePercent:Number(form.get('substitutePercent')),
    defaultSessionRateRupiah:Number(form.get('defaultSessionRateRupiah')),
    actorId:s.id,
  })
  if(r.success)refresh()
  return r
}

export async function createTeacherCompensationAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const teacherId=String(form.get('teacherId'))
  const teacher=await queryOne<{id:number}>(`SELECT id FROM data_guru WHERE CAST(id AS TEXT)=?`,[teacherId])
  if(!teacher)return{success:false as const,error:'Guru tidak ditemukan.'}
  await syncFinanceTeacherSnapshots([teacherId])
  const sessionRate=String(form.get('sessionRateRupiah')||'').trim()
  const r=await createTeacherCompensation({
    teacherId,
    effectiveFrom:String(form.get('effectiveFrom')),
    fixedSalaryRupiah:Number(form.get('fixedSalaryRupiah')),
    sessionRateRupiah:sessionRate?Number(sessionRate):null,
    actorId:s.id,
  })
  if(r.success)refresh()
  return r
}

export async function syncTeachersAction(){
  await requireFinanceAccess('CONFIGURE')
  const teachers=await query<{id:number}>(`SELECT id FROM data_guru`)
  await syncFinanceTeacherSnapshots(teachers.map(row=>String(row.id)))
  refresh()
  return{success:true as const,count:teachers.length}
}

export async function saveTeachingAttendanceAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const scheduledTeacherId=String(form.get('scheduledTeacherId'))
  const actualTeacherId=String(form.get('actualTeacherId')||'')||null
  const ids=[scheduledTeacherId,...(actualTeacherId?[actualTeacherId]:[])]
  const teachers=await query<{id:number}>(`SELECT id FROM data_guru WHERE CAST(id AS TEXT) IN (${ids.map(()=>'?').join(',')})`,ids)
  if(teachers.length!==new Set(ids).size)return{success:false as const,error:'Guru terjadwal atau guru aktual tidak ditemukan.'}
  await syncFinanceTeacherSnapshots(ids)
  const r=await upsertTeachingAttendance({
    payrollPeriodId:String(form.get('payrollPeriodId')),
    scheduleReference:String(form.get('scheduleReference')),
    scheduledTeacherId,
    actualTeacherId,
    sessionDate:String(form.get('sessionDate')),
    status:String(form.get('status')) as 'PRESENT'|'ABSENT'|'HOLIDAY'|'SUBSTITUTE',
    notes:String(form.get('notes')||'')||null,
    actorId:s.id,
  })
  if(r.success)refresh()
  return r
}

export async function verifyTeachingAttendanceAction(id:string){
  const s=await requireFinanceAccess('CHECK')
  const r=await verifyTeachingAttendance(id,s.id)
  if(r.success)refresh()
  return r
}

export async function deleteTeachingAttendanceAction(id:string){
  const s=await requireFinanceAccess('CONFIGURE')
  const r=await deleteTeachingAttendance(id,s.id)
  if(r.success)refresh()
  return r
}

/** Guru yang benar-benar ada di master; dipakai kedua importir agar id palsu tertolak sebelum menulis. */
async function knownTeacherIds(ids:string[]):Promise<Set<string>>{
  const unique=[...new Set(ids.filter(Boolean))]
  if(!unique.length)return new Set()
  const rows=await query<{id:number}>(`SELECT id FROM data_guru WHERE CAST(id AS TEXT) IN (${unique.map(()=>'?').join(',')})`,unique)
  return new Set(rows.map(row=>String(row.id)))
}

/** Baris template kompensasi & absensi; dipakai bersama UI supaya kolomnya tidak pernah berbeda. */
export type CompensationImportRow={
  row:number;teacherId:string;effectiveFrom:string;fixedSalaryRupiah:number;sessionRateRupiah:number|null
}
export type AttendanceImportRow={
  row:number;payrollPeriodId:string;sessionDate:string;scheduleReference:string
  scheduledTeacherId:string;actualTeacherId:string|null;status:'PRESENT'|'ABSENT'|'HOLIDAY'|'SUBSTITUTE';notes:string|null
}

export async function importCompensationAction(rows:CompensationImportRow[]){
  const session=await requireFinanceAccess('CONFIGURE')
  const known=await knownTeacherIds(rows.map(item=>item.teacherId))
  // Snapshot disinkronkan sekali untuk seluruh berkas, bukan per baris.
  await syncFinanceTeacherSnapshots([...known])
  const summary=await runBulk(rows,async item=>{
    if(!known.has(item.teacherId))return{success:false,error:`Guru dengan id ${item.teacherId} tidak ada di master guru.`}
    return createTeacherCompensation({
      teacherId:item.teacherId,
      effectiveFrom:item.effectiveFrom,
      fixedSalaryRupiah:item.fixedSalaryRupiah,
      sessionRateRupiah:item.sessionRateRupiah,
      actorId:session.id,
    })
  })
  if(summary.success&&summary.created)refresh()
  return summary
}

export async function importAttendanceAction(rows:AttendanceImportRow[]){
  const session=await requireFinanceAccess('CONFIGURE')
  const known=await knownTeacherIds(rows.flatMap(item=>[item.scheduledTeacherId,item.actualTeacherId||'']))
  await syncFinanceTeacherSnapshots([...known])
  const summary=await runBulk(rows,async item=>{
    if(!known.has(item.scheduledTeacherId))return{success:false,error:`Guru terjadwal id ${item.scheduledTeacherId} tidak ada di master guru.`}
    if(item.actualTeacherId&&!known.has(item.actualTeacherId))return{success:false,error:`Guru pengganti id ${item.actualTeacherId} tidak ada di master guru.`}
    return upsertTeachingAttendance({
      payrollPeriodId:item.payrollPeriodId,
      scheduleReference:item.scheduleReference,
      scheduledTeacherId:item.scheduledTeacherId,
      actualTeacherId:item.actualTeacherId,
      sessionDate:item.sessionDate,
      status:item.status,
      notes:item.notes,
      actorId:session.id,
    })
  })
  if(summary.success&&summary.created)refresh()
  return summary
}

/** Verifikasi beberapa baris absensi sekaligus; syarat lock adalah semua baris terverifikasi. */
export async function verifyAttendanceBatchAction(ids:string[]){
  const session=await requireFinanceAccess('CHECK')
  const summary=await runBulk(ids.map((id,index)=>({row:index+1,id})),item=>verifyTeachingAttendance(item.id,session.id))
  if(summary.success&&summary.created)refresh()
  return summary
}

export async function getPayrollData(){
  const session=await requireFinanceAccess('VIEW')
  const capabilities=await financeCapabilities(session)
  const teachers=await query<any>(`SELECT id,nama_lengkap,gelar,kode_guru FROM data_guru ORDER BY nama_lengkap`)
  const teacherNames=new Map(teachers.map(row=>[String(row.id),row.nama_lengkap]))
  const periods=await financeQuery<any>(`SELECT p.*,pol.version policy_version,pol.fixed_salary_mode,
    COUNT(a.id) attendance_count,
    SUM(CASE WHEN a.id IS NOT NULL AND a.verified_at IS NULL THEN 1 ELSE 0 END) unverified_count
    FROM finance_payroll_periods p
    LEFT JOIN finance_payroll_policies pol ON pol.id=p.policy_id
    LEFT JOIN finance_teaching_attendance a ON a.payroll_period_id=p.id
    GROUP BY p.id ORDER BY p.period_key DESC`)
  const policies=await financeQuery<any>(`SELECT * FROM finance_payroll_policies ORDER BY version DESC LIMIT 30`)
  const compensation=await financeQuery<any>(`SELECT c.*,s.full_name teacher_name FROM finance_teacher_compensation c LEFT JOIN finance_teacher_snapshots s ON s.teacher_id=c.teacher_id ORDER BY c.effective_from DESC,c.created_at DESC LIMIT 300`)
  const attendance=await financeQuery<any>(`SELECT a.*,p.period_key,ss.full_name scheduled_teacher_name,aa.full_name actual_teacher_name
    FROM finance_teaching_attendance a
    JOIN finance_payroll_periods p ON p.id=a.payroll_period_id
    LEFT JOIN finance_teacher_snapshots ss ON ss.teacher_id=a.scheduled_teacher_id
    LEFT JOIN finance_teacher_snapshots aa ON aa.teacher_id=a.actual_teacher_id
    ORDER BY a.session_date DESC,a.schedule_reference LIMIT 500`)
  const items=await financeQuery<any>(`SELECT i.*,p.period_key,g.full_name teacher_name FROM finance_payroll_items i JOIN finance_payroll_periods p ON p.id=i.payroll_period_id LEFT JOIN finance_teacher_snapshots g ON g.teacher_id=i.teacher_id ORDER BY p.period_key DESC,i.created_at DESC LIMIT 300`)
  return{
    periods,
    policies,
    compensation:compensation.map(row=>({...row,teacher_name:row.teacher_name||teacherNames.get(String(row.teacher_id))||row.teacher_id})),
    attendance:attendance.map(row=>({...row,scheduled_teacher_name:row.scheduled_teacher_name||teacherNames.get(String(row.scheduled_teacher_id))||row.scheduled_teacher_id,actual_teacher_name:row.actual_teacher_name||teacherNames.get(String(row.actual_teacher_id))||row.actual_teacher_id})),
    items:items.map(row=>({...row,teacher_name:row.teacher_name||teacherNames.get(String(row.teacher_id))||row.teacher_id})),
    teachers,
    canConfigure:capabilities.configure,
    canCheck:capabilities.check,
  }
}
