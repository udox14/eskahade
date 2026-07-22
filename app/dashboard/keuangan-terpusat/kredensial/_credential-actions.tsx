'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { issueCredentialAction,markCredentialAction } from './actions'
import type { CredentialKind } from '@/lib/finance/types'

export function CredentialActions({id,santriId,kind,status}:{id:string;santriId:string;kind:CredentialKind;status:string}){
  const [pending,startTransition]=useTransition(),router=useRouter()
  const mark=(next:'LOST'|'REVOKED'|'BLOCKED')=>startTransition(async()=>{const result=await markCredentialAction(id,next);if('error'in result)toast.error(result.error);else{toast.success(`Credential ditandai ${next}.`);router.refresh()}})
  const reissue=()=>startTransition(async()=>{
    let rawToken:undefined|string
    if(kind==='RFID_UID'){rawToken=window.prompt('Tempel/scan kartu RFID pengganti, lalu tekan OK:')?.trim();if(!rawToken)return}
    else if(!window.confirm('Terbitkan QR baru dan cabut QR lama?'))return
    const result=await issueCredentialAction({santriId,kind,rawToken,reissue:true});if('error'in result)toast.error(result.error);else{toast.success('Credential pengganti diterbitkan.');router.refresh()}
  })
  return <div className="flex flex-wrap gap-1"><button disabled={pending} onClick={reissue} className="rounded-lg border px-2 py-1 font-bold">Terbitkan ulang</button>{status!=='BLOCKED'?<button disabled={pending} onClick={()=>mark('BLOCKED')} className="rounded-lg border px-2 py-1">Blokir</button>:null}<button disabled={pending} onClick={()=>mark('LOST')} className="rounded-lg border border-red-200 px-2 py-1 text-red-700">Hilang</button><button disabled={pending} onClick={()=>window.confirm('Cabut credential ini? Kartu tidak dapat dipakai lagi.')&&mark('REVOKED')} className="rounded-lg border border-red-200 px-2 py-1 text-red-700">Cabut</button></div>
}
