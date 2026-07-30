'use client'

import { ClipboardList } from 'lucide-react'

import { cn } from '@/lib/utils'

export function PoskestrenTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ value: T; label: string; icon?: typeof ClipboardList }>
  active: T
  onChange: (value: T) => void
}) {
  return (
    <div className="no-print overflow-x-auto">
      <div className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition',
                active === tab.value
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
      <p className="font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'emerald',
}: {
  label: string
  value: string | number
  detail?: string
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate'
}) {
  const tones = {
    emerald: 'text-emerald-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    slate: 'text-slate-700',
  }
  return (
    <article className="rounded-lg border bg-white p-4">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className={cn('mt-1 text-lg font-extrabold', tones[tone])}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  )
}

