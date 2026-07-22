'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, BadgeDollarSign, ChevronDown, CircleHelp, CreditCard, Landmark, ScanLine, SendHorizontal, Settings2 } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { cn } from '@/lib/utils'

const financeNav = [
  { href: '/dashboard/keuangan-terpusat', label: 'Ringkasan', icon: Landmark },
  { href: '/dashboard/keuangan-terpusat/loket', label: 'Loket', icon: ScanLine },
  { href: '/dashboard/keuangan-terpusat/kredensial', label: 'RFID / QR', icon: CreditCard },
  { href: '/dashboard/keuangan-terpusat/payout', label: 'Payout', icon: SendHorizontal },
  { href: '/dashboard/keuangan-terpusat/payroll', label: 'Payroll', icon: BadgeDollarSign },
  { href: '/dashboard/keuangan-terpusat/operasi', label: 'Operasi', icon: Settings2 },
]

export function FinancePageHeader({ title, description, eyebrow, meta, action }: {
  title: string; description: string; eyebrow?: string; meta?: string; action?: React.ReactNode
}) {
  return <div className="space-y-3 sm:space-y-4">
    <DashboardPageHeader title={title} description={description} action={action} className="[&_h1]:text-xl [&_p]:text-xs sm:[&_h1]:text-[1.75rem] sm:[&_p]:text-sm" />
    <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
      {eyebrow ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 ring-1 ring-emerald-100">{eyebrow}</span> : null}
      {meta ? <span className="text-slate-500">{meta}</span> : null}
    </div>
  </div>
}

export function FinanceNav() {
  const pathname = usePathname()
  return <nav aria-label="Navigasi keuangan terpusat" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
    <div className="flex min-w-max gap-1">
      {financeNav.map(item => {
        const active = item.href === '/dashboard/keuangan-terpusat' ? pathname === item.href : pathname.startsWith(item.href)
        return <Link key={item.href} href={item.href} className={cn(
          'flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-bold transition-colors sm:min-h-0 sm:py-2.5',
          active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
        )}><item.icon className="h-3.5 w-3.5" />{item.label}</Link>
      })}
    </div>
  </nav>
}

export function FinanceGuide({ title = 'Cara menggunakan halaman ini', purpose, prerequisites = [], steps, notes = [] }: {
  title?: string; purpose: string; prerequisites?: string[]; steps: string[]; notes?: string[]
}) {
  return <details className="group rounded-xl border border-blue-200 bg-blue-50/60 open:bg-white">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-bold text-slate-800 sm:text-sm"><CircleHelp className="h-4 w-4 text-blue-600" />{title}</span>
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-blue-700 sm:text-xs">Buka <span className="hidden sm:inline">petunjuk</span> <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
    </summary>
    <div className="grid gap-4 border-t border-blue-100 px-4 py-4 text-xs leading-relaxed text-slate-600 md:grid-cols-2 xl:grid-cols-4">
      <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-800">Tujuan</p><p>{purpose}</p></div>
      <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-800">Sebelum mulai</p>{prerequisites.length ? <ul className="list-disc space-y-1 pl-4">{prerequisites.map(item => <li key={item}>{item}</li>)}</ul> : <p>Tidak ada persiapan khusus.</p>}</div>
      <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-800">Alur kerja</p><ol className="list-decimal space-y-1 pl-4">{steps.map(item => <li key={item}>{item}</li>)}</ol></div>
      <div><p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Catatan penting</p>{notes.length ? <ul className="list-disc space-y-1 pl-4">{notes.map(item => <li key={item}>{item}</li>)}</ul> : <p>Periksa kembali sebelum menyimpan.</p>}</div>
    </div>
  </details>
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'emerald' }: {
  label: string; value: string; detail: string; icon: LucideIcon; tone?: 'emerald' | 'blue' | 'amber' | 'slate'
}) {
  const toneClass = { emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700' }[tone]
  return <div className="flex min-h-[108px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:block sm:min-h-0 sm:p-4">
    <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={cn('grid h-8 w-8 place-items-center rounded-lg', toneClass)}><Icon className="h-4 w-4" /></span></div>
    <p className="mt-2 break-words text-sm font-extrabold tabular-nums text-slate-900 sm:truncate sm:text-xl">{value}</p>
    <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">{detail}</p>
  </div>
}

export function SectionPanel({ title, description, action, children, className }: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return <section className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
    <div className="flex flex-col items-stretch justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div><h2 className="text-xs font-bold text-slate-900 sm:text-sm">{title}</h2>{description ? <p className="mt-0.5 text-[11px] leading-4 text-slate-500 sm:text-xs">{description}</p> : null}</div>{action}
    </div>
    {children}
  </section>
}

export function StatusBadge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate' }) {
  const styles = { emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100', red: 'bg-red-50 text-red-700 ring-red-100', blue: 'bg-blue-50 text-blue-700 ring-blue-100', slate: 'bg-slate-100 text-slate-600 ring-slate-200' }[tone]
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1', styles)}>{children}</span>
}
