import { query, queryOne, batch, generateId, now } from '@/lib/db'

export type DisciplineIncident = {
 id: string; source_id: string; source: 'umum' | 'pengajian'; santri_id: string
 tanggal: string | null; created_at: string; jenis: string; deskripsi: string
 sesi: string | null; jumlah_kejadian: number; perlu_verifikasi: number
 status: 'active' | 'cancelled'; foto_url: string | null; penindak_nama?: string
 nama_pelanggaran?: string
}
export const ACTIVE_INCIDENTS = "discipline_incidents"
export async function getStudentIncidents(santriId: string) {
 return query<DisciplineIncident>(`SELECT p.*,u.full_name penindak_nama,COALESCE(mp.nama_pelanggaran,p.jenis) nama_pelanggaran
 FROM discipline_incidents p LEFT JOIN users u ON u.id=p.penindak_id LEFT JOIN master_pelanggaran mp ON mp.id=p.master_id
 WHERE p.santri_id=? AND p.status='active' ORDER BY COALESCE(p.tanggal,p.created_at) DESC,p.id`,[santriId])
}
export async function getIncidentTotals(santriId: string) {
 const row=await queryOne<{jumlah:number;pending:number}>(`SELECT COALESCE(SUM(jumlah_kejadian),0) jumlah,COALESCE(SUM(perlu_verifikasi),0) pending FROM discipline_incidents WHERE santri_id=? AND status='active'`,[santriId])
 return row??{jumlah:0,pending:0}
}
export function sessionKey(source: string,santriId: string,tanggal: string,sesi: string) {
 return `alfa:${source}:${santriId}:${tanggal}:${sesi}`
}
export function sessionStatement(input: {parentId:string;santriId:string;source:'pengajian'|'berjamaah';tanggal:string;sesi:string;ref:string;actor:string;status?:'active'|'cancelled';reason:string}) {
 return {sql:`INSERT INTO pelanggaran_sessions(id,pelanggaran_id,santri_id,source,tanggal,sesi,source_ref,status,updated_by,updated_at,reason)
 VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(santri_id,source,tanggal,sesi) DO UPDATE SET status=excluded.status,updated_by=excluded.updated_by,updated_at=excluded.updated_at,reason=excluded.reason,version=pelanggaran_sessions.version+1
 WHERE pelanggaran_sessions.status<>excluded.status`,params:[sessionKey(input.source,input.santriId,input.tanggal,input.sesi),input.parentId,input.santriId,input.source,input.tanggal,input.sesi,input.ref,input.status??'active',input.actor,now(),input.reason]}
}

// Old letters contain raw legacy IDs. New letters contain namespaced view IDs.
export async function resolveLetterIncidents(santriId:string,ids:string[],activeOnly=true) {
 if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>typeof id!=='string'||id.length>200000)||new Set(ids).size!==ids.length) throw new Error('Pilih catatan pelanggaran yang valid.')
 const collected=new Map<string,DisciplineIncident>()
 const links:{pelanggaran_id:string;session_id:string}[]=[]
 // At most 91 bound parameters per statement, including historical aliases.
 for(let offset=0;offset<ids.length;offset+=30) {
  const chunk=ids.slice(offset,offset+30),marks=chunk.map(()=>'?').join(',')
  const rows=await query<DisciplineIncident>(`SELECT * FROM discipline_incidents WHERE santri_id=? ${activeOnly?"AND status='active' AND perlu_verifikasi=0":''} AND (id IN (${marks}) OR (source='umum' AND source_id IN (${marks})) OR id IN (SELECT 'sesi:'||session_id FROM pelanggaran_session_links WHERE pelanggaran_id IN (${marks})))`,[santriId,...chunk,...chunk,...chunk])
  rows.forEach(row=>collected.set(row.id,row))
  links.push(...await query<{pelanggaran_id:string;session_id:string}>(`SELECT pelanggaran_id,session_id FROM pelanggaran_session_links WHERE pelanggaran_id IN (${marks})`,chunk))
 }
 const rows=[...collected.values()].sort((a,b)=>(a.tanggal??'').localeCompare(b.tanggal??'')||a.id.localeCompare(b.id))
 if(activeOnly&&ids.some(id=>!rows.some(r=>r.id===id||(r.source==='umum'&&r.source_id===id)||links.some(l=>l.pelanggaran_id===id&&r.id==='sesi:'+l.session_id)))) throw new Error('Catatan tidak aktif, belum terverifikasi, atau bukan milik santri ini.')
 return rows
}
export async function saveIncidentLetter(santriId:string,ids:string[],tanggal:string,actor:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)||new Date(tanggal+'T00:00:00Z').toISOString().slice(0,10)!==tanggal) throw new Error('Tanggal surat tidak valid.')
 const rows=await resolveLetterIncidents(santriId,ids)
 const id=generateId()
 // Recheck the exact snapshot within the write transaction to reject cancellations
 // and concurrent edits between selection and save.
 const statements=rows.map(row=>({sql:`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM discipline_incidents WHERE id=? AND santri_id=? AND status='active' AND perlu_verifikasi=0 AND tanggal IS ? AND jenis=? AND deskripsi=?) THEN 'true' ELSE 'stale_incident' END)`,params:[row.id,santriId,row.tanggal,row.jenis,row.deskripsi]}))
 await batch([...statements,{sql:'INSERT INTO surat_pernyataan(id,santri_id,pelanggaran_ids,tanggal,dibuat_oleh,created_at,incident_snapshot) VALUES(?,?,?,?,?,?,?)',params:[id,santriId,JSON.stringify(ids),tanggal,actor,now(),JSON.stringify(rows)]}])
 return id
}

export function sessionLinkStatement(parentId:string,source:string,santriId:string,tanggal:string,sesi:string) {
 return {sql:'INSERT OR IGNORE INTO pelanggaran_session_links(pelanggaran_id,session_id) VALUES(?,?)',params:[parentId,sessionKey(source,santriId,tanggal,sesi)]}
}
