'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getHistoryReviews, verifyHistory } from './history-actions'
import type { SessionEvidence } from '@/lib/discipline/evidence'

export function HistoryReview() {
 const [page,setPage]=useState(1)
 const [data,setData]=useState<Awaited<ReturnType<typeof getHistoryReviews>>>()
 const [selected,setSelected]=useState<string|null>(null)
 const [items,setItems]=useState<SessionEvidence[]>([])
 const [reason,setReason]=useState('')
 const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{setData(await getHistoryReviews(page))},[page])
 useEffect(()=>{void load()},[load])
 if(!data||data.denied)return null
 if(data.error)return <p role="alert" className="text-sm text-red-700">{data.error}</p>
 const save=async()=>{
  const row=data.rows.find(r=>r.id===selected);if(!row)return
  setBusy(true)
  try {
   const result=await verifyHistory(row.id,row.version,items,reason)
   if('error' in result){toast.error(result.error);return}
   toast.success('Histori berhasil diverifikasi');setSelected(null);await load()
  }finally{setBusy(false)}
 }
 return <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
  <h2 className="text-sm font-semibold text-slate-900">Verifikasi Histori · {data.total} catatan</h2>
  <p className="text-xs text-slate-500">Catatan berikut belum masuk jumlah kejadian. Periksa tanggal dan sesi berdasarkan bukti. Nilai poin lama tidak digunakan.</p>
  {data.rows.map(row=><div key={row.id} className="border-t border-slate-100 py-3 space-y-2">
   <p className="text-sm font-semibold">{row.nama_lengkap} · {row.jenis==='ALFA_PENGAJIAN'?'Alfa Pengajian':'Alfa Berjamaah'}</p>
   <p className="text-xs text-slate-600 whitespace-pre-wrap">{row.deskripsi}</p>
   {selected!==row.id?<button className="text-xs text-blue-700 underline" onClick={()=>{setSelected(row.id);setItems(row.suggestions.length?row.suggestions:[{tanggal:'',sesi:'shubuh'}]);setReason('')}}>Periksa catatan</button>:<div className="space-y-2">
    {items.map((item,index)=><div key={index} className="flex flex-wrap gap-2">
     <label className="text-xs">Tanggal sesi<input aria-label={`Tanggal sesi ${index+1}`} type="date" value={item.tanggal} onChange={e=>setItems(items.map((r,i)=>i===index?{...r,tanggal:e.target.value}:r))} className="block border rounded p-2" /></label>
     <label className="text-xs">Sesi<select aria-label={`Sesi ${index+1}`} value={item.sesi} onChange={e=>setItems(items.map((r,i)=>i===index?{...r,sesi:e.target.value}:r))} className="block border rounded p-2">{(row.jenis==='ALFA_PENGAJIAN'?['shubuh','ashar','maghrib']:['shubuh','dzuhur','ashar','maghrib','isya']).map(s=><option key={s} value={s}>{s==='maghrib'&&row.jenis==='ALFA_PENGAJIAN'?'Malam':s}</option>)}</select></label>
     <button className="text-xs text-red-700" onClick={()=>setItems(items.filter((_,i)=>i!==index))}>Hapus sesi</button>
    </div>)}
    <button className="text-xs text-blue-700 underline" onClick={()=>setItems([...items,{tanggal:'',sesi:'shubuh'}])}>Tambah sesi</button>
    <label className="block text-xs">Alasan dan bukti verifikasi<textarea className="block w-full border rounded p-2" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} /></label>
    <p className="text-xs text-slate-500">{items.length} sesi akan diverifikasi. Sesi yang sama dengan catatan lain tetap dihitung sekali.</p>
    <div className="flex gap-3"><button disabled={busy} className="bg-slate-800 text-white rounded px-3 py-2 text-xs disabled:opacity-50" onClick={save}>{busy?'Menyimpan…':'Simpan Verifikasi'}</button><button className="text-xs" onClick={()=>setSelected(null)}>Tutup</button></div>
   </div>}
  </div>)}
  {data.total>30&&<nav className="flex gap-4 text-xs"><button disabled={page<=1} onClick={()=>setPage(page-1)}>Sebelumnya</button><span>Halaman {page}</span><button disabled={page*30>=data.total} onClick={()=>setPage(page+1)}>Berikutnya</button></nav>}
 </section>
}
