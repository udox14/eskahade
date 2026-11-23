'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { InboxItem } from '@/lib/notifications/inbox'
import { getMyNotifications, markAllMyNotificationsRead, markMyNotificationsRead } from '@/app/dashboard/notifikasi/actions'
import { announceNotificationsChanged, NotificationRow, UnreadBadge, useUnreadCount } from './shared'

/** Bell notifikasi pegawai dengan dropdown 8 notifikasi terbaru. */
export function StaffNotificationBell({ tone = 'light' }: { tone?: 'light' | 'overlay' }) {
  const router = useRouter()
  const { count, setCount } = useUnreadCount('staff')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function load() {
    setError(null)
    const res = await getMyNotifications({ limit: 8 })
    if (!res.ok) { setError(res.error); setItems([]); return }
    setItems(res.data.items)
    setCount(res.data.unread)
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) { setItems(null); void load() }
  }

  async function openItem(item: InboxItem) {
    setOpen(false)
    if (!item.read_at) {
      const res = await markMyNotificationsRead([item.id])
      if (res.ok) { setCount(res.data); announceNotificationsChanged(res.data) }
    }
    router.push(item.link || '/dashboard/notifikasi')
  }

  async function readAll() {
    const res = await markAllMyNotificationsRead()
    if (!res.ok) return
    setCount(0)
    announceNotificationsChanged(0)
    setItems(prev => prev?.map(i => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })) ?? prev)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={count > 0 ? `Notifikasi, ${count} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifikasi"
        className={cn(
          'relative flex items-center justify-center transition-colors active:scale-95 motion-reduce:transition-none',
          tone === 'overlay'
            ? 'h-9 w-9 rounded-full border border-current/30 hover:bg-white/15'
            : cn('rounded-lg p-2', open ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'),
        )}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        <UnreadBadge count={count} />
      </button>

      {open && (
        <div role="dialog" aria-label="Notifikasi" className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200/80 bg-white text-slate-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800">Notifikasi</span>
            {count > 0 && (
              <button type="button" onClick={readAll} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
            {items === null && (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-400">
                <CircleNotch className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat…
              </div>
            )}
            {items !== null && error && <p className="px-4 py-6 text-center text-xs text-rose-600">{error}</p>}
            {items !== null && !error && items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-500">Belum ada notifikasi.</p>
            )}
            {items?.map(item => <NotificationRow key={item.id} item={item} onOpen={openItem} compact />)}
          </div>
          <Link
            href="/dashboard/notifikasi"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            Lihat semua notifikasi
          </Link>
        </div>
      )}
    </div>
  )
}
