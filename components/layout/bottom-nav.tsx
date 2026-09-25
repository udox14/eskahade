'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { House } from "@phosphor-icons/react";
import { getIcon } from '@/lib/menu/config'

interface BottomNavProps {
  fiturAkses: FiturAkses[]
  userRole: string
  userRoles?: string[]
  globalEnabled: boolean      // dari admin — kalau false, sembunyikan untuk semua
  userShowBottomNav: boolean  // preferensi user — kalau false, sembunyikan untuk user ini
  onOpenMenu: () => void
}

export function BottomNav({ fiturAkses, globalEnabled, userShowBottomNav, onOpenMenu }: BottomNavProps) {
  const pathname = usePathname()

  // Cek dua kondisi: admin harus aktifkan global, DAN user tidak matikan sendiri
  if (!globalEnabled || !userShowBottomNav) return null

  // Saring fitur aktif untuk bottom nav, maks 4 (selain dashboard)
  const navItems = fiturAkses
    .filter(f => f.href !== '/dashboard' && f.is_active && f.is_bottomnav)
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)
    .slice(0, 4)

  const activeHref = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname === item.href || pathname.startsWith(item.href + '/'))
    ?.href

  // Halaman dashboard aktif jika pathname === '/dashboard' atau berada di sub-halaman dashboard dan tidak ada item bottom nav lain yang aktif
  const menuActive = pathname === '/dashboard' || (pathname.startsWith('/dashboard') && !activeHref)

  // Bagi fitur secara simetris di sisi kiri dan kanan tombol MENU
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
        prefetch={true}
        className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-500 transition-all duration-200 group active:scale-95"
      >
        <div className={cn(
          "p-1.5 rounded-xl transition-all duration-300",
          active 
            ? "bg-emerald-50 text-emerald-600 scale-105 shadow-sm shadow-emerald-600/5" 
            : "text-slate-400 group-hover:text-slate-600"
        )}>
          <Icon className="w-[20px] h-[20px]" strokeWidth={active ? 2.2 : 1.8} />
        </div>
        <span className={cn(
          "text-[9.5px] font-semibold tracking-wide transition-colors duration-200 truncate max-w-[72px] px-1",
          active ? "text-emerald-700 font-bold" : "text-slate-500"
        )}>
          {item.title}
        </span>
      </Link>
    )
  }

  return (
    <nav className="md:hidden no-print fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.04)] h-16 z-40">
      <div className="grid grid-cols-5 h-full max-w-md mx-auto relative px-2">
        {/* Slot 1: Left Item 1 */}
        <div className="flex items-center justify-center">
          {leftItems[0] && renderNavItem(leftItems[0])}
        </div>

        {/* Slot 2: Left Item 2 */}
        <div className="flex items-center justify-center">
          {leftItems[1] && renderNavItem(leftItems[1])}
        </div>

        {/* Slot 3: Center MENU (Stand-out) */}
        <div className="flex items-center justify-center relative">
          <div className="flex flex-col items-center justify-end h-full pb-1.5 relative w-full">
            <button
              type="button"
              onClick={onOpenMenu}
              className={cn(
                "absolute -top-4 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-md",
                menuActive
                  ? "bg-[#12372a] text-white scale-105 border-2 border-white"
                  : "bg-white border border-slate-200 text-slate-600 shadow-slate-200/50 hover:border-emerald-200 hover:text-emerald-600"
              )}
              title="Buka seluruh menu"
              aria-label="Home: buka seluruh menu"
            >
              <House className="w-5.5 h-5.5" weight="bold" />
            </button>
            <span className={cn(
              "text-[9.5px] font-bold tracking-wider transition-colors duration-200",
              menuActive ? "text-emerald-700" : "text-slate-500"
            )}>
              HOME
            </span>
          </div>
        </div>

        {/* Slot 4: Right Item 1 */}
        <div className="flex items-center justify-center">
          {rightItems[0] && renderNavItem(rightItems[0])}
        </div>

        {/* Slot 5: Right Item 2 */}
        <div className="flex items-center justify-center">
          {rightItems[1] && renderNavItem(rightItems[1])}
        </div>
      </div>
    </nav>
  )
}
