/* eslint-disable @typescript-eslint/no-explicit-any */

const labels:Record<string,string>={complaint:'Keluhan',diagnosis:'Diagnosis',treatment:'Pemeriksaan',followUp:'Tindakan',
  referralDestination:'Rujukan',referralNotes:'Catatan rujukan',allergies:'Alergi obat',diseaseHistory:'Riwayat penyakit',notes:'Catatan tambahan',
  temperatureCelsius:'Suhu (°C)',systolicPressure:'Tekanan sistolik',diastolicPressure:'Tekanan diastolik',weightKg:'Berat badan (kg)'}
export function ClinicalDetail({data}: {data:any}) {
  if(!data)return null
  return <dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(labels).map(([key,label])=><div key={key}><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="whitespace-pre-wrap">{String(data[key]??'—')}</dd></div>)}</dl>
}
export function MedicineDetail({items}: {items:any[]}) {
  return <div className="space-y-2">{items.map((m:any)=><div key={m.id} className="rounded border p-2 text-sm">
    <b>{m.medicine_name}</b> {m.source_type==='EXTERNAL'?<span className="text-amber-700">Beli dari luar</span>:null}
    <p>Resep: {m.requested_quantity??m.quantity_base??m.quantity??'—'} {m.unit||'unit'}{m.source_type==='STOCK'?` · Diserahkan: ${m.dispensed_quantity??m.quantity_base??0}`:''}</p>
    <p className="whitespace-pre-wrap">{m.dosage||'Aturan pakai belum dicatat'}{m.notes?` · ${m.notes}`:''}</p>
    {m.administered_at?<p>Diberikan: {m.administered_at}</p>:null}
  </div>)}</div>
}
export function MedicalEventDetail({detail}: {detail:any}) {
  if(!detail)return null
  return <div className="mt-3 space-y-3"><ClinicalDetail data={detail.clinical}/>
    {detail.record?<details><summary className="cursor-pointer text-xs">Data pelayanan</summary><dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(detail.record).filter(([k])=>!['id','patient_id','created_by','updated_by','personnel_id','status'].includes(k)).map(([k,v])=><div key={k}><dt>{({visited_at:'Waktu visit',admitted_at:'Waktu masuk',discharged_at:'Waktu keluar',provider_name:'Tempat berobat',region_name:'Wilayah',driver_name:'Supir',complaint:'Keluhan',notes:'Catatan',created_at:'Dibuat',updated_at:'Diubah'} as Record<string,string>)[k]||k.replaceAll('_',' ')}</dt><dd>{String(v??'—')}</dd></div>)}</dl></details>:null}
    <MedicineDetail items={detail.medicines||[]}/>
    {detail.exams?.map((e:any)=><section key={e.id} className="space-y-3 rounded-lg border p-3"><p className="font-bold">{e.doctor_name} · {e.examined_at}</p><ClinicalDetail data={e.clinical}/><MedicineDetail items={e.medicines}/><p className="text-xs">{({PENDING:'Menunggu penyerahan obat',DONE:'Penyerahan selesai',NONE:'Tanpa obat stok'} as Record<string,string>)[e.delivery_status]}{e.delivered_at?` · ${e.delivered_at}`:''}</p></section>)}
    {detail.revisions?.length?<details><summary className="cursor-pointer text-sm font-bold">Riwayat revisi</summary>{detail.revisions.map((r:any)=><div key={r.id} className="my-2 rounded border p-2 text-sm"><p>Revisi {r.revision_no} · {r.revised_by_name} · {r.created_at}</p><p>{r.reason}</p><details><summary>Data sebelum revisi</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(JSON.parse(r.before_json),null,2)}</pre></details></div>)}</details>:null}
  </div>
}
