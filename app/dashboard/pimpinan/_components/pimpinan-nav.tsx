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
    <nav
      aria-label="Navigasi monitoring pimpinan"
      className="no-print -mx-4 overflow-x-auto border-b border-slate-200 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-1">
        {PIMPINAN_MENU.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard/pimpinan' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-bold transition-colors sm:min-h-0 sm:py-2.5',
                active
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
