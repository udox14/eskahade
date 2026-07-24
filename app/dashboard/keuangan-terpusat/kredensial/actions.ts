'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, financeQueryOne, generateId, getFinanceDB, query, queryOne } from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'
import { issueCredential, setCredentialMode } from '@/lib/finance/credentials'
import { createCredentialBatch, getCredentialBatch, getLatestCredentialBatch, processQrCredentialBatch } from '@/lib/finance/credential-batches'
import type { CredentialKind, CredentialMode } from '@/lib/finance/types'
import { syncFinanceStudentSnapshot, syncFinanceStudentsByIds } from '@/lib/finance/snapshots'

const PATH='/dashboard/keuangan-terpusat/kredensial'

export type CredentialStudentRow={
  id:string;nis:string;nama_lengkap:string;asrama:string|null;kamar:string|null;foto_url:string|null;kelas_pesantren:string|null
  rfid_id:string|null;rfid_status:string|null;qr_id:string|null;qr_status:string|null;qr_card_number:string|null
}

export async function getCredentialFilters(){
  await requireFinanceAccess('VIEW')
  const [asramas,kamars,kelas]=await Promise.all([
    query<{value:string}>(`SELECT DISTINCT asrama value FROM santri WHERE status_global='aktif' AND asrama IS NOT NULL AND trim(asrama)<>'' ORDER BY asrama`),
    query<{value:string}>(`SELECT DISTINCT kamar value FROM santri WHERE status_global='aktif' AND kamar IS NOT NULL AND trim(kamar)<>'' ORDER BY kamar`),
    query<{value:string}>(`SELECT DISTINCT k.nama_kelas value FROM santri s JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif' JOIN kelas k ON k.id=rp.kelas_id WHERE s.status_global='aktif' ORDER BY k.nama_kelas`),
  ])
  return {asramas:asramas.map(x=>x.value),kamars:kamars.map(x=>x.value),kelas:kelas.map(x=>x.value)}
}

export async function searchCredentialStudents(input:{q?:string;asrama?:string;kamar?:string;kelas?:string;status?:string;page?:number;pageSize?:number}){
  await requireFinanceAccess('VIEW')
  const params:unknown[]=[],where=[`s.status_global='aktif'`]
  const q=String(input.q||'').trim()
  if(q){where.push(`(s.nama_lengkap LIKE ? OR s.nis LIKE ?)`);params.push(`%${q}%`,`%${q}%`)}
  if(input.asrama){where.push(`s.asrama=?`);params.push(input.asrama)}
  if(input.kamar){where.push(`s.kamar=?`);params.push(input.kamar)}
  if(input.kelas){where.push(`k.nama_kelas=?`);params.push(input.kelas)}
  const students=await query<Omit<CredentialStudentRow,'rfid_id'|'rfid_status'|'qr_id'|'qr_status'|'qr_card_number'>>(`SELECT s.id,s.nis,s.nama_lengkap,s.asrama,s.kamar,s.foto_url,k.nama_kelas kelas_pesantren
    FROM santri s LEFT JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif'
    LEFT JOIN kelas k ON k.id=rp.kelas_id WHERE ${where.join(' AND ')} ORDER BY s.nama_lengkap LIMIT 5000`,params)
  const credentials:any[]=[]
  for(let offset=0;offset<students.length;offset+=80){
    const ids=students.slice(offset,offset+80).map(s=>s.id)
    if(ids.length)credentials.push(...await financeQuery<any>(`SELECT id,santri_id,credential_kind,status,card_number FROM student_credentials WHERE santri_id IN (${ids.map(()=>'?').join(',')}) AND status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED')`,ids))
  }
  const byStudent=new Map<string,any[]>()
  for(const credential of credentials)byStudent.set(credential.santri_id,[...(byStudent.get(credential.santri_id)||[]),credential])
  let rows:CredentialStudentRow[]=students.map(student=>{
    const creds=byStudent.get(student.id)||[],rfid=creds.find(c=>c.credential_kind==='RFID_UID'),qr=creds.find(c=>c.credential_kind==='QR_STATIC')
    return {...student,rfid_id:rfid?.id||null,rfid_status:rfid?.status||null,qr_id:qr?.id||null,qr_status:qr?.status||null,qr_card_number:qr?.card_number||null}
  })
  const status=String(input.status||'ALL')
  if(status==='MISSING_QR')rows=rows.filter(row=>!row.qr_id)
  if(status==='MISSING_RFID')rows=rows.filter(row=>!row.rfid_id)
  if(status==='HAS_QR')rows=rows.filter(row=>Boolean(row.qr_id))
  if(status==='HAS_RFID')rows=rows.filter(row=>Boolean(row.rfid_id))
  const pageSize=Math.max(10,Math.min(5000,Number(input.pageSize)||50)),page=Math.max(1,Number(input.page)||1),total=rows.length
  return {rows:rows.slice((page-1)*pageSize,page*pageSize),allSelectable:rows.map(row=>({id:row.id,qr_id:row.qr_id,rfid_id:row.rfid_id})),total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize))}
}

