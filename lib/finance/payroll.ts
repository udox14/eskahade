import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { financeError } from './errors'
import { prepareJournalStatements } from './ledger'

export async function createPayrollPeriod(periodKey:string){try{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey))throw new Error('Format periode tidak valid.');const policy=await queryOne<{id:string}>(`SELECT id FROM finance_payroll_policies WHERE effective_from<=? ORDER BY effective_from DESC,version DESC LIMIT 1`,[`${periodKey}-01`]);if(!policy)throw new Error('Kebijakan payroll belum tersedia.');const id=generateId();await(await getDB()).prepare(`INSERT INTO finance_payroll_periods(id,period_key,policy_id) VALUES(?,?,?)`).bind(id,periodKey,policy.id).run();return{success:true as const,id}}catch(error){return{success:false as const,...financeError(error)}}}

export async function lockPayrollAttendance(periodId:string,actorId:string){try{const summary=await queryOne<{total:number;unverified:number}>(`SELECT COUNT(*) total,SUM(CASE WHEN verified_at IS NULL THEN 1 ELSE 0 END) unverified FROM finance_teaching_attendance WHERE payroll_period_id=?`,[periodId]);if(!summary?.total||Number(summary.unverified)>0)throw new Error('Absensi kosong atau belum seluruhnya diverifikasi.');await(await getDB()).prepare(`UPDATE finance_payroll_periods SET attendance_status='LOCKED',locked_by=?,locked_at=datetime('now') WHERE id=? AND attendance_status='OPEN'`).bind(actorId,periodId).run();return{success:true as const}}catch(error){return{success:false as const,...financeError(error)}}}

export async function calculatePayrollPeriod(periodId: string, actorId: string) {
  try {
    const period=await queryOne<{id:string;attendance_status:string;payroll_status:string;policy_id:string}>(`SELECT id,attendance_status,payroll_status,policy_id FROM finance_payroll_periods WHERE id=?`,[periodId])
    if(!period||period.attendance_status!=='LOCKED'||!['DRAFT','CALCULATED'].includes(period.payroll_status)) throw new Error('Absensi harus dikunci sebelum payroll dihitung.')
    const policy=await queryOne<any>(`SELECT * FROM finance_payroll_policies WHERE id=?`,[period.policy_id])
    if(!policy) throw new Error('Kebijakan payroll tidak ditemukan.')
    const teachers=await query<any>(`SELECT c.teacher_id,c.fixed_salary_rupiah,c.session_rate_rupiah FROM finance_teacher_compensation c WHERE c.effective_from=(SELECT MAX(c2.effective_from) FROM finance_teacher_compensation c2 WHERE c2.teacher_id=c.teacher_id AND c2.effective_from<=date('now'))`)
    const attendance=await query<any>(`SELECT * FROM finance_teaching_attendance WHERE payroll_period_id=? AND verified_at IS NOT NULL`,[periodId])
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
    statements.push(db.prepare(`UPDATE finance_payroll_periods SET payroll_status='APPROVED',approved_by=?,approved_at=datetime('now') WHERE id=? AND payroll_status='CALCULATED'`).bind(actorId,periodId));await db.batch(statements);return{success:true as const,itemCount:items.length}
  }catch(error){return{success:false as const,...financeError(error)}}
}
