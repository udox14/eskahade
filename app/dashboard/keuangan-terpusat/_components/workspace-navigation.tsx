'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ROOT = '/dashboard/keuangan-terpusat'

const groups = [
  { id: 'summary', label: 'Ringkasan', href: ROOT },
  { id: 'operations', label: 'Operasional', href: `${ROOT}/loket` },
  { id: 'units', label: 'Unit Pembayaran', href: `${ROOT}/unit/uang-jajan` },
  { id: 'admin', label: 'Administrasi', href: `${ROOT}/kredensial` },
] as const

const children = {
  operations: [
    { label: 'Loket & Uang Jajan', href: `${ROOT}/loket` },
    { label: 'Pembayaran Gabungan', href: `${ROOT}/tagihan` },
    { label: 'Penyaluran', href: `${ROOT}/payout` },
    { label: 'Transaksi & Laporan', href: `${ROOT}/transaksi` },
  ],
  units: [
    { label: 'Uang Jajan', href: `${ROOT}/unit/uang-jajan` },
    { label: 'Makan', href: `${ROOT}/unit/makan` },
    { label: 'Laundry', href: `${ROOT}/unit/laundry` },
    { label: 'SPP', href: `${ROOT}/unit/spp` },
    { label: 'Bangunan', href: `${ROOT}/unit/bangunan` },
    { label: 'Biaya Tahunan', href: `${ROOT}/unit/biaya-tahunan` },
  ],
  admin: [
    { label: 'Kartu QR', href: `${ROOT}/kredensial` },
    { label: 'Pengaturan', href: `${ROOT}/pengaturan` },
  ],
} as const

function activeGroup(pathname: string) {
  if (pathname.startsWith(`${ROOT}/unit/`)) return 'units'
  if (pathname.startsWith(`${ROOT}/kredensial`) || pathname.startsWith(`${ROOT}/pengaturan`)) return 'admin'
  if ([`${ROOT}/loket`, `${ROOT}/tagihan`, `${ROOT}/payout`, `${ROOT}/transaksi`].some(path => pathname.startsWith(path))) return 'operations'
  return 'summary'
}

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function FinanceWorkspaceNavigation() {
  const pathname = usePathname()
  const group = activeGroup(pathname)
  const secondary = group === 'summary' ? [] : children[group]

  return <div className="space-y-2">
    <nav aria-label="Kelompok Sistem Keuangan Baru" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
        {groups.map(item => {
          const active = item.id === group
          return <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined}
            className={cn('inline-flex min-h-11 items-center rounded-md px-3 text-xs font-bold transition sm:px-4 sm:text-sm', active ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900')}>
            {item.label}
          </Link>
        })}
      </div>
    </nav>
    {secondary.length ? <nav aria-label={`Menu ${groups.find(item => item.id === group)?.label}`} className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-5">
        {secondary.map(item => {
          const active = isCurrent(pathname, item.href)
          return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
            className={cn('inline-flex min-h-11 items-center border-b-2 px-0.5 text-xs font-semibold transition sm:text-sm', active ? 'border-emerald-700 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {item.label}
          </Link>
        })}
      </div>
    </nav> : null}
  </div>
}
