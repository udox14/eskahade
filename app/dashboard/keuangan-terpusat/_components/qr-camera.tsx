'use client'
import { useEffect,useRef,useState } from 'react'
import { BrowserQRCodeReader,type IScannerControls } from '@zxing/browser'
export function QrCamera({onScan}:{onScan:(value:string)=>void}){
 const video=useRef<HTMLVideoElement>(null),callback=useRef(onScan),[active,setActive]=useState(false),[error,setError]=useState('')
 useEffect(()=>{callback.current=onScan},[onScan])
 useEffect(()=>{
  if(!active||!video.current)return
  let cancelled=false,controls:IScannerControls|undefined
  const reader=new BrowserQRCodeReader()
  reader.decodeFromVideoDevice(undefined,video.current,(result,_error,control)=>{if(result&&!cancelled){control.stop();callback.current(result.getText());setActive(false)}}).then(c=>{controls=c;if(cancelled)c.stop()}).catch(()=>{if(!cancelled){setError('Kamera tidak dapat dibuka. Izinkan kamera atau gunakan scanner QR.');setActive(false)}})
  return()=>{cancelled=true;controls?.stop()}
 },[active])
 return <div className="space-y-2"><button type="button" className="min-h-11 rounded-md border px-4 text-sm font-medium" onClick={()=>{setError('');setActive(v=>!v)}}>{active?'Tutup kamera':'Pindai dengan kamera'}</button>{active&&<video ref={video} muted playsInline className="aspect-video w-full max-w-md rounded-lg bg-slate-950"/>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</div>
}
