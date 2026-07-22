'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { Camera, X } from '@phosphor-icons/react'

export function QrCameraScanner({onScan,label='Scan QR dengan kamera'}:{onScan:(token:string)=>void;label?:string}){
  const [open,setOpen]=useState(false),[error,setError]=useState(''),videoRef=useRef<HTMLVideoElement>(null),controlsRef=useRef<IScannerControls|null>(null)
  useEffect(()=>{
    if(!open)return
    let cancelled=false
    const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:150})
    reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},videoRef.current||undefined,(result)=>{
      if(result&&!cancelled){const value=result.getText().trim();controlsRef.current?.stop();setOpen(false);onScan(value)}
    }).then(controls=>{if(cancelled)controls.stop();else controlsRef.current=controls}).catch(err=>{setError(err?.name==='NotAllowedError'?'Izin kamera ditolak. Izinkan kamera lalu coba lagi.':'Kamera tidak tersedia atau tidak dapat dibuka.');setOpen(false)})
    return()=>{cancelled=true;controlsRef.current?.stop();controlsRef.current=null}
  },[open,onScan])
  return <>
    <button type="button" onClick={()=>{setError('');setOpen(true)}} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold text-emerald-800 sm:min-h-0"><Camera className="h-4 w-4"/>{label}</button>
    {error?<p className="mt-2 text-xs text-red-700">{error}</p>:null}
    {open?<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">Arahkan kamera ke QR</h2><p className="text-xs text-slate-500">Pemindaian berhenti otomatis setelah QR terbaca.</p></div><button type="button" onClick={()=>setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><X className="h-5 w-5"/></button></div><video ref={videoRef} muted playsInline className="aspect-square w-full rounded-xl bg-black object-cover"/></div></div>:null}
  </>
}
