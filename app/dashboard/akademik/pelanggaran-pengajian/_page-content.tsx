'use client'

import { useEffect, useState } from 'react'
import { Filter, Plus, Settings as SettingsIcon } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { toWibDateInputValue, formatWibDateTime } from '@/lib/date/wib'
import type { Analytics, Capabilities, Filters, Incident, Options, Page, Recap, Santri, Tab } from '@/lib/pengajian-violations/types'
import { getAnalytics, getCapabilities, getHistory, getOptions, getRecap, getStudentDetail } from './actions'
import { Bars, button, control, Empty, ErrorMessage, IncidentList, Modal, Pager, primary } from './_components'
import { CancelForm, FilterModal, IncidentForm, Settings } from './_forms'

const emptyOptions:Options={asramas:[],kamars:[],classes:[],actors:[],types:[]}
function initialFilters():Record<Tab,Filters>{const date=toWibDateInputValue();return {riwayat:{status:'active',sort:'time',direction:'desc'},rekap:{status:'active',sort:'count',direction:'desc'},analitik:{status:'active',start:date.slice(0,7)+'-01',end:date}}}
function RecapList({data,onSelect}:{data:Page<Recap>;onSelect:(id:string)=>void}) {
 if(!data.rows.length)return <Empty>Belum ada santri dengan catatan yang sesuai filter.</Empty>
 return <div className="divide-y divide-slate-100">{data.rows.map(row=><button className="flex min-h-11 w-full items-center justify-between gap-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600" key={row.santri_id} onClick={()=>onSelect(row.santri_id)}><div className="min-w-0"><p className="font-semibold text-slate-800">{row.nama_lengkap}</p><p className="mt-1 text-xs text-slate-500">{row.nis} · {row.asrama||'Tanpa asrama'} / {row.kamar||'—'}</p><p className="mt-1 text-xs text-slate-500">{row.type_count} jenis · Terakhir {formatWibDateTime(row.last)}</p></div><div className="shrink-0 text-right"><p className="text-xl font-semibold tabular-nums text-emerald-800">{row.count}</p><p className="text-xs text-slate-500">kejadian</p></div></button>)}</div>
}
function StudentDetail({id,initial,options,cap,refresh,onClose,onEdit,onCancel}:{id:string;initial:Filters;options:Options;cap:Capabilities|null;refresh:number;onClose:()=>void;onEdit:(row:Incident)=>void;onCancel:(row:Incident)=>void}) {
 const [filters,setFilters]=useState<Filters>(()=>({...initial,min:undefined,max:undefined,sort:'time',direction:'desc'}));const [page,setPage]=useState(1);const [filterOpen,setFilterOpen]=useState(false)
 const [data,setData]=useState<{student:Santri;history:Page<Incident>}|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
 useEffect(()=>{let alive=true;async function load(){setLoading(true);setError('');try{const r=await getStudentDetail(id,filters,page);if(alive){if(r.data)setData(r.data);else{setError(r.error);setData(null)}}}catch{if(alive)setError('Detail tidak dapat dimuat.')}finally{if(alive)setLoading(false)}}void load();return()=>{alive=false}},[id,filters,page,refresh])
 return <><Modal title="Riwayat Pelanggaran Santri" onClose={onClose} wide><div className="space-y-4">
  {data&&<div><h3 className="font-semibold text-slate-900">{data.student.nama_lengkap}</h3><p className="text-xs text-slate-500">{data.student.nis} · {data.student.asrama||'Tanpa asrama'} / {data.student.kamar||'—'} · {data.student.status_global}</p></div>}
  <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setFilterOpen(true)}><Filter size={16}/>Filter & Urutkan</button><button className={button} onClick={()=>{setFilters({status:'all',sort:'time',direction:'desc'});setPage(1)}}>Semua riwayat santri</button></div>
  <p className="text-xs text-slate-500">{filters.start||filters.end?`${filters.start||'Awal'} — ${filters.end||'Sekarang'}`:'Seluruh periode'} · {filters.status==='all'?'Semua status':filters.status==='cancelled'?'Dibatalkan':'Aktif'}</p>
  {error&&<ErrorMessage message={error}/>} {loading?<Empty>Memuat riwayat…</Empty>:data&&<><IncidentList data={data.history} cap={cap} onEdit={onEdit} onCancel={onCancel}/><Pager data={data.history} onPage={setPage}/></>}
 </div></Modal>{filterOpen&&<FilterModal value={filters} options={options} tab="riwayat" detail onClose={()=>setFilterOpen(false)} onApply={f=>{setFilters(f);setPage(1);setFilterOpen(false)}}/>}</>
}
export default function PageContent() {
 const [tab,setTab]=useState<Tab>('riwayat');const [allFilters,setAllFilters]=useState(initialFilters);const [page,setPage]=useState(1);const [refresh,setRefresh]=useState(0)
 const [options,setOptions]=useState<Options>(emptyOptions);const [cap,setCap]=useState<Capabilities|null>(null);const [initError,setInitError]=useState('')
 const [history,setHistory]=useState<Page<Incident>|null>(null);const [recap,setRecap]=useState<Page<Recap>|null>(null);const [analytics,setAnalytics]=useState<Analytics|null>(null)
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [filterOpen,setFilterOpen]=useState(false);const [settingsOpen,setSettingsOpen]=useState(false)
 const [form,setForm]=useState<{row?:Incident}|null>(null);const [cancel,setCancel]=useState<Incident|null>(null);const [student,setStudent]=useState<{id:string;filters:Filters}|null>(null);const [weekly,setWeekly]=useState(false)
 const filters=allFilters[tab]
 useEffect(()=>{let alive=true;Promise.all([getOptions(),getCapabilities()]).then(([o,c])=>{if(!alive)return;if(!o.data||!c.data){setInitError(o.error||c.error||'Gagal memuat pengaturan.');return}setOptions(o.data);setCap(c.data);setInitError('')}).catch(()=>{if(alive)setInitError('Pengaturan tidak dapat dimuat.')});return()=>{alive=false}},[refresh])
 useEffect(()=>{let alive=true;async function load(){setLoading(true);setError('');try{if(tab==='riwayat'){const r=await getHistory(filters,page);if(alive){if(r.data)setHistory(r.data);else setError(r.error)}}else if(tab==='rekap'){const r=await getRecap(filters,page);if(alive){if(r.data)setRecap(r.data);else setError(r.error)}}else{const r=await getAnalytics(filters);if(alive){if(r.data)setAnalytics(r.data);else setError(r.error)}}}catch{if(alive)setError('Data tidak dapat dimuat.')}finally{if(alive)setLoading(false)}}void load();return()=>{alive=false}},[tab,filters,page,refresh])
 function updateFilters(f:Filters){setAllFilters(a=>({...a,[tab]:f}));setPage(1)}
 function saved(){setForm(null);setCancel(null);setRefresh(n=>n+1)}
 function selectStudent(id:string){setStudent({id,filters:{...filters}})}
 function drill(patch:Filters){setAllFilters(a=>({...a,riwayat:{...filters,...patch,status:'active',sort:'time',direction:'desc'}}));setTab('riwayat');setPage(1)}
 const filterCount=Object.entries(filters).filter(([k,v])=>!['sort','direction','status','search'].includes(k)&&v!==undefined&&v!=='').length
 return <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
  <DashboardPageHeader title="Pelanggaran Pengajian" description="Catatan kejadian dan bahan evaluasi pengajian santri." action={<div className="flex flex-wrap gap-2">{cap?.manage&&<button className={button} onClick={()=>setSettingsOpen(true)}><SettingsIcon size={17}/>Pengaturan</button>}{cap?.create&&tab==='riwayat'&&<button className={primary} onClick={()=>setForm({})}><Plus size={17}/>Catat Pelanggaran</button>}</div>}/>
  {initError&&<ErrorMessage message={initError}/>}
  <div className="flex border-b border-slate-200" role="tablist" aria-label="Pelanggaran pengajian">{(['riwayat','rekap','analitik'] as const).map(t=><button id={`tab-${t}`} key={t} role="tab" aria-selected={tab===t} aria-controls={`panel-${t}`} tabIndex={tab===t?0:-1} className={`min-h-11 flex-1 border-b-2 px-3 py-3 text-sm font-semibold capitalize focus-visible:outline-2 focus-visible:outline-emerald-600 sm:flex-none sm:px-6 ${tab===t?'border-emerald-700 text-emerald-800':'border-transparent text-slate-500'}`} onClick={()=>{setTab(t);setPage(1)}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs:Tab[]=['riwayat','rekap','analitik'];const index=e.key==='Home'?0:e.key==='End'?2:(tabs.indexOf(t)+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[index]);setPage(1);document.getElementById(`tab-${tabs[index]}`)?.focus()}}}>{t}</button>)}</div>
  <div className="flex flex-col gap-2 sm:flex-row"><input className={control+' flex-1'} aria-label="Cari nama atau NIS" placeholder="Cari nama santri atau NIS…" value={filters.search??''} onChange={e=>updateFilters({...filters,search:e.target.value})}/><button className={button} onClick={()=>setFilterOpen(true)}><Filter size={16}/>Filter & Urutkan{filterCount>0?` (${filterCount})`:''}</button></div>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>{filters.start||filters.end?`${filters.start||'Awal'} — ${filters.end||'Sekarang'}`:'Seluruh periode'} · {tab!=='riwayat'?'Catatan aktif saja':filters.status==='all'?'Semua status':filters.status==='cancelled'?'Dibatalkan':'Catatan aktif'}</p><button className="min-h-11 px-2 text-emerald-800" onClick={()=>setRefresh(n=>n+1)}>Muat ulang</button></div>
  <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} aria-busy={loading} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
   {error?<ErrorMessage message={error}/>:loading?<div role="status"><Empty>Memuat {tab}…</Empty></div>:tab==='riwayat'&&history?<><IncidentList data={history} cap={cap} onEdit={row=>setForm({row})} onCancel={setCancel} onStudent={selectStudent}/><Pager data={history} onPage={setPage}/></>:tab==='rekap'&&recap?<><RecapList data={recap} onSelect={selectStudent}/><Pager data={recap} onPage={setPage}/></>:tab==='analitik'&&analytics?<div className="space-y-5">
    <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-5">{[{label:'Kejadian',value:analytics.total},{label:'Santri tercatat',value:analytics.students},{label:'Santri berulang',value:analytics.repeat}].map(k=><div key={k.label}><p className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{k.value}</p><p className="mt-1 text-xs text-slate-500">{k.label}</p></div>)}</div>
    <p className="text-xs text-slate-500">Santri berulang memiliki minimal 2 kejadian pada periode dan filter yang dipilih. Klik kelompok untuk melihat kejadian.</p>
    <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">Tren kejadian</h3><select className={control+' !w-auto'} aria-label="Interval tren" value={weekly?'weekly':'daily'} onChange={e=>setWeekly(e.target.value==='weekly')}><option value="daily">Harian</option><option value="weekly">Mingguan</option></select></div><Bars title={weekly?'Per minggu (mulai Senin)':'Per hari'} rows={weekly?analytics.weekly:analytics.trend}/></div>
    <div className="grid gap-4 sm:grid-cols-2"><Bars title="Jenis terbanyak" rows={analytics.types} onPick={r=>drill({typeId:r.key})}/><Bars title="Sebaran sesi" rows={analytics.sessions} onPick={r=>drill({session:r.key})}/><Bars title="Sebaran asrama saat ini" rows={analytics.dorms} onPick={r=>drill({asrama:r.key})}/><Bars title="Sebaran kelas saat ini" rows={analytics.classes} onPick={r=>drill({kelasId:r.key})}/></div>
    <p className="text-xs text-slate-500">Asrama dan kelas mengikuti penempatan saat ini. Santri yang terdaftar di beberapa kelas dihitung sekali pada masing-masing kelas; jumlah antarkelas dapat melebihi total kejadian. Sebaran menampilkan hingga 100 kelompok.</p>
    <section><h3 className="font-semibold text-slate-900">Santri dengan kejadian berulang</h3><p className="mt-1 text-xs text-slate-500">10 santri dengan jumlah kejadian terbanyak dalam filter saat ini.</p><RecapList data={{rows:analytics.recurring,total:analytics.recurring.length,page:1}} onSelect={selectStudent}/></section>
   </div>:<Empty>Belum ada data.</Empty>}
  </section>
  {filterOpen&&<FilterModal value={filters} options={options} tab={tab} onClose={()=>setFilterOpen(false)} onApply={f=>{updateFilters(f);setFilterOpen(false)}}/>}
  {settingsOpen&&cap?.manage&&<Settings options={options} canCreate={cap.create} canUpdate={cap.update} onClose={()=>setSettingsOpen(false)} onSaved={()=>setRefresh(n=>n+1)}/>}
  {student&&<StudentDetail id={student.id} initial={student.filters} options={options} cap={cap} refresh={refresh} onClose={()=>setStudent(null)} onEdit={row=>setForm({row})} onCancel={setCancel}/>}
  {form&&<IncidentForm row={form.row} options={options} onClose={()=>setForm(null)} onSaved={saved}/>}
  {cancel&&<CancelForm row={cancel} onClose={()=>setCancel(null)} onSaved={saved}/>}
 </div>
}
