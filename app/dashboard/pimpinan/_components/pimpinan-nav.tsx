'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  Users,
  GraduationCap,
  HeartPulse,
  BedDouble,
  ShieldAlert,
  BookOpen,
  ClipboardList,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type PimpinanMenuItem = {
  href: string
  label: string
  icon: React.ElementType
}

export const PIMPINAN_MENU: PimpinanMenuItem[] = [
  { href: '/dashboard/pimpinan', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/pimpinan/keuangan', label: 'Keuangan', icon: Wallet },
  { href: '/dashboard/pimpinan/absensi-santri', label: 'Absensi Santri', icon: Users },
  { href: '/dashboard/pimpinan/absensi-guru', label: 'Absensi Guru', icon: GraduationCap },
  { href: '/dashboard/pimpinan/kesehatan', label: 'Kesehatan', icon: HeartPulse },
  { href: '/dashboard/pimpinan/asrama', label: 'Asrama', icon: BedDouble },
  { href: '/dashboard/pimpinan/disiplin', label: 'Disiplin', icon: ShieldAlert },
  { href: '/dashboard/pimpinan/akademik', label: 'Akademik', icon: BookOpen },
  { href: '/dashboard/pimpinan/ehb', label: 'EHB', icon: ClipboardList },
  { href: '/dashboard/pimpinan/psb', label: 'PSB', icon: UserPlus },
]

export function PimpinanNav() {
  const pathname = usePathname()

  return (
    <nav className="no-print flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PIMPINAN_MENU.map(item => {
        const Icon = item.icon
        const active = pathname === item.href || (item.href !== '/dashboard/pimpinan' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition',
              active
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
