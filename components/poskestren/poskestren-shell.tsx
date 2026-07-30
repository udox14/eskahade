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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
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
    emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-800',
    blue: 'border-blue-100 bg-blue-50/70 text-blue-800',
    amber: 'border-amber-100 bg-amber-50/70 text-amber-800',
    rose: 'border-rose-100 bg-rose-50/70 text-rose-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  }
  return (
    <article className={cn('rounded-2xl border p-4', tones[tone])}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs opacity-70">{detail}</p> : null}
    </article>
  )
}

