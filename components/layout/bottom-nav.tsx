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
  ArrowLeftRight, Flame, ClipboardList, ToggleRight, Home, Menu,
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
}

export function BottomNav({ fiturAkses, userRole }: BottomNavProps) {
  const pathname = usePathname()

  // Filter: fitur yang aktif, dimiliki role ini, dan ditandai is_bottomnav
  // Urutkan by bottomnav_urutan, max 4 item
  const navItems = fiturAkses
    .filter(f => f.is_active && f.is_bottomnav && f.roles.includes(userRole))
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)
    .slice(0, 4)

  // Slot ke-5 selalu: "Menu" → /dashboard
  const menuItem = {
    href: '/dashboard',
    title: 'Menu',
    icon: 'Menu' as const,
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="md:hidden no-print fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-safe px-3 pb-3">
      <nav className="w-full max-w-sm bg-[#1a2e25] rounded-2xl flex items-center h-14 px-1.5 gap-0.5 shadow-xl">

        {/* Dynamic items from DB */}
        {navItems.map((item) => {
          const Icon = getIcon(item.icon)
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 h-11 rounded-xl transition-all duration-200',
                active
                  ? 'bg-emerald-500'
                  : 'hover:bg-white/10 active:bg-white/15'
              )}
            >
              <Icon
                className={cn(
                  'w-[18px] h-[18px] transition-colors',
                  active ? 'text-white' : 'text-white/50'
                )}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={cn(
                  'text-[9px] leading-none font-medium transition-colors truncate max-w-full px-0.5',
                  active ? 'text-white' : 'text-white/50'
                )}
              >
                {item.title}
              </span>
            </Link>
          )
        })}

        {/* Slot ke-5: selalu Menu → /dashboard */}
        <Link
          href={menuItem.href}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 h-11 rounded-xl transition-all duration-200',
            pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard')
              ? 'bg-emerald-500'
              : 'hover:bg-white/10 active:bg-white/15'
          )}
        >
          <Menu
            className={cn(
              'w-[18px] h-[18px] transition-colors',
              pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard')
                ? 'text-white'
                : 'text-white/50'
            )}
            strokeWidth={1.8}
          />
          <span className={cn(
            'text-[9px] leading-none font-medium transition-colors',
            pathname === '/dashboard' && navItems.every(i => i.href !== '/dashboard')
              ? 'text-white'
              : 'text-white/50'
          )}>
            Menu
          </span>
        </Link>

      </nav>
    </div>
  )
}