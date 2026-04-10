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
  globalEnabled: boolean      // dari admin — kalau false, sembunyikan untuk semua
  userShowBottomNav: boolean  // preferensi user — kalau false, sembunyikan untuk user ini
}

export function BottomNav({ fiturAkses, userRole, globalEnabled, userShowBottomNav }: BottomNavProps) {
  const pathname = usePathname()

  // Cek dua kondisi: admin harus aktifkan global, DAN user tidak matikan sendiri
  if (!globalEnabled || !userShowBottomNav) return null

  const navItems = fiturAkses
    .filter(f => f.is_active && f.is_bottomnav && f.roles.includes(userRole))
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)
    .slice(0, 4)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="md:hidden no-print shrink-0 w-full bg-card border-t border-border flex items-stretch h-14 pb-[env(safe-area-inset-bottom)] box-content z-50">

      {navItems.map((item) => {
        const Icon = getIcon(item.icon)
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_hsl(var(--primary))]" />
            )}
            <Icon className="w-[18px] h-[18px] z-10" strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[9px] leading-none font-semibold truncate max-w-full px-1 z-10">
              {item.title}
            </span>
          </Link>
        )
      })}

      {/* Slot ke-5: selalu Menu → /dashboard */}
      <Link
        href="/dashboard"
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative',
          pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard')
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
        )}
      >
        {pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard') && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_hsl(var(--primary))]" />
        )}
        <Menu className="w-[18px] h-[18px] z-10" strokeWidth={pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard') ? 2.5 : 1.8} />
        <span className="text-[9px] leading-none font-semibold z-10">Menu</span>
      </Link>

    </nav>
  )
}
