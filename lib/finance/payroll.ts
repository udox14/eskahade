import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { financeError } from './errors'
import { prepareJournalStatements } from './ledger'
import { syncFinanceTeacherSnapshots } from './snapshots'

export async function createPayrollPeriod(periodKey:string,actorId?:string|null){try{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey))throw new Error('Format periode tidak valid.');const policy=await queryOne<{id:string}>(`SELECT id FROM finance_payroll_policies WHERE effective_from<=? ORDER BY effective_from DESC,version DESC LIMIT 1`,[`${periodKey}-01`]);if(!policy)throw new Error('Kebijakan payroll belum tersedia.');const id=generateId(),db=await getDB();await db.batch([db.prepare(`INSERT INTO finance_payroll_periods(id,period_key,policy_id) VALUES(?,?,?)`).bind(id,periodKey,policy.id),db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CREATE','PAYROLL_PERIOD',?,?)`).bind(generateId(),actorId||null,id,JSON.stringify({periodKey,policyId:policy.id}))]);return{success:true as const,id}}catch(error){return{success:false as const,...financeError(error)}}}

export async function lockPayrollAttendance(periodId:string,actorId:string){try{const summary=await queryOne<{total:number;unverified:number}>(`SELECT COUNT(*) total,SUM(CASE WHEN verified_at IS NULL THEN 1 ELSE 0 END) unverified FROM finance_teaching_attendance WHERE payroll_period_id=?`,[periodId]);if(!summary?.total||Number(summary.unverified)>0)throw new Error('Absensi kosong atau belum seluruhnya diverifikasi.');const db=await getDB(),result=await db.prepare(`UPDATE finance_payroll_periods SET attendance_status='LOCKED',locked_by=?,locked_at=datetime('now') WHERE id=? AND attendance_status='OPEN'`).bind(actorId,periodId).run();if(!result.meta?.changes)throw new Error('Periode tidak ditemukan atau absensi sudah dikunci.');await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'LOCK_ATTENDANCE','PAYROLL_PERIOD',?,?)`).bind(generateId(),actorId,periodId,JSON.stringify(summary)).run();return{success:true as const}}catch(error){return{success:false as const,...financeError(error)}}}

export async function calculatePayrollPeriod(periodId: string, actorId: string) {
  try {
    const period=await queryOne<{id:string;period_key:string;attendance_status:string;payroll_status:string;policy_id:string}>(`SELECT id,period_key,attendance_status,payroll_status,policy_id FROM finance_payroll_periods WHERE id=?`,[periodId])
    if(!period||period.attendance_status!=='LOCKED'||!['DRAFT','CALCULATED'].includes(period.payroll_status)) throw new Error('Absensi harus dikunci sebelum payroll dihitung.')
    const policy=await queryOne<any>(`SELECT * FROM finance_payroll_policies WHERE id=?`,[period.policy_id])
    if(!policy) throw new Error('Kebijakan payroll tidak ditemukan.')
    const teachers=await query<any>(`SELECT c.teacher_id,c.fixed_salary_rupiah,c.session_rate_rupiah FROM finance_teacher_compensation c WHERE c.effective_from=(SELECT MAX(c2.effective_from) FROM finance_teacher_compensation c2 WHERE c2.teacher_id=c.teacher_id AND c2.effective_from<=?)`,[`${period.period_key}-31`])
    const attendance=await query<any>(`SELECT * FROM finance_teaching_attendance WHERE payroll_period_id=? AND verified_at IS NOT NULL`,[periodId])
    if(!teachers.length)throw new Error('Kompensasi guru belum tersedia untuk periode ini.')
    const compensated=new Set(teachers.map(row=>String(row.teacher_id)))
    const missing=[...new Set(attendance.flatMap(row=>[String(row.scheduled_teacher_id),String(row.actual_teacher_id||'')]).filter(id=>id&&!compensated.has(id)))]
    if(missing.length)throw new Error(`Kompensasi belum tersedia untuk ${missing.length} guru pada periode ini.`)
    await syncFinanceTeacherSnapshots([...teachers.map(row=>String(row.teacher_id)),...attendance.flatMap(row=>[String(row.scheduled_teacher_id),String(row.actual_teacher_id||'')])])
    const items:any[]=[]
    for(const teacher of teachers){
      const scheduled=attendance.filter(a=>String(a.scheduled_teacher_id)===String(teacher.teacher_id))
      const present=scheduled.filter(a=>a.status==='PRESENT'&&String(a.actual_teacher_id||a.scheduled_teacher_id)===String(teacher.teacher_id)).length
      const absent=scheduled.filter(a=>a.status==='ABSENT'||a.status==='SUBSTITUTE').length
      const substitute=attendance.filter(a=>a.status==='SUBSTITUTE'&&String(a.actual_teacher_id)===String(teacher.teacher_id)).length
      const rate=Number(teacher.session_rate_rupiah??policy.default_session_rate_rupiah)
      const fixed=Number(teacher.fixed_salary_rupiah||0);let deduction=0
      if(policy.fixed_salary_mode==='DEDUCT_ABSENCE'&&scheduled.length){deduction=Math.round(fixed*absent/scheduled.length)}
      if(policy.fixed_salary_mode==='ATTENDANCE_THRESHOLD'&&scheduled.length&&present/scheduled.length*100<Number(policy.threshold_percent||0)){deduction=fixed}
      const honor=present*rate+Math.round(substitute*rate*Number(policy.substitute_percent)/100)
      const net=Math.max(0,fixed+honor-deduction)
      items.push({id:generateId(),teacherId:String(teacher.teacher_id),fixed,honor,deduction,net,calc:{scheduled:scheduled.length,present,absent,substitute,rate,policyVersion:policy.version}})
    }
    const db=await getDB();const statements=[db.prepare(`DELETE FROM finance_payroll_items WHERE payroll_period_id=? AND status='CALCULATED'`).bind(periodId)]
    for(const item of items)statements.push(db.prepare(`INSERT INTO finance_payroll_items(id,payroll_period_id,teacher_id,fixed_salary_rupiah,session_honor_rupiah,deduction_rupiah,net_rupiah,calculation_json) VALUES(?,?,?,?,?,?,?,?)`).bind(item.id,periodId,item.teacherId,item.fixed,item.honor,item.deduction,item.net,JSON.stringify(item.calc)))
    statements.push(db.prepare(`UPDATE finance_payroll_periods SET payroll_status='CALCULATED' WHERE id=? AND attendance_status='LOCKED'`).bind(periodId))
    statements.push(db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CALCULATE','PAYROLL_PERIOD',?,?)`).bind(generateId(),actorId,periodId,JSON.stringify({itemCount:items.length})))
    await db.batch(statements);return{success:true as const,itemCount:items.length}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function createPayrollPolicy(input:{
  effectiveFrom:string;fixedSalaryMode:'UNCHANGED'|'DEDUCT_ABSENCE'|'ATTENDANCE_THRESHOLD'
  thresholdPercent?:number|null;substitutePercent:number;defaultSessionRateRupiah:number;actorId:string
}){
  try{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom))throw new Error('Tanggal efektif kebijakan tidak valid.')
    if(!Number.isSafeInteger(input.substitutePercent)||input.substitutePercent<0||input.substitutePercent>100)throw new Error('Persentase substitusi harus 0–100.')
    if(!Number.isSafeInteger(input.defaultSessionRateRupiah)||input.defaultSessionRateRupiah<0)throw new Error('Tarif sesi default tidak valid.')
    const threshold=input.fixedSalaryMode==='ATTENDANCE_THRESHOLD'?Number(input.thresholdPercent):null
    if(input.fixedSalaryMode==='ATTENDANCE_THRESHOLD'&&(!Number.isSafeInteger(threshold)||Number(threshold)<1||Number(threshold)>100))throw new Error('Threshold kehadiran harus 1–100.')
    const latest=await queryOne<{version:number}>(`SELECT MAX(version) version FROM finance_payroll_policies`)
    const version=Number(latest?.version||0)+1,id=generateId(),db=await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_payroll_policies(id,version,effective_from,fixed_salary_mode,threshold_percent,substitute_percent,default_session_rate_rupiah,created_by) VALUES(?,?,?,?,?,?,?,?)`).bind(id,version,input.effectiveFrom,input.fixedSalaryMode,threshold,input.substitutePercent,input.defaultSessionRateRupiah,input.actorId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CREATE','PAYROLL_POLICY',?,?)`).bind(generateId(),input.actorId,id,JSON.stringify({version,effectiveFrom:input.effectiveFrom,fixedSalaryMode:input.fixedSalaryMode,thresholdPercent:threshold,substitutePercent:input.substitutePercent,defaultSessionRateRupiah:input.defaultSessionRateRupiah})),
    ])
    return{success:true as const,id,version}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function createTeacherCompensation(input:{teacherId:string;effectiveFrom:string;fixedSalaryRupiah:number;sessionRateRupiah?:number|null;actorId:string}){
  try{
    if(!input.teacherId)throw new Error('Guru wajib dipilih.')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom))throw new Error('Tanggal efektif kompensasi tidak valid.')
    if(!Number.isSafeInteger(input.fixedSalaryRupiah)||input.fixedSalaryRupiah<0)throw new Error('Gaji tetap tidak valid.')
    if(input.sessionRateRupiah!=null&&(!Number.isSafeInteger(input.sessionRateRupiah)||input.sessionRateRupiah<0))throw new Error('Tarif sesi tidak valid.')
    const id=generateId(),db=await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_teacher_compensation(id,teacher_id,effective_from,fixed_salary_rupiah,session_rate_rupiah,created_by) VALUES(?,?,?,?,?,?)`).bind(id,input.teacherId,input.effectiveFrom,input.fixedSalaryRupiah,input.sessionRateRupiah??null,input.actorId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CREATE','TEACHER_COMPENSATION',?,?)`).bind(generateId(),input.actorId,id,JSON.stringify({teacherId:input.teacherId,effectiveFrom:input.effectiveFrom,fixedSalaryRupiah:input.fixedSalaryRupiah,sessionRateRupiah:input.sessionRateRupiah??null})),
    ])
    return{success:true as const,id}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function upsertTeachingAttendance(input:{
  payrollPeriodId:string;scheduleReference:string;scheduledTeacherId:string;actualTeacherId?:string|null
  sessionDate:string;status:'PRESENT'|'ABSENT'|'HOLIDAY'|'SUBSTITUTE';notes?:string|null;actorId:string
}){
  try{
    const period=await queryOne<{attendance_status:string}>(`SELECT attendance_status FROM finance_payroll_periods WHERE id=?`,[input.payrollPeriodId])
    if(!period||period.attendance_status!=='OPEN')throw new Error('Absensi periode sudah dikunci atau periode tidak ditemukan.')
    const reference=input.scheduleReference.trim()
    if(reference.length<3)throw new Error('Referensi jadwal minimal 3 karakter.')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate))throw new Error('Tanggal sesi tidak valid.')
    let actual=input.actualTeacherId||null
    if(input.status==='PRESENT')actual=actual||input.scheduledTeacherId
    if(['ABSENT','HOLIDAY'].includes(input.status))actual=null
    if(input.status==='SUBSTITUTE'&&(!actual||actual===input.scheduledTeacherId))throw new Error('Guru pengganti wajib dipilih dan harus berbeda.')
    const current=await queryOne<{id:string;verified_at:string|null}>(`SELECT id,verified_at FROM finance_teaching_attendance WHERE payroll_period_id=? AND schedule_reference=? AND session_date=?`,[input.payrollPeriodId,reference,input.sessionDate])
    if(current?.verified_at)throw new Error('Absensi terverifikasi tidak dapat diubah.')
    const id=current?.id||generateId(),db=await getDB()
    if(current){
      await db.prepare(`UPDATE finance_teaching_attendance SET scheduled_teacher_id=?,actual_teacher_id=?,status=?,notes=? WHERE id=? AND verified_at IS NULL`).bind(input.scheduledTeacherId,actual,input.status,input.notes?.trim()||null,id).run()
    }else{
      await db.prepare(`INSERT INTO finance_teaching_attendance(id,payroll_period_id,schedule_reference,scheduled_teacher_id,actual_teacher_id,session_date,status,notes) VALUES(?,?,?,?,?,?,?,?)`).bind(id,input.payrollPeriodId,reference,input.scheduledTeacherId,actual,input.sessionDate,input.status,input.notes?.trim()||null).run()
    }
    await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'UPSERT','TEACHING_ATTENDANCE',?,?)`).bind(generateId(),input.actorId,id,JSON.stringify({payrollPeriodId:input.payrollPeriodId,scheduleReference:reference,scheduledTeacherId:input.scheduledTeacherId,actualTeacherId:actual,sessionDate:input.sessionDate,status:input.status})).run()
    return{success:true as const,id}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function verifyTeachingAttendance(id:string,actorId:string){
  try{
    const db=await getDB(),result=await db.prepare(`UPDATE finance_teaching_attendance SET verified_by=?,verified_at=datetime('now') WHERE id=? AND verified_at IS NULL AND EXISTS(SELECT 1 FROM finance_payroll_periods p WHERE p.id=finance_teaching_attendance.payroll_period_id AND p.attendance_status='OPEN')`).bind(actorId,id).run()
    if(!result.meta?.changes)throw new Error('Absensi sudah diverifikasi atau periode sudah dikunci.')
    await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'VERIFY','TEACHING_ATTENDANCE',?)`).bind(generateId(),actorId,id).run()
    return{success:true as const}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function deleteTeachingAttendance(id:string,actorId:string){
  try{
    const db=await getDB(),result=await db.prepare(`DELETE FROM finance_teaching_attendance WHERE id=? AND verified_at IS NULL AND EXISTS(SELECT 1 FROM finance_payroll_periods p WHERE p.id=finance_teaching_attendance.payroll_period_id AND p.attendance_status='OPEN')`).bind(id).run()
    if(!result.meta?.changes)throw new Error('Hanya absensi belum terverifikasi pada periode terbuka yang dapat dihapus.')
    await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'DELETE','TEACHING_ATTENDANCE',?)`).bind(generateId(),actorId,id).run()
    return{success:true as const}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function approvePayrollPeriod(periodId:string,actorId:string){
  try{
    const period=await queryOne<{period_key:string;payroll_status:string}>(`SELECT period_key,payroll_status FROM finance_payroll_periods WHERE id=?`,[periodId]);if(!period||period.payroll_status!=='CALCULATED')throw new Error('Payroll belum selesai dihitung.')
    const items=await query<any>(`SELECT * FROM finance_payroll_items WHERE payroll_period_id=? AND status='CALCULATED'`,[periodId]);if(!items.length)throw new Error('Tidak ada item payroll.')
    const db=await getDB(),statements:any[]=[]
    for(const item of items){
      if(Number(item.net_rupiah)<=0){statements.push(db.prepare(`UPDATE finance_payroll_items SET status='APPROVED',updated_at=datetime('now') WHERE id=? AND status='CALCULATED'`).bind(item.id))}
      else{const journal=prepareJournalStatements(db,{idempotencyKey:`payroll:${periodId}:${item.teacher_id}`,effectiveDate:`${period.period_key}-28`,description:`Akrual payroll guru ${item.teacher_id}`,sourceType:'PAYROLL_ACCRUAL',sourceId:item.id,actorType:'STAFF',actorId,entries:[{accountCode:'5102',side:'DEBIT',amountRupiah:Number(item.net_rupiah),counterpartyType:'TEACHER',counterpartyId:item.teacher_id},{accountCode:'2104',side:'CREDIT',amountRupiah:Number(item.net_rupiah),counterpartyType:'TEACHER',counterpartyId:item.teacher_id}]});statements.push(...journal.statements,db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),db.prepare(`UPDATE finance_payroll_items SET status='APPROVED',journal_id=?,updated_at=datetime('now') WHERE id=? AND status='CALCULATED'`).bind(journal.journalId,item.id))}
      if(statements.length>=70)await db.batch(statements.splice(0))
    }
    statements.push(
      db.prepare(`UPDATE finance_payroll_periods SET payroll_status='APPROVED',approved_by=?,approved_at=datetime('now') WHERE id=? AND payroll_status='CALCULATED'`).bind(actorId,periodId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'APPROVE','PAYROLL_PERIOD',?,?)`).bind(generateId(),actorId,periodId,JSON.stringify({itemCount:items.length})),
    );await db.batch(statements);return{success:true as const,itemCount:items.length}
  }catch(error){return{success:false as const,...financeError(error)}}
}
