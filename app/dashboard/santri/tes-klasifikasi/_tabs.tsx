'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarClock, ClipboardCheck, Printer } from 'lucide-react'

const tabs = [
  { href: '/dashboard/santri/tes-klasifikasi', label: 'Input Hasil', icon: ClipboardCheck },
  { href: '/dashboard/santri/tes-klasifikasi/penjadwalan', label: 'Penjadwalan', icon: CalendarClock },
  { href: '/dashboard/santri/tes-klasifikasi/cetak', label: 'Cetak', icon: Printer },
]

export function TesKlasifikasiTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map(tab => {
        const Icon = tab.icon
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
