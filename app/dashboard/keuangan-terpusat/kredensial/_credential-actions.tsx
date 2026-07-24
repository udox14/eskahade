'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { issueCredentialAction,markCredentialAction } from './actions'
import type { CredentialKind } from '@/lib/finance/types'

export function CredentialActions({id,santriId,kind,status}:{id:string;santriId:string;kind:CredentialKind;status:string}){
  const [pending,startTransition]=useTransition(),router=useRouter(),[reissueModal,setReissueModal]=useState(false)
  const mark=(next:'LOST'|'REVOKED'|'BLOCKED')=>startTransition(async()=>{const result=await markCredentialAction(id,next);if('error'in result)toast.error(result.error);else{toast.success(`Credential ditandai ${next}.`);router.refresh()}})
  const reissue=()=>{
    if(kind==='RFID_UID')setReissueModal(true)
    else if(window.confirm('Terbitkan QR baru dan cabut QR lama?')) startTransition(async()=>{
      const result=await issueCredentialAction({santriId,kind,reissue:true});if('error'in result)toast.error(result.error);else{toast.success('Credential pengganti diterbitkan.');router.refresh()}
    })
  }
  const submitReissueRfid=(rawToken:string)=>{
    if(!rawToken.trim())return
    setReissueModal(false)
    startTransition(async()=>{
      const result=await issueCredentialAction({santriId,kind,rawToken:rawToken.trim(),reissue:true});if('error'in result)toast.error(result.error);else{toast.success('Credential pengganti diterbitkan.');router.refresh()}
    })
  }
  return <div className="flex flex-wrap gap-1"><button disabled={pending} onClick={reissue} className="rounded-lg border px-2 py-1 font-bold">Terbitkan ulang</button>{status!=='BLOCKED'?<button disabled={pending} onClick={()=>mark('BLOCKED')} className="rounded-lg border px-2 py-1">Blokir</button>:null}<button disabled={pending} onClick={()=>mark('LOST')} className="rounded-lg border border-red-200 px-2 py-1 text-red-700">Hilang</button><button disabled={pending} onClick={()=>window.confirm('Cabut credential ini? Kartu tidak dapat dipakai lagi.')&&mark('REVOKED')} className="rounded-lg border border-red-200 px-2 py-1 text-red-700">Cabut</button>
    {reissueModal?<div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/75 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h3 className="font-bold text-lg">Ganti Kartu RFID</h3><p className="mt-1 text-xs text-slate-500">Scan kartu pengganti ke reader sekarang.</p><input autoFocus onBlur={e=>e.target.focus()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submitReissueRfid(e.currentTarget.value)}}} placeholder="Menunggu scan..." className="mt-4 min-h-12 w-full rounded-xl border-2 border-emerald-400 bg-white px-3 font-mono outline-none"/><div className="mt-4 flex justify-end"><button onClick={()=>setReissueModal(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500">Batal</button></div></div></div>:null}
  </div>
}
