'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, ShieldWarning as ShieldAlert } from '@phosphor-icons/react'
import { SectionPanel, StatusBadge } from '../_components/finance-ui'
import { activateBreakGlass, reviewBreakGlass, revokeBreakGlass } from './actions'

export function BreakGlassClient({data}:{data:any}){
  const router=useRouter()
  const[pending,startTransition]=useTransition()
  const act=(work:()=>Promise<any>,success:string)=>startTransition(async()=>{
    try{
      const result=await work()
      if(!result?.success){toast.error(result?.error||'Tindakan gagal.');return}
      toast.success(success)
      router.refresh()
    }catch(error){toast.error(error instanceof Error?error.message:'Tindakan gagal.')}
  })
  const now=Number(data.nowMs)
  return <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
    {data.canActivate?<form action={form=>act(()=>activateBreakGlass(form),'Akses break-glass aktif selama 30 menit.')} className="h-fit rounded-xl border border-red-200 bg-red-50/70 p-4">
      <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700"/><div><h2 className="text-sm font-bold text-red-900">Aktifkan akses darurat</h2><p className="mt-1 text-xs leading-relaxed text-red-700">Semua aktivitas selama akses aktif tetap tercatat dan wajib direview checker.</p></div></div>
      <label className="mt-4 block text-xs font-bold text-slate-700">Alasan insiden<textarea name="reason" required minLength={20} placeholder="Jelaskan insiden, dampak, dan mengapa akses teknis diperlukan..." className="mt-1.5 block min-h-28 w-full rounded-lg border border-red-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-red-500"/></label>
      <button disabled={pending} className="mt-3 min-h-11 w-full rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50">Aktifkan selama 30 menit</button>
    </form>:<div className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"><ShieldAlert className="mx-auto mb-2 h-8 w-8 text-slate-300"/>Akun ini tidak memenuhi syarat aktivasi break-glass. Akses darurat hanya untuk admin teknis tanpa role keuangan native.</div>}
    <SectionPanel title="Riwayat akses darurat" description="Checker meninjau setiap aktivasi; akses aktif dapat dicabut sebelum 30 menit.">
      <div className="divide-y divide-slate-100">{data.rows.length?data.rows.map((row:any)=>{
        const active=!row.revoked_at&&new Date(row.expires_at).getTime()>now
        return <article key={row.id} className="space-y-3 px-4 py-3 text-xs"><div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"><strong className="break-words text-slate-800">{row.full_name||row.user_id}</strong><div className="flex gap-2"><StatusBadge tone={active?'red':'slate'}>{active?'AKTIF':row.revoked_at?'DICABUT':'BERAKHIR'}</StatusBadge><StatusBadge tone={row.reviewed_at?'emerald':'amber'}>{row.reviewed_at?'Direview':'Menunggu review'}</StatusBadge></div></div><p className="break-words text-slate-700">{row.reason}</p><p className="tabular-nums text-slate-400">{row.starts_at} — {row.expires_at}</p><div className="flex flex-wrap gap-2">{data.canReview&&!row.reviewed_at&&row.user_id!==data.currentUserId?<button disabled={pending} onClick={()=>act(()=>reviewBreakGlass(row.id),'Aktivasi break-glass direview.')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 font-bold text-white disabled:opacity-50"><CheckCircle/>Tandai direview</button>:null}{active&&(data.canReview||row.user_id===data.currentUserId)?<button disabled={pending} onClick={()=>act(()=>revokeBreakGlass(row.id),'Akses break-glass dicabut.')} className="min-h-10 rounded-lg border border-red-200 bg-red-50 px-3 font-bold text-red-700 disabled:opacity-50">Cabut akses</button>:null}</div></article>
      }):<p className="p-10 text-center text-sm text-slate-500">Belum pernah ada aktivasi break-glass.</p>}</div>
    </SectionPanel>
  </div>
}
