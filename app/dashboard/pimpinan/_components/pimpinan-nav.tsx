'use client'

import React, { useEffect, useRef } from 'react'
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
  { href: '/dashboard/pimpinan/psb', label: 'PSB', icon: UserPlus },
]

export function PimpinanNav() {
  const pathname = usePathname()
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Jaga tab aktif selalu terlihat di dalam strip yang bisa discroll.
  // Saat user berpindah menu, strip ikut bergeser minimal ke tab yang aktif,
  // tidak tertinggal di posisi lama.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <nav
      aria-label="Navigasi monitoring pimpinan"
      className="no-print overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max gap-0.5">
        {PIMPINAN_MENU.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard/pimpinan' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              ref={active ? activeRef : undefined}
              href={item.href}
              scroll={false}
              className={cn(
                'flex min-h-11 items-center gap-1 border-b-2 px-2 py-3 text-[11px] font-bold transition-colors sm:min-h-0 sm:px-3 sm:py-2.5 sm:text-xs',
                active
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
