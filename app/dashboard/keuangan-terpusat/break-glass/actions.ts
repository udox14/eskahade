'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { getSession,getEffectiveRoles } from '@/lib/auth/session'
import { getFinanceDB as getDB,generateId,financeQuery as query,financeQueryOne as queryOne } from '@/lib/db'

const PATH='/dashboard/keuangan-terpusat/break-glass'

export async function activateBreakGlass(formData:FormData){
  const session=await getSession()
  if(!session)return{error:'Sesi tidak valid.'}
  const roles=getEffectiveRoles(session)
  if(!roles.includes('admin')&&!roles.includes('demo'))return{error:'Hanya admin teknis yang dapat mengaktifkan break-glass.'}
  const hasNative=roles.includes('bendahara')||(roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara'))||(roles.includes('pengurus_asrama')&&roles.includes('jabatan:bendahara'))
  if(hasNative)return{error:'Akun ini sudah memiliki role keuangan native dan tidak boleh memakai break-glass.'}
  const reason=String(formData.get('reason')||'').trim()
  if(reason.length<20)return{error:'Alasan darurat minimal 20 karakter.'}
  const existing=await queryOne<{id:string}>(`SELECT id FROM finance_break_glass WHERE user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') LIMIT 1`,[session.id])
  if(existing)return{error:'Masih ada akses break-glass aktif untuk akun ini.'}
  const id=generateId(),db=await getDB()
  await db.batch([
    db.prepare(`INSERT INTO finance_staff_snapshots(user_id,full_name,roles_json,asrama_scope,synced_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,roles_json=excluded.roles_json,asrama_scope=excluded.asrama_scope,synced_at=datetime('now')`).bind(session.id,session.full_name,JSON.stringify(roles),session.asrama_binaan),
    db.prepare(`INSERT INTO finance_break_glass(id,user_id,reason,scope,expires_at) VALUES(?,?,?,'FINANCE_FULL',datetime('now','+30 minutes'))`).bind(id,session.id,reason),
    db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(generateId(),'BREAK_GLASS_ACTIVATED','USER',session.id,JSON.stringify({breakGlassId:id,reason,expiresInMinutes:30})),
    db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'ACTIVATE','BREAK_GLASS',?,?)`).bind(generateId(),session.id,id,JSON.stringify({reason,scope:'FINANCE_FULL',expiresInMinutes:30})),
  ])
  revalidatePath(PATH)
  return{success:true as const,id}
}

export async function reviewBreakGlass(id:string){
  const session=await getSession()
  if(!session)return{error:'Sesi tidak valid.'}
  const roles=getEffectiveRoles(session)
  if(!(roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara'))&&!roles.includes('demo'))return{error:'Hanya checker Dewan Santri yang dapat mereview.'}
  const row=await queryOne<{id:string;user_id:string}>(`SELECT id,user_id FROM finance_break_glass WHERE id=?`,[id])
  if(!row)return{error:'Aktivasi break-glass tidak ditemukan.'}
  if(row.user_id===session.id)return{error:'Aktivasi sendiri tidak boleh direview sendiri.'}
  const db=await getDB(),result=await db.prepare(`UPDATE finance_break_glass SET reviewed_by=?,reviewed_at=datetime('now') WHERE id=? AND reviewed_at IS NULL`).bind(session.id,id).run()
  if(!result.meta?.changes)return{error:'Aktivasi ini sudah direview.'}
  await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'REVIEW','BREAK_GLASS',?)`).bind(generateId(),session.id,id).run()
  revalidatePath(PATH)
  return{success:true as const}
}

export async function revokeBreakGlass(id:string){
  const session=await getSession()
  if(!session)return{error:'Sesi tidak valid.'}
  const roles=getEffectiveRoles(session)
  const row=await queryOne<{id:string;user_id:string}>(`SELECT id,user_id FROM finance_break_glass WHERE id=?`,[id])
  if(!row)return{error:'Aktivasi break-glass tidak ditemukan.'}
  const isChecker=(roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara'))||roles.includes('demo')
  if(!isChecker&&!(roles.includes('admin')&&row.user_id===session.id))return{error:'Anda tidak berwenang mencabut akses ini.'}
  const db=await getDB(),result=await db.prepare(`UPDATE finance_break_glass SET revoked_at=datetime('now') WHERE id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now')`).bind(id).run()
  if(!result.meta?.changes)return{error:'Akses sudah berakhir atau sudah dicabut.'}
  await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'REVOKE','BREAK_GLASS',?)`).bind(generateId(),session.id,id).run()
  revalidatePath(PATH)
  return{success:true as const}
}

export async function getBreakGlassData(){
  const session=await getSession()
  if(!session)throw new Error('Sesi tidak valid.')
  const roles=getEffectiveRoles(session)
  const rows=await query<any>(`SELECT b.*,u.full_name FROM finance_break_glass b LEFT JOIN finance_staff_snapshots u ON u.user_id=b.user_id ORDER BY b.starts_at DESC LIMIT 100`)
  return{
    rows,
    currentUserId:session.id,
    canActivate:(roles.includes('admin')||roles.includes('demo'))&&!roles.includes('bendahara')&&!(roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara'))&&!(roles.includes('pengurus_asrama')&&roles.includes('jabatan:bendahara')),
    canReview:(roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara'))||roles.includes('demo'),
    nowMs:Date.now(),
  }
}
