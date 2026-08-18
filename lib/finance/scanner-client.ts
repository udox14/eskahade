'use client'

import { useEffect, useRef } from 'react'

// Hanya QR yang berlaku. Token sah selalu berawalan SKH1.; apa pun selain itu
// bukan kredensial yang bisa dipakai di loket dan ditolak resolver.
export function isQrToken(token:string){return token.trim().startsWith('SKH1.')}

export function useKeyboardWedgeScanner(onScan:(value:string)=>void,enabled=true){
  const callback=useRef(onScan),buffer=useRef(''),lastKeyAt=useRef(0)
  useEffect(()=>{callback.current=onScan},[onScan])
  useEffect(()=>{
    if(!enabled)return
    const handler=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null
      if(target&&(target.matches('input,textarea,select')||target.isContentEditable))return
      const now=Date.now()
      if(now-lastKeyAt.current>120)buffer.current=''
      lastKeyAt.current=now
      if(event.key==='Enter'){
        const value=buffer.current.trim();buffer.current=''
        if(value.length>=4){event.preventDefault();callback.current(value)}
        return
      }
      if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey)buffer.current+=event.key
    }
    window.addEventListener('keydown',handler)
    return()=>window.removeEventListener('keydown',handler)
  },[enabled])
}