export async function getRfidEnrollmentQueueAction(santriIds:string[]){
  await requireFinanceAccess('CONFIGURE')
  const unique=[...new Set(santriIds.filter(Boolean))].slice(0,5000)
  if(!unique.length)return []
  const students:CredentialStudentRow[]=[]
  for(let offset=0;offset<unique.length;offset+=80){
    const chunk=unique.slice(offset,offset+80)
    const found=await query<Omit<CredentialStudentRow,'rfid_id'|'rfid_status'|'qr_id'|'qr_status'|'qr_card_number'>>(`SELECT s.id,s.nis,s.nama_lengkap,s.asrama,s.kamar,s.foto_url,k.nama_kelas kelas_pesantren
      FROM santri s LEFT JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif'
      LEFT JOIN kelas k ON k.id=rp.kelas_id WHERE s.status_global='aktif' AND s.id IN (${chunk.map(()=>'?').join(',')})`,chunk)
    students.push(...found.map(student=>({...student,rfid_id:null,rfid_status:null,qr_id:null,qr_status:null,qr_card_number:null})))
  }
  const existing=new Set<string>()
  for(let offset=0;offset<unique.length;offset+=80){
    const chunk=unique.slice(offset,offset+80)
    const credentials=await financeQuery<{santri_id:string}>(`SELECT santri_id FROM student_credentials WHERE credential_kind='RFID_UID'
      AND status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED') AND santri_id IN (${chunk.map(()=>'?').join(',')})`,chunk)
    credentials.forEach(row=>existing.add(row.santri_id))
  }
  const byId=new Map(students.map(student=>[student.id,student]))
  return unique.map(id=>byId.get(id)).filter((student):student is CredentialStudentRow=>Boolean(student&&!existing.has(student.id)))
}

export async function issueCredentialAction(input:{nis?:string;santriId?:string;kind:CredentialKind;rawToken?:string;reissue?:boolean}){
  const session=await requireFinanceAccess('CONFIGURE')
  const student=input.santriId
    ? await queryOne<{id:string}>(`SELECT id FROM santri WHERE id=? AND status_global='aktif'`,[input.santriId])
    : await queryOne<{id:string}>(`SELECT id FROM santri WHERE nis=? AND status_global='aktif'`,[String(input.nis||'').trim()])
  if(!student)return{error:'Santri aktif tidak ditemukan.'}
  await syncFinanceStudentSnapshot(student.id)
  const result=await issueCredential({santriId:student.id,kind:input.kind,rawToken:input.rawToken,actorId:session.id,reissue:Boolean(input.reissue)})
  if(result.success)revalidatePath(PATH)
  return result
}

export async function createQrBatchAction(input:{santriIds:string[];filter?:Record<string,unknown>}){
  const session=await requireFinanceAccess('CONFIGURE')
  const unique=[...new Set(input.santriIds.filter(Boolean))]
  const valid:string[]=[]
  for(let offset=0;offset<unique.length;offset+=80){
    const chunk=unique.slice(offset,offset+80)
    const rows=await query<{id:string}>(`SELECT id FROM santri WHERE status_global='aktif' AND id IN (${chunk.map(()=>'?').join(',')})`,chunk)
    valid.push(...rows.map(row=>row.id))
  }
  if(valid.length!==unique.length)return{error:'Sebagian santri tidak ditemukan atau sudah nonaktif.'}
  await syncFinanceStudentsByIds(valid)
  const result=await createCredentialBatch({santriIds:valid,kind:'QR_STATIC',actorId:session.id,filter:input.filter})
  if(result.success)revalidatePath(PATH)
  return result
}

export async function processQrBatchAction(batchId:string){const session=await requireFinanceAccess('CONFIGURE');const result=await processQrCredentialBatch(batchId,session.id,50);if(result.success)revalidatePath(PATH);return result}
export async function getCredentialBatchAction(batchId:string){const session=await requireFinanceAccess('CONFIGURE');const batch=await getCredentialBatch(batchId);if(!batch||batch.created_by!==session.id)return null;return batch}
export async function getLatestCredentialBatchAction(){const session=await requireFinanceAccess('CONFIGURE');return getLatestCredentialBatch(session.id)}

export async function setCredentialModeAction(input:{mode:CredentialMode;transitionFrom?:'RFID'|'QR'|null;transitionTo?:'RFID'|'QR'|null;transitionEndsAt?:string|null}){
  const session=await requireFinanceAccess('CONFIGURE');const result=await setCredentialMode({...input,actorId:session.id});if(result.success)revalidatePath(PATH);return result
}

export async function markCredentialAction(id:string,status:'LOST'|'REVOKED'|'BLOCKED'){
  const session=await requireFinanceAccess('CONFIGURE'),db=await getFinanceDB()
  const result=await db.prepare(`UPDATE student_credentials SET status=?,blocked_reason=? WHERE id=? AND status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED')`).bind(status,status,id).run()
  if(!result.meta?.changes)return{error:'Credential tidak dapat diubah.'}
  await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'MARK_CREDENTIAL','STUDENT_CREDENTIAL',?,?)`).bind(generateId(),session.id,id,JSON.stringify({status})).run()
  revalidatePath(PATH);return{success:true as const}
}

export async function getCredentialData(){
  await requireFinanceAccess('VIEW')
  return{policy:await financeQueryOne<any>(`SELECT * FROM finance_credential_policy WHERE singleton_id=1`),credentials:await financeQuery<any>(`SELECT c.id,c.santri_id,c.credential_kind,c.token_version,c.card_number,c.status,c.issued_at,c.expires_at,c.print_count,c.last_printed_at,s.nis,s.full_name nama_lengkap FROM student_credentials c JOIN finance_student_snapshots s ON s.santri_id=c.santri_id ORDER BY c.issued_at DESC LIMIT 100`)}
}
