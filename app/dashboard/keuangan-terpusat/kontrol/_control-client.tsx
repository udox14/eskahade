'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowClockwise, CheckCircle, MagnifyingGlass, ShieldCheck, Warning } from '@phosphor-icons/react'
import {
  EmptyState, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { retryOutboxAction, revokeFinanceSessionAction, updateFinanceSettingAction } from './actions'

const field='min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
const settingLabels:Record<string,string>={
  finance_payment_intent_ttl_hours:'Masa berlaku instruksi top-up (jam)',
  finance_soft_alerts:'Ambang peringatan lunak',
  finance_meal_cutoff:'Batas waktu pengembalian alokasi makan',
  finance_laundry_cutoff:'Batas waktu pengembalian alokasi laundry',
  finance_payout_api_fee_rupiah:'Biaya transfer payout API (rupiah)',
}
/** Penjelasan singkat tiap pengaturan; tanpa ini nilainya sekadar angka tanpa konteks. */
const settingHints:Record<string,string>={
  finance_payment_intent_ttl_hours:'Berapa lama instruksi pembayaran wali tetap berlaku sebelum kedaluwarsa. Isi 1–168 jam.',
  finance_soft_alerts:'Ambang yang memunculkan indikator di halaman ringkasan. Bukan penolakan transaksi — hanya penanda untuk diperiksa.',
  finance_meal_cutoff:'Tanggal dan jam tiap bulan sebagai batas terakhir alokasi makan dapat dikembalikan ke Titipan. Format: day 1–31, time HH:mm.',
  finance_laundry_cutoff:'Batas terakhir alokasi laundry dapat dikembalikan ke Titipan. Format: day 1–31, time HH:mm.',
  finance_payout_api_fee_rupiah:'Biaya yang dibebankan tiap transfer payout via API. Ditampilkan ke maker sebelum pengajuan.',
}
const prettyJson=(value:string)=>{try{return JSON.stringify(JSON.parse(value),null,2)}catch{return value}}

const TOUR:TourStep[]=[
  {target:'[data-tour="settings"]',title:'Pengaturan runtime',body:'Nilai di sini mengubah perilaku seluruh modul keuangan tanpa perlu deploy. Setiap perubahan divalidasi server dan tercatat di audit log.'},
  {target:'[data-tour="outbox"]',title:'Antrean event',body:'Notifikasi dan integrasi dikirim lewat antrean ini. Event berstatus FAILED bisa dicoba ulang; retry hanya mengembalikannya ke antrean, tidak mengubah transaksinya.'},
  {target:'[data-tour="sessions"]',title:'Sesi dan MFA staf',body:'Cabut sesi bila ada perangkat yang hilang atau akses mencurigakan. Pencabutan berlaku langsung.'},
  {target:'[data-tour="audit"]',title:'Audit trail',body:'Seluruh tindakan keuangan tersimpan lengkap dengan kondisi sebelum dan sesudahnya. Ini rujukan utama saat menelusuri selisih.'},
]

export function FinanceControlClient({data}:{data:any}){
  const router=useRouter()
  const[pending,startTransition]=useTransition()
  const[auditSearch,setAuditSearch]=useState('')
  const[auditEntity,setAuditEntity]=useState('ALL')
  const[result,setResult]=useState<FinanceResult|null>(null)
  const tour=useFinanceTour('kontrol')
  const entities=useMemo(()=>[...new Set<string>(data.audit.map((row:any)=>row.entity_type))].sort(),[data.audit])
  const filteredAudit=useMemo(()=>{
    const needle=auditSearch.trim().toLowerCase()
    return data.audit.filter((row:any)=>(auditEntity==='ALL'||row.entity_type===auditEntity)&&(!needle||[row.actor_name,row.action,row.entity_type,row.entity_id].some(value=>String(value||'').toLowerCase().includes(needle))))
  },[auditEntity,auditSearch,data.audit])
  const now=Number(data.nowMs)
  const failedOutbox=data.outbox.filter((row:any)=>row.status==='FAILED')
  const activeSessions=data.sessions.filter((row:any)=>!row.revoked_at&&new Date(row.expires_at).getTime()>now)
  const failedAuth=data.authTrend.reduce((sum:number,row:any)=>sum+Number(row.failed),0)

  const act=(work:()=>Promise<any>,success:string)=>startTransition(async()=>{
    try{
      const outcome=await work()
      if(!outcome?.success){
        const message=outcome?.error||'Tindakan gagal.'
        setResult({tone:'error',message})
        toast.error(message)
        return
      }
      setResult({tone:'success',message:success})
      toast.success(success)
      router.refresh()
    }catch(error){
      const message=error instanceof Error?error.message:'Tindakan gagal.'
      setResult({tone:'error',message})
      toast.error(message)
    }
  })

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish}/>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Audit dimuat" value={String(data.audit.length)} detail={data.canAudit?'500 aktivitas terbaru':'Khusus checker/auditor'} icon="fileSpreadsheet" tone="blue"/>
      <MetricCard label="Outbox gagal" value={String(failedOutbox.length)} detail={`${data.outbox.filter((row:any)=>row.status==='PENDING').length} event pending`} icon="listChecks" tone={failedOutbox.length?'amber':'emerald'}/>
      <MetricCard label="Sesi finance aktif" value={String(activeSessions.length)} detail={`${data.mfa.length} staf memiliki MFA`} icon="lock" tone="slate"/>
      <MetricCard label="Login gagal 14 hari" value={String(failedAuth)} detail="Agregat finance auth attempts" icon="checkCircle" tone={failedAuth?'amber':'emerald'}/>
    </section>

    <ResultBanner result={result} onDismiss={()=>setResult(null)}/>

    <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Pengaturan runtime" description="Nilai divalidasi di server dan setiap perubahan masuk audit log.">
        <div data-tour="settings" className="divide-y divide-slate-100">{data.settings.map((row:any)=><form key={row.key} action={form=>act(()=>updateFinanceSettingAction(form),'Pengaturan keuangan diperbarui.')} className="grid gap-2 p-4">
          <input type="hidden" name="key" value={row.key}/><div className="flex items-center justify-between gap-3"><label htmlFor={`setting-${row.key}`} className="text-xs font-bold text-slate-800">{settingLabels[row.key]||row.key}</label><span className="text-[10px] text-slate-400">{row.updated_at}</span></div>
          {settingHints[row.key]?<p className="text-[11px] leading-4 text-slate-500">{settingHints[row.key]}</p>:null}
          {row.value.trim().startsWith('{')?<textarea id={`setting-${row.key}`} name="value" rows={3} defaultValue={prettyJson(row.value)} readOnly={!data.canConfigure} className={`${field} py-2 font-mono text-xs`}/>:<input id={`setting-${row.key}`} name="value" defaultValue={row.value} readOnly={!data.canConfigure} className={field}/>} {data.canConfigure?<button disabled={pending} className="min-h-10 justify-self-end rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">Simpan</button>:null}
        </form>)}</div>
        {!data.canConfigure?<p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">Anda dapat melihat pengaturan, tetapi hanya bendahara pusat yang dapat mengubahnya.</p>:null}
      </SectionPanel>

      <SectionPanel title="Antrean event" description="Notifikasi dan integrasi dikirim lewat antrean ini; retry hanya mengembalikan event gagal ke antrean.">
        <div data-tour="outbox" className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">{data.outbox.length?data.outbox.map((row:any)=><article key={row.id} className="space-y-2 px-4 py-3 text-xs"><div className="flex items-start justify-between gap-3"><div><strong>{row.event_type}</strong><p className="text-slate-500">{row.aggregate_type} · {row.aggregate_id}</p></div><StatusBadge tone={row.status==='FAILED'?'red':row.status==='SENT'?'emerald':row.status==='PENDING'?'amber':'blue'}>{row.status}</StatusBadge></div><p className="text-slate-400">{row.created_at} · {row.attempts} percobaan</p>{row.last_error?<p className="rounded bg-red-50 p-2 text-red-700">{row.last_error}</p>:null}{data.canExecute&&row.status==='FAILED'?<button disabled={pending} onClick={()=>act(()=>retryOutboxAction(row.id),'Event dikembalikan ke antrean.')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 font-bold text-amber-800 disabled:opacity-50"><ArrowClockwise/>Coba kirim ulang</button>:null}</article>):<EmptyState icon={CheckCircle} title="Belum ada event" description="Antrean terisi otomatis saat transaksi keuangan terjadi. Kosong berarti belum ada yang perlu dikirim."/>}</div>
      </SectionPanel>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="MFA &amp; sesi staf" description="Kunci MFA tidak pernah dikirim ke layar; bendahara dapat mencabut sesi yang masih aktif.">
        <div className="border-b border-slate-100 p-4"><h3 className="text-xs font-bold">Cakupan MFA</h3><div className="mt-2 flex flex-wrap gap-2">{data.mfa.length?data.mfa.map((row:any)=><span key={row.user_id} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800"><strong>{row.user_name}</strong> · {row.method}</span>):<span className="text-xs text-amber-700">Belum ada staf finance dengan MFA tercatat.</span>}</div></div>
        <div data-tour="sessions" className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{data.sessions.length?data.sessions.map((row:any)=>{
          const active=!row.revoked_at&&new Date(row.expires_at).getTime()>now
          return <article key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs"><div><strong>{row.user_name}</strong><p className="text-slate-500">{row.created_at} — {row.expires_at}</p><p className="mt-1 max-w-md truncate text-[10px] text-slate-400">{row.user_agent||'User agent tidak tersedia'}</p></div><div className="text-right"><StatusBadge tone={active?'emerald':'slate'}>{active?'AKTIF':row.revoked_at?'DICABUT':'BERAKHIR'}</StatusBadge>{data.canConfigure&&active?<button disabled={pending} onClick={()=>act(()=>revokeFinanceSessionAction(row.id),'Sesi finance dicabut.')} className="mt-2 block min-h-9 rounded-lg border border-red-200 px-3 font-bold text-red-700 disabled:opacity-50">Cabut</button>:null}</div></article>
        }):<EmptyState icon={ShieldCheck} title="Belum ada sesi khusus keuangan" description="Sesi tercatat di sini saat staf masuk ke modul keuangan dengan verifikasi tambahan."/>}</div>
      </SectionPanel>

      <SectionPanel title="Percobaan autentikasi 14 hari" description="Agregat sukses/gagal tanpa mengekspos identity hash atau IP hash.">
        <div className="divide-y divide-slate-100">{data.authTrend.length?data.authTrend.map((row:any)=><div key={row.day} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 text-xs"><strong>{row.day}</strong><span className="text-emerald-700">{row.succeeded} sukses</span><span className={Number(row.failed)?'font-bold text-red-700':'text-slate-400'}>{row.failed} gagal</span></div>):<div className="p-10 text-center text-sm text-slate-500"><ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500"/>Belum ada percobaan autentikasi finance.</div>}</div>
      </SectionPanel>
    </section>

    {data.canAudit?<SectionPanel title="Audit trail keuangan" description="Cari berdasarkan pelaku, tindakan, jenis entitas, atau ID; buka satu baris untuk melihat kondisi sebelum dan sesudahnya.">
      <div data-tour="audit" className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[1fr_220px]"><label className="relative"><MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={auditSearch} onChange={event=>setAuditSearch(event.target.value)} placeholder="Cari aktor, action, tipe, atau ID" className={`${field} pl-9`}/></label><select value={auditEntity} onChange={event=>setAuditEntity(event.target.value)} className={field}><option value="ALL">Semua entitas</option>{entities.map(item=><option key={item}>{item}</option>)}</select></div>
      <div className="divide-y divide-slate-100">{filteredAudit.length?filteredAudit.map((row:any)=><details key={row.id}><summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[150px_170px_150px_1fr] sm:items-center"><span className="text-slate-500">{row.created_at}</span><strong>{row.actor_name}</strong><StatusBadge tone="blue">{row.action}</StatusBadge><span className="truncate">{row.entity_type} · {row.entity_id||'—'}</span></summary><div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2"><div><p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Sebelum</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-3 text-[10px]">{row.before_json?prettyJson(row.before_json):'—'}</pre></div><div><p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Sesudah</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-3 text-[10px]">{row.after_json?prettyJson(row.after_json):'—'}</pre></div></div></details>):<EmptyState icon={CheckCircle} title="Tidak ada aktivitas yang sesuai filter" description="Kosongkan kata kunci atau pilih semua entitas untuk melihat lebih banyak."/>}</div>
    </SectionPanel>:<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Warning className="mr-2 inline h-5 w-5"/>Audit trail terperinci hanya tersedia untuk checker Dewan Santri.</div>}
  </div>
}
