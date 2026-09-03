/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClinicalFields, PrescriptionEditor, readClinicalForm } from '@/components/poskestren/clinical-form'
import { ClinicalDetail, MedicineDetail } from '@/components/poskestren/medical-event-detail'
import { encounterLabels } from '@/lib/poskestren/clinical-labels'
import type { ClinicalInput } from '@/lib/poskestren/clinical'
import type { PrescriptionDraftItem } from '@/lib/poskestren/types'
import { getMedicineOptions } from './actions'
import { createObservation } from '../observasi/actions'
import { getDiagnosisOptions, getDormVisits, searchHealthSantri } from './clinical-actions'
import { beginDormExamination, completeClinicalExamination, deliverClinicalPrescription, getClinicalDeliveryQueue,
  getClinicalDoctor, getClinicalPrescription, getDormVisitDetail, registerDormVisit } from './clinical-workflow-actions'

const input='min-h-10 w-full rounded-lg border p-2 text-sm'
const button='min-h-10 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
function errorMessage(e:unknown){toast.error(e instanceof Error?e.message:'Gagal memproses pelayanan.')}
function useClinicalOptions(){
  const [data,setData]=useState<any>(null)
  useEffect(()=>{let live=true;void Promise.all([getClinicalDoctor(),getMedicineOptions(),getDiagnosisOptions()]).then(([doctor,medicines,diagnoses])=>{if(live)setData({doctor,medicines,diagnoses})}).catch(errorMessage);return()=>{live=false}},[])
  return data
}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3"><div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{title}</h2><button type="button" onClick={onClose}>Tutup</button></div>{children}</div></div>
}
export function ClinicalExaminationForm({source,sourceId,initial,onSaved}:{source:'VISIT_ASRAMA'|'OBSERVASI';sourceId:string;initial:Partial<ClinicalInput>;onSaved:()=>void}) {
  const options=useClinicalOptions(),[items,setItems]=useState<PrescriptionDraftItem[]>([]),[pending,setPending]=useState(false)
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID())
  if(!options)return <p>Memuat formulir pemeriksaan...</p>
  if(!options.doctor)return <p className="rounded bg-amber-50 p-3 text-sm">Pemeriksaan dan resep diisi melalui akun dokter yang terhubung ke personel medis aktif.</p>
  return <form className="space-y-4" onSubmit={async e=>{e.preventDefault();const data=readClinicalForm(new FormData(e.currentTarget));setPending(true);try{
    await completeClinicalExamination({...data,source,sourceId,requestId,prescriptionItems:items});toast.success('Pemeriksaan disimpan.');setItems([]);setRequestId(crypto.randomUUID());onSaved()
  }catch(error){errorMessage(error)}finally{setPending(false)}}}>
    <p className="text-sm font-bold">Dokter: {options.doctor.full_name}</p><ClinicalFields initial={initial} diagnoses={options.diagnoses}/>
    <PrescriptionEditor items={items} onChange={setItems} medicines={options.medicines}/>
    <button disabled={pending} className={button}>{pending?'Menyimpan...':'Selesaikan pemeriksaan'}</button>
  </form>
}
export function DormVisitsTab(){
  const [q,setQ]=useState(''),[rows,setRows]=useState<any[]>([]),[limit,setLimit]=useState(100),[more,setMore]=useState(false)
  const [create,setCreate]=useState(false),[detail,setDetail]=useState<any>(null),[examining,setExamining]=useState(false)
  const options=useClinicalOptions()
  const load=useCallback(async()=>{try{const r=await getDormVisits({q,from:limit>100?'1900-01-01':undefined,limit:limit>100?'all':100});setRows(r.items);setMore(r.hasMore)}catch(e){errorMessage(e)}},[q,limit])
  useEffect(()=>{const t=setTimeout(()=>void load(),250);return()=>clearTimeout(t)},[load])
  async function open(id:string){try{setDetail(await getDormVisitDetail(id));setExamining(false)}catch(e){errorMessage(e)}}
  const v=detail?.visit
  return <section className="space-y-3 rounded-xl border bg-white p-4"><div className="flex gap-3"><input aria-label="Cari Visit Asrama" className={input} value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari santri atau keluhan..."/><button className={button} onClick={()=>setCreate(true)}>Visit Asrama</button></div>
    {rows.map(row=><button key={row.id} onClick={()=>void open(row.id)} className="block w-full rounded-lg border p-3 text-left"><b>{row.nama_lengkap}</b><p className="text-xs">{row.visited_at} · {({LEGACY:'Visit lama',MENUNGGU:'Menunggu dokter',DIPERIKSA:'Diperiksa',SELESAI:'Pemeriksaan selesai'} as Record<string,string>)[row.status]}</p><p className="text-sm">{row.complaint}</p></button>)}
    {!rows.length?<p className="py-8 text-center text-sm">Belum ada Visit Asrama.</p>:null}
    {more?<button onClick={()=>setLimit(1000)} className={button}>Tampilkan hingga 1.000 visit; gunakan pencarian untuk mempersempit</button>:null}
    {create?<Modal title="Visit Asrama baru" onClose={()=>setCreate(false)}><DormRegistration onSaved={async id=>{setCreate(false);await load();await open(id)}}/></Modal>:null}
    {detail?<Modal title={'Visit Asrama · '+v.nama_lengkap} onClose={()=>setDetail(null)}>
      {examining?<ClinicalExaminationForm key={v.id} source="VISIT_ASRAMA" sourceId={v.id} initial={{complaint:v.complaint,notes:v.notes,allergies:v.allergies_snapshot??v.allergies,diseaseHistory:v.disease_history_snapshot??v.special_conditions,
        temperatureCelsius:v.temperature_celsius,systolicPressure:v.systolic_pressure,diastolicPressure:v.diastolic_pressure,weightKg:v.weight_kg}} onSaved={()=>{void load();void open(v.id)}}/>:<div className="space-y-4">
        <ClinicalDetail data={detail.exam?JSON.parse(detail.exam.clinical_json):{complaint:v.complaint,notes:v.notes,allergies:v.allergies_snapshot,diseaseHistory:v.disease_history_snapshot,temperatureCelsius:v.temperature_celsius,systolicPressure:v.systolic_pressure,diastolicPressure:v.diastolic_pressure,weightKg:v.weight_kg}}/>
        <MedicineDetail items={detail.medicines}/>
        {options?.doctor&&['MENUNGGU','DIPERIKSA'].includes(v.status)?<button className={button} onClick={async()=>{try{await beginDormExamination(v.id);setExamining(true);await load()}catch(e){errorMessage(e)}}}>Periksa pasien</button>:null}
        {detail.exam?<p className="text-sm">{detail.exam.delivery_status==='PENDING'?'Menunggu penyerahan petugas':'Pemeriksaan selesai'}</p>:null}
      </div>}
    </Modal>:null}
  </section>
}
function DormRegistration({onSaved,source='VISIT_ASRAMA'}:{onSaved:(id:string)=>void;source?:'VISIT_ASRAMA'|'OBSERVASI'}){
  const options=useClinicalOptions(),[q,setQ]=useState(''),[patients,setPatients]=useState<any[]>([]),[selected,setSelected]=useState<any>(null)
  const [items,setItems]=useState<PrescriptionDraftItem[]>([]),[pending,setPending]=useState(false),[direct,setDirect]=useState(true)
  const [requestId]=useState(()=>crypto.randomUUID()),[examId]=useState(()=>crypto.randomUUID())
  useEffect(()=>{if(selected||q.trim().length<2)return;let live=true;const t=setTimeout(()=>void searchHealthSantri(q).then(r=>{if(live)setPatients(r)}).catch(errorMessage),250);return()=>{live=false;clearTimeout(t)}},[q,selected])
  if(!options)return <p>Memuat...</p>
  const examine=Boolean(options.doctor&&direct)
  return <form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(!selected)return;const f=new FormData(e.currentTarget),data=readClinicalForm(f);setPending(true);try{
    const result=source==='OBSERVASI'
      ? await createObservation({santriId:selected.id,admittedAt:String(f.get('visitedAt')),symptoms:data.complaint,notes:data.notes,requestId,clinicalSnapshot:data})
      : await registerDormVisit({...data,santriId:selected.id,visitedAt:String(f.get('visitedAt')),requestId})
    if(!result.success)throw new Error(result.error)
    if(examine){if(source==='VISIT_ASRAMA')await beginDormExamination(result.id);await completeClinicalExamination({...data,source,sourceId:result.id,requestId:examId,prescriptionItems:items})}
    toast.success(examine?'Pemeriksaan visit disimpan.':'Visit didaftarkan.');onSaved(result.id)
  }catch(e){errorMessage(e)}finally{setPending(false)}}}>
    <label className="text-sm">Santri<input className={input} value={q} onChange={e=>{setQ(e.target.value);setSelected(null);setPatients([]);setItems([])}}/></label>
    {!selected?patients.map(p=><button type="button" key={p.id} onClick={()=>{setSelected(p);setQ(p.nama_lengkap);setPatients([])}} className="block w-full rounded border p-2 text-left">{p.nama_lengkap} · {p.asrama}</button>):null}
    <label className="text-sm">Tanggal pelayanan (WIB)<input required type="datetime-local" name="visitedAt" className={input} defaultValue={new Date(Date.now()+7*3600000).toISOString().slice(0,16)}/></label>
    {options.doctor?<label className="flex gap-2 text-sm"><input type="checkbox" checked={direct} onChange={e=>{setDirect(e.target.checked);setItems([])}}/>Langsung periksa sebagai {options.doctor.full_name}</label>:null}
    {selected?<ClinicalFields key={selected.id} registration={!examine} initial={{allergies:selected.drug_allergies||'',diseaseHistory:selected.disease_history||''}} diagnoses={options.diagnoses}/>:null}
    {selected&&examine?<PrescriptionEditor items={items} onChange={setItems} medicines={options.medicines}/>:null}
    <button disabled={pending||!selected} className={button}>{pending?'Menyimpan...':examine?'Selesaikan pemeriksaan':source==='OBSERVASI'?'Mulai observasi':'Daftarkan visit'}</button>
  </form>
}
export function ClinicalDeliveries(){
  const [rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[items,setItems]=useState<any[]>([]),[qty,setQty]=useState<Record<string,number>>({}),[pending,setPending]=useState(false)
  const load=useCallback(()=>getClinicalDeliveryQueue().then(setRows).catch(errorMessage),[])
  useEffect(()=>{void load()},[load])
  return <section className="space-y-3 rounded-lg border bg-white p-4"><div className="flex justify-between"><h3 className="font-bold">Resep Visit Asrama dan Observasi</h3><button type="button" onClick={()=>void load()}>Muat ulang</button></div>
    {rows.map(r=><button key={r.id} className="block w-full rounded border p-3 text-left" onClick={async()=>{try{const data=await getClinicalPrescription(r.id);setItems(data);setQty(Object.fromEntries(data.map(i=>[i.id,i.requested_quantity])));setSelected(r)}catch(e){errorMessage(e)}}}><b>{r.nama_lengkap}</b><p className="text-xs">{encounterLabels[r.source]} · {r.doctor_name} · {r.examined_at}</p></button>)}
    {!rows.length?<p className="text-sm text-slate-500">Tidak ada resep menunggu penyerahan.</p>:null}
    {selected?<Modal title={'Penyerahan obat · '+selected.nama_lengkap} onClose={()=>setSelected(null)}><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setPending(true);try{
      await deliverClinicalPrescription({examId:selected.id,items:items.filter(i=>i.source_type==='STOCK').map(i=>({id:i.id,quantity:qty[i.id]}))});toast.success('Penyerahan dicatat.');setSelected(null);await load()
    }catch(e){errorMessage(e)}finally{setPending(false)}}}>
      <ClinicalDetail data={JSON.parse(selected.clinical_json)}/><MedicineDetail items={items}/>
      {items.filter(i=>i.source_type==='STOCK').map(i=><label key={i.id} className="block text-sm">Jumlah diserahkan: {i.medicine_name}<input required type="number" min={0} max={i.requested_quantity} step={1} className={input} value={qty[i.id]} onChange={e=>setQty({...qty,[i.id]:Number(e.target.value)})}/></label>)}
      <button disabled={pending} className={button}>Konfirmasi penyerahan</button>
    </form></Modal>:null}
  </section>
}

export function ObservationRegistration({onSaved}:{onSaved:(id:string)=>void}) {
  return <DormRegistration source="OBSERVASI" onSaved={onSaved}/>
}
