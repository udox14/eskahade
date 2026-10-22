'use client'

import { useState } from 'react'
import { previewMissingBillingAction, applyMissingBillingAction, getBillingMonitorAction, verifyHistoricalBillingProviderAction } from './billing-actions'

type Preview = Awaited<ReturnType<typeof previewMissingBillingAction>>
const outcomes: Record<string,string> = {
  READY:'Aman dibuat',EXISTING:'Sudah tersedia',EXEMPTED:'Dibebaskan',LEGACY:'Pembayaran modul lama',
  SKIPPED:'Dilewati',REVIEW:'Perlu Pemeriksaan',FAILED:'Konfigurasi belum lengkap',
}

export function BillingAuditPanel({ canApply,onUpdated }: { canApply: boolean; onUpdated: () => void }) {
  const [preview,setPreview] = useState<Preview | null>(null)
  const [selected,setSelected] = useState<Set<number>>(new Set())
  const [pending,setPending] = useState(false)
  const [message,setMessage] = useState('')
  const [monitor,setMonitor] = useState<Awaited<ReturnType<typeof getBillingMonitorAction>> | null>(null)
  const [currentCursor,setCurrentCursor] = useState('')
  async function load(cursor='') {
    setPending(true);setMessage('');setSelected(new Set())
    try {
      const [next,health]=await Promise.all([previewMissingBillingAction(cursor),getBillingMonitorAction()])
      setPreview(next);setMonitor(health);setCurrentCursor(cursor)
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Pratinjau gagal dimuat.') }
    finally { setPending(false) }
  }
  async function apply() {
    if (!preview || !selected.size) return
    setPending(true);setMessage('')
    try {
      const result = await applyMissingBillingAction([...selected].map(i=>preview.candidates[i]))
      setSelected(new Set());setPreview(null)
      setMessage(`${result.created} tagihan ditambahkan; ${result.review} perlu pemeriksaan; ${result.failed} gagal. Referensi ${result.runId}`)
      onUpdated()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Pelengkapan gagal.') }
    finally { setPending(false) }
  }
  return <details className="rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Pemeriksaan penerbitan tagihan</summary>
    <p className="my-3 text-xs text-slate-600">Periksa tagihan yang belum terbentuk sejak CUTOVER. Pembayaran modul lama, tarif, dan pembebasan diperiksa sebelum kandidat dapat dipilih.</p>
    <button type="button" disabled={pending} onClick={()=>load()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{pending?'Memproses…':'Muat pratinjau'}</button>
    {message && <p role="status" className="mt-3 text-sm text-amber-800">{message}</p>}
    {monitor && <div className="my-3 text-xs text-slate-600">
      <p>{monitor.legacyPending} kewajiban memiliki bukti pembayaran lama yang perlu pemeriksaan. {monitor.runs.length ? `Proses terakhir: ${monitor.runs[0].status === 'COMPLETED' ? 'Selesai diproses' : 'Sedang memproses'}; ${monitor.runs[0].failed_count} gagal, ${monitor.runs[0].review_count} perlu pemeriksaan.` : 'Belum ada proses penerbitan otomatis.'}</p>
      {monitor.issues.length>0 && <details className="mt-2"><summary className="cursor-pointer">Kasus pemeriksaan penerbitan ({monitor.issues.length} terbaru)</summary>
        <ul className="mt-2 space-y-1">{monitor.issues.map(i=><li key={`${i.santri_id}:${i.item_type}:${i.period}`}>{i.name} · {i.item_type} {i.period}: {i.reason}</li>)}</ul>
      </details>}
    </div>}
    {preview && <>
      <div className="my-3 overflow-auto"><table className="w-full text-left text-xs">
        <thead><tr><th className="p-2">Pilih</th><th>Santri</th><th>Item / periode</th><th>Nominal</th><th>Hasil pemeriksaan</th></tr></thead>
        <tbody>{preview.candidates.map((c,i)=><tr key={`${c.santriId}:${c.itemType}:${c.period}`} className="border-t align-top">
          <td className="p-2"><input type="checkbox" aria-label={`Lengkapi ${c.name} ${c.itemType} ${c.period}`} checked={selected.has(i)}
            disabled={pending || !canApply || !['READY','EXEMPTED'].includes(c.outcome) || (!selected.has(i) && selected.size>=25)}
            onChange={()=>setSelected(old=>{const next=new Set(old);if(next.has(i))next.delete(i);else next.add(i);return next})}/></td>
          <td className="p-2">{c.name}</td><td className="p-2">{c.itemType}<br/>{c.period}</td>
          <td className="p-2 whitespace-nowrap">{c.obligation ? `Rp${c.obligation.amount_expected.toLocaleString('id-ID')}` : '—'}</td>
          <td className="p-2">{outcomes[c.outcome]??c.outcome}{c.reason && <p className="mt-1 text-slate-500">{c.reason}</p>}
            {c.outcome==='REVIEW' && monitor?.canVerifyHistorical && (c.itemType==='UANG_MAKAN'||c.itemType==='UANG_NYUCI') && <details className="mt-2">
              <summary className="cursor-pointer font-medium">Catat hasil verifikasi provider periode ini</summary>
              <form className="mt-2 space-y-2" onSubmit={async e=>{
                e.preventDefault();const form=new FormData(e.currentTarget);setPending(true);setMessage('')
                try {
                  await verifyHistoricalBillingProviderAction({santriId:c.santriId,itemType:c.itemType as 'UANG_MAKAN'|'UANG_NYUCI',period:c.period,
                    providerId:String(form.get('provider')??''),note:String(form.get('note')??'')})
                  await load(currentCursor)
                } catch(error) {setMessage(error instanceof Error?error.message:'Verifikasi gagal.');setPending(false)}
              }}>
                <select name="provider" required aria-label="Provider historis terverifikasi" className="block w-full rounded border p-2">
                  <option value="">Pilih provider berdasarkan bukti</option>
                  {monitor.providers.filter(p=>p.jenis===(c.itemType==='UANG_MAKAN'?'Makan':'Cuci')).map(p=><option key={p.id} value={p.id}>{p.nama_jasa}</option>)}
                </select>
                <textarea name="note" required minLength={10} maxLength={1000} aria-label="Referensi bukti keanggotaan historis" placeholder="Referensi dokumen/rekaman keanggotaan yang sudah diperiksa" className="block w-full rounded border p-2"/>
                <button type="submit" disabled={pending} className="rounded border px-3 py-2 disabled:opacity-50">Simpan verifikasi dan muat ulang pratinjau</button>
              </form>
            </details>}
          </td>
        </tr>)}</tbody>
      </table></div>
      <div className="flex flex-wrap gap-2">
        {canApply && <button type="button" disabled={pending || !selected.size} onClick={apply} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">Lengkapi {selected.size} kandidat yang ditinjau</button>}
        {preview.nextCursor && <button type="button" disabled={pending} onClick={()=>load(preview.nextCursor!)} className="rounded-lg border px-3 py-2 text-sm">Santri berikutnya</button>}
      </div>
    </>}
  </details>
}
