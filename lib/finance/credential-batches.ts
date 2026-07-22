import { financeQuery, financeQueryOne, generateId, getFinanceDB } from '@/lib/db'
import { issueCredential } from './credentials'

export type CredentialBatchStatus = 'PENDING'|'PROCESSING'|'COMPLETED'|'COMPLETED_WITH_ERRORS'|'CANCELLED'
type CredentialBatchRow={id:string;credential_kind:string;status:CredentialBatchStatus;total_count:number;processed_count:number;success_count:number;failed_count:number;filter_json:string|null;created_by:string;created_at:string;updated_at:string;completed_at:string|null}

export async function createCredentialBatch(input:{
  santriIds:string[]
  kind:'QR_STATIC'|'RFID_UID'
  actorId:string
  filter?:Record<string,unknown>
}) {
  const santriIds=[...new Set(input.santriIds.filter(Boolean))]
  if(!santriIds.length) return {error:'Pilih minimal satu santri.'}
  if(santriIds.length>5000) return {error:'Maksimal 5.000 santri per batch.'}
  const id=generateId(),db=await getFinanceDB()
  await db.prepare(`INSERT INTO finance_credential_batches(id,credential_kind,total_count,filter_json,created_by)
    VALUES(?,?,?,?,?)`).bind(id,input.kind,santriIds.length,JSON.stringify(input.filter||{}),input.actorId).run()
  for(let offset=0;offset<santriIds.length;offset+=50){
    const chunk=santriIds.slice(offset,offset+50)
    await db.batch(chunk.map((santriId,index)=>db.prepare(`INSERT INTO finance_credential_batch_items(batch_id,santri_id,position)
      VALUES(?,?,?)`).bind(id,santriId,offset+index)))
  }
  await db.batch([
    db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json)
      VALUES(?,'STAFF',?,'CREATE_CREDENTIAL_BATCH','CREDENTIAL_BATCH',?,?)`).bind(generateId(),input.actorId,id,JSON.stringify({kind:input.kind,total:santriIds.length})),
    db.prepare(`UPDATE finance_credential_batches SET status='PROCESSING',updated_at=datetime('now') WHERE id=?`).bind(id),
  ])
  return {success:true as const,id,total:santriIds.length}
}

async function refreshBatchCounters(batchId:string) {
  const db=await getFinanceDB()
  await db.prepare(`UPDATE finance_credential_batches SET
    processed_count=(SELECT COUNT(*) FROM finance_credential_batch_items WHERE batch_id=? AND status IN ('SUCCESS','SKIPPED','FAILED')),
    success_count=(SELECT COUNT(*) FROM finance_credential_batch_items WHERE batch_id=? AND status='SUCCESS'),
    failed_count=(SELECT COUNT(*) FROM finance_credential_batch_items WHERE batch_id=? AND status='FAILED'),
    status=CASE
      WHEN (SELECT COUNT(*) FROM finance_credential_batch_items WHERE batch_id=? AND status IN ('PENDING','PROCESSING'))>0 THEN 'PROCESSING'
      WHEN (SELECT COUNT(*) FROM finance_credential_batch_items WHERE batch_id=? AND status='FAILED')>0 THEN 'COMPLETED_WITH_ERRORS'
      ELSE 'COMPLETED' END,
    completed_at=CASE WHEN (SELECT COUNT(*) FROM finance_credential_batch_items WHERE batch_id=? AND status IN ('PENDING','PROCESSING'))=0 THEN datetime('now') ELSE NULL END,
    updated_at=datetime('now') WHERE id=?`).bind(batchId,batchId,batchId,batchId,batchId,batchId,batchId).run()
}

export async function processQrCredentialBatch(batchId:string,actorId:string,limit=50) {
  const batch=await financeQueryOne<{id:string;credential_kind:string;status:CredentialBatchStatus;created_by:string}>(
    `SELECT id,credential_kind,status,created_by FROM finance_credential_batches WHERE id=?`,[batchId]
  )
  if(!batch||batch.credential_kind!=='QR_STATIC') return {error:'Batch QR tidak ditemukan.'}
  if(batch.created_by!==actorId) return {error:'Batch ini dibuat oleh petugas lain.'}
  const items=await financeQuery<{santri_id:string}>(`SELECT santri_id FROM finance_credential_batch_items
    WHERE batch_id=? AND status IN ('PENDING','FAILED') ORDER BY position LIMIT ?`,[batchId,Math.max(1,Math.min(50,limit))])
  const db=await getFinanceDB()
  for(const item of items){
    await db.prepare(`UPDATE finance_credential_batch_items SET status='PROCESSING',error_message=NULL WHERE batch_id=? AND santri_id=?`).bind(batchId,item.santri_id).run()
    const existing=await financeQueryOne<{id:string}>(`SELECT id FROM student_credentials WHERE santri_id=? AND credential_kind='QR_STATIC'
      AND status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED') LIMIT 1`,[item.santri_id])
    if(existing){
      await db.prepare(`UPDATE finance_credential_batch_items SET status='SKIPPED',credential_id=?,processed_at=datetime('now') WHERE batch_id=? AND santri_id=?`).bind(existing.id,batchId,item.santri_id).run()
      continue
    }
    const result=await issueCredential({santriId:item.santri_id,kind:'QR_STATIC',actorId})
    if(result.success){
      await db.prepare(`UPDATE finance_credential_batch_items SET status='SUCCESS',credential_id=?,processed_at=datetime('now') WHERE batch_id=? AND santri_id=?`).bind(result.credentialId,batchId,item.santri_id).run()
    }else{
      await db.prepare(`UPDATE finance_credential_batch_items SET status='FAILED',error_message=?,processed_at=datetime('now') WHERE batch_id=? AND santri_id=?`).bind(result.error,batchId,item.santri_id).run()
    }
  }
  await refreshBatchCounters(batchId)
  return {success:true as const,batch:await getCredentialBatch(batchId)}
}

export async function getCredentialBatch(batchId:string) {
  const batch=await financeQueryOne<CredentialBatchRow>(`SELECT * FROM finance_credential_batches WHERE id=?`,[batchId])
  if(!batch)return null
  const errors=await financeQuery<{santri_id:string;error_message:string|null}>(`SELECT santri_id,error_message FROM finance_credential_batch_items
    WHERE batch_id=? AND status='FAILED' ORDER BY position LIMIT 20`,[batchId])
  return {...batch,errors}
}

export async function getLatestCredentialBatch(actorId:string) {
  const row=await financeQueryOne<{id:string}>(`SELECT id FROM finance_credential_batches WHERE created_by=? AND credential_kind='QR_STATIC'
    AND status IN ('PENDING','PROCESSING','COMPLETED_WITH_ERRORS') ORDER BY created_at DESC LIMIT 1`,[actorId])
  return row?getCredentialBatch(row.id):null
}
