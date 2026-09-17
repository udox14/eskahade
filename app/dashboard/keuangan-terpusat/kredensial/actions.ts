'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, financeQueryOne, generateId, getFinanceDB, query, queryOne } from '@/lib/db'
import { financeAsramaScope, requireFinanceAccess } from '@/lib/finance/access'
import { andExcludeAsramaSql, excludeAsramaSql } from '@/lib/finance/asrama'
import { issueCredential } from '@/lib/finance/credentials'
import { createCredentialBatch, getCredentialBatch, getLatestCredentialBatch, processQrCredentialBatch } from '@/lib/finance/credential-batches'
import type { CredentialKind } from '@/lib/finance/types'
import { syncFinanceStudentSnapshot, syncFinanceStudentsByIds } from '@/lib/finance/snapshots'

const PATH='/dashboard/keuangan-terpusat/kredensial'

export type CredentialStudentRow={
  id:string;nis:string;nama_lengkap:string;asrama:string|null;kamar:string|null;foto_url:string|null;kelas_pesantren:string|null
  qr_id:string|null;qr_status:string|null;qr_card_number:string|null
}

export async function getCredentialFilters(){
  // Bendahara asrama lolos VIEW, jadi daftar filter pun harus dibatasi scope-nya.
  // Menyembunyikan menu di navigasi bukan otorisasi; server action tetap bisa dipanggil.
  const scope=financeAsramaScope(await requireFinanceAccess('CARDS'))
  const scoped=`${andExcludeAsramaSql('s.asrama')} ${scope?'AND s.asrama=?':''}`
  const args=scope?[scope]:[]
  const [asramas,kamars,kelas]=await Promise.all([
    query<{value:string}>(`SELECT DISTINCT s.asrama value FROM santri s WHERE s.status_global='aktif' AND s.asrama IS NOT NULL AND trim(s.asrama)<>'' ${scoped} ORDER BY s.asrama`,args),
    query<{value:string}>(`SELECT DISTINCT s.kamar value FROM santri s WHERE s.status_global='aktif' AND s.kamar IS NOT NULL AND trim(s.kamar)<>'' ${scoped} ORDER BY s.kamar`,args),
    query<{value:string}>(`SELECT DISTINCT k.nama_kelas value FROM santri s JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif' JOIN kelas k ON k.id=rp.kelas_id WHERE s.status_global='aktif' ${scoped} ORDER BY k.nama_kelas`,args),
  ])
  return {asramas:asramas.map(x=>x.value),kamars:kamars.map(x=>x.value),kelas:kelas.map(x=>x.value),scope}
}

export async function searchCredentialStudents(input:{q?:string;asrama?:string;kamar?:string;kelas?:string;status?:string;page?:number;pageSize?:number}){
  const scope=financeAsramaScope(await requireFinanceAccess('CARDS'))
  const params:unknown[]=[],where=[`s.status_global='aktif'`,excludeAsramaSql('s.asrama')]
  if(scope){where.push(`s.asrama=?`);params.push(scope)}
  const q=String(input.q||'').trim()
  if(q){where.push(`(s.nama_lengkap LIKE ? OR s.nis LIKE ?)`);params.push(`%${q}%`,`%${q}%`)}
  if(input.asrama){where.push(`s.asrama=?`);params.push(input.asrama)}
  if(input.kamar){where.push(`s.kamar=?`);params.push(input.kamar)}
  if(input.kelas){where.push(`k.nama_kelas=?`);params.push(input.kelas)}
  const students=await query<Omit<CredentialStudentRow,'qr_id'|'qr_status'|'qr_card_number'>>(`SELECT s.id,s.nis,s.nama_lengkap,s.asrama,s.kamar,s.foto_url,k.nama_kelas kelas_pesantren
    FROM santri s LEFT JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif'
    LEFT JOIN kelas k ON k.id=rp.kelas_id WHERE ${where.join(' AND ')} ORDER BY s.nama_lengkap LIMIT 5000`,params)
  const credentials:any[]=[]
  for(let offset=0;offset<students.length;offset+=80){
    const ids=students.slice(offset,offset+80).map(s=>s.id)
    if(ids.length)credentials.push(...await financeQuery<any>(`SELECT id,santri_id,credential_kind,status,card_number FROM student_credentials WHERE santri_id IN (${ids.map(()=>'?').join(',')}) AND status IN ('ACTIVE','BLOCKED')`,ids))
  }
  const byStudent=new Map<string,any[]>()
  for(const credential of credentials)byStudent.set(credential.santri_id,[...(byStudent.get(credential.santri_id)||[]),credential])
  let rows:CredentialStudentRow[]=students.map(student=>{
    const creds=byStudent.get(student.id)||[],qr=creds.find(c=>c.credential_kind==='QR_STATIC')
    return {...student,qr_id:qr?.id||null,qr_status:qr?.status||null,qr_card_number:qr?.card_number||null}
  })
  const status=String(input.status||'ALL')
  if(status==='MISSING_QR')rows=rows.filter(row=>!row.qr_id)
  if(status==='HAS_QR')rows=rows.filter(row=>Boolean(row.qr_id))
  const pageSize=Math.max(10,Math.min(5000,Number(input.pageSize)||50)),page=Math.max(1,Number(input.page)||1),total=rows.length
  return {rows:rows.slice((page-1)*pageSize,page*pageSize),allSelectable:rows.map(row=>({id:row.id,qr_id:row.qr_id})),total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize))}
}

