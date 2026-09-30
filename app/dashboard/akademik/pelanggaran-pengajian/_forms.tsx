'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { toWibDateTimeLocalValue } from '@/lib/date/wib'
import { inferSession, SESSION_LABELS } from '@/lib/pengajian-violations/session'
import type { Filters, Incident, Options, Santri, Tab, ViolationType } from '@/lib/pengajian-violations/types'
import { attachIncidentPhoto, cancelIncident, saveIncident, saveType, searchSantri } from './actions'
import { EvidenceCamera, EvidenceDraft } from './_camera'
import { button, Combobox, control, ErrorMessage, Field, Modal, primary, StudentIdentity } from './_components'

export function FilterModal({value,options,tab,detail=false,onApply,onClose}:{value:Filters;options:Options;tab:Tab;detail?:boolean;onApply:(f:Filters)=>void;onClose:()=>void}) {
 const [draft,setDraft]=useState(value);const [error,setError]=useState('')
 const set=(key:keyof Filters,value:string)=>setDraft(d=>({...d,[key]:value||undefined}))
 const select=(key:keyof Filters,label:string,items:{id:string;name:string}[])=> <Field label={label}><select className={control} value={String(draft[key]??'')} onChange={e=>set(key,e.target.value)}><option value="">Semua</option>{items.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></Field>
 const submit=(e:FormEvent)=>{
  e.preventDefault()
  if(draft.start&&draft.end&&draft.start>draft.end){setError('Tanggal awal harus sebelum tanggal akhir.');return}
  if(draft.min!=null&&draft.max!=null&&draft.min>draft.max){setError('Batas minimum melebihi maksimum.');return}
  onApply(draft)
 }
 const sorts=detail?[{id:'time',name:'Waktu'},{id:'type',name:'Jenis'}]:tab==='rekap'?[{id:'count',name:'Jumlah kejadian'},{id:'name',name:'Nama santri'},{id:'last',name:'Kejadian terakhir'}]:[{id:'time',name:'Waktu'},{id:'name',name:'Nama santri'},{id:'type',name:'Jenis'},{id:'actor',name:'Pencatat'}]
 return <Modal title="Filter & Urutkan" description="Sesuaikan cakupan data dan urutan tampilannya." onClose={onClose} footer={<div className="flex justify-between gap-3"><button type="button" className={button} onClick={()=>{setDraft({status:'active',sort:tab==='rekap'?'count':'time',direction:'desc',search:value.search});setError('')}}>Reset</button><button form="pengajian-filter" className={primary} type="submit">Terapkan Filter</button></div>}><form id="pengajian-filter" className="space-y-6" onSubmit={submit}>
  {error&&<ErrorMessage message={error}/>}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
   <Field label="Dari tanggal"><input type="date" className={control} value={draft.start??''} onChange={e=>set('start',e.target.value)}/></Field><Field label="Sampai tanggal"><input type="date" className={control} value={draft.end??''} onChange={e=>set('end',e.target.value)}/></Field>
   {!detail&&<>{select('asrama','Asrama',[...options.asramas.filter(Boolean).map(id=>({id,name:id})),{id:'__unassigned__',name:'Belum ditempatkan'}])}{select('kamar','Kamar',options.kamars.map(id=>({id,name:id})))}{select('gender','Jenis kelamin',[{id:'L',name:'Putra'},{id:'P',name:'Putri'}])}{select('kelasId','Kelas pengajian',options.classes)}</>}
   {select('typeId','Jenis pelanggaran',options.types.map(t=>({id:t.id,name:t.name+(t.active?'':' (nonaktif)')})))}
   {select('session','Sesi',Object.entries(SESSION_LABELS).map(([id,name])=>({id,name})))}
   {select('actorId','Pencatat',options.actors)}
   {tab==='riwayat'&&<Field label="Status catatan"><select className={control} value={draft.status??'active'} onChange={e=>setDraft(d=>({...d,status:e.target.value as Filters['status']}))}><option value="active">Aktif</option><option value="cancelled">Dibatalkan</option><option value="all">Semua</option></select></Field>}
   {tab==='rekap'&&!detail&&<>{(['min','max'] as const).map(key=><Field label={key==='min'?'Jumlah minimum':'Jumlah maksimum'} key={key}><input className={control} type="number" min={0} step={1} value={draft[key]??''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value===''?undefined:Number(e.target.value)}))}/></Field>)}</>}
   {tab!=='analitik'&&<>{select('sort','Urut berdasarkan',sorts)}<Field label="Arah urutan"><select className={control} value={draft.direction??'desc'} onChange={e=>setDraft(d=>({...d,direction:e.target.value as Filters['direction']}))}><option value="desc">Menurun / terbaru / Z–A</option><option value="asc">Menaik / terlama / A–Z</option></select></Field></>}
  </div>
  {!detail&&<p className="text-xs text-slate-500">Asrama, kamar, dan kelas mengikuti penempatan santri saat ini. Rekap dan analitik menghitung catatan aktif saja.</p>}
 </form></Modal>
}

