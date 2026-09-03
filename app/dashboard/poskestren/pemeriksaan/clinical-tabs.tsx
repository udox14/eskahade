/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { CalendarDays, ChevronRight, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/poskestren/poskestren-shell'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { toWibDateInputValue } from '@/lib/date/wib'

import {
  getDiagnosisOptions,
  getMedicalRecordPatients,
  getOutsideReferences,
  getOutsideTreatments,
  getPatientMedicalTimeline,
  saveOutsideReference,
  saveOutsideTreatment,
  searchHealthSantri,
} from './clinical-actions'

const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function nowLocal() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function MedicalRecordsTab({ isFull }: { isFull: boolean }) {
  const today = toWibDateInputValue()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [asrama, setAsrama] = useState('')
  const [diagnosisId, setDiagnosisId] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [diagnoses, setDiagnoses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMedicalRecordPatients({ q, from, to, asrama, diagnosisId, limit: 50 })
      setRows(result.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat rekam kesehatan.')
    } finally { setLoading(false) }
  }, [asrama, diagnosisId, from, q, to])

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  useEffect(() => { if (isFull) void getDiagnosisOptions().then(setDiagnoses) }, [isFull])

  async function openDetail(patientId: string) {
    try { setDetail(await getPatientMedicalTimeline({ patientId, limit: 20 })) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal membuka rekam kesehatan.') }
  }

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={event => setQ(event.target.value)} placeholder="Nama, NIS, kode pasien, asrama..." className={`${input} pl-9`} /></div>
        <input type="date" value={from} onChange={event => setFrom(event.target.value)} className={input} />
        <input type="date" value={to} onChange={event => setTo(event.target.value)} className={input} />
        <button onClick={() => { setFrom(today); setTo(today) }} className={from === today && to === today ? primary : secondary}><CalendarDays className="h-4 w-4" /> Hari Ini</button>
      </div>
      {isFull ? <div className="grid gap-3 md:grid-cols-2">
        <input value={asrama} onChange={event => setAsrama(event.target.value)} placeholder="Filter asrama..." className={input} />
        <select value={diagnosisId} onChange={event => setDiagnosisId(event.target.value)} className={input}><option value="">Semua diagnosis</option>{diagnoses.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
      </div> : <p className="text-xs font-medium text-amber-700">Tampilan ringkas: catatan sensitif dan rincian obat tidak ditampilkan.</p>}
    </div>
    {loading ? <Loading /> : rows.length ? <>
      <div className="space-y-2 p-3 md:hidden">{rows.map(row => <button key={row.patient_id} onClick={() => void openDetail(row.patient_id)} className="w-full rounded-lg border p-3 text-left"><div className="flex items-start gap-3"><SantriPhotoAvatar name={row.nama_lengkap} src={row.foto_url} size="sm" /><div className="min-w-0 flex-1"><p className="truncate font-bold">{row.nama_lengkap}</p><p className="text-[11px] text-slate-500">{row.poskestren_code} · {row.asrama || '—'} / {row.kamar || '—'}</p><p className="mt-1 line-clamp-1 text-xs">{row.last_complaint || '—'} · {row.last_result || row.last_status}</p></div><ChevronRight className="h-4 w-4 text-slate-400" /></div></button>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Santri</th><th className="px-4 py-3">Asrama / Kamar</th><th className="px-4 py-3">Terakhir</th><th className="px-4 py-3">Keluhan / Hasil</th><th className="px-4 py-3 text-center">Rekaman</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.patient_id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="flex items-center gap-3"><SantriPhotoAvatar name={row.nama_lengkap} src={row.foto_url} size="sm" /><div><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.poskestren_code} · {row.nis}</p></div></div></td><td className="px-4 py-3">{row.asrama || '—'} / {row.kamar || '—'}</td><td className="px-4 py-3">{String(row.last_event_at).slice(0,16).replace('T',' ')}</td><td className="max-w-md px-4 py-3"><p>{row.last_complaint || '—'}</p><p className="text-xs text-slate-500">{row.last_result || row.last_status}</p></td><td className="px-4 py-3 text-center font-bold">{row.event_count}</td><td className="px-4 py-3 text-right"><button className={secondary} onClick={() => void openDetail(row.patient_id)}>Rekam medis</button></td></tr>)}</tbody></table></div>
    </> : <EmptyState title="Tidak ada rekam kesehatan" description="Ubah filter atau rentang tanggal." />}
    {detail ? <TimelineModal detail={detail} onClose={() => setDetail(null)} /> : null}
  </section>
}

function TimelineModal({ detail, onClose }: any) {
  const patient = detail.patient
  return <Modal title={`Rekam Kesehatan · ${patient.nama_lengkap}`} onClose={onClose} wide>
    <div className="flex gap-4 rounded-lg bg-slate-50 p-4"><SantriPhotoAvatar name={patient.nama_lengkap} src={patient.foto_url} size="md" /><div><p className="text-lg font-black">{patient.nama_lengkap}</p><p className="text-sm text-slate-500">{patient.poskestren_code || patient.medical_record_no} · {patient.nis}</p><p className="text-sm text-slate-500">{patient.asrama || '—'} / {patient.kamar || '—'}</p></div></div>
    {detail.accessMode === 'FULL' ? <div className="grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-lg border p-3"><b>Alergi Obat</b><p>{patient.allergies || 'Tidak ada catatan'}</p></div><div className="rounded-lg border p-3"><b>Riwayat Penyakit</b><p>{patient.special_conditions || 'Tidak ada catatan'}</p></div><div className="rounded-lg border p-3"><b>Obat Rutin</b><p>{patient.routine_medicines || 'Tidak ada catatan'}</p></div></div> : null}
    <div className="relative space-y-3 border-l-2 border-emerald-100 pl-5">{detail.items.map((row: any) => <article key={`${row.event_type}-${row.event_id}`} className="relative rounded-lg border p-3 before:absolute before:-left-[27px] before:top-4 before:h-3 before:w-3 before:rounded-full before:bg-emerald-500"><div className="flex flex-wrap justify-between gap-2"><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-black">{row.event_type}</span><span className="text-xs text-slate-400">{String(row.event_at).slice(0,16).replace('T',' ')}</span></div><p className="mt-2 font-bold">{row.summary || '—'}</p><p className="text-sm text-slate-600">{row.result_text || row.status}</p>{row.referral_destination ? <p className="text-xs font-bold text-rose-600">Rujukan: {row.referral_destination}</p> : null}<p className="mt-1 text-xs text-slate-400">{row.personnel_name || '—'}</p></article>)}</div>
  </Modal>
}

export function OutsideTreatmentTab({ isFull, canWrite }: { isFull:boolean; canWrite:boolean }) {
  const today=toWibDateInputValue();const [q,setQ]=useState('');const [from,setFrom]=useState(`${today.slice(0,7)}-01`);const [to,setTo]=useState(today);const [rows,setRows]=useState<any[]>([]);const [refs,setRefs]=useState<any>({regions:[],providers:[],drivers:[]});const [loading,setLoading]=useState(true);const [showCreate,setShowCreate]=useState(false);const [editing,setEditing]=useState<any>(null);const [pending,startTransition]=useTransition()
  const load=useCallback(async()=>{setLoading(true);try{const [data,master]=await Promise.all([getOutsideTreatments({q,from,to,limit:100}),getOutsideReferences()]);setRows(data.items);setRefs(master)}catch(e){toast.error(e instanceof Error?e.message:'Gagal memuat Berobat Keluar.')}finally{setLoading(false)}},[from,q,to])
  useEffect(()=>{const t=setTimeout(()=>void load(),250);return()=>clearTimeout(t)},[load])
  function addMaster(type:'REGION'|'PROVIDER'|'DRIVER'){const name=window.prompt(`Nama ${type.toLowerCase()} baru:`);if(!name)return;startTransition(async()=>{const r=await saveOutsideReference({referenceType:type,name});if(!r.success)toast.error(r.error);else{toast.success('Master ditambahkan.');await load()}})}
  return <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Santri, klinik/dokter, keluhan..." className={`${input} pl-9`}/></div><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={input}/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className={input}/>{canWrite?<button onClick={()=>setShowCreate(true)} className={primary}><Plus className="h-4 w-4"/> Berobat Keluar</button>:null}</div>
    {isFull?<div className="flex flex-wrap gap-2 border-b p-3"><span className="self-center text-xs font-bold text-slate-500">Kelola master:</span><button onClick={()=>addMaster('REGION')} className={secondary}>Wilayah</button><button onClick={()=>addMaster('PROVIDER')} className={secondary}>Klinik/Dokter</button><button onClick={()=>addMaster('DRIVER')} className={secondary}>Supir</button></div>:null}
    {loading?<Loading/>:rows.length?<><div className="space-y-2 p-3 md:hidden">{rows.map(row=><button key={row.id} disabled={!canWrite} onClick={()=>{if(canWrite){setEditing(row);setShowCreate(true)}}} className="w-full rounded-lg border p-3 text-left disabled:cursor-default"><p className="font-bold">{row.nama_lengkap}</p><p className="text-[11px] text-slate-500">{row.poskestren_code} · {row.asrama_snapshot||'—'}/{row.kamar_snapshot||'—'} · {String(row.treated_at).slice(0,16).replace('T',' ')}</p><p className="mt-1 text-xs">{row.provider_name} · {row.region_name}</p></button>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Tanggal/Pasien</th><th className="px-4 py-3">Wilayah</th><th className="px-4 py-3">Klinik/Dokter</th><th className="px-4 py-3">Keluhan</th><th className="px-4 py-3">Supir</th>{canWrite?<th className="px-4 py-3 text-right">Aksi</th>:null}</tr></thead><tbody className="divide-y">{rows.map(row=><tr key={row.id}><td className="px-4 py-3"><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.poskestren_code} · {String(row.treated_at).slice(0,16).replace('T',' ')}</p><p className="text-xs text-slate-500">{row.asrama_snapshot||'—'} / {row.kamar_snapshot||'—'}</p></td><td className="px-4 py-3">{row.region_name}</td><td className="px-4 py-3 font-bold">{row.provider_name}</td><td className="max-w-sm px-4 py-3">{row.complaint}</td><td className="px-4 py-3">{row.driver_name||'—'}</td>{canWrite?<td className="px-4 py-3 text-right"><button className={secondary} onClick={()=>{setEditing(row);setShowCreate(true)}}>Edit</button></td>:null}</tr>)}</tbody></table></div></>:<EmptyState title="Belum ada Data Berobat Keluar" description="Catat santri yang dibawa berobat ke klinik atau dokter luar."/>}
    {showCreate?<OutsideModal row={editing} refs={refs} pending={pending} onClose={()=>{setShowCreate(false);setEditing(null)}} onSave={(payload:any)=>startTransition(async()=>{try{const r=await saveOutsideTreatment(payload);if(!r.success){toast.error(r.error);return}toast.success('Data Berobat Keluar disimpan.');setShowCreate(false);setEditing(null);await load()}catch(e){toast.error(e instanceof Error?e.message:'Gagal menyimpan.') }})}/>:null}
  </section>
}

function OutsideModal({row,refs,pending,onClose,onSave}:any){const [search,setSearch]=useState(row?.nama_lengkap||'');const [options,setOptions]=useState<any[]>([]);const [selected,setSelected]=useState<any>(row?{id:row.santri_id,nama_lengkap:row.nama_lengkap,poskestren_code:row.poskestren_code,asrama:row.asrama_snapshot,kamar:row.kamar_snapshot}:null);useEffect(()=>{if(search.trim().length<2||selected)return;const t=setTimeout(()=>void searchHealthSantri(search).then(setOptions),250);return()=>clearTimeout(t)},[search,selected]);return <Modal title={row?'Edit Berobat Keluar':'Data Berobat Keluar Baru'} onClose={onClose}><form className="space-y-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onSave({id:row?.id,santriId:selected?.id,treatedAt:f.get('treatedAt'),regionId:f.get('regionId'),providerId:f.get('providerId'),driverId:f.get('driverId'),complaint:f.get('complaint')})}}><label className="block text-xs font-bold">Santri<input value={search} disabled={Boolean(row)} onChange={e=>{setSearch(e.target.value);setSelected(null)}} className={`${input} mt-1`}/></label>{options.length&&!selected?<div className="max-h-40 overflow-y-auto rounded-lg border">{options.map(x=><button type="button" key={x.id} onClick={()=>{setSelected(x);setSearch(x.nama_lengkap)}} className="block w-full border-b p-3 text-left text-sm"><b>{x.nama_lengkap}</b><small className="block">{x.poskestren_code} · {x.asrama||'—'}/{x.kamar||'—'}</small></button>)}</div>:null}<input required type="datetime-local" name="treatedAt" defaultValue={row?String(row.treated_at).slice(0,16):nowLocal()} className={input}/><select required name="regionId" defaultValue={row?.region_id||''} className={input}><option value="">Pilih wilayah</option>{refs.regions.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select required name="providerId" defaultValue={row?.provider_id||''} className={input}><option value="">Pilih klinik/dokter</option>{refs.providers.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select name="driverId" defaultValue={row?.driver_id||''} className={input}><option value="">Tanpa supir</option>{refs.drivers.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select><textarea required name="complaint" defaultValue={row?.complaint||''} placeholder="Keluhan" className={`${input} min-h-24`}/><button disabled={pending||!selected} className={`${primary} w-full`}>{pending?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>} Simpan</button></form></Modal>}

function Loading(){return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400"/></div>}
function Modal({title,onClose,wide,children}:{title:string;onClose:()=>void;wide?:boolean;children:React.ReactNode}){return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"><div className={`max-h-[94vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:rounded-xl ${wide?'max-w-4xl':'max-w-xl'}`}><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-slate-50 px-5 py-4"><h2 className="font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-200"><X className="h-4 w-4"/></button></div><div className="space-y-4 p-5">{children}</div></div></div>}

