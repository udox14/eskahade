'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { CategoryPreference, InboxItem } from '@/lib/notifications/inbox'
import { announceNotificationsChanged, NotificationRow } from './shared'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export interface InboxActions {
  load: (options: { before?: string | null; unreadOnly?: boolean }) => Promise<Result<{ items: InboxItem[]; nextCursor: string | null; unread: number }>>
  markRead: (ids: string[]) => Promise<Result<number>>
  markAll: () => Promise<Result<number>>
  setPreference: (category: string, enabled: boolean) => Promise<Result<boolean>>
}

export function InboxList({
  initialItems,
  initialCursor,
  initialUnread,
  actions,
  fallbackLink,
  emptyText = 'Belum ada notifikasi.',
}: {
  initialItems: InboxItem[]
  initialCursor: string | null
  initialUnread: number
  actions: InboxActions
  fallbackLink?: string
  emptyText?: string
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [unread, setUnread] = useState(initialUnread)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [pending, startTransition] = useTransition()

  function reload(nextUnreadOnly: boolean) {
    setUnreadOnly(nextUnreadOnly)
    startTransition(async () => {
      const res = await actions.load({ unreadOnly: nextUnreadOnly })
      if (!res.ok) { toast.error(res.error); return }
      setItems(res.data.items)
      setCursor(res.data.nextCursor)
      setUnread(res.data.unread)
    })
  }

  function loadMore() {
    if (!cursor) return
    startTransition(async () => {
      const res = await actions.load({ before: cursor, unreadOnly })
      if (!res.ok) { toast.error(res.error); return }
      setItems(prev => [...prev, ...res.data.items.filter(i => !prev.some(p => p.id === i.id))])
      setCursor(res.data.nextCursor)
    })
  }

  async function open(item: InboxItem) {
    if (!item.read_at) {
      const res = await actions.markRead([item.id])
      if (res.ok) {
        setUnread(res.data)
        announceNotificationsChanged(res.data)
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
      }
    }
    const target = item.link || fallbackLink
    if (target) router.push(target)
  }

  async function readAll() {
    const res = await actions.markAll()
    if (!res.ok) { toast.error(res.error); return }
    setUnread(0)
    announceNotificationsChanged(0)
    setItems(prev => unreadOnly ? [] : prev.map(i => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })))
  }

  const tab = (active: boolean) => cn(
    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
    active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex items-center gap-1" role="tablist" aria-label="Saring notifikasi">
          <button type="button" role="tab" aria-selected={!unreadOnly} className={tab(!unreadOnly)} onClick={() => reload(false)}>Semua</button>
          <button type="button" role="tab" aria-selected={unreadOnly} className={tab(unreadOnly)} onClick={() => reload(true)}>
            Belum dibaca{unread > 0 ? ` (${unread})` : ''}
          </button>
        </div>
        {unread > 0 && (
          <button type="button" onClick={readAll} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            Tandai semua dibaca
          </button>
        )}
      </div>

      <div className={cn('divide-y divide-slate-100 dark:divide-slate-800', pending && 'opacity-60')}>
        {items.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-slate-500">{unreadOnly ? 'Semua notifikasi sudah dibaca.' : emptyText}</p>
        )}
        {items.map(item => <NotificationRow key={item.id} item={item} onOpen={open} />)}
      </div>

      {cursor && (
        <div className="border-t border-slate-100 p-3 text-center dark:border-slate-800">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {pending && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Muat lebih banyak
          </button>
        </div>
      )}
    </div>
  )
}

export function PreferenceList({
  initial,
  onChange,
  note,
}: {
  initial: CategoryPreference[]
  onChange: InboxActions['setPreference']
  note: string
}) {
  const [prefs, setPrefs] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(category: string, enabled: boolean) {
    setBusy(category)
    const res = await onChange(category, enabled)
    setBusy(null)
    if (!res.ok) { toast.error(res.error); return }
    setPrefs(prev => prev.map(p => p.category === category ? { ...p, in_app_enabled: enabled } : p))
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jenis notifikasi yang diterima</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {prefs.map(p => (
          <li key={p.category} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-slate-700 dark:text-slate-300">{p.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={p.in_app_enabled}
              aria-label={`Terima notifikasi ${p.label}`}
              disabled={busy === p.category}
              onClick={() => toggle(p.category, !p.in_app_enabled)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
                p.in_app_enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700',
              )}
            >
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', p.in_app_enabled ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