export async function issueCredentialAction(input:{nis?:string;santriId?:string;kind:CredentialKind;rawToken?:string;reissue?:boolean}){
  const session=await requireFinanceAccess('CARDS')
  const student=input.santriId
    ? await queryOne<{id:string}>(`SELECT id FROM santri WHERE id=? AND status_global='aktif' ${andExcludeAsramaSql('asrama')}`,[input.santriId])
    : await queryOne<{id:string}>(`SELECT id FROM santri WHERE nis=? AND status_global='aktif' ${andExcludeAsramaSql('asrama')}`,[String(input.nis||'').trim()])
  if(!student)return{error:'Santri aktif tidak ditemukan.'}
  await syncFinanceStudentSnapshot(student.id)
  const result=await issueCredential({santriId:student.id,kind:input.kind,rawToken:input.rawToken,actorId:session.id,reissue:Boolean(input.reissue)})
  if(result.success)revalidatePath(PATH)
  return result
}

export async function createQrBatchAction(input:{santriIds:string[];filter?:Record<string,unknown>}){
  const session=await requireFinanceAccess('CARDS')
  const unique=[...new Set(input.santriIds.filter(Boolean))]
  const valid:string[]=[]
  for(let offset=0;offset<unique.length;offset+=80){
    const chunk=unique.slice(offset,offset+80)
    const rows=await query<{id:string}>(`SELECT id FROM santri WHERE status_global='aktif' ${andExcludeAsramaSql('asrama')} AND id IN (${chunk.map(()=>'?').join(',')})`,chunk)
    valid.push(...rows.map(row=>row.id))
  }
  if(valid.length!==unique.length)return{error:'Sebagian santri tidak ditemukan atau sudah nonaktif.'}
  await syncFinanceStudentsByIds(valid)
  const result=await createCredentialBatch({santriIds:valid,kind:'QR_STATIC',actorId:session.id,filter:input.filter})
  if(result.success)revalidatePath(PATH)
  return result
}

export async function processQrBatchAction(batchId:string){const session=await requireFinanceAccess('CARDS');const result=await processQrCredentialBatch(batchId,session.id,50);if(result.success)revalidatePath(PATH);return result}
export async function getCredentialBatchAction(batchId:string){const session=await requireFinanceAccess('CARDS');const batch=await getCredentialBatch(batchId);if(!batch||batch.created_by!==session.id)return null;return batch}
export async function getLatestCredentialBatchAction(){const session=await requireFinanceAccess('CARDS');return getLatestCredentialBatch(session.id)}


export async function markCredentialAction(id:string,status:'ACTIVE'|'LOST'|'REVOKED'|'BLOCKED',reason:string){
 const session=await requireFinanceAccess('CARDS'),db=await getFinanceDB()
 if(!['ACTIVE','LOST','REVOKED','BLOCKED'].includes(status)||reason.trim().length<5)return {error:'Alasan minimal 5 karakter.'}
 const current=await financeQueryOne<{status:string}>('SELECT status FROM student_credentials WHERE id=?',[id])
 if(!current||!['ACTIVE','BLOCKED'].includes(current.status)||(status==='ACTIVE'&&current.status!=='BLOCKED'))return {error:'Status kartu tidak dapat diubah.'}
 await db.batch([db.prepare("UPDATE student_credentials SET status=?,blocked_reason=? WHERE id=? AND status=?").bind(status,reason,id,current.status),db.prepare("INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,before_json,after_json) VALUES(?,'STAFF',?,'CARD_STATUS','STUDENT_CREDENTIAL',?,?,?)").bind(generateId(),session.id,id,JSON.stringify(current),JSON.stringify({status,reason}))])
 revalidatePath(PATH);return {success:true as const}
}

export async function getCredentialData(){
  const scope=financeAsramaScope(await requireFinanceAccess('CARDS'))
  return{
    scope,
    policy:await financeQueryOne<any>(`SELECT * FROM finance_credential_policy WHERE singleton_id=1`),
    credentials:await financeQuery<any>(`SELECT c.id,c.santri_id,c.credential_kind,c.token_version,c.card_number,c.status,c.issued_at,c.expires_at,c.print_count,c.last_printed_at,s.nis,s.full_name nama_lengkap
      FROM student_credentials c JOIN finance_student_snapshots s ON s.santri_id=c.santri_id
      WHERE 1=1 ${andExcludeAsramaSql('s.asrama')} ${scope?'AND s.asrama=?':''} ORDER BY c.issued_at DESC LIMIT 100`,scope?[scope]:[]),
  }
}
