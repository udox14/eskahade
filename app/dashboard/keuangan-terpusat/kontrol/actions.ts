'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, financeQueryOne, generateId, getFinanceDB, query } from '@/lib/db'
import { getEffectiveRoles } from '@/lib/auth/session'
import { requireFinanceAccess } from '@/lib/finance/access'

const PATH='/dashboard/keuangan-terpusat/kontrol'
const SETTING_KEYS=new Set(['finance_payment_intent_ttl_hours','finance_soft_alerts','finance_meal_cutoff','finance_laundry_cutoff'])

function normalizedSetting(key:string,raw:string){
  if(key==='finance_payment_intent_ttl_hours'){
    const value=Number(raw)
    if(!Number.isSafeInteger(value)||value<1||value>168)throw new Error('TTL payment intent harus 1–168 jam.')
    return String(value)
  }
  const parsed=JSON.parse(raw) as Record<string,unknown>
  if(key==='finance_soft_alerts'){
    for(const name of ['topup_rupiah','student_balance_rupiah','aggregate_float_rupiah']){
      const value=Number(parsed[name])
      if(!Number.isSafeInteger(value)||value<0)throw new Error(`Nilai ${name} harus rupiah bulat non-negatif.`)
    }
    return JSON.stringify({
      topup_rupiah:Number(parsed.topup_rupiah),
      student_balance_rupiah:Number(parsed.student_balance_rupiah),
      aggregate_float_rupiah:Number(parsed.aggregate_float_rupiah),
    })
  }
  const day=Number(parsed.day),time=String(parsed.time||'')
  if(!Number.isSafeInteger(day)||day<1||day>31||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Cutoff harus berisi day 1–31 dan time HH:mm.')
  return JSON.stringify({day,time})
}

export async function updateFinanceSettingAction(form:FormData){
  const session=await requireFinanceAccess('CONFIGURE')
  const key=String(form.get('key')||'')
  if(!SETTING_KEYS.has(key))return{success:false as const,error:'Pengaturan tidak didukung.'}
  try{
    const value=normalizedSetting(key,String(form.get('value')||''))
    const current=await financeQueryOne<{value:string}>(`SELECT value FROM finance_settings WHERE key=?`,[key])
    const db=await getFinanceDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_settings(key,value,updated_at,updated_by) VALUES(?,?,datetime('now'),?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now'),updated_by=excluded.updated_by`).bind(key,value,session.id),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'STAFF',?,'UPDATE','FINANCE_SETTING',?,?,?)`).bind(generateId(),session.id,key,JSON.stringify({value:current?.value||null}),JSON.stringify({value})),
    ])
    revalidatePath(PATH)
    return{success:true as const}
  }catch(error){return{success:false as const,error:error instanceof Error?error.message:'Pengaturan tidak valid.'}}
}

export async function retryOutboxAction(id:string){
  const session=await requireFinanceAccess('EXECUTE')
  const db=await getFinanceDB(),result=await db.prepare(`UPDATE finance_outbox SET status='PENDING',available_at=datetime('now'),last_error=NULL WHERE id=? AND status='FAILED'`).bind(id).run()
  if(!result.meta?.changes)return{success:false as const,error:'Event tidak ditemukan atau bukan berstatus FAILED.'}
  await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'RETRY','OUTBOX_EVENT',?)`).bind(generateId(),session.id,id).run()
  revalidatePath(PATH)
  return{success:true as const}
}

export async function revokeFinanceSessionAction(id:string){
  const session=await requireFinanceAccess('CONFIGURE')
  const db=await getFinanceDB(),result=await db.prepare(`UPDATE finance_staff_sessions SET revoked_at=datetime('now') WHERE id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now')`).bind(id).run()
  if(!result.meta?.changes)return{success:false as const,error:'Sesi sudah berakhir, sudah dicabut, atau tidak ditemukan.'}
  await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'REVOKE','FINANCE_STAFF_SESSION',?)`).bind(generateId(),session.id,id).run()
  revalidatePath(PATH)
  return{success:true as const}
}

export async function getFinanceControlData(){
  const session=await requireFinanceAccess('VIEW')
  const roles=getEffectiveRoles(session)
  const canAudit=(roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara'))||roles.includes('admin')||roles.includes('demo')
  const canConfigure=roles.includes('bendahara')||roles.includes('admin')||roles.includes('demo')
  const users=await query<any>(`SELECT id,full_name,email FROM users`)
  const names=new Map(users.map(row=>[row.id,row.full_name||row.email]))
  const settings=await financeQuery<any>(`SELECT * FROM finance_settings ORDER BY key`)
  const outbox=await financeQuery<any>(`SELECT id,event_type,aggregate_type,aggregate_id,status,attempts,available_at,processed_at,last_error,created_at FROM finance_outbox ORDER BY CASE status WHEN 'FAILED' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'PROCESSING' THEN 2 ELSE 3 END,created_at DESC LIMIT 250`)
  const mfa=await financeQuery<any>(`SELECT user_id,method,enabled_at,last_verified_at FROM finance_staff_mfa ORDER BY enabled_at DESC`)
  const sessions=await financeQuery<any>(`SELECT id,user_id,created_at,expires_at,revoked_at,ip_address,user_agent FROM finance_staff_sessions ORDER BY created_at DESC LIMIT 150`)
  const authTrend=await financeQuery<any>(`SELECT date(created_at,'+7 hours') day,COUNT(*) attempts,SUM(CASE WHEN succeeded=1 THEN 1 ELSE 0 END) succeeded,SUM(CASE WHEN succeeded=0 THEN 1 ELSE 0 END) failed FROM finance_auth_attempts WHERE datetime(created_at)>=datetime('now','-14 days') GROUP BY date(created_at,'+7 hours') ORDER BY day`)
  const audit=canAudit?await financeQuery<any>(`SELECT * FROM finance_audit_log ORDER BY created_at DESC LIMIT 500`):[]
  return{
    settings,
    outbox,
    mfa:mfa.map(row=>({...row,user_name:names.get(row.user_id)||row.user_id})),
    sessions:sessions.map(row=>({...row,user_name:names.get(row.user_id)||row.user_id})),
    authTrend,
    audit:audit.map(row=>({...row,actor_name:names.get(row.actor_id)||row.actor_id||row.actor_type})),
    canAudit,
    canConfigure,
    canExecute:roles.includes('bendahara')||roles.includes('admin')||roles.includes('demo'),
    nowMs:Date.now(),
  }
}
