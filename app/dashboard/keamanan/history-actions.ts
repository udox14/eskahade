'use server'
import { query, queryOne, batch, now } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { getEffectiveRoles } from '@/lib/auth/session'
import { validEvidence, descriptionEvidence, type SessionEvidence } from '@/lib/discipline/evidence'
import { sessionKey, sessionStatement, sessionLinkStatement } from '@/lib/discipline/data'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'

async function access(action:'read'|'update'='read') {
 const session=await assertFeature('/dashboard/keamanan',action)
 if('error' in session)throw new Error(session.error)
 if(!getEffectiveRoles(session).some(r=>['admin','keamanan','sekpen','demo'].includes(r)))throw new Error('Verifikasi histori hanya untuk admin, keamanan, atau sekpen.')
 return session
}
type ReviewRow={id:string;santri_id:string;nama_lengkap:string;jenis:string;deskripsi:string;version:number}
export async function getHistoryReviews(page=1) {
 try {await access()}catch{return {rows:[],total:0,denied:true,error:undefined}}
 try {
  if(!Number.isSafeInteger(page)||page<1)throw new Error('Halaman tidak valid.')
  const [rows,count]=await Promise.all([
   query<ReviewRow>("SELECT p.id,p.santri_id,p.jenis,p.deskripsi,p.version,s.nama_lengkap FROM pelanggaran p JOIN santri s ON s.id=p.santri_id WHERE p.review_state='pending' AND p.status='active' ORDER BY p.created_at,p.id LIMIT 30 OFFSET ?",[(page-1)*30]),
   queryOne<{n:number}>("SELECT COUNT(*) n FROM pelanggaran WHERE review_state='pending' AND status='active'")
  ])
  return {rows:rows.map(r=>({...r,suggestions:descriptionEvidence(r.deskripsi,r.jenis==='ALFA_PENGAJIAN'?'pengajian':'berjamaah')})),total:count?.n??0}
 }catch(error){console.error('[discipline-history]',error);return {rows:[],total:0,denied:false,error:'Daftar verifikasi gagal dimuat. Periksa migrasi database atau coba kembali.'}}
}
export async function verifyHistory(id:string,version:number,items:SessionEvidence[],reason:string) {
 try {
  const actor=await access('update')
  if(typeof reason!=='string'||reason.trim().length<5||reason.length>500)throw new Error('Isi alasan verifikasi minimal 5 karakter.')
  const p=await queryOne<ReviewRow>("SELECT id,santri_id,jenis,deskripsi,version FROM pelanggaran WHERE id=? AND status='active' AND review_state='pending'",[id])
  if(!p||p.version!==version)throw new Error('Catatan telah berubah. Muat ulang daftar.')
  const source=p.jenis==='ALFA_PENGAJIAN'?'pengajian':'berjamaah'
  validEvidence(items,source)
  const statementList=[{sql:"SELECT json(CASE WHEN EXISTS(SELECT 1 FROM pelanggaran WHERE id=? AND version=? AND review_state='pending' AND status='active') THEN 'true' ELSE 'stale_history' END)",params:[id,version]}]
  // Do not reactivate a session whose authoritative verdict was corrected.
  for(const item of items) {
   const key=sessionKey(source,p.santri_id,item.tanggal,item.sesi)
   statementList.push({sql:"SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM verifikasi_panggilan_vonis WHERE santri_id=? AND source=? AND tanggal=? AND sesi=? AND status_final NOT IN ('ALFA','MANGKIR')) THEN 'true' ELSE 'contradictory_verdict' END)",params:[p.santri_id,source,item.tanggal,item.sesi]})
   statementList.push(sessionStatement({parentId:id,santriId:p.santri_id,source,tanggal:item.tanggal,sesi:item.sesi,ref:'review:'+key,actor:actor.id,reason:reason.trim()}))
   statementList.push(sessionLinkStatement(id,source,p.santri_id,item.tanggal,item.sesi))
  }
  // Previous incomplete evidence must not survive a manual replacement.
  const keys=items.map(i=>sessionKey(source,p.santri_id,i.tanggal,i.sesi))
  statementList.push({sql:`UPDATE pelanggaran_sessions SET status='cancelled',updated_by=?,updated_at=?,reason=?,version=version+1 WHERE pelanggaran_id=? AND status='active' AND id NOT IN (SELECT value FROM json_each(?))`,params:[actor.id,now(),reason.trim(),id,JSON.stringify(keys)]})
  statementList.push({sql:"UPDATE pelanggaran SET review_state='resolved',updated_by=?,updated_at=?,reason=?,version=version+1 WHERE id=? AND version=?",params:[actor.id,now(),reason.trim(),id,version]})
  await batch(statementList);revalidateDiscipline(p.santri_id)
  return {success:true}
 } catch(error) {return {error:error instanceof Error&&/malformed JSON/.test(error.message)?'Bukti bertentangan atau data berubah. Koreksi melalui modul vonis terlebih dahulu.':error instanceof Error?error.message:'Verifikasi gagal.'}}
}
