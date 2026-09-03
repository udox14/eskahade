'use client'

import type { PrescriptionDraftItem } from '@/lib/poskestren/types'
import type { ClinicalInput } from '@/lib/poskestren/clinical'
import { MedicineCombobox } from './medicine-combobox'

const input = 'mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm'
export function readClinicalForm(form: FormData): ClinicalInput {
  const text = (key: string) => String(form.get(key) || '')
  const number = (key: string) => form.get(key) ? Number(form.get(key)) : null
  return {complaint:text('complaint'),diagnosisId:text('diagnosisId'),treatment:text('treatment'),followUp:text('followUp'),
    referralDestination:text('referralDestination'),referralNotes:text('referralNotes'),notes:text('notes'),
    allergies:text('allergies'),diseaseHistory:text('diseaseHistory'),temperatureCelsius:number('temperatureCelsius'),
    systolicPressure:number('systolicPressure'),diastolicPressure:number('diastolicPressure'),weightKg:number('weightKg')}
}
export function ClinicalFields({initial={},diagnoses=[],registration=false}: {
  initial?: Partial<ClinicalInput>; diagnoses?: Array<{id:string;name:string}>; registration?: boolean
}) {
  const texts: Array<[keyof ClinicalInput,string]> = [['complaint','Keluhan'],['allergies','Alergi obat'],['diseaseHistory','Riwayat penyakit'],
    ...(!registration ? [['treatment','Pemeriksaan'],['followUp','Tindakan'],['referralDestination','Rujukan'],['referralNotes','Catatan rujukan']] as Array<[keyof ClinicalInput,string]> : []),['notes','Catatan tambahan']]
  return <div className="grid gap-3 sm:grid-cols-2">
    {texts.map(([key,label])=><label key={key} className="text-xs font-bold">{label}<textarea name={key} required={key==='complaint'} defaultValue={String(initial[key]??'')} className={input}/></label>)}
    {!registration ? <label className="text-xs font-bold">Diagnosis<select required name="diagnosisId" defaultValue={initial.diagnosisId||''} className={input}><option value="">Pilih diagnosis</option>{diagnoses.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label> : null}
    {([['temperatureCelsius','Suhu (°C)'],['systolicPressure','Tekanan sistolik'],['diastolicPressure','Tekanan diastolik'],['weightKg','Berat badan (kg)']] as const).map(([key,label])=>
      <label key={key} className="text-xs font-bold">{label}<input type="number" step="any" min="0.1" name={key} defaultValue={initial[key]??''} className={input}/></label>)}
  </div>
}
export function PrescriptionEditor({items,onChange,medicines}: {
  items: PrescriptionDraftItem[]; onChange:(items:PrescriptionDraftItem[])=>void;
  medicines:Array<{id:string;name:string;base_unit?:string;total_stock_base?:number}>
}) {
  const update = (i:number, patch:Partial<PrescriptionDraftItem>)=>onChange(items.map((item,n)=>n===i?{...item,...patch}:item))
  return <section className="space-y-3 rounded-lg border p-3">
    <div className="flex items-center justify-between"><b>Resep</b><button type="button" onClick={()=>onChange([...items,{localId:crypto.randomUUID(),sourceType:'STOCK',medicineId:'',requestedQuantityBase:1,unit:'unit'}])} className="rounded border px-3 py-2 text-sm">Tambah obat</button></div>
    {items.map((item,i)=><div key={item.localId||i} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
      <MedicineCombobox required value={item.sourceType==='EXTERNAL'?'external':item.medicineId} allowExternal
        options={[...medicines.map(m=>({value:m.id,label:`${m.name} · stok ${m.total_stock_base??0} ${m.base_unit||''}`})),...(item.sourceType==='EXTERNAL'?[{value:'external',label:`${item.medicineName} · Beli dari luar`}]:[])]}
        onValueChange={id=>{if(id!=='external')update(i,{medicineId:id,medicineName:medicines.find(m=>m.id===id)?.name,sourceType:'STOCK',unit:medicines.find(m=>m.id===id)?.base_unit})}}
        onExternal={name=>update(i,{sourceType:'EXTERNAL',medicineId:'',medicineName:name,unit:'unit'})}/>
      <label className="text-xs">Jumlah<input required type="number" min={1} step={1} value={item.requestedQuantityBase} onChange={e=>update(i,{requestedQuantityBase:Number(e.target.value)})} className={input}/></label>
      <label className="text-xs">Satuan<input required disabled={item.sourceType!=='EXTERNAL'} value={item.unit||medicines.find(m=>m.id===item.medicineId)?.base_unit||'unit'} onChange={e=>update(i,{unit:e.target.value})} className={input}/></label>
      <label className="text-xs">Aturan pakai<input value={item.dosage||''} onChange={e=>update(i,{dosage:e.target.value})} className={input}/></label>
      <label className="text-xs">Catatan<input value={item.notes||''} onChange={e=>update(i,{notes:e.target.value})} className={input}/></label>
      <button type="button" onClick={()=>onChange(items.filter((_,n)=>n!==i))} className="text-sm text-rose-700">Hapus obat</button>
    </div>)}
    {!items.length ? <p className="text-sm text-slate-500">Tanpa obat.</p> : null}
  </section>
}
