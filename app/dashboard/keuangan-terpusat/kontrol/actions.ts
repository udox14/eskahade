'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, financeQueryOne, generateId, getFinanceDB, query } from '@/lib/db'
import { financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'

const PATH='/dashboard/keuangan-terpusat/kontrol'
const SETTING_KEYS=new Set(['finance_payment_intent_ttl_hours','finance_soft_alerts','finance_meal_cutoff','finance_laundry_cutoff','finance_payout_api_fee_rupiah'])

function normalizedSetting(key:string,raw:string){
  if(key==='finance_payment_intent_ttl_hours'){
    const value=Number(raw)
    if(!Number.isSafeInteger(value)||value<1||value>168)throw new Error('TTL payment intent harus 1–168 jam.')
    return String(value)
  }
  // Biaya payout adalah rupiah bulat, bukan JSON. Tanpa cabang ini nilainya
  // jatuh ke JSON.parse di bawah dan selalu ditolak.
  if(key==='finance_payout_api_fee_rupiah'){
    const value=Number(raw)
    if(!Number.isSafeInteger(value)||value<0||value>100_000)throw new Error('Biaya payout API harus rupiah bulat 0–100.000.')
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

export async function getFinanceControlData(){
  const session=await requireFinanceAccess('VIEW')
  const capabilities=await financeCapabilities(session)
  const canAudit=capabilities.audit
  const canConfigure=capabilities.configure
  const users=await query<any>(`SELECT id,full_name,email FROM users`)
  const names=new Map(users.map(row=>[row.id,row.full_name||row.email]))
  const settings=await financeQuery<any>(`SELECT * FROM finance_settings ORDER BY key`)
  const audit=canAudit?await financeQuery<any>(`SELECT * FROM finance_audit_log ORDER BY created_at DESC LIMIT 500`):[]
  return{
    settings,
    audit:audit.map(row=>({...row,actor_name:names.get(row.actor_id)||row.actor_id||row.actor_type})),
    canAudit,
    canConfigure,
    nowMs:Date.now(),
  }
}
