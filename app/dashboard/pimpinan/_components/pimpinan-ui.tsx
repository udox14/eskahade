'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  SearchX,
  Calendar,
  CalendarRange,
  House,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BULAN_PANJANG } from '@/lib/pimpinan/format'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { PimpinanNav } from './pimpinan-nav'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <DashboardPageHeader title={title} description={description || ''} />
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <PimpinanNav />
    </div>
  )
}

type KpiTone = 'default' | 'good' | 'warn' | 'bad' | 'accent'

const KPI_TONE: Record<KpiTone, { box: string; value: string; label: string }> = {
  default: { box: 'bg-white border-slate-200', value: 'text-slate-900', label: 'text-slate-500' },
  good: { box: 'bg-emerald-50 border-emerald-200', value: 'text-emerald-800', label: 'text-emerald-700' },
  warn: { box: 'bg-amber-50 border-amber-200', value: 'text-amber-900', label: 'text-amber-700' },
  bad: { box: 'bg-red-50 border-red-200', value: 'text-red-800', label: 'text-red-700' },
  accent: { box: 'bg-slate-900 border-slate-900', value: 'text-white', label: 'text-slate-300' },
}

export function KpiCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: KpiTone
}) {
  const c = KPI_TONE[tone]
  return (
    <div className={cn('min-w-0 max-w-full rounded-xl border px-5 py-4 shadow-sm', c.box)}>
      <p className={cn('text-xs font-bold uppercase tracking-wide', c.label)}>{label}</p>
      <p className={cn('mt-1 break-words text-3xl font-black leading-tight sm:text-4xl', c.value)}>{value}</p>
      {sub && <p className={cn('mt-1 break-words text-xs font-medium', c.label)}>{sub}</p>}
    </div>
  )
}

export function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'bad'
          ? 'text-red-700'
          : 'text-slate-800'
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-0.5 break-words text-2xl font-black', color)}>{value}</p>
    </div>
  )
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0 max-w-full rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-black text-slate-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function DataTable({
  columns,
  children,
  empty = false,
  emptyText = 'Belum ada data pada periode ini.',
}: {
  columns: Array<{ label: string; align?: 'left' | 'center' | 'right' }>
  children: React.ReactNode
  empty?: boolean
  emptyText?: string
}) {
  if (empty) {
    return (
      <div className="flex min-w-0 max-w-full flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <SearchX className="h-10 w-10 text-slate-300" />
        <p className="break-words text-sm font-bold text-slate-600">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-base">
        <thead>
          <tr className="bg-slate-50 text-xs uppercase text-slate-500">
            {columns.map(column => (
              <th
                key={column.label}
                className={cn(
                  'whitespace-nowrap px-4 py-3 font-black',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right'
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

export function EmptyState({
  title = 'Belum ada data',
  description = 'Data akan tampil di sini setelah periode atau filter dipilih.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
      <SearchX className="h-12 w-12 text-slate-300" />
      <p className="text-base font-black text-slate-700">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
    </div>
  )
}

function monthOptions(): Array<{ value: string; label: string }> {
  const now = new Date()
  const options: Array<{ value: string; label: string }> = []
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push({
      value,
      label: `${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`,
    })
  }
  return options
}

export function usePageNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value)
    })
    const qs = search.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }
}

export function MonthSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Calendar className="h-4 w-4" />
        Periode Bulan
      </span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        {monthOptions().map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function MonthPeriodFilter({ month }: { month: string }) {
  const navigate = usePageNav()
  return (
    <FilterBar>
      <MonthSelect value={month} onChange={value => navigate({ month: value })} />
    </FilterBar>
  )
}

export function MonthAsramaFilter({
  month,
  asrama,
  asramaOptions,
}: {
  month: string
  asrama: string
  asramaOptions: string[]
}) {
  const navigate = usePageNav()
  return (
    <FilterBar>
      <MonthSelect value={month} onChange={value => navigate({ month: value, asrama })} />
      <AsramaSelect value={asrama} onChange={value => navigate({ month, asrama: value })} options={asramaOptions} />
    </FilterBar>
  )
}

export function AsramaSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <House className="h-4 w-4" />
        Asrama
      </span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">Semua Asrama</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterBar({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="no-print flex min-w-0 max-w-full flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      {children}
    </div>
  )
}

const DATE_INPUT_CLASS =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'

export function DateRangeFilter({ from, to }: { from: string; to: string }) {
  const navigate = usePageNav()
  return (
    <>
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <CalendarRange className="h-4 w-4" />
          Dari Tanggal
        </span>
        <input
          type="date"
          value={from}
          onChange={event => navigate({ from: event.target.value || undefined, to })}
          className={DATE_INPUT_CLASS}
        />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <CalendarRange className="h-4 w-4" />
          Sampai Tanggal
        </span>
        <input
          type="date"
          value={to}
          onChange={event => navigate({ from, to: event.target.value || undefined })}
          className={DATE_INPUT_CLASS}
        />
      </label>
    </>
  )
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent'
}) {
  const color =
    tone === 'good'
      ? 'bg-emerald-100 text-emerald-800'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : tone === 'bad'
          ? 'bg-red-100 text-red-800'
          : tone === 'accent'
            ? 'bg-slate-800 text-white'
            : 'bg-slate-100 text-slate-700'
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-black', color)}>
      {children}
    </span>
  )
}
