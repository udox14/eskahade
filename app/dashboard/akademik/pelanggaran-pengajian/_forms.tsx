'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { toWibDateTimeLocalValue } from '@/lib/date/wib'
import type { Filters, Incident, Options, Santri, Tab, ViolationType } from '@/lib/pengajian-violations/types'
import { cancelIncident, saveIncident, saveType, searchSantri } from './actions'
import { button, Combobox, control, ErrorMessage, Field, Modal, primary } from './_components'

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
 return <Modal title="Filter & Urutkan" onClose={onClose}><form className="space-y-4" onSubmit={submit}>
  {error&&<ErrorMessage message={error}/>}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
   <Field label="Dari tanggal"><input type="date" className={control} value={draft.start??''} onChange={e=>set('start',e.target.value)}/></Field><Field label="Sampai tanggal"><input type="date" className={control} value={draft.end??''} onChange={e=>set('end',e.target.value)}/></Field>
   {!detail&&<>{select('asrama','Asrama',[...options.asramas.filter(Boolean).map(id=>({id,name:id})),{id:'__unassigned__',name:'Belum ditempatkan'}])}{select('kamar','Kamar',options.kamars.map(id=>({id,name:id})))}{select('gender','Jenis kelamin',[{id:'L',name:'Putra'},{id:'P',name:'Putri'}])}{select('kelasId','Kelas pengajian',options.classes)}</>}
   {select('typeId','Jenis pelanggaran',options.types.map(t=>({id:t.id,name:t.name+(t.active?'':' (nonaktif)')})))}
   {select('session','Sesi',[{id:'shubuh',name:'Shubuh'},{id:'ashar',name:'Ashar'},{id:'maghrib',name:'Maghrib'}])}
   {select('actorId','Pencatat',options.actors)}
   {tab==='riwayat'&&<Field label="Status catatan"><select className={control} value={draft.status??'active'} onChange={e=>setDraft(d=>({...d,status:e.target.value as Filters['status']}))}><option value="active">Aktif</option><option value="cancelled">Dibatalkan</option><option value="all">Semua</option></select></Field>}
   {tab==='rekap'&&!detail&&<>{(['min','max'] as const).map(key=><Field label={key==='min'?'Jumlah minimum':'Jumlah maksimum'} key={key}><input className={control} type="number" min={0} step={1} value={draft[key]??''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value===''?undefined:Number(e.target.value)}))}/></Field>)}</>}
   {tab!=='analitik'&&<>{select('sort','Urut berdasarkan',sorts)}<Field label="Arah urutan"><select className={control} value={draft.direction??'desc'} onChange={e=>setDraft(d=>({...d,direction:e.target.value as Filters['direction']}))}><option value="desc">Menurun / terbaru / Z–A</option><option value="asc">Menaik / terlama / A–Z</option></select></Field></>}
  </div>
  {!detail&&<p className="text-xs text-slate-500">Asrama, kamar, dan kelas mengikuti penempatan santri saat ini. Rekap dan analitik menghitung catatan aktif saja.</p>}
  <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white pt-3"><button type="button" className={button} onClick={()=>{setDraft({status:'active',sort:tab==='rekap'?'count':'time',direction:'desc',search:value.search});setError('')}}>Reset</button><button className={primary+' flex-1'} type="submit">Terapkan</button></div>
 </form></Modal>
}

