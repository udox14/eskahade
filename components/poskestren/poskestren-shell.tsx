'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, FileText, Package, Stethoscope, Users, Wallet } from 'lucide-react'

import { cn } from '@/lib/utils'

const MODULES = [
  { href: '/dashboard/poskestren/pemeriksaan', label: 'Pemeriksaan', icon: Stethoscope },
  { href: '/dashboard/poskestren/keuangan', label: 'Keuangan', icon: Wallet },
  { href: '/dashboard/poskestren/laporan', label: 'Laporan', icon: FileText },
  { href: '/dashboard/poskestren/obat', label: 'Obat', icon: Package },
  { href: '/dashboard/poskestren/manajemen', label: 'Manajemen', icon: Users },
]

export function PoskestrenModuleNav({ canFinance }: { canFinance: boolean }) {
  const pathname = usePathname()
  const visible = MODULES.filter(item => canFinance || item.label !== 'Keuangan')

  return (
    <nav className="no-print sticky top-0 z-20 -mx-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
      <div className="flex min-w-max gap-1">
        {visible.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition',
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

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

