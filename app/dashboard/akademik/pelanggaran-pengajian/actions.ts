'use server'

import { revalidatePath } from 'next/cache'
import { batch, getDB, query, queryOne, now } from '@/lib/db'
import { assertFeature, canFeatureForSession } from '@/lib/auth/feature'
import { getEffectiveRoles, type SessionUser } from '@/lib/auth/session'
import { getOwnKelasIds } from '@/lib/akademik/guru-access'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { parseWibDateTime, toWibDateTimeLocalValue } from '@/lib/date/wib'
import { ACTIVE_EDUCATION, BASE_FROM, countHaving, orderBy, studentScope, whereClause } from '@/lib/pengajian-violations/query'
import { HREF, PAGE_SIZE, type Analytics, type Bucket, type Capabilities, type Filters, type Incident, type Options, type Page, type Recap, type Result, type Santri, type SaveInput, type ViolationType } from '@/lib/pengajian-violations/types'

class InputError extends Error {}
async function result<T>(fn: () => Promise<T>): Promise<Result<T>> {
 try { return { data: await fn() } } catch (error) {
  if (error instanceof InputError) return { error: error.message }
  console.error('[pelanggaran-pengajian]',error)
  return { error: 'Data tidak dapat diproses. Silakan coba lagi atau hubungi admin.' }
 }
}
function manager(session: SessionUser) { return getEffectiveRoles(session).some(r=>['admin','sekpen','demo'].includes(r)) }
async function access(action: 'read' | 'create' | 'update' | 'delete' = 'read') {
 const session = await assertFeature(HREF,action)
 if ('error' in session) throw new InputError(session.error)
 const roles = getEffectiveRoles(session)
 if (!roles.some(r=>['admin','sekpen','keamanan','guru','wali_kelas','demo','tester'].includes(r))) throw new InputError('Akses ditolak.')
 const unrestricted = roles.some(r=>['admin','sekpen','keamanan','demo'].includes(r))
 const classes = unrestricted ? null : await getOwnKelasIds(session,{activeOnly:true})
 // Unlike the generic helper, another unrelated role never widens teacher scope.
 return { session, classes: unrestricted ? null : classes ?? [] }
}
function filters(f: Filters) {
 try { whereClause(f,null) } catch(error) { throw new InputError(error instanceof Error ? error.message : 'Filter tidak valid.') }
 return f
}
function pageNumber(page: number) { if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new InputError('Halaman tidak valid.'); return page }
async function activity(session: SessionUser, action: string, id: string) {
 await logActivity({ actor:actorFromSession(session),module:'pelanggaran_pengajian',action,fiturHref:HREF,logKind:action==='create'?'create':'update',entityType:'pengajian_violation',entityId:id,summary:`${action==='create'?'Mencatat':action==='cancel'?'Membatalkan':'Memperbarui'} pelanggaran pengajian`,details:{id} })
 revalidatePath(HREF)
}
export async function getCapabilities(): Promise<Result<Capabilities>> {
 return result(async()=>{
  const {session}=await access()
  const [create,update,cancel]=await Promise.all(['create','update','delete'].map(action=>canFeatureForSession(session,HREF,action as 'create'|'update'|'delete')))
  return {userId:session.id,manage:manager(session),create,update,cancel}
 })
}
export async function searchSantri(search: string): Promise<Result<Santri[]>> {
 return result(async()=>{
  const {classes}=await access(); filters({search})
  if (search.trim().length<2) return []
  const scope=studentScope(classes)
  return query<Santri>(`SELECT s.id,s.nis,s.nama_lengkap,s.asrama,s.kamar,s.jenis_kelamin,s.status_global FROM santri s WHERE ${scope.sql} AND lower(trim(s.status_global))='aktif' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?) ORDER BY s.nama_lengkap,s.id LIMIT 20`,[...scope.params,`%${search.trim()}%`,`%${search.trim()}%`])
 })
}
export async function getOptions(): Promise<Result<Options>> {
 return result(async()=>{
  const {classes}=await access(); const scope=studentScope(classes)
  const [asramas,kamars,classRows,actors,types]=await Promise.all([
   query<{value:string}>(`SELECT DISTINCT s.asrama value FROM santri s WHERE ${scope.sql} AND s.asrama IS NOT NULL ORDER BY value`,scope.params),
   query<{value:string}>(`SELECT DISTINCT s.kamar value FROM santri s WHERE ${scope.sql} AND s.kamar IS NOT NULL ORDER BY value`,scope.params),
   query<{id:string;name:string}>(`SELECT k.id,k.nama_kelas name FROM kelas k JOIN tahun_ajaran ta ON ta.id=k.tahun_ajaran_id AND ta.is_active=1 ${classes===null?'':`WHERE k.id IN (${classes.length?classes.map(()=>'?').join(','):"''"})`} ORDER BY k.nama_kelas,k.id`,classes??[]),
   query<{id:string;name:string}>(`SELECT DISTINCT u.id,u.full_name name ${BASE_FROM} WHERE ${scope.sql} ORDER BY name`,scope.params),
   query<ViolationType>('SELECT id,name,description,position,active,version FROM pengajian_violation_types ORDER BY position,name,id'),
  ])
  return {asramas:asramas.map(r=>r.value),kamars:kamars.map(r=>r.value),classes:classRows,actors,types}
 })
}
async function history(f: Filters, classes: string[]|null, page: number, santriId?: string): Promise<Page<Incident>> {
 const w=whereClause(filters(f),classes,santriId); pageNumber(page)
 const [count,rows]=await Promise.all([
  queryOne<{n:number}>(`SELECT COUNT(*) n ${BASE_FROM} WHERE ${w.sql}`,w.params),
  query<Incident>(`SELECT v.*,s.nama_lengkap,s.nis,s.asrama,s.kamar,u.full_name actor_name ${BASE_FROM} WHERE ${w.sql} ORDER BY ${orderBy(f)} LIMIT ? OFFSET ?`,[...w.params,PAGE_SIZE,(page-1)*PAGE_SIZE]),
 ])
 return {rows,total:count?.n??0,page}
}
export async function getHistory(f: Filters={},page=1): Promise<Result<Page<Incident>>> {
 return result(async()=>{const {classes}=await access(); return history(f,classes,page)})
}
const RECAP_COLUMNS='s.id santri_id,s.nama_lengkap,s.nis,s.asrama,s.kamar,COUNT(*) count,COUNT(DISTINCT v.type_id) type_count,MAX(v.occurred_at) last'
export async function getRecap(f: Filters={},page=1): Promise<Result<Page<Recap>>> {
 return result(async()=>{
  const {classes}=await access(); const w=whereClause(filters(f),classes,undefined,true); const h=countHaving(f); pageNumber(page)
  const grouped=`${BASE_FROM} WHERE ${w.sql} GROUP BY s.id ${h.sql}`
  const [count,rows]=await Promise.all([
   queryOne<{n:number}>(`SELECT COUNT(*) n FROM (SELECT s.id ${grouped})`,[...w.params,...h.params]),
   query<Recap>(`SELECT ${RECAP_COLUMNS} ${grouped} ORDER BY ${orderBy(f,true)} LIMIT ? OFFSET ?`,[...w.params,...h.params,PAGE_SIZE,(page-1)*PAGE_SIZE]),
  ])
  return {rows,total:count?.n??0,page}
 })
}
export async function getStudentDetail(santriId: string,f: Filters={},page=1): Promise<Result<{student:Santri;history:Page<Incident>}>> {
 return result(async()=>{
  const {classes}=await access(); const scope=studentScope(classes)
  const student=await queryOne<Santri>(`SELECT s.id,s.nis,s.nama_lengkap,s.asrama,s.kamar,s.jenis_kelamin,s.status_global FROM santri s WHERE s.id=? AND ${scope.sql}`,[santriId,...scope.params])
  if (!student) throw new InputError('Santri tidak ditemukan atau di luar cakupan akses.')
  return {student,history:await history(f,classes,page,santriId)}
 })
}
export async function getAnalytics(f: Filters={}): Promise<Result<Analytics>> {
 return result(async()=>{
  const {classes}=await access(); const w=whereClause(filters(f),classes,undefined,true)
  const buckets=(expression:string,label=expression)=>query<Bucket>(`SELECT ${expression} key,${label} label,COUNT(*) count ${BASE_FROM} WHERE ${w.sql} GROUP BY ${expression} ORDER BY count DESC,key LIMIT 100`,w.params)
  const [totals,repeated,trend,weekly,types,sessions,dorms,classRows,recurring]=await Promise.all([
   queryOne<{total:number;students:number}>(`SELECT COUNT(*) total,COUNT(DISTINCT s.id) students ${BASE_FROM} WHERE ${w.sql}`,w.params),
   queryOne<{n:number}>(`SELECT COUNT(*) n FROM (SELECT s.id ${BASE_FROM} WHERE ${w.sql} GROUP BY s.id HAVING COUNT(*)>=2)`,w.params),
   query<Bucket>(`SELECT date(v.occurred_at,'+7 hours') key,date(v.occurred_at,'+7 hours') label,COUNT(*) count ${BASE_FROM} WHERE ${w.sql} GROUP BY key ORDER BY key`,w.params),
   query<Bucket>(`SELECT date(v.occurred_at,'+7 hours','weekday 0','-6 days') key,date(v.occurred_at,'+7 hours','weekday 0','-6 days') label,COUNT(*) count ${BASE_FROM} WHERE ${w.sql} GROUP BY key ORDER BY key`,w.params),
   buckets('v.type_id','(SELECT name FROM pengajian_violation_types WHERE id=v.type_id)'),buckets('v.session'),buckets("COALESCE(NULLIF(trim(s.asrama),''),'__unassigned__')","COALESCE(NULLIF(trim(s.asrama),''),'Belum ditempatkan')"),
   query<Bucket>(`SELECT k.id key,k.nama_kelas label,COUNT(DISTINCT v.id) count ${BASE_FROM} JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND ${ACTIVE_EDUCATION} JOIN kelas k ON k.id=rp.kelas_id JOIN tahun_ajaran ta ON ta.id=k.tahun_ajaran_id AND ta.is_active=1 WHERE ${w.sql} ${classes===null?'':`AND k.id IN (${classes.length?classes.map(()=>'?').join(','):"''"})`} GROUP BY k.id ORDER BY count DESC,k.id LIMIT 100`,[...w.params,...classes??[]]),
   query<Recap>(`SELECT ${RECAP_COLUMNS} ${BASE_FROM} WHERE ${w.sql} GROUP BY s.id HAVING COUNT(*)>=2 ORDER BY count DESC,s.id LIMIT 10`,w.params),
  ])
  return {total:totals?.total??0,students:totals?.students??0,repeat:repeated?.n??0,trend,weekly,types,sessions,dorms,classes:classRows,recurring}
 })
}
function clean(value: unknown,max: number,label: string) {
 if (typeof value!=='string' || value.trim().length>max) throw new InputError(`${label} tidak valid atau terlalu panjang.`)
 return value.trim()
}
function requestId(value: string) { if (!/^[a-zA-Z0-9-]{16,80}$/.test(value)) throw new InputError('Identitas permintaan tidak valid.'); return value }
function payload(input: SaveInput) {
 const local=clean(input.occurredAt,16,'Waktu kejadian')
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new InputError('Waktu kejadian tidak valid.')
 const date=parseWibDateTime(local)
 if (!Number.isFinite(date.getTime()) || toWibDateTimeLocalValue(date)!==local) throw new InputError('Waktu kejadian tidak valid.')
 if (!['shubuh','ashar','maghrib'].includes(input.session)) throw new InputError('Pilih sesi pengajian.')
 return {date:date.toISOString(),note:clean(input.note,2000,'Catatan'),reason:clean(input.reason??'',500,'Alasan')}
}
async function existing(id: string,classes: string[]|null) {
 const w=whereClause({status:'all'},classes)
 const row=await queryOne<Incident>(`SELECT v.*,s.nama_lengkap,s.nis,s.asrama,s.kamar,u.full_name actor_name ${BASE_FROM} WHERE v.id=? AND ${w.sql}`,[id,...w.params])
 if (!row) throw new InputError('Catatan tidak ditemukan atau di luar cakupan akses.')
 return row
}
function owns(session: SessionUser,row: Incident) { if (!manager(session) && row.created_by!==session.id) throw new InputError('Anda hanya dapat memperbaiki catatan buatan sendiri.') }
async function replay(request: string,id: string,actorId: string,action: string,expected: Record<string,unknown>,reason: string) {
 const revision=await queryOne<{violation_id:string;actor_id:string;action:string;reason:string;after_json:string}>('SELECT violation_id,actor_id,action,reason,after_json FROM pengajian_violation_revisions WHERE request_id=?',[request])
 if (!revision) return false
 const snapshot=JSON.parse(revision.after_json) as Record<string,unknown>
 if(revision.violation_id!==id||revision.actor_id!==actorId||revision.action!==action||revision.reason!==reason||Object.entries(expected).some(([key,value])=>snapshot[key]!==value)) throw new InputError('Identitas permintaan telah digunakan untuk perubahan lain. Muat ulang formulir.')
 return true
}
export async function saveIncident(input: SaveInput): Promise<Result<{id:string}>> {
 return result(async()=>{
  const editing=input.version!=null; const {session,classes}=await access(editing?'update':'create')
  requestId(input.id); requestId(input.requestId); const p=payload(input); const scope=studentScope(classes)
  const expected={santri_id:input.santriId,type_id:input.typeId,occurred_at:p.date,session:input.session,note:p.note,...editing?{version:(input.version??0)+1}:{}}
  if(await replay(input.requestId,input.id,session.id,editing?'update':'create',expected,editing?p.reason:'')) {
   const row=await existing(input.id,classes);if(editing)owns(session,row)
   return {id:input.id}
  }
  const db=await getDB(); const timestamp=now()
  if (!editing) {
   const replay=await queryOne<Incident>('SELECT * FROM pengajian_violations WHERE id=?',[input.id])
   if (replay) {
    await existing(input.id,classes)
    if (replay.created_by!==session.id || replay.santri_id!==input.santriId || replay.type_id!==input.typeId || replay.occurred_at!==p.date || replay.session!==input.session || replay.note!==p.note) throw new InputError('Identitas permintaan telah digunakan. Muat ulang formulir.')
    return {id:input.id}
   }
   const mutation=await db.prepare(`INSERT INTO pengajian_violations(id,santri_id,type_id,type_name,occurred_at,session,note,created_by,created_at,updated_by,updated_at,request_id)
    SELECT ?,s.id,t.id,t.name,?,?,?,?,?,?,?,? FROM santri s JOIN pengajian_violation_types t ON t.id=? AND t.active=1 WHERE s.id=? AND lower(trim(s.status_global))='aktif' AND ${scope.sql} ON CONFLICT(id) DO NOTHING`).bind(input.id,p.date,input.session,p.note,session.id,timestamp,session.id,timestamp,input.requestId,input.typeId,input.santriId,...scope.params).run()
   if (!mutation.meta.changes) {
    const raced=await existing(input.id,classes).catch(()=>null)
    if (!raced || raced.created_by!==session.id || raced.santri_id!==input.santriId || raced.type_id!==input.typeId || raced.occurred_at!==p.date || raced.note!==p.note || raced.session!==input.session) throw new InputError('Santri tidak aktif/di luar akses atau jenis pelanggaran tidak aktif.')
   }
  } else {
   const row=await existing(input.id,classes); owns(session,row)
   if (!p.reason) throw new InputError('Alasan koreksi wajib diisi.')
   if (!Number.isSafeInteger(input.version) || input.version!<1) throw new InputError('Versi catatan tidak valid.')
   if (input.santriId!==row.santri_id) throw new InputError('Santri pada catatan tidak dapat diganti.')
   const mutation=await db.prepare(`UPDATE pengajian_violations SET type_id=?,type_name=CASE WHEN type_id=? THEN type_name ELSE (SELECT name FROM pengajian_violation_types WHERE id=?) END,occurred_at=?,session=?,note=?,reason=?,updated_by=?,updated_at=?,request_id=?,version=version+1
    WHERE id=? AND version=? AND status='active' AND (type_id=? OR EXISTS(SELECT 1 FROM pengajian_violation_types WHERE id=? AND active=1))
    AND EXISTS(SELECT 1 FROM santri s WHERE s.id=pengajian_violations.santri_id AND ${scope.sql})`).bind(input.typeId,input.typeId,input.typeId,p.date,input.session,p.note,p.reason,session.id,timestamp,input.requestId,input.id,input.version,input.typeId,input.typeId,...scope.params).run()
   if (!mutation.meta.changes && !await replay(input.requestId,input.id,session.id,'update',expected,p.reason)) throw new InputError('Catatan telah berubah/dibatalkan atau jenis tidak aktif. Muat ulang sebelum mengoreksi.')
  }
  await activity(session,editing?'update':'create',input.id)
  return {id:input.id}
 })
}
export async function cancelIncident(id: string,version: number,reason: string,mutationId: string): Promise<Result<{id:string}>> {
 return result(async()=>{
  const {session,classes}=await access('delete'); const row=await existing(id,classes); owns(session,row); requestId(mutationId)
  const why=clean(reason,500,'Alasan pembatalan'); if (!why) throw new InputError('Alasan pembatalan wajib diisi.')
  if(await replay(mutationId,id,session.id,'cancel',{status:'cancelled',version:version+1},why)) return {id}
  if (!Number.isSafeInteger(version) || version<1) throw new InputError('Versi catatan tidak valid.')
  const scope=studentScope(classes); const db=await getDB()
  const mutation=await db.prepare(`UPDATE pengajian_violations SET status='cancelled',reason=?,updated_by=?,updated_at=?,request_id=?,version=version+1 WHERE id=? AND version=? AND status='active' AND EXISTS(SELECT 1 FROM santri s WHERE s.id=pengajian_violations.santri_id AND ${scope.sql})`).bind(why,session.id,now(),mutationId,id,version,...scope.params).run()
  if (!mutation.meta.changes && !await replay(mutationId,id,session.id,'cancel',{status:'cancelled',version:version+1},why)) throw new InputError('Catatan telah berubah. Muat ulang sebelum membatalkan.')
  await activity(session,'cancel',id); return {id}
 })
}
export async function saveType(input: ViolationType): Promise<Result<{id:string}>> {
 return result(async()=>{
  const prior=await access('read'); if (!manager(prior.session)) throw new InputError('Hanya sekpen/admin dapat mengatur jenis.')
  const before=await queryOne<ViolationType>('SELECT * FROM pengajian_violation_types WHERE id=?',[input.id])
  const {session}=await access(before?'update':'create')
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(input.id)) throw new InputError('Identitas jenis tidak valid.')
  const name=clean(input.name,120,'Nama'); const description=clean(input.description,1000,'Deskripsi')
  if (!name || !Number.isSafeInteger(input.position) || input.position<0 || ![0,1].includes(input.active)) throw new InputError('Nama, urutan, atau status tidak valid.')
  const duplicate=await queryOne<{id:string}>('SELECT id FROM pengajian_violation_types WHERE lower(trim(name))=lower(?) AND id<>?',[name,input.id])
  if (duplicate) throw new InputError('Nama jenis sudah digunakan.')
  if (before) {
   const db=await getDB()
   const mutation=await db.prepare('UPDATE pengajian_violation_types SET name=?,description=?,position=?,active=?,version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?').bind(name,description,input.position,input.active,session.id,now(),input.id,input.version).run()
   if (!mutation.meta.changes) throw new InputError('Jenis telah berubah. Muat ulang pengaturan.')
  } else {
   await batch([
    {sql:'INSERT INTO pengajian_violation_types(id,name,description,position,active,updated_by,updated_at) VALUES(?,?,?,?,?,?,?)',params:[input.id,name,description,input.position,input.active,session.id,now()]},
    {sql:"INSERT INTO pengajian_violation_revisions(type_id,actor_id,changed_at,action,reason,after_json) VALUES(?,?,?,'create','Jenis baru',?)",params:[input.id,session.id,now(),JSON.stringify({name,description,position:input.position,active:input.active})]},
   ])
  }
  await activity(session,before?'update':'create',input.id); return {id:input.id}
 })
}