export function IncidentForm({row,options,onClose,onSaved}:{row?:Incident;options:Options;onClose:()=>void;onSaved:()=>void}) {
 const [student,setStudent]=useState<{id:string;nama_lengkap:string;nis:string;foto_url:string|null;asrama:string|null;kamar:string|null}|null>(row?{id:row.santri_id,nama_lengkap:row.nama_lengkap,nis:row.nis,foto_url:row.foto_url,asrama:row.asrama,kamar:row.kamar}:null)
 const [search,setSearch]=useState(''); const [matches,setMatches]=useState<Santri[]>([]);const [searching,setSearching]=useState(false)
 const [typeId,setTypeId]=useState(row?.type_id??''); const [date,setDate]=useState(toWibDateTimeLocalValue(row?.occurred_at??new Date()))
 const [manualSession,setManualSession]=useState(row?.session??'');const automaticSession=inferSession(date);const sesi=automaticSession||manualSession;const [note,setNote]=useState(row?.note??'');const [reason,setReason]=useState('')
 const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const [photo,setPhoto]=useState<File|null>(null),[cameraOpen,setCameraOpen]=useState(false),[incidentSaved,setIncidentSaved]=useState(false)
 const [ids]=useState(()=>({id:row?.id??crypto.randomUUID(),requestId:crypto.randomUUID()}))
 useEffect(()=>{
  let alive=true
  const timeout=setTimeout(async()=>{
   if(student||search.trim().length<2){if(alive)setMatches([]);return}
   setSearching(true)
   const response=await searchSantri(search).catch(()=>({error:'Pencarian gagal.',data:undefined}))
   if(alive){setSearching(false);if(response.data){setMatches(response.data);setError('')}else{setError(response.error);setMatches([])}}
  },250)
  return ()=>{alive=false;clearTimeout(timeout)}
 },[search,student])
 async function submit(e:FormEvent) {
  e.preventDefault();if(busy)return
  if(!student||!typeId||!sesi){setError('Pilih santri, jenis pelanggaran, dan sesi pengajian.');return}
  setBusy(true);setError('')
  let saved=incidentSaved
  try {
   if(!incidentSaved){
    const response=await saveIncident({...ids,santriId:student.id,typeId,occurredAt:date,session:sesi,note,reason,version:row?.version})
    if(response.error){setError(response.error);return}
    setIncidentSaved(true)
    saved=true
   }
   if(photo){
    const attachment=new FormData();attachment.set('photo',photo)
    const response=await attachIncidentPhoto(ids.id,ids.requestId,attachment)
    if(response.error){setError(`Catatan sudah tersimpan. Foto belum berhasil disimpan: ${response.error}`);return}
   }
   toast.success(row?'Catatan berhasil dikoreksi.':'Pelanggaran berhasil dicatat.');onSaved()
  }catch{setError(saved?'Catatan sudah tersimpan. Unggah foto terputus; coba simpan foto lagi atau lanjut tanpa foto.':'Penyimpanan gagal. Coba lagi dengan formulir yang sama.')}finally{setBusy(false)}
 }
 const types=options.types.filter(t=>t.active||t.id===row?.type_id).map(t=>({id:t.id,name:t.name+(t.active?'':' (nonaktif)')}))
 return <><Modal title={row?'Koreksi Pelanggaran':'Catat Pelanggaran'} description={student?'Lengkapi kejadian pengajian santri.':'Cari dan pilih santri yang akan dicatat.'} busy={busy} onClose={incidentSaved?onSaved:onClose} footer={<div className="flex flex-wrap justify-end gap-3"><button className={button} type="button" disabled={busy} onClick={incidentSaved?onSaved:onClose}>{incidentSaved?'Lanjut Tanpa Foto':'Tutup'}</button>{student&&<button form="pengajian-incident" className={primary} disabled={busy||!types.length} type="submit">{busy?'Menyimpan…':incidentSaved?'Coba Simpan Foto':row?'Simpan Koreksi':'Simpan Pelanggaran'}</button>}</div>}><form id="pengajian-incident" onSubmit={submit} className="space-y-6" aria-busy={busy}>
  {error&&<ErrorMessage message={error}/>}
  {student?<div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5"><StudentIdentity student={student} large placement/>{!row&&<button type="button" disabled={busy||incidentSaved} className={button} onClick={()=>{setStudent(null);setSearch('');setMatches([])}}>Ganti</button>}</div>:<div className="space-y-3"><Field label="Cari santri"><input disabled={busy} autoComplete="off" className={control} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama atau NIS, minimal 2 karakter"/></Field>
   {searching?<p role="status" className="text-sm text-slate-500">Mencari santri…</p>:<div className="max-h-80 divide-y divide-slate-100 overflow-auto">{matches.map(s=><button disabled={busy} type="button" key={s.id} className="min-h-11 w-full rounded-lg px-3 py-3 text-left hover:bg-emerald-50 focus-visible:outline-emerald-600" onClick={()=>setStudent(s)}><StudentIdentity student={s} placement/></button>)}{search.length>=2&&!matches.length&&<p className="py-3 text-sm text-slate-500">Tidak ada santri aktif dalam cakupan akses Anda.</p>}</div>}
  </div>}
  {student&&<><fieldset disabled={incidentSaved} className="min-w-0 space-y-6"><Field label="Jenis pelanggaran"><Combobox disabled={busy||incidentSaved} label="Jenis pelanggaran" value={typeId} onChange={setTypeId} items={types}/></Field>
  {!types.length&&<p className="text-sm text-amber-700">Belum ada jenis aktif. Hubungi sekpen/admin untuk mengatur jenis pelanggaran.</p>}
  <div className="grid gap-4 sm:grid-cols-2"><Field label="Tanggal dan jam (UTC+7)"><input required disabled={busy} type="datetime-local" className={control} value={date} onChange={e=>{setDate(e.target.value);setManualSession('')}}/></Field><Field label="Sesi pengajian"><select disabled={busy||!!automaticSession} required className={control} value={sesi} onChange={e=>setManualSession(e.target.value as typeof manualSession)}><option value="">Pilih sesi</option>{Object.entries(SESSION_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><p className="mt-2 text-xs leading-relaxed text-slate-500">{automaticSession?'Sesi otomatis sesuai waktu kejadian.':'Di luar jam pengajian otomatis. Pilih sesi secara manual.'}</p></Field></div>
  <Field label="Catatan (opsional)"><textarea disabled={busy} className={control} rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
  {row&&<Field label="Alasan koreksi"><textarea required disabled={busy} className={control} rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>}
  </fieldset>{!row&&<EvidenceDraft file={photo} disabled={busy||incidentSaved} onCapture={()=>setCameraOpen(true)} onRemove={()=>setPhoto(null)}/>}
  </>}
 </form></Modal>{cameraOpen&&<EvidenceCamera onClose={()=>setCameraOpen(false)} onUse={file=>{setPhoto(file);setCameraOpen(false)}}/>}</>
}
export function CancelForm({row,onClose,onSaved}:{row:Incident;onClose:()=>void;onSaved:()=>void}) {
 const [reason,setReason]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [id]=useState(()=>crypto.randomUUID())
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await cancelIncident(row.id,row.version,reason,id);if(r.error)setError(r.error);else{toast.success('Catatan dibatalkan; histori tetap tersimpan.');onSaved()}}catch{setError('Pembatalan gagal. Silakan coba lagi.')}finally{setBusy(false)}}
 return <Modal title="Batalkan Catatan" busy={busy} onClose={onClose} footer={<div className="flex justify-end gap-3"><button className={button} disabled={busy} onClick={onClose}>Tutup</button><button form="pengajian-cancel" className={button+' border-rose-200 bg-rose-600 text-white hover:bg-rose-700'} disabled={busy} type="submit">{busy?'Memproses…':'Batalkan Catatan'}</button></div>}><form id="pengajian-cancel" className="space-y-5" onSubmit={submit}>{error&&<ErrorMessage message={error}/>}<StudentIdentity student={row} large placement/><p className="text-sm leading-relaxed text-slate-600">{row.type_name}. Catatan tetap tersimpan, dan tidak dihitung dalam rekap maupun analitik.</p><Field label="Alasan pembatalan"><textarea required disabled={busy} maxLength={500} className={control} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></Field></form></Modal>
}
export function Settings({options,canCreate,canUpdate,onClose,onSaved}:{options:Options;canCreate:boolean;canUpdate:boolean;onClose:()=>void;onSaved:()=>void}) {
 const fresh=()=>({id:crypto.randomUUID(),name:'',description:'',position:options.types.length+1,active:1,version:1})
 const [draft,setDraft]=useState<ViolationType>(fresh);const [editing,setEditing]=useState(false);const [formOpen,setFormOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await saveType(draft);if(r.error)setError(r.error);else{toast.success('Jenis pelanggaran disimpan.');setDraft(fresh());setEditing(false);setFormOpen(false);onSaved()}}catch{setError('Pengaturan gagal disimpan.')}finally{setBusy(false)}}
 return <Modal title={formOpen?(editing?'Ubah Jenis Pelanggaran':'Tambah Jenis Pelanggaran'):'Pengaturan Jenis Pelanggaran'} busy={busy} onClose={onClose} footer={<div className="flex justify-end gap-3"><button className={button} disabled={busy} onClick={()=>formOpen?setFormOpen(false):onClose()}>{formOpen?'Kembali':'Tutup'}</button>{formOpen&&<button form="pengajian-type" className={primary} type="submit" disabled={busy||!(editing?canUpdate:canCreate)}>{busy?'Menyimpan…':'Simpan Jenis'}</button>}</div>}><div className="space-y-5">
  <p className="text-sm text-slate-500">Jenis nonaktif tetap tersedia dalam histori, tetapi tidak dapat dipilih untuk kejadian baru.</p>
  {formOpen?<form id="pengajian-type" className="space-y-5" onSubmit={submit}>{error&&<ErrorMessage message={error}/>}<Field label="Nama jenis"><input required disabled={busy} maxLength={120} className={control} value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></Field><Field label="Deskripsi"><textarea disabled={busy} className={control} rows={2} maxLength={1000} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></Field><div className="grid grid-cols-2 gap-4"><Field label="Urutan"><input required disabled={busy} className={control} type="number" min={0} step={1} value={draft.position} onChange={e=>setDraft(d=>({...d,position:Number(e.target.value)}))}/></Field><Field label="Status"><select disabled={busy} className={control} value={draft.active} onChange={e=>setDraft(d=>({...d,active:Number(e.target.value)}))}><option value={1}>Aktif</option><option value={0}>Nonaktif</option></select></Field></div></form>:<><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-600">{options.types.length} jenis pelanggaran</p>{canCreate&&<button className={primary} onClick={()=>{setDraft(fresh());setEditing(false);setError('');setFormOpen(true)}}>Tambah Jenis</button>}</div><div className="divide-y divide-slate-100">{options.types.map(t=><div key={t.id} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-800">{t.name}</p><p className="mt-1 text-xs text-slate-500">Urutan {t.position} · {t.active?'Aktif':'Nonaktif'}</p>{t.description&&<p className="mt-1 break-words text-sm text-slate-500">{t.description}</p>}</div>{canUpdate&&<button className={button} onClick={()=>{setDraft(t);setEditing(true);setError('');setFormOpen(true)}}>Ubah</button>}</div>)}</div></>}
 </div></Modal>
}
