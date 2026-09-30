'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, BookOpen, Camera, ChevronDown, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { TableSkeleton } from '@/components/ui/skeletons'
import { formatWibDateTime } from '@/lib/date/wib'
import { SESSION_LABELS } from '@/lib/pengajian-violations/session'
import { cn } from '@/lib/utils'
import type { Bucket, Capabilities, Filters, Incident, Page } from '@/lib/pengajian-violations/types'

// Match Status Pembayaran; the dashboard shell owns outer page padding.
export const control = 'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50'
export const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'
export const primary = cn(button, 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700')
export const ghost = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 cursor-pointer'
const dialogs: HTMLElement[] = []
let originalOverflow = ''

export function Modal({ title, description, icon, children, footer, onClose, wide = false, busy = false }: {
  title: string; description?: string; icon?: ReactNode; children: ReactNode; footer?: ReactNode
  onClose: () => void; wide?: boolean; busy?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null), closeRef = useRef(onClose), busyRef = useRef(busy), id = useId()
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy }, [onClose, busy])
  useEffect(() => {
    const element = ref.current!, previous = document.activeElement as HTMLElement | null
    if (!dialogs.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    dialogs.push(element); element.focus()
    function key(event: KeyboardEvent) {
      if (dialogs.at(-1) !== element) return
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopImmediatePropagation(); if (!busyRef.current) closeRef.current() }
      if (event.key === 'Tab') {
        const items = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length)
        const first = items[0], last = items.at(-1)
        if (!first) { event.preventDefault(); element.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus() }
      }
    }
    function focus(event: FocusEvent) { if (dialogs.at(-1) === element && !element.contains(event.target as Node)) element.focus() }
    document.addEventListener('keydown', key); document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus)
      const index = dialogs.indexOf(element); if (index >= 0) dialogs.splice(index, 1)
      if (!dialogs.length) document.body.style.overflow = originalOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 300 + dialogs.length }}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" aria-hidden="true" onClick={() => { if (!busy) onClose() }} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={description ? `${id}-description` : undefined} tabIndex={-1}
        className={cn('relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none sm:max-h-[90dvh]', wide ? 'max-w-4xl' : 'max-w-2xl')}>
        <div className="h-1.5 shrink-0 bg-emerald-600" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">{icon || <BookOpen size={20} />}</div>
            <div className="min-w-0"><h2 id={id} className="text-base font-bold leading-tight text-slate-900">{title}</h2>{description && <p id={`${id}-description`} className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>
          </div>
          <button type="button" className={cn(ghost, 'shrink-0 px-2')} disabled={busy} onClick={onClose} aria-label="Tutup modal"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</footer>}
      </div>
    </div>, document.body,
  )
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="block text-xs font-semibold text-slate-600">{label}</span>{children}</label>
}
export function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{message}</p></div>
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-12 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><BookOpen size={20} /></div><p className="text-sm leading-6 text-slate-500">{children}</p></div>
}
export function ListLoading() {
  return <div role="status" aria-label="Memuat data"><div className="space-y-4 p-5 md:hidden">{[1, 2, 3].map(i => <div key={i} className="flex animate-pulse gap-3"><div className="h-14 w-10 rounded-lg bg-slate-100" /><div className="flex-1 space-y-2 py-1"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /><div className="h-3 w-3/4 rounded bg-slate-50" /></div></div>)}</div><div className="hidden md:block"><TableSkeleton rows={5} cols={5} /></div></div>
}
export function StudentIdentity({ student, large = false, placement = true }: {
  student: { nama_lengkap: string; nis: string; foto_url?: string | null; asrama?: string | null; kamar?: string | null }
  large?: boolean; placement?: boolean
}) {
  return <div className="flex min-w-0 items-center gap-3"><SantriPhotoAvatar src={student.foto_url} name={student.nama_lengkap} alt={`Foto ${student.nama_lengkap}`} size={large ? 'md' : 'sm'} clickable={false} />
    <div className="min-w-0"><p className={cn('break-words font-semibold text-slate-900 transition group-hover:text-emerald-700', large ? 'text-base sm:text-lg' : 'text-sm')}>{student.nama_lengkap}</p><p className="mt-0.5 text-xs text-slate-500">NIS {student.nis}</p>{placement && <p className="mt-0.5 text-xs text-slate-500">{student.asrama || 'Non-Asrama'}{student.kamar ? ` / ${student.kamar}` : ''}</p>}</div>
  </div>
}
export function Combobox({ items, value, onChange, label, disabled = false }: { items: { id: string; name: string }[]; value: string; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  const id = useId(), [open, setOpen] = useState(false), [search, setSearch] = useState(''), [active, setActive] = useState(0)
  const selected = items.find(r => r.id === value), matches = items.filter(r => r.name.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')))
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [id, active, open])
  function pick(index: number) { if (matches[index]) { onChange(matches[index].id); setOpen(false); setSearch('') } }
  return <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
    <div className="relative"><input className={cn(control, 'pr-9')} aria-label={label} disabled={disabled} role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
      value={open ? search : selected?.name ?? ''} placeholder="Cari dan pilih jenis pelanggaran…" autoComplete="off"
      onFocus={() => { setOpen(true); setSearch(''); setActive(0) }} onChange={e => { setSearch(e.target.value); setOpen(true); setActive(0) }} onKeyDown={e => {
        if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(n => Math.max(0, Math.min(matches.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1)))) }
        if (e.key === 'Enter' && open) { e.preventDefault(); pick(active) }
      }} /><ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-slate-400" /></div>
    {open && <div id={id} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{matches.map((item, index) => <button key={item.id} id={`${id}-${index}`} role="option" aria-selected={item.id === value} type="button" tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => pick(index)} className={cn('min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm', index === active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50')}>{item.name}</button>)}{!matches.length && <p className="p-3 text-sm text-slate-500">Jenis tidak ditemukan.</p>}</div>}
  </div>
}
export function Pager({ data, onPage, noun = 'catatan' }: { data: Page<unknown>; onPage: (page: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(data.total / 30)), start = data.total ? (data.page - 1) * 30 + 1 : 0, end = Math.min(data.page * 30, data.total)
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3.5 sm:px-5"><p className="text-xs text-slate-500">{start}–{end} dari {data.total} {noun}</p><div className="flex items-center gap-2"><span className="mr-1 text-xs text-slate-500">{data.page} / {pages}</span><button className={cn(button, 'min-w-11 px-2.5 py-2')} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></button><button className={cn(button, 'min-w-11 px-2.5 py-2')} disabled={data.page >= pages} onClick={() => onPage(data.page + 1)} aria-label="Halaman berikutnya"><ChevronRight size={16} /></button></div></div>
}
function Actions({ row, cap, onEdit, onCancel }: { row: Incident; cap: Capabilities | null; onEdit: (row: Incident) => void; onCancel: (row: Incident) => void }) {
  if (!cap || row.status === 'cancelled' || (!cap.manage && row.created_by !== cap.userId)) return null
  return <div className="flex items-center justify-end gap-1">{cap.update && <button className={ghost} onClick={() => onEdit(row)} aria-label={`Koreksi pelanggaran ${row.nama_lengkap}`}><Pencil size={14} /><span>Koreksi</span></button>}{cap.cancel && <button className={cn(ghost, 'text-rose-600 hover:bg-rose-50 hover:text-rose-700')} onClick={() => onCancel(row)} aria-label={`Batalkan pelanggaran ${row.nama_lengkap}`}><X size={14} /><span className="sr-only sm:not-sr-only">Batalkan</span></button>}</div>
}
function EvidencePhoto({row}:{row:Incident}) {
 const [open,setOpen]=useState(false),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false)
 const [expired,setExpired]=useState(()=>!!row.evidence_expires_at&&Date.parse(row.evidence_expires_at)<=Date.now())
 useEffect(()=>{
  if(!row.evidence_expires_at)return
  let timer:ReturnType<typeof setTimeout>
  function schedule(){const remaining=Date.parse(row.evidence_expires_at!)-Date.now();timer=setTimeout(()=>{if(remaining<=0){setExpired(true);setOpen(false)}else schedule()},Math.min(Math.max(remaining,0),86400000))}
  schedule();return()=>clearTimeout(timer)
 },[row.evidence_expires_at])
 if(!row.evidence_expires_at)return null
 if(!row.evidence_url||expired)return <p className="mt-2 text-xs text-slate-400">Foto telah melewati masa simpan 30 hari.</p>
 // eslint-disable-next-line @next/next/no-img-element -- Private evidence must use its authenticated no-store route without an image cache.
 return <><button type="button" className={ghost+' mt-1'} onClick={()=>{setFailed(false);setLoaded(false);setOpen(true)}}><Camera size={14}/>Lihat Foto Kejadian</button>{open&&<Modal title="Foto Kejadian" description={`${row.nama_lengkap} · ${row.type_name}`} icon={<Camera size={20}/>} onClose={()=>setOpen(false)} footer={<button className={button} onClick={()=>setOpen(false)}>Tutup</button>}><div className="space-y-4">{failed?<ErrorMessage message="Foto tidak tersedia atau sudah melewati masa simpan."/>:<>{!loaded&&<p role="status" className="text-sm text-slate-500">Memuat foto…</p>}{/* Authenticated, no-store image. Next image optimization must not cache evidence. */}<img src={row.evidence_url} alt={`Foto kejadian ${row.type_name} — ${row.nama_lengkap}`} className="max-h-[60dvh] w-full rounded-xl object-contain" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/></>}<p className="text-xs text-slate-500">Tersedia hingga {formatWibDateTime(row.evidence_expires_at)}. Catatan pelanggaran tetap tersimpan.</p></div></Modal>}</>
}
export function SortHeading({ label, sort, filters, onSort }: { label: string; sort: Filters['sort']; filters?: Filters; onSort?: (sort: Filters['sort']) => void }) {
  return onSort ? <button className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition hover:text-slate-800" onClick={() => onSort(sort)}>{label}{filters && filters.sort === sort && <span aria-label={filters.direction === 'asc' ? 'Menaik' : 'Menurun'}>{filters.direction === 'asc' ? '↑' : '↓'}</span>}</button> : <span>{label}</span>
}
export function IncidentList({ data, cap, onEdit, onCancel, onStudent, filters, onSort, compact = false }: {
  data: Page<Incident>; cap: Capabilities | null; onEdit: (row: Incident) => void; onCancel: (row: Incident) => void
  onStudent?: (id: string) => void; filters?: Filters; onSort?: (sort: Filters['sort']) => void; compact?: boolean
}) {
  if (!data.rows.length) return <Empty>Belum ada catatan pelanggaran yang sesuai filter.<br />Sesuaikan filter untuk melihat riwayat lainnya.</Empty>
  const identity = (row: Incident) => onStudent ? <button className="group block w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-emerald-500" onClick={() => onStudent(row.santri_id)}><StudentIdentity student={row} /></button> : <StudentIdentity student={row} />
  return <><div className={cn('divide-y divide-slate-100', !compact && 'md:hidden')}>{data.rows.map(row => <article key={row.id} className="space-y-3 px-4 py-4 sm:px-5">{identity(row)}<div className="space-y-1.5"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-semibold text-slate-800">{row.type_name}</p>{row.status === 'cancelled' && <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">Dibatalkan</span>}</div><p className="text-xs leading-5 text-slate-500">{formatWibDateTime(row.occurred_at)} · {SESSION_LABELS[row.session]}</p><p className="text-xs text-slate-400">Dicatat oleh {row.actor_name}</p>{(row.note || row.reason) && <details className="text-xs text-slate-500"><summary className="min-h-8 cursor-pointer py-1 font-medium">Catatan kejadian</summary>{row.note && <p className="whitespace-pre-wrap break-words py-1 leading-5">{row.note}</p>}{row.reason && <p className="py-1 leading-5">Alasan {row.status === 'cancelled' ? 'pembatalan' : 'koreksi'}: {row.reason}</p>}</details>}</div><div className="flex flex-wrap items-center justify-between gap-1"><EvidencePhoto row={row}/><Actions row={row} cap={cap} onEdit={onEdit} onCancel={onCancel} /></div></article>)}</div>
    {!compact && <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm text-slate-600"><thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="py-1 pl-5 pr-3"><SortHeading label="Santri" sort="name" filters={filters} onSort={onSort} /></th><th scope="col" className="px-3 py-1"><SortHeading label="Pelanggaran" sort="type" filters={filters} onSort={onSort} /></th><th scope="col" className="px-3 py-1"><SortHeading label="Waktu & sesi" sort="time" filters={filters} onSort={onSort} /></th><th scope="col" className="px-3 py-1"><SortHeading label="Pencatat" sort="actor" filters={filters} onSort={onSort} /></th><th scope="col" className="py-3.5 pl-3 pr-5 text-right">Tindakan</th></tr></thead><tbody className="divide-y divide-slate-100">{data.rows.map(row => <tr key={row.id} className="transition-colors hover:bg-slate-50/90"><td className="py-3.5 pl-5 pr-3">{identity(row)}</td><td className="max-w-xs px-3 py-3.5"><p className="break-words font-medium text-slate-800">{row.type_name}</p>{row.status === 'cancelled' && <span className="mt-1 inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">Dibatalkan</span>}{(row.note || row.reason) && <details className="mt-1 text-xs"><summary className="cursor-pointer py-1 text-slate-400">Catatan</summary><p className="whitespace-pre-wrap break-words leading-5">{row.note}</p>{row.reason && <p className="mt-1 leading-5">Alasan: {row.reason}</p>}</details>}<EvidencePhoto row={row}/></td><td className="whitespace-nowrap px-3 py-3.5 text-xs"><p>{formatWibDateTime(row.occurred_at)}</p><p className="mt-1 text-slate-400">{SESSION_LABELS[row.session]}</p></td><td className="px-3 py-3.5 text-xs">{row.actor_name}</td><td className="py-3.5 pl-3 pr-4"><Actions row={row} cap={cap} onEdit={onEdit} onCancel={onCancel} /></td></tr>)}</tbody></table></div>}
  </>
}
export function Bars({ title, rows, onPick }: { title: string; rows: Bucket[]; onPick?: (row: Bucket) => void }) {
  const max = Math.max(1, ...rows.map(r => r.count)), total = rows.reduce((sum, r) => sum + r.count, 0)
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-400">{total} kejadian · {rows.length} kelompok</p><div className="mt-5 max-h-72 space-y-4 overflow-y-auto">{!rows.length && <p className="py-6 text-sm text-slate-500">Belum ada kejadian pada periode ini.</p>}{rows.map(row => { const label = row.key in SESSION_LABELS ? SESSION_LABELS[row.key as keyof typeof SESSION_LABELS] : row.label; const content = <><div className="mb-2 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{label}</span><span className="font-semibold tabular-nums text-slate-900">{row.count}</span></div><div className="h-1.5 rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.count / max * 100}%` }} /></div></>; return onPick ? <button className="block min-h-11 w-full rounded text-left focus-visible:outline-2 focus-visible:outline-emerald-500" key={row.key} onClick={() => onPick(row)}>{content}</button> : <div key={row.key}>{content}</div> })}</div></section>
}
