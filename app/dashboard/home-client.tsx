'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Megaphone, Menu, RefreshCw, Settings2, X } from 'lucide-react'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { getIcon, getMenuTitle } from '@/lib/menu/config'
import { useDashboardMenu } from '@/components/layout/menu-context'
import type { HeroConfig, TickerConfig } from '@/lib/dashboard/config'
import { saveDashboardShortcuts } from './actions'
import './home.css'

type Props = {
  userName: string
  primaryRoleLabel: string
  greeting: string
  dateLabel: string
  menu: FiturAkses[]
  initialShortcuts: FiturAkses[]
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

export function HomeClient({ userName, primaryRoleLabel, greeting, dateLabel, menu, initialShortcuts, hero, ticker }: Props) {
  const openMenu = useDashboardMenu()
  const router = useRouter()
  const [shortcuts, setShortcuts] = useState(initialShortcuts)
  const [draft, setDraft] = useState<number[]>([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState<'shortcuts' | null>(null)
  const [isRefreshing, startRefresh] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const userNameRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => setShortcuts(initialShortcuts), [initialShortcuts])

  useEffect(() => {
    const element = userNameRef.current
    if (!element) return
    let cancelled = false
    const fitName = () => {
      if (cancelled) return
      const width = element.clientWidth
      if (!width) return
      const maxSize = window.matchMedia('(min-width: 768px)').matches ? 42 : 30
      let size = maxSize
      element.style.fontSize = String(size) + 'px'
      while (element.scrollWidth > width && size > 10) {
        size = Math.max(10, size - 0.5)
        element.style.fontSize = String(size) + 'px'
      }
    }
    fitName()
    const observer = new ResizeObserver(fitName)
    observer.observe(element)
    window.addEventListener('resize', fitName)
    document.fonts?.ready.then(fitName)
    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener('resize', fitName)
    }
  }, [userName])

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
  const refresh = () => {
    setMessage(null)
    startRefresh(() => router.refresh())
  }
  const initial = userName.trim().slice(0, 1).toUpperCase() || 'P'
  const filteredMenu = menu.filter(item => item.href !== '/dashboard' &&
    `${item.title} ${item.group_name}`.toLocaleLowerCase('id').includes(filter.toLocaleLowerCase('id')))
  const whiteText = hero.textColor === 'white'

  return (
    <div className="dashboard-home min-h-full bg-[#f7f1e5] text-[#1c2923]">
      <section className={"relative isolate h-[292px] overflow-hidden bg-[#12372a] sm:h-[316px] md:h-[326px] " + (whiteText ? 'text-white' : 'text-black')}>
        <HeroPhoto hero={hero} />
        <div className={"absolute inset-0 " + (whiteText ? 'bg-gradient-to-r from-black/75 via-black/35 to-black/5' : 'bg-gradient-to-r from-white/85 via-white/45 to-white/5')} />
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-between px-4 pb-6 pt-4 sm:px-6 md:px-8 md:pb-7 md:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Image src="/logo.png" alt="Logo Pesantren ESKAHADE" width={34} height={34} priority className="h-8 w-8 shrink-0 object-contain" />
              <span className="truncate font-serif text-base font-semibold tracking-[0.08em] sm:text-lg">ESKAHADE</span>
            </div>
            <div className={whiteText ? "flex shrink-0 items-center gap-1.5 rounded-full bg-black/55 p-1 backdrop-blur-sm" : "flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 p-1 backdrop-blur-sm"}>
              <button onClick={refresh} disabled={isRefreshing} title="Segarkan dashboard" aria-label="Segarkan dashboard" className="flex h-9 w-9 items-center justify-center rounded-full border border-current/30 transition hover:bg-white/15 disabled:opacity-60"><RefreshCw className={"h-4 w-4 " + (isRefreshing ? 'animate-spin' : '')} aria-hidden="true" /></button>
              <button onClick={openMenu} title="Buka menu" aria-label="Buka menu" className="flex h-9 w-9 items-center justify-center rounded-full border border-current/30 transition hover:bg-white/15 md:hidden"><Menu className="h-4 w-4" aria-hidden="true" /></button>
              <Link href="/dashboard/profil" title="Profil saya" aria-label="Profil saya" className="flex h-9 w-9 items-center justify-center rounded-full border border-current/35 text-sm font-bold transition hover:bg-white/15">{initial}</Link>
            </div>
          </div>
          <div className="w-full max-w-2xl">
            <p className="mb-1 text-[11px] font-medium tracking-wide opacity-90 sm:text-xs">{dateLabel}</p>
            <p className="text-xs font-medium leading-tight opacity-90 sm:text-sm">{greeting}</p>
            <h1 ref={userNameRef} className="w-full whitespace-nowrap font-serif text-[30px] font-semibold leading-[1.08] tracking-tight">{userName}</h1>
            <p className="mt-1 text-xs font-medium opacity-90 sm:text-sm">{primaryRoleLabel}</p>
          </div>
        </div>
      </section>

      {ticker.text && <div className="dashboard-ticker flex min-h-11 items-center overflow-hidden px-4" style={{ backgroundColor: ticker.backgroundColor, color: ticker.textColor }}>
        <Megaphone className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="dashboard-ticker-window flex-1 overflow-hidden"><div className="dashboard-ticker-track whitespace-nowrap text-sm" aria-label={ticker.text}>{ticker.text}<span aria-hidden="true" className="mx-16">•</span><span aria-hidden="true">{ticker.text}</span></div></div>
      </div>}

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 md:px-8 md:py-7">
        {message && <p role="status" className="rounded-lg border border-[#ddd4c3] bg-white px-4 py-3 text-sm">{message}</p>}
        <section aria-labelledby="shortcuts-heading">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="shortcuts-heading" className="font-serif text-lg font-semibold sm:text-xl">Akses cepat</h2><button onClick={editShortcuts} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#247451] hover:bg-[#e7eee6]"><Settings2 className="h-4 w-4" /> Atur pintasan</button></div>
          {shortcuts.length ? <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {shortcuts.map(item => { const Icon = getIcon(item.icon); return <Link key={item.id} href={item.href} className="group flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[#e4ddcf] bg-[#fffdf8] px-1.5 py-2 text-center transition-colors hover:border-[#9ab5a2] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247451] sm:min-h-[84px] sm:gap-2 sm:px-2">
              <Icon className="h-5 w-5 text-[#12372a] group-hover:text-[#247451] sm:h-[22px] sm:w-[22px]" aria-hidden="true" />
              <span className="line-clamp-2 text-[10px] font-medium leading-tight text-[#1c2923] sm:text-xs">{getMenuTitle(item.title)}</span>
            </Link> })}
          </div> : <div className="rounded-xl border border-dashed border-[#c9d8ce] px-5 py-7 text-sm text-[#66736c]">Belum ada pintasan. Pilih menu yang paling sering Anda gunakan.</div>}
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
