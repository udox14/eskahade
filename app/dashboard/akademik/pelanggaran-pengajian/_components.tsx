'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatWibDateTime } from '@/lib/date/wib'
import { cn } from '@/lib/utils'
import type { Bucket, Capabilities, Incident, Page } from '@/lib/pengajian-violations/types'

export const control='min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50'
export const button='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50'
export const primary=cn(button,'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800')
const dialogs: HTMLElement[]=[]
let originalOverflow=''

export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
 const ref=useRef<HTMLDivElement>(null); const closeRef=useRef(onClose); const id=useId()
 useEffect(()=>{closeRef.current=onClose},[onClose])
 useEffect(()=>{
  const element=ref.current!; const previous=document.activeElement as HTMLElement|null
  if (!dialogs.length) { originalOverflow=document.body.style.overflow; document.body.style.overflow='hidden' }
  dialogs.push(element)
  const focusable=()=>Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length)
  element.focus()
  function key(event:KeyboardEvent) {
   if (dialogs.at(-1)!==element) return
   if (event.key==='Escape' && !event.defaultPrevented) {event.preventDefault();event.stopImmediatePropagation();closeRef.current()}
   if (event.key==='Tab') {
    const items=focusable(); const first=items[0]; const last=items.at(-1)
    if (!first) {event.preventDefault();element.focus();return}
    if (event.shiftKey && (document.activeElement===first || document.activeElement===element)) {event.preventDefault();last?.focus()}
    else if (!event.shiftKey && (document.activeElement===last || document.activeElement===element)) {event.preventDefault();first.focus()}
   }
  }
  function focus(event:FocusEvent) {if(dialogs.at(-1)===element && !element.contains(event.target as Node)) element.focus()}
  document.addEventListener('keydown',key);document.addEventListener('focusin',focus)
  return ()=>{
   document.removeEventListener('keydown',key);document.removeEventListener('focusin',focus)
   const index=dialogs.indexOf(element);if(index>=0)dialogs.splice(index,1)
   if (!dialogs.length) document.body.style.overflow=originalOverflow
   if(previous?.isConnected)previous.focus()
  }
 },[])
 if(typeof document==='undefined') return null
 return createPortal(<div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-5" style={{zIndex:100+dialogs.length}}>
  <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white outline-none sm:max-h-[90dvh] sm:rounded-2xl ${wide?'sm:max-w-4xl':'sm:max-w-xl'}`}>
   <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6"><h2 id={id} className="text-lg font-semibold text-slate-900">{title}</h2><button className={button+' shrink-0'} onClick={onClose} aria-label="Tutup modal"><X size={18}/></button></header>
   <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
  </div>
 </div>,document.body)
}
export function Field({label,children}:{label:string;children:ReactNode}) {return <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>}
export function ErrorMessage({message}:{message:string}) {return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}
export function Empty({children}:{children:ReactNode}) {return <p className="py-12 text-center text-sm text-slate-500">{children}</p>}
export function Combobox({items,value,onChange,label,disabled=false}:{items:{id:string;name:string}[];value:string;onChange:(value:string)=>void;label:string;disabled?:boolean}) {
 const id=useId(); const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const [active,setActive]=useState(0)
 const selected=items.find(r=>r.id===value)
 const matches=items.filter(r=>r.name.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')))
 useEffect(()=>{if(open)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'})},[id,active,open])
 useEffect(()=>{if(open)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'})},[id,active,open])
 function pick(index:number) {if(matches[index]){onChange(matches[index].id);setOpen(false);setSearch('')}}
 return <div className="relative" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}>
  <div className="relative"><input className={control+' pr-9'} aria-label={label} disabled={disabled} role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?`${id}-${active}`:undefined} value={open?search:selected?.name??''} placeholder="Cari dan pilih jenis…" autoComplete="off"
   onFocus={()=>{setOpen(true);setSearch('');setActive(0)}} onChange={e=>{setSearch(e.target.value);setOpen(true);setActive(0)}} onKeyDown={e=>{
    if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false)}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(matches.length-1,n+(e.key==='ArrowDown'?1:-1))))}
    if(e.key==='Enter'&&open){e.preventDefault();pick(active)}
   }}/><ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-slate-400"/></div>
  {open&&<div id={id} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
   {matches.map((item,index)=><button key={item.id} id={`${id}-${index}`} role="option" aria-selected={item.id===value} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>pick(index)} className={`min-h-11 w-full px-3 py-2 text-left text-sm ${index===active?'bg-emerald-50 text-emerald-900':'text-slate-700'}`}>{item.name}</button>)}
   {!matches.length&&<p className="p-3 text-sm text-slate-500">Jenis tidak ditemukan.</p>}
  </div>}
 </div>
}
export function Pager({data,onPage}:{data:Page<unknown>;onPage:(page:number)=>void}) {
 const pages=Math.max(1,Math.ceil(data.total/30))
 return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{data.total} catatan · Halaman {data.page} dari {pages}</span><div className="flex gap-2"><button className={button} disabled={data.page<=1} onClick={()=>onPage(data.page-1)} aria-label="Halaman sebelumnya"><ChevronLeft size={16}/></button><button className={button} disabled={data.page>=pages} onClick={()=>onPage(data.page+1)} aria-label="Halaman berikutnya"><ChevronRight size={16}/></button></div></div>
}
function Actions({row,cap,onEdit,onCancel}:{row:Incident;cap:Capabilities|null;onEdit:(row:Incident)=>void;onCancel:(row:Incident)=>void}) {
 if(!cap||row.status==='cancelled'||(!cap.manage&&row.created_by!==cap.userId))return null
 return <div className="flex flex-wrap gap-1">{cap.update&&<button className={button} onClick={()=>onEdit(row)}>Koreksi</button>}{cap.cancel&&<button className={button+' text-rose-700'} onClick={()=>onCancel(row)}>Batalkan</button>}</div>
}
export function IncidentList({data,cap,onEdit,onCancel,onStudent}:{data:Page<Incident>;cap:Capabilities|null;onEdit:(row:Incident)=>void;onCancel:(row:Incident)=>void;onStudent?:(id:string)=>void}) {
 if(!data.rows.length)return <Empty>Belum ada catatan yang sesuai filter.</Empty>
 const name=(row:Incident)=>onStudent?<button className="min-h-11 text-left font-semibold text-emerald-800 hover:underline" onClick={()=>onStudent(row.santri_id)}>{row.nama_lengkap}</button>:<span className="font-semibold">{row.nama_lengkap}</span>
 return <>
  <div className="divide-y divide-slate-100 md:hidden">{data.rows.map(row=><article key={row.id} className="space-y-2 py-4">
   <div>{name(row)}<p className="text-xs text-slate-500">{row.nis} · {row.asrama||'Tanpa asrama'}{row.kamar?` / ${row.kamar}`:''}</p></div>
   <p className="text-sm font-medium text-slate-800">{row.type_name}{row.status==='cancelled'&&<span className="ml-2 text-rose-700">Dibatalkan</span>}</p>
   <p className="text-xs text-slate-500">{formatWibDateTime(row.occurred_at)} · <span className="capitalize">{row.session}</span> · {row.actor_name}</p>
   {row.note&&<p className="whitespace-pre-wrap break-words text-sm text-slate-600">{row.note}</p>}
   {row.reason&&<p className="text-xs text-slate-500">Alasan {row.status==='cancelled'?'pembatalan':'koreksi'}: {row.reason}</p>}
   <Actions row={row} cap={cap} onEdit={onEdit} onCancel={onCancel}/>
  </article>)}</div>
  <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr>{['Santri','Kejadian','Waktu & sesi','Pencatat','Tindakan'].map(h=><th className="px-3 py-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.rows.map(row=><tr key={row.id}>
   <td className="px-3 py-3">{name(row)}<p className="text-xs text-slate-500">{row.nis} · {row.asrama||'Tanpa asrama'} / {row.kamar||'—'}</p></td>
   <td className="max-w-xs px-3 py-3"><p className="font-medium text-slate-800">{row.type_name}</p>{row.status==='cancelled'&&<p className="text-xs text-rose-700">Dibatalkan</p>}<p className="whitespace-pre-wrap break-words text-xs text-slate-500">{row.note}</p>{row.reason&&<p className="mt-1 text-xs text-slate-500">Alasan: {row.reason}</p>}</td>
   <td className="px-3 py-3 text-xs text-slate-600">{formatWibDateTime(row.occurred_at)}<p className="mt-1 capitalize">{row.session}</p></td><td className="px-3 py-3 text-xs text-slate-600">{row.actor_name}</td><td className="px-3 py-3"><Actions row={row} cap={cap} onEdit={onEdit} onCancel={onCancel}/></td>
  </tr>)}</tbody></table></div>
 </>
}
export function Bars({title,rows,onPick}:{title:string;rows:Bucket[];onPick?:(row:Bucket)=>void}) {
 const max=Math.max(1,...rows.map(r=>r.count));const total=rows.reduce((sum,r)=>sum+r.count,0)
 return <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">{title}</h3><p className="text-xs text-slate-500">{total} kejadian pada {rows.length} kelompok yang ditampilkan.</p><div className="max-h-72 space-y-3 overflow-y-auto">
  {!rows.length&&<p className="py-4 text-sm text-slate-500">Belum ada data.</p>}
  {rows.map(row=>{const content=<><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate capitalize">{row.label}</span><span className="font-semibold tabular-nums">{row.count}</span></div><div className="h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-emerald-600" style={{width:`${row.count/max*100}%`}}/></div></>
   return onPick?<button className="block min-h-11 w-full text-left focus-visible:outline-2 focus-visible:outline-emerald-600" key={row.key} onClick={()=>onPick(row)}>{content}</button>:<div key={row.key}>{content}</div>
  })}
 </div></section>
}
