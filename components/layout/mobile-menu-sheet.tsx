'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, X } from 'lucide-react'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import {
  getActiveMenu,
  getIcon,
  getMenuTitle,
  GROUP_ICON,
  GROUP_ORDER,
  sortFiturItems,
} from '@/lib/menu/config'
import type { SidebarGroupConfig } from '@/lib/menu/groups'

type Props = {
  open: boolean
  items: FiturAkses[]
  groups: SidebarGroupConfig[]
  onClose: () => void
}

export function MobileMenuSheet({ open, items, groups, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const navRef = useRef<HTMLElement>(null)

  const [search, setSearch] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const pathname = usePathname()
  const closeImmediately = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    setIsClosing(false)
    setSearch('')
    dialogRef.current?.close()
    onClose()
  }
  const closeMenu = () => {
    setSearch('')
    if (closeTimerRef.current !== null) return
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    setIsClosing(delay > 0)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setIsClosing(false)
      onClose()
    }, delay)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    if (!open || search) return
    const frame = window.requestAnimationFrame(() => {
      const nav = navRef.current
      const activeItem = nav?.querySelector<HTMLElement>('[aria-current="page"]')
      if (nav && activeItem) {
        nav.scrollTop += activeItem.getBoundingClientRect().top - nav.getBoundingClientRect().top
          - nav.clientHeight / 2 + activeItem.clientHeight / 2
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, pathname, search])

  useEffect(() => {
    if (open) closeImmediately()
    // Route changes can also come from browser history while the dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  const groupedItems = useMemo(() => {
    const available = items.filter(item => item.is_active && item.href !== '/dashboard')
    const map = new Map<string, FiturAkses[]>()
    for (const item of available) {
      const bucket = map.get(item.group_name) ?? []
      bucket.push(item)
      map.set(item.group_name, bucket)
    }

    const configured = new Set(groups.map(group => group.group_name))
    const configuredOrder = [...groups]
      .filter(group => map.has(group.group_name))
      .sort((a, b) => a.urutan - b.urutan || a.group_name.localeCompare(b.group_name))
      .map(group => group.group_name)
    const fallbackOrder = GROUP_ORDER.filter(group => map.has(group) && !configured.has(group))
    const fallbackSet = new Set(fallbackOrder)
    const leftovers = [...map.keys()]
      .filter(group => !configured.has(group) && !fallbackSet.has(group))
      .sort((a, b) => {
        const minPosition = (name: string) => Math.min(...(map.get(name) ?? []).map(item => item.urutan))
        return minPosition(a) - minPosition(b) || a.localeCompare(b)
      })

    const groupLabels = new Map(groups.map(group => [group.group_name, group.label || group.group_name]))
    const needle = search.trim().toLocaleLowerCase('id')
    return [...configuredOrder, ...fallbackOrder, ...leftovers]
      .map(group => {
        const label = groupLabels.get(group) || group
        const groupItems = sortFiturItems(map.get(group) ?? [])
        const filtered = needle
          ? groupItems.filter(item =>
              getMenuTitle(item.title).toLocaleLowerCase('id').includes(needle) ||
              item.title.toLocaleLowerCase('id').includes(needle) ||
              label.toLocaleLowerCase('id').includes(needle) ||
              group.toLocaleLowerCase('id').includes(needle)
            )
          : groupItems
        return { group, label, items: filtered }
      })
      .filter(entry => entry.items.length > 0)
  }, [groups, items, search])

  const activeHref = getActiveMenu(pathname, items)

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mobile-menu-title"
      aria-modal="true"
      onCancel={event => { event.preventDefault(); closeMenu() }}
      onClick={event => { if (event.target === event.currentTarget) closeMenu() }}
      className="mobile-menu-dialog fixed inset-0 m-0 h-screen w-screen max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-[#1c2923] backdrop:bg-black/50"
    >
      <section className={"mobile-menu-panel absolute inset-x-0 bottom-0 flex h-[84dvh] max-h-[900px] flex-col overflow-hidden rounded-t-3xl border border-[#ddd4c3] bg-[#fffdf8] shadow-[0_-12px_40px_rgba(18,55,42,.16)] " + (isClosing ? 'mobile-menu-panel-closing' : '')}>
        <div className="shrink-0 border-b border-[#e4ddcf] px-4 pb-3 pt-3 sm:px-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#b9c9bd]" aria-hidden="true" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="mobile-menu-title" className="font-serif text-lg font-semibold">Menu</h2>
            <button type="button" onClick={closeMenu} aria-label="Tutup menu" className="flex h-10 w-10 items-center justify-center rounded-full text-[#66736c] transition duration-200 hover:bg-[#f1ede4] hover:text-[#12372a] active:scale-95 motion-reduce:transition-none">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <Link
            href="/dashboard"
            onClick={closeImmediately}
            className={'mb-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition duration-200 active:scale-[0.98] motion-reduce:transition-none ' +
              (pathname === '/dashboard' ? 'bg-[#eaf3e9] text-[#12372a]' : 'bg-[#f5f2eb] text-[#34483c] hover:bg-[#eaf3e9]')}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0 text-[#247451]" aria-hidden="true" />
            <span>Dashboard</span>
            {pathname === '/dashboard' && <span className="ml-auto h-2 w-2 rounded-full bg-[#247451]" aria-hidden="true" />}
          </Link>
          <label className="mobile-menu-search flex min-h-11 items-center gap-2.5 rounded-xl border border-[#ddd4c3] bg-white px-3 focus-within:border-[#247451]">
            <Search className="h-4 w-4 shrink-0 text-[#66736c]" aria-hidden="true" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Cari menu..."
              aria-label="Cari menu"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#89928d]"
            />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" className="rounded-full p-1 text-[#66736c] hover:bg-[#f1ede4]"><X className="h-4 w-4" /></button>}
          </label>
        </div>

        <nav ref={navRef} aria-label="Semua menu" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2.5 sm:px-6">
          {groupedItems.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-[#66736c]">Menu tidak ditemukan.</p>
          ) : groupedItems.map(({ group, label, items: groupItems }) => {
            const GroupIcon = GROUP_ICON[group]
            return (
              <section key={group} aria-labelledby={'menu-group-' + group.replace(/[^a-zA-Z0-9_-]/g, '-') } className="mb-4 last:mb-2">
                {group !== '_standalone' && (
                  <h3 id={'menu-group-' + group.replace(/[^a-zA-Z0-9_-]/g, '-') } className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#66736c]">
                    {GroupIcon ? <GroupIcon className="h-4 w-4 text-[#247451]" aria-hidden="true" /> : null}
                    {label}
                  </h3>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {groupItems.map(item => {
                    const Icon = getIcon(item.icon)
                    const active = activeHref === item.href
                    const title = getMenuTitle(item.title)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeImmediately}
                        aria-label={title}
                        aria-current={active ? 'page' : undefined}
                        className={'group flex min-h-14 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247451] ' +
                          (active ? 'border-[#9ab5a2] bg-[#eaf3e9] font-semibold text-[#12372a]' : 'border-[#e4ddcf] bg-[#fffdf8] text-[#34483c] hover:border-[#9ab5a2] hover:bg-white')}
                      >
                        <Icon className={'h-5 w-5 shrink-0 ' + (active ? 'text-[#247451]' : 'text-[#12372a] group-hover:text-[#247451]')} aria-hidden="true" />
                        <span className="min-w-0 text-xs font-medium leading-4 break-words">{title}</span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-[#e4ddcf] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6">
          <p className="text-center text-[11px] text-[#89928d]">ESKAHADE</p>
        </div>
      </section>
    </dialog>
  )
}
