'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { InboxItem } from '@/lib/notifications/inbox'

export const NOTIF_CHANGED_EVENT = 'eskahade-notif-changed'
const POLL_MS = 60_000

/** Beri tahu bell/badge lain di halaman bahwa status baca berubah. */
export function announceNotificationsChanged(count?: number) {
  window.dispatchEvent(new CustomEvent(NOTIF_CHANGED_EVENT, { detail: { count } }))
}

/** Jumlah belum dibaca: polling saat tab terlihat + segarkan saat fokus/perubahan. */
export function useUnreadCount(audience: 'staff' | 'portal') {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications/unread?audience=${audience}`, { cache: 'no-store', credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json() as { count?: number }
      if (typeof data.count === 'number') setCount(data.count)
    } catch { /* jaringan putus: pertahankan angka terakhir */ }
  }, [audience])

  useEffect(() => {
    const first = window.setTimeout(refresh, 0)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const onChanged = (event: Event) => {
      const next = (event as CustomEvent<{ count?: number }>).detail?.count
      if (typeof next === 'number') setCount(next); else refresh()
    }
    const onWorkerMessage = (event: MessageEvent) => { if (event.data?.type === 'eskahade-notification') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    window.addEventListener(NOTIF_CHANGED_EVENT, onChanged)
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage)
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(NOTIF_CHANGED_EVENT, onChanged)
    }
  }, [refresh])

  return { count, setCount, refresh }
}

const RTF = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('id', { numeric: 'auto' }) : null

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Math.round((time - now) / 1000)
  const abs = Math.abs(diff)
  if (abs < 60) return 'Baru saja'
  if (!RTF) return new Date(iso).toLocaleString('id-ID')
  if (abs < 3600) return RTF.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return RTF.format(Math.round(diff / 3600), 'hour')
  if (abs < 7 * 86400) return RTF.format(Math.round(diff / 86400), 'day')
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

const LEVEL_DOT: Record<InboxItem['level'], string> = {
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function NotificationRow({
  item,
  onOpen,
  compact = false,
}: {
  item: InboxItem
  onOpen: (item: InboxItem) => void
  compact?: boolean
}) {
  const unread = !item.read_at
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600',
        compact ? 'px-4 py-3' : 'px-4 py-3.5 sm:px-5',
        unread ? 'bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
      )}
    >
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? LEVEL_DOT[item.level] : 'bg-transparent')} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn('text-sm leading-snug text-slate-900 dark:text-slate-100', unread ? 'font-semibold' : 'font-medium')}>
            {item.title}
          </span>
          <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-slate-400">{formatRelativeTime(item.created_at)}</span>
        </span>
        <span className={cn('mt-0.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-400', compact && 'line-clamp-2')}>
          {item.body}
        </span>
        {!compact && (
          <span className="mt-1.5 inline-block text-[11px] font-medium text-slate-400">{item.category_label}</span>
        )}
      </span>
      {unread && <span className="sr-only">Belum dibaca</span>}
    </button>
  )
}
