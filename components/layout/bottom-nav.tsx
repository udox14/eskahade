'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { List as MenuList } from '@phosphor-icons/react'
import { getIcon, getMenuTitle } from '@/lib/menu/config'

interface BottomNavProps {
  fiturAkses: FiturAkses[]
  globalEnabled: boolean
  userShowBottomNav: boolean
  onOpenMenu: () => void
  menuOpen: boolean
}

export function BottomNav({ fiturAkses, globalEnabled, userShowBottomNav, onOpenMenu, menuOpen }: BottomNavProps) {
  const pathname = usePathname()
  if (!globalEnabled || !userShowBottomNav) return null

  const navItems = fiturAkses
    .filter(item => item.href !== '/dashboard' && item.is_active && item.is_bottomnav)
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)
    .slice(0, 4)

  const activeHref = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname === item.href || pathname.startsWith(item.href + '/'))
    ?.href
  const menuActive = pathname === '/dashboard' || (pathname.startsWith('/dashboard') && !activeHref)
  const midIndex = Math.ceil(navItems.length / 2)
  const leftItems = navItems.slice(0, midIndex)
  const rightItems = navItems.slice(midIndex)

  const renderNavItem = (item: FiturAkses) => {
    const Icon = getIcon(item.icon)
    const active = activeHref === item.href
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        aria-current={active ? 'page' : undefined}
        className="group flex h-full min-w-0 w-full flex-col items-center justify-center gap-0.5 px-1 text-[#66736c] transition duration-200 active:scale-95 motion-reduce:transition-none"
      >
        <span className={cn(
          'flex h-8 w-10 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-[#eaf3e9] text-[#12372a]' : 'text-[#89928d] group-hover:bg-[#f5f2eb] group-hover:text-[#34483c]'
        )}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className={cn(
          'max-w-full truncate px-1 text-[10px] font-semibold leading-3',
          active ? 'text-[#12372a]' : 'text-[#66736c]'
        )}>
          {getMenuTitle(item.title)}
        </span>
      </Link>
    )
  }

  return (
    <nav
      aria-label="Navigasi bawah"
      className="no-print fixed inset-x-0 bottom-0 z-40 h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-[#ddd4c3] bg-[#fffdf8]/95 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-2">
        <div className="flex min-w-0 items-center justify-center">{leftItems[0] && renderNavItem(leftItems[0])}</div>
        <div className="flex min-w-0 items-center justify-center">{leftItems[1] && renderNavItem(leftItems[1])}</div>
        <div className="flex min-w-0 items-center justify-center">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Buka menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className="group flex h-full w-full flex-col items-center justify-center gap-0.5 text-[#66736c] transition duration-200 active:scale-95 motion-reduce:transition-none"
          >
            <span className={cn(
              'flex h-8 w-10 items-center justify-center rounded-xl transition-colors',
              menuActive ? 'bg-[#12372a] text-white' : 'text-[#89928d] group-hover:bg-[#f5f2eb] group-hover:text-[#12372a]'
            )}>
              <MenuList className="h-5 w-5" weight="bold" aria-hidden="true" />
            </span>
            <span className={cn('text-[10px] font-bold leading-3', menuActive ? 'text-[#12372a]' : 'text-[#66736c]')}>Menu</span>
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-center">{rightItems[0] && renderNavItem(rightItems[0])}</div>
        <div className="flex min-w-0 items-center justify-center">{rightItems[1] && renderNavItem(rightItems[1])}</div>
      </div>
    </nav>
  )
}
