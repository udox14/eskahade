'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, ClockCounterClockwise, CreditCard, House, User } from '@phosphor-icons/react'

const TABS = [
  { href: '/portal-ortu/beranda', label: 'Beranda', icon: House, matchPaths: ['/portal-ortu/beranda'] },
  { href: '/portal-ortu/tagihan', label: 'Tagihan', icon: CreditCard, matchPaths: ['/portal-ortu/tagihan'] },
  { href: '/portal-ortu/aktivitas', label: 'Aktivitas', icon: CalendarCheck, matchPaths: ['/portal-ortu/aktivitas', '/portal-ortu/absensi', '/portal-ortu/pelanggaran'] },
  { href: '/portal-ortu/riwayat', label: 'Riwayat', icon: ClockCounterClockwise, matchPaths: ['/portal-ortu/riwayat'] },
  { href: '/portal-ortu/akun', label: 'Akun', icon: User, matchPaths: ['/portal-ortu/akun'] },
]

function tabIndexForPath(pathname: string) {
  return TABS.findIndex(tab => tab.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/')))
}

export function BottomNav() {
  const pathname = usePathname()
  // Optimistic: sorotan langsung pindah saat disentuh, tanpa menunggu halaman selesai dimuat.
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)

  useEffect(() => {
    setTappedIndex(null)
  }, [pathname])

  const routeIndex = tabIndexForPath(pathname)
  const activeIndex = tappedIndex ?? routeIndex

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/70 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1">
      <div className="relative grid grid-cols-5 px-1.5">
        {/* Pil sorotan tunggal yang meluncur antar tab */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 left-1.5 flex w-[calc((100%-0.75rem)/5)] items-start justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none will-change-transform"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="mt-1 h-8 w-14 rounded-full bg-emerald-100/90 dark:bg-emerald-950/70" />
          </span>
        )}

        {TABS.map((tab, index) => {
          const active = index === activeIndex
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              onClick={e => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                setTappedIndex(index)
              }}
              aria-current={index === routeIndex ? 'page' : undefined}
              className={`relative z-10 flex min-h-[54px] flex-col items-center justify-center gap-1 py-1 transition-[transform,color] duration-200 active:scale-[0.94] motion-reduce:transition-none ${
                active
                  ? 'text-emerald-900 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex h-8 w-14 items-center justify-center">
                <Icon
                  className={`h-[22px] w-[22px] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                    active ? 'scale-110' : 'scale-100'
                  }`}
                  weight={active ? 'fill' : 'regular'}
                />
              </span>
              <span
                className={`text-[10.5px] tracking-tight leading-none transition-colors duration-200 ${
                  active ? 'font-bold' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
