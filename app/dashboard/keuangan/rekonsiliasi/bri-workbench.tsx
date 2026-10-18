'use client'

import {useEffect,useState} from 'react'
import {getBriReconciliationWorkbench,resolveBriStatementAction,syncBriStatementAction} from './bri-actions'

export default function BriWorkbench({canMutate}:{canMutate:boolean}){
 const [data,setData]=useState<Awaited<ReturnType<typeof getBriReconciliationWorkbench>>|null>(null)
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [selected,setSelected]=useState(''),[target,setTarget]=useState(''),[notes,setNotes]=useState('')
 const [from,setFrom]=useState(''),[to,setTo]=useState('')
 const [confirm,setConfirm]=useState(false)
 async function refresh(){try{setData(await getBriReconciliationWorkbench())}catch{setMessage('Data rekonsiliasi belum dapat dimuat. Periksa konfigurasi dan migrasi.')}}
 useEffect(()=>{void refresh()},[])
 async function resolve(){
  setBusy(true);setMessage('')
  try{
   const choice=data?.targets.find(t=>t.id===target)
   await resolveBriStatementAction({statementId:selected,targetId:choice?.id,kind:choice?.kind||'UNALLOCATED',notes})
   setConfirm(false);setSelected('');setTarget('');setNotes('');setMessage('Hasil pemeriksaan telah dicatat.');await refresh()
  }catch{setMessage('Pemeriksaan belum dapat diselesaikan. Pastikan identitas, nominal, periode dan bukti bank sesuai.')}
  finally{setBusy(false)}
 }
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
  <h3 className="font-semibold text-slate-800">Rekonsiliasi Rekening Koran BRI</h3>
  <p className="text-slate-600">Pembayaran diterima tetap menunggu rekonsiliasi. Kesamaan nominal hanya menghasilkan kandidat; operator harus memeriksa identitas dan bukti bank.</p>
  {message&&<p role="status" className="text-amber-800">{message}</p>}
  {canMutate&&<div className="flex flex-wrap items-end gap-2">
   <label>Dari (ISO8601 dengan zona waktu)<input className="block border rounded p-2" value={from} onChange={e=>setFrom(e.target.value)} placeholder="2026-10-18T00:00:00+07:00"/></label>
   <label>Sampai<input className="block border rounded p-2" value={to} onChange={e=>setTo(e.target.value)} placeholder="2026-10-18T23:59:59+07:00"/></label>
   <button className="border rounded p-2 disabled:opacity-50" disabled={busy||!data?.syncEnabled||!from||!to} onClick={async()=>{setBusy(true);try{const result=await syncBriStatementAction({fromDateTime:from,toDateTime:to});setMessage(result.cursorAdvanced?'Mutasi bank berhasil dimuat.':'Mutasi memerlukan pemeriksaan; cursor tidak dilanjutkan.');await refresh()}catch{setMessage('Sinkronisasi belum dapat dilakukan. Periksa kesiapan integrasi bank.')}finally{setBusy(false)}}}>Ambil Mutasi Bank</button>
   {!data?.syncEnabled&&<span className="text-slate-500">Sinkronisasi bank dinonaktifkan.</span>}
  </div>}
  <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Tanggal / Referensi</th><th>Nominal</th><th>Hasil pencocokan</th><th/></tr></thead><tbody>
   {data?.statements.map(st=><tr key={st.id} className="border-t"><td className="p-2">{st.date}<br/>{st.reference||'Tanpa ID transaksi'}</td><td>Rp{st.amount.toLocaleString('id-ID')}</td><td>{({EXACT_MATCH:'Kandidat — perlu pemeriksaan',AMBIGUOUS:'Beberapa kandidat',NO_MATCH:'Belum ditemukan',AMOUNT_MISMATCH:'Nominal berbeda',ALREADY_SETTLED:'Sudah direkonsiliasi',IGNORED_DEBIT:'Mutasi keluar'} as Record<string,string>)[st.classification]||'Perlu pemeriksaan'}</td><td>{canMutate&&<button className="border rounded p-2" onClick={()=>{setSelected(st.id);setConfirm(false)}}>Periksa Bukti</button>}</td></tr>)}
  </tbody></table>{data&&!data.statements.length&&<p className="py-3 text-slate-500">Tidak ada kredit bank yang menunggu pemeriksaan.</p>}</div>
  {selected&&canMutate&&<div className="border-t pt-4 space-y-3">
   <label className="block">Pembayaran / order yang telah diverifikasi<select className="block border rounded p-2 w-full" value={target} onChange={e=>{setTarget(e.target.value);setConfirm(false)}}><option value="">Belum dapat dialokasikan — buka kasus rekonsiliasi</option>{data?.targets.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   <label className="block">Catatan bukti dan alasan pencocokan<textarea className="block border rounded p-2 w-full" value={notes} onChange={e=>{setNotes(e.target.value);setConfirm(false)}}/></label>
   {!confirm?<button className="border rounded p-2" disabled={notes.trim().length<10} onClick={()=>setConfirm(true)}>Tinjau Hasil Pemeriksaan</button>:<div><p className="mb-2">Konfirmasi pencatatan berdasarkan bukti bank yang Anda periksa. Pilihan pembayaran akan menghasilkan settlement dengan audit operator.</p><button className="border rounded p-2" disabled={busy} onClick={resolve}>Konfirmasi Hasil Pemeriksaan</button></div>}
  </div>}
 </section>
}