export function IncidentForm({row,options,onClose,onSaved}:{row?:Incident;options:Options;onClose:()=>void;onSaved:()=>void}) {
 const [student,setStudent]=useState<{id:string;nama_lengkap:string;nis:string;asrama:string|null;kamar:string|null}|null>(row?{id:row.santri_id,nama_lengkap:row.nama_lengkap,nis:row.nis,asrama:row.asrama,kamar:row.kamar}:null)
 const [search,setSearch]=useState(''); const [matches,setMatches]=useState<Santri[]>([]);const [searching,setSearching]=useState(false)
 const [typeId,setTypeId]=useState(row?.type_id??''); const [date,setDate]=useState(toWibDateTimeLocalValue(row?.occurred_at??new Date()))
 const [sesi,setSesi]=useState(row?.session??'');const [note,setNote]=useState(row?.note??'');const [reason,setReason]=useState('')
 const [error,setError]=useState('');const [busy,setBusy]=useState(false)
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
  try {
   const response=await saveIncident({...ids,santriId:student.id,typeId,occurredAt:date,session:sesi,note,reason,version:row?.version})
   if(response.error)setError(response.error)
   else{toast.success(row?'Catatan berhasil dikoreksi.':'Pelanggaran berhasil dicatat.');onSaved()}
  }catch{setError('Penyimpanan gagal. Coba lagi dengan formulir yang sama.')}finally{setBusy(false)}
 }
 const types=options.types.filter(t=>t.active||t.id===row?.type_id).map(t=>({id:t.id,name:t.name+(t.active?'':' (nonaktif)')}))
 return <Modal title={row?'Koreksi Pelanggaran':'Catat Pelanggaran'} onClose={()=>{if(!busy)onClose()}}><form onSubmit={submit} className="space-y-4" aria-busy={busy}>
  {error&&<ErrorMessage message={error}/>}
  {student?<div className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-900">{student.nama_lengkap}</p><p className="mt-1 text-xs text-slate-500">{student.nis} · {student.asrama||'Tanpa asrama'} / {student.kamar||'—'}</p>{!row&&<button type="button" disabled={busy} className={button+' mt-2'} onClick={()=>{setStudent(null);setSearch('');setMatches([])}}>Ganti santri</button>}</div>:<div className="space-y-2"><Field label="Cari santri"><input disabled={busy} autoComplete="off" className={control} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama atau NIS, minimal 2 karakter"/></Field>
   {searching?<p role="status" className="text-sm text-slate-500">Mencari santri…</p>:<div className="max-h-48 divide-y divide-slate-100 overflow-auto">{matches.map(s=><button disabled={busy} type="button" key={s.id} className="min-h-11 w-full px-2 py-3 text-left hover:bg-emerald-50" onClick={()=>setStudent(s)}><p className="text-sm font-semibold text-slate-800">{s.nama_lengkap}</p><p className="text-xs text-slate-500">{s.nis} · {s.asrama||'Tanpa asrama'} / {s.kamar||'—'}</p></button>)}{search.length>=2&&!matches.length&&<p className="py-3 text-sm text-slate-500">Tidak ada santri aktif dalam cakupan akses Anda.</p>}</div>}
  </div>}
  <Field label="Jenis pelanggaran"><Combobox disabled={busy} label="Jenis pelanggaran" value={typeId} onChange={setTypeId} items={types}/></Field>
  {!types.length&&<p className="text-sm text-amber-700">Belum ada jenis aktif. Hubungi sekpen/admin untuk mengatur jenis pelanggaran.</p>}
  <div className="grid gap-4 sm:grid-cols-2"><Field label="Tanggal dan jam (UTC+7)"><input required disabled={busy} type="datetime-local" className={control} value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Sesi pengajian"><select disabled={busy} required className={control} value={sesi} onChange={e=>setSesi(e.target.value as typeof sesi)}><option value="">Pilih sesi</option><option value="shubuh">Shubuh</option><option value="ashar">Ashar</option><option value="maghrib">Maghrib</option></select></Field></div>
  <Field label="Catatan (opsional)"><textarea disabled={busy} className={control} rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
  {row&&<Field label="Alasan koreksi"><textarea required disabled={busy} className={control} rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>}
  <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white pt-3"><button className={button} type="button" disabled={busy} onClick={onClose}>Tutup</button><button className={primary+' flex-1'} disabled={busy||!types.length} type="submit">{busy?'Menyimpan…':row?'Simpan Koreksi':'Simpan Pelanggaran'}</button></div>
 </form></Modal>
}
export function CancelForm({row,onClose,onSaved}:{row:Incident;onClose:()=>void;onSaved:()=>void}) {
 const [reason,setReason]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [id]=useState(()=>crypto.randomUUID())
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await cancelIncident(row.id,row.version,reason,id);if(r.error)setError(r.error);else{toast.success('Catatan dibatalkan; histori tetap tersimpan.');onSaved()}}catch{setError('Pembatalan gagal. Silakan coba lagi.')}finally{setBusy(false)}}
 return <Modal title="Batalkan Catatan" onClose={()=>{if(!busy)onClose()}}><form className="space-y-4" onSubmit={submit}>{error&&<ErrorMessage message={error}/>}<p className="text-sm text-slate-600">{row.nama_lengkap} · {row.type_name}. Catatan tetap tersimpan, dan tidak dihitung dalam rekap maupun analitik.</p><Field label="Alasan pembatalan"><textarea required disabled={busy} maxLength={500} className={control} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></Field><button className={primary+' w-full bg-rose-700 hover:bg-rose-800'} disabled={busy} type="submit">{busy?'Memproses…':'Batalkan Catatan'}</button></form></Modal>
}
export function Settings({options,canCreate,canUpdate,onClose,onSaved}:{options:Options;canCreate:boolean;canUpdate:boolean;onClose:()=>void;onSaved:()=>void}) {
 const fresh=()=>({id:crypto.randomUUID(),name:'',description:'',position:options.types.length+1,active:1,version:1})
 const [draft,setDraft]=useState<ViolationType>(fresh);const [editing,setEditing]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await saveType(draft);if(r.error)setError(r.error);else{toast.success('Jenis pelanggaran disimpan.');setDraft(fresh());setEditing(false);onSaved()}}catch{setError('Pengaturan gagal disimpan.')}finally{setBusy(false)}}
 return <Modal title="Pengaturan Jenis Pelanggaran" onClose={()=>{if(!busy)onClose()}}><div className="space-y-5">
  <p className="text-sm text-slate-500">Jenis nonaktif tetap tersedia dalam histori, tetapi tidak dapat dipilih untuk kejadian baru.</p>
  {(canCreate||editing)&&<form className="space-y-3 rounded-xl border border-slate-200 p-3" onSubmit={submit}><h3 className="font-semibold text-slate-800">{editing?'Ubah jenis':'Tambah jenis'}</h3>{error&&<ErrorMessage message={error}/>}<Field label="Nama jenis"><input required disabled={busy} maxLength={120} className={control} value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></Field><Field label="Deskripsi"><textarea disabled={busy} className={control} rows={2} maxLength={1000} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Urutan"><input required disabled={busy} className={control} type="number" min={0} step={1} value={draft.position} onChange={e=>setDraft(d=>({...d,position:Number(e.target.value)}))}/></Field><Field label="Status"><select disabled={busy} className={control} value={draft.active} onChange={e=>setDraft(d=>({...d,active:Number(e.target.value)}))}><option value={1}>Aktif</option><option value={0}>Nonaktif</option></select></Field></div><div className="flex gap-2"><button type="submit" className={primary} disabled={busy||!(editing?canUpdate:canCreate)}>{busy?'Menyimpan…':'Simpan Jenis'}</button>{editing&&<button type="button" className={button} disabled={busy} onClick={()=>{setEditing(false);setDraft(fresh());setError('')}}>Batal Ubah</button>}</div></form>}
  <div className="divide-y divide-slate-100">{options.types.map(t=><div key={t.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-800">{t.name}</p><p className="text-xs text-slate-500">Urutan {t.position} · {t.active?'Aktif':'Nonaktif'}</p>{t.description&&<p className="mt-1 break-words text-xs text-slate-500">{t.description}</p>}</div>{canUpdate&&<button disabled={busy} className={button} onClick={()=>{setDraft(t);setEditing(true);setError('')}}>Ubah</button>}</div>)}</div>
 </div></Modal>
}
