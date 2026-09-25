'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUp, House, Megaphone, Menu, RefreshCw, Settings2, X } from 'lucide-react'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { getIcon, getMenuTitle } from '@/lib/menu/config'
import { useDashboardMenu } from '@/components/layout/menu-context'
import type { HeroConfig, TickerConfig } from '@/lib/dashboard/config'
import type { DashboardWidgetData } from '@/lib/dashboard/data'
import { refreshDashboardWidgets, saveDashboardShortcuts } from './actions'
import './home.css'

type Props = {
  userName: string
  greeting: string
  dateLabel: string
  isAdmin: boolean
  menu: FiturAkses[]
  initialShortcuts: FiturAkses[]
  initialWidgets: DashboardWidgetData[]
  hero: HeroConfig
  ticker: TickerConfig
}

function HeroPhoto({ hero }: { hero: HeroConfig }) {
  const image = (mode: 'desktop' | 'mobile') => {
    const crop = hero[mode]
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={hero.imageUrl} alt="" aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover ${mode === 'desktop' ? 'hidden md:block' : 'md:hidden'}`}
        style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} />
    )
  }
  return <>{image('desktop')}{image('mobile')}</>
}

export function HomeClient({ userName, greeting, dateLabel, isAdmin, menu, initialShortcuts, initialWidgets, hero, ticker }: Props) {
  const openMenu = useDashboardMenu()
  const [shortcuts, setShortcuts] = useState(initialShortcuts)
  const [draft, setDraft] = useState<number[]>([])
  const [filter, setFilter] = useState('')
  const [widgets, setWidgets] = useState(initialWidgets)
  const [busy, setBusy] = useState<'shortcuts' | 'widgets' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onClose = () => { setFilter(''); setDraft([]) }
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [])

  const editShortcuts = () => {
    setDraft(shortcuts.map(item => item.id))
    setMessage(null)
    dialogRef.current?.showModal()
  }
  const toggleDraft = (id: number) => {
    setDraft(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 8 ? [...current, id] : current)
  }
  const moveDraft = (id: number, direction: number) => {
    const index = draft.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= draft.length) return
    const next = [...draft]
    ;[next[index], next[target]] = [next[target], next[index]]
    setDraft(next)
  }
  const saveShortcuts = async () => {
    setBusy('shortcuts')
    try {
      await saveDashboardShortcuts(draft)
      const byId = new Map(menu.map(item => [item.id, item]))
      setShortcuts(draft.map(id => byId.get(id)).filter((item): item is FiturAkses => !!item))
      dialogRef.current?.close()
      setMessage('Pintasan berhasil disimpan.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan pintasan.') }
    finally { setBusy(null) }
  }
  const refresh = async () => {
    setBusy('widgets'); setMessage(null)
    try { setWidgets(await refreshDashboardWidgets()); setMessage('Ringkasan sudah diperbarui.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memperbarui widget.') }
    finally { setBusy(null) }
  }
  const firstName = userName.split(' ')[0] || userName
  const filteredMenu = menu.filter(item => item.href !== '/dashboard' &&
    `${item.title} ${item.group_name}`.toLocaleLowerCase('id').includes(filter.toLocaleLowerCase('id')))
  const whiteText = hero.textColor === 'white'

  return (
    <div className="dashboard-home min-h-full bg-[#f7f1e5] text-[#1c2923]">
      <section className={`relative isolate h-[370px] overflow-hidden bg-[#12372a] sm:h-[410px] md:h-[390px] ${whiteText ? 'text-white' : 'text-black'}`}>
        <HeroPhoto hero={hero} />
        <div className={`absolute inset-0 ${whiteText ? 'bg-gradient-to-r from-black/75 via-black/35 to-black/5' : 'bg-gradient-to-r from-white/85 via-white/45 to-white/5'}`} />
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-5 pb-8 pt-6 sm:px-8 md:px-10 md:pb-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-current/40"><House className="h-4 w-4" aria-hidden="true" /></span>
              <span className="font-serif text-lg font-semibold tracking-[0.09em] sm:text-xl">ESKAHADE</span>
            </div>
            <div className={whiteText ? "flex items-center gap-2 rounded-full bg-black/60 p-1 backdrop-blur-sm" : "flex items-center gap-2 rounded-full bg-white/85 p-1 backdrop-blur-sm"}>
              {isAdmin && <Link href="/dashboard/pengaturan/dashboard" title="Pengaturan dashboard" aria-label="Pengaturan dashboard" className="rounded-full border border-current/35 p-2.5 hover:bg-white/15"><Settings2 className="h-4 w-4" /></Link>}
              <button onClick={openMenu} title="Buka seluruh menu" aria-label="Buka seluruh menu" className="rounded-full border border-current/35 p-2.5 hover:bg-white/15 md:hidden"><Menu className="h-4 w-4" /></button>
              <Link href="/dashboard/profil" title="Profil saya" aria-label="Profil saya" className="flex h-10 w-10 items-center justify-center rounded-full border border-current/40 text-sm font-bold hover:bg-white/15">{firstName.slice(0, 1).toUpperCase()}</Link>
            </div>
          </div>
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-medium tracking-wide opacity-90">{dateLabel}</p>
            <h1 className="font-serif text-[clamp(2.25rem,5vw,4.4rem)] font-semibold leading-[1.08] tracking-tight">{greeting},<br />{firstName}</h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed opacity-95 sm:text-base">Kelola kegiatan pesantren dengan jelas, tenang, dan penuh perhatian.</p>
            <div className="mt-5 h-px w-14 bg-[#c9952e]" />
          </div>
        </div>
      </section>

      {ticker.text && <div className="dashboard-ticker flex min-h-11 items-center overflow-hidden px-4" style={{ backgroundColor: ticker.backgroundColor, color: ticker.textColor }}>
        <Megaphone className="mr-3 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="mr-4 shrink-0 text-xs font-bold uppercase tracking-wider">Pengumuman</span>
        <div className="dashboard-ticker-window flex-1 overflow-hidden"><div className="dashboard-ticker-track whitespace-nowrap text-sm" aria-label={ticker.text}>{ticker.text}<span aria-hidden="true" className="mx-16">•</span><span aria-hidden="true">{ticker.text}</span></div></div>
      </div>}

      <div className="mx-auto max-w-7xl space-y-9 px-4 py-8 sm:px-8 md:px-10 md:py-10">
        {message && <p role="status" className="rounded-lg border border-[#ddd4c3] bg-white px-4 py-3 text-sm">{message}</p>}
        <section aria-labelledby="shortcuts-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="shortcuts-heading" className="font-serif text-xl font-semibold sm:text-2xl">Akses cepat</h2><button onClick={editShortcuts} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[#247451] hover:bg-[#e7eee6]"><Settings2 className="h-4 w-4" /> Atur pintasan</button></div>
          {shortcuts.length ? <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {shortcuts.map(item => { const Icon = getIcon(item.icon); return <Link key={item.id} href={item.href} className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-[#e4ddcf] bg-[#fffdf8] px-2 py-3 text-center transition-colors hover:border-[#9ab5a2] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247451]">
              <Icon className="h-6 w-6 text-[#12372a] group-hover:text-[#247451]" aria-hidden="true" />
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-[#1c2923] sm:text-sm">{getMenuTitle(item.title)}</span>
            </Link> })}
          </div> : <div className="rounded-xl border border-dashed border-[#c9d8ce] px-5 py-7 text-sm text-[#66736c]">Belum ada pintasan. Pilih menu yang paling sering Anda gunakan.</div>}
        </section>

        <section aria-labelledby="widgets-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="widgets-heading" className="font-serif text-xl font-semibold sm:text-2xl">Ringkasan untuk Anda</h2><p className="mt-1 text-xs text-[#66736c]">Angka ringkasan tersimpan sampai 5 menit. Segarkan untuk data terbaru.</p></div><button onClick={refresh} disabled={!!busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#c9d8ce] bg-white px-3 py-2 text-xs font-semibold text-[#12372a] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'widgets' ? 'animate-spin' : ''}`} /> Segarkan</button></div>
          {widgets.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {widgets.map(widget => <article key={widget.key} className={`flex min-h-48 flex-col rounded-xl border p-5 ${widget.key === 'wallet' ? 'border-[#c9ddce] bg-[#eaf3e9]' : 'border-[#e4ddcf] bg-[#fffdf8]'}`}>
              <div className="flex items-start justify-between gap-3"><h3 className="font-serif text-base font-semibold">{widget.title}</h3>{widget.href && !widget.unavailable && <Link href={widget.href} aria-label={`Buka ${widget.title}`} className="rounded-full p-1 text-[#247451] hover:bg-[#e7eee6]"><ArrowRight className="h-4 w-4" /></Link>}</div>
              <div className="mt-5 text-[clamp(1.7rem,3vw,2.5rem)] font-semibold leading-none tabular-nums text-[#12372a]">{widget.value}</div>
              <p className="mt-2 text-xs text-[#66736c]">{widget.description}</p>
              {widget.lines.length > 0 && <ul className="mt-4 space-y-2 border-t border-[#e4ddcf] pt-3 text-xs text-[#34483c]">{widget.lines.map((line, index) => <li key={index} className="flex justify-between gap-2"><span>{line.label}</span>{line.detail && <span className="shrink-0 text-[#66736c]">{line.detail}</span>}</li>)}</ul>}
            </article>)}
          </div> : <p className="rounded-xl border border-dashed border-[#c9d8ce] px-5 py-7 text-sm text-[#66736c]">Belum ada widget untuk role Anda.</p>}
        </section>
      </div>

      <dialog ref={dialogRef} className="m-auto w-[min(96vw,650px)] max-h-[85dvh] rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] p-0 text-[#1c2923] shadow-xl backdrop:bg-black/50">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e4ddcf] bg-[#fffdf8] px-5 py-4"><div><h2 className="font-serif text-lg font-semibold">Atur pintasan</h2><p className="text-xs text-[#66736c]">Pilih maksimal 8 menu yang Anda gunakan.</p></div><button onClick={() => dialogRef.current?.close()} aria-label="Tutup" className="rounded-lg p-2 hover:bg-[#e7eee6]"><X className="h-5 w-5" /></button></div>
        {message && <p role="alert" className="mx-5 mt-4 rounded-lg border border-[#ddd4c3] bg-white px-3 py-2 text-sm">{message}</p>}
        <div className="max-h-[60dvh] overflow-y-auto p-5">
          <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Cari menu..." aria-label="Cari menu" className="mb-4 w-full rounded-lg border border-[#ddd4c3] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#247451]" />
          {draft.length > 0 && <div className="mb-5"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#66736c]">Dipilih ({draft.length}/8)</p><div className="space-y-1">{draft.map(id => { const item = menu.find(value => value.id === id); if (!item) return null; return <div key={id} className="flex items-center gap-2 rounded-lg bg-[#eaf3e9] px-3 py-2 text-sm"><span className="flex-1">{getMenuTitle(item.title)}</span><button onClick={() => moveDraft(id, -1)} aria-label={`Naikkan ${item.title}`} className="p-1"><ArrowUp className="h-4 w-4" /></button><button onClick={() => moveDraft(id, 1)} aria-label={`Turunkan ${item.title}`} className="p-1"><ArrowDown className="h-4 w-4" /></button><button onClick={() => toggleDraft(id)} aria-label={`Hapus ${item.title}`} className="p-1"><X className="h-4 w-4" /></button></div> })}</div></div>}
          <div className="space-y-1">{filteredMenu.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#f7f1e5]"><input type="checkbox" checked={draft.includes(item.id)} disabled={!draft.includes(item.id) && draft.length >= 8} onChange={() => toggleDraft(item.id)} /><span className="flex-1">{getMenuTitle(item.title)}</span><span className="text-xs text-[#66736c]">{item.group_name}</span></label>)}</div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#e4ddcf] bg-[#fffdf8] px-5 py-4"><button onClick={() => dialogRef.current?.close()} className="rounded-lg px-4 py-2.5 text-sm">Batal</button><button disabled={!!busy} onClick={saveShortcuts} className="rounded-lg bg-[#12372a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Simpan pintasan</button></div>
      </dialog>
    </div>
  )
}
