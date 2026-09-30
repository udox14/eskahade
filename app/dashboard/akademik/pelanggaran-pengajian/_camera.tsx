'use client'
/* eslint-disable @next/next/no-img-element -- Object URLs are local camera previews, not remote images. */

import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, SwitchCamera } from 'lucide-react'
import { compressEvidencePhoto } from '@/lib/pengajian-violations/compress-photo-client'
import { button, ErrorMessage, Modal, primary } from './_components'

function BlobPreview({file,alt,className}:{file:File;alt:string;className:string}) {
 const image=useRef<HTMLImageElement>(null)
 useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url)},[file])
 return <img ref={image} alt={alt} className={className}/>
}

export function EvidenceCamera({onClose,onUse}:{onClose:()=>void;onUse:(file:File)=>void}) {
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null)
 const [facing,setFacing]=useState<'environment'|'user'>('environment')
 const [file,setFile]=useState<File|null>(null)
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
 useEffect(()=>{
  if(file)return
  let active=true
  setReady(false);setError('')
  async function start(){
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera memerlukan HTTPS dan peramban yang mendukungnya.')
    const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:960}}})
    if(!active){media.getTracks().forEach(track=>track.stop());return}
    stream.current=media
    if(video.current){video.current.srcObject=media;await video.current.play()}
   }catch(reason){
    if(!active)return
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null
    const name=reason instanceof Error?reason.name:''
    setError(name==='NotAllowedError'?'Izin kamera belum diberikan. Izinkan kamera untuk aplikasi ini, lalu coba lagi.':name==='NotFoundError'?'Kamera tidak ditemukan pada perangkat ini.':name==='NotReadableError'?'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.':reason instanceof Error?reason.message:'Kamera tidak dapat dibuka. Coba lagi.')
   }
  }
  void start()
  return()=>{active=false;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null}
 },[facing,file,attempt])
 async function capture(){
  const element=video.current
  if(!element||!ready||busy)return
  setBusy(true);setError('')
  try{
   const ratio=Math.min(1280/element.videoWidth,1280/element.videoHeight,1),canvas=document.createElement('canvas')
   canvas.width=Math.max(1,Math.round(element.videoWidth*ratio));canvas.height=Math.max(1,Math.round(element.videoHeight*ratio))
   const context=canvas.getContext('2d');if(!context)throw new Error('Pemotret tidak tersedia di peramban ini.')
   context.drawImage(element,0,0,canvas.width,canvas.height)
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.92))
   if(!blob)throw new Error('Foto gagal diambil. Silakan ulangi.')
   setFile(await compressEvidencePhoto(new File([blob],'capture.webp',{type:blob.type})))
  }catch(reason){setError(reason instanceof Error?reason.message:'Foto gagal diproses. Silakan ulangi.')}
  finally{setBusy(false)}
 }
 return <Modal title={file?'Periksa Foto':'Ambil Foto Kejadian'} description="Foto opsional. Pastikan objek terlihat jelas dan cukup terang." icon={<Camera size={20}/>} busy={busy} onClose={onClose} footer={<div className="flex w-full flex-wrap justify-between gap-3">{file?<><button type="button" className={button} onClick={()=>setFile(null)}><RefreshCw size={16}/>Ulangi</button><button type="button" className={primary} onClick={()=>onUse(file)}>Gunakan Foto</button></>:<><button type="button" className={button} disabled={busy} onClick={onClose}>Tanpa Foto</button><button type="button" className={primary} disabled={!ready||busy||!!error} onClick={()=>void capture()}><Camera size={17}/>{busy?'Memproses…':'Ambil Foto'}</button></>}</div>}>
  <div className="space-y-4">
   {error&&<ErrorMessage message={error}/>}
   <div className="relative overflow-hidden rounded-xl bg-slate-900">
    {file?<BlobPreview file={file} alt="Preview foto kejadian" className="max-h-[50dvh] w-full object-contain"/>:<><video ref={video} muted autoPlay playsInline onLoadedData={()=>setReady(true)} className={`aspect-[3/4] max-h-[50dvh] w-full object-contain ${facing==='user'?'[transform:scaleX(-1)]':''}`}/>{!ready&&!error&&<p role="status" className="absolute inset-0 flex items-center justify-center px-5 text-center text-sm text-white">Membuka kamera…</p>}</>}
   </div>
   {file?<p className="text-xs text-slate-500">WebP · {Math.ceil(file.size/1024)} KB · Disimpan selama 30 hari setelah diunggah.</p>:<div className="flex items-center justify-between gap-3"><p className="text-xs leading-5 text-slate-500">Kamera langsung di aplikasi. Foto otomatis diperkecil.</p><button type="button" className={button} disabled={busy} onClick={()=>error?setAttempt(n=>n+1):setFacing(current=>current==='environment'?'user':'environment')} aria-label={error?'Coba buka kamera lagi':'Ganti kamera'}>{error?<RefreshCw size={18}/>:<SwitchCamera size={18}/>}</button></div>}
  </div>
 </Modal>
}

export function EvidenceDraft({file,disabled,onCapture,onRemove}:{file:File|null;disabled?:boolean;onCapture:()=>void;onRemove:()=>void}) {
 return <section className="space-y-3 border-t border-slate-100 pt-5" aria-label="Foto kejadian opsional"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xs font-semibold text-slate-600">Foto kejadian (opsional)</h3><p className="mt-1 text-xs leading-5 text-slate-500">Otomatis WebP. Foto dihapus setelah 30 hari.</p></div><button type="button" className={button} disabled={disabled} onClick={onCapture}><Camera size={17}/>{file?'Ambil Ulang':'Ambil Foto'}</button></div>{file&&<div className="flex items-center gap-3"><BlobPreview file={file} alt="Foto kejadian yang akan disimpan" className="h-20 w-20 rounded-lg border border-slate-200 object-cover"/><div><p className="text-sm text-slate-600">WebP · {Math.ceil(file.size/1024)} KB</p><button type="button" className="min-h-11 text-xs font-semibold text-rose-600" disabled={disabled} onClick={onRemove}>Hapus Foto</button></div></div>}</section>
}
