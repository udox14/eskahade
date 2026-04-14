'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  Image as ImageIcon, School, Palette, Archive, Utensils, CalendarDays,
  ArrowLeftRight, Flame, ClipboardList, ToggleRight, Menu,
} from 'lucide-react'
import React from 'react'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  ImageIcon, School, Palette, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight,
}

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings
}

interface BottomNavProps {
  fiturAkses: FiturAkses[]
  userRole: string
  userRoles?: string[]
  globalEnabled: boolean      // dari admin — kalau false, sembunyikan untuk semua
  userShowBottomNav: boolean  // preferensi user — kalau false, sembunyikan untuk user ini
}

export function BottomNav({ fiturAkses, userRole, userRoles, globalEnabled, userShowBottomNav }: BottomNavProps) {
  const pathname = usePathname()

  // Cek dua kondisi: admin harus aktifkan global, DAN user tidak matikan sendiri
  if (!globalEnabled || !userShowBottomNav) return null

  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole]

  const navItems = fiturAkses
    .filter(f => f.is_active && f.is_bottomnav && f.roles.some(r => effectiveRoles.includes(r)))
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)
    .slice(0, 4)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="md:hidden no-print shrink-0 w-full bg-white border-t border-slate-200 flex items-stretch h-14">

      {navItems.map((item) => {
        const Icon = getIcon(item.icon)
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
              active ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            )}
          >
            <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[9px] leading-none font-medium truncate max-w-full px-1">
              {item.title}
            </span>
          </Link>
        )
      })}

      {/* Slot ke-5: selalu Menu → /dashboard */}
      <Link
        href="/dashboard"
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
          pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard')
            ? 'text-emerald-600 bg-emerald-50'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
        )}
      >
        <Menu className="w-[18px] h-[18px]" strokeWidth={1.8} />
        <span className="text-[9px] leading-none font-medium">Menu</span>
      </Link>

    </nav>
  )
}
