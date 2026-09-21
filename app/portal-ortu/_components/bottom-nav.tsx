'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, ClockCounterClockwise, CreditCard, House, User } from '@phosphor-icons/react'

const TABS = [
  { href: '/portal-ortu/beranda', label: 'Beranda', icon: House, matchPaths: ['/portal-ortu/beranda'] },
  { href: '/portal-ortu/tagihan', label: 'Tagihan', icon: CreditCard, matchPaths: ['/portal-ortu/tagihan'] },
  { href: '/portal-ortu/aktivitas', label: 'Aktivitas', icon: CalendarCheck, matchPaths: ['/portal-ortu/aktivitas', '/portal-ortu/absensi', '/portal-ortu/pelanggaran'] },
  { href: '/portal-ortu/riwayat', label: 'Riwayat', icon: ClockCounterClockwise, matchPaths: ['/portal-ortu/riwayat'] },
  { href: '/portal-ortu/akun', label: 'Akun', icon: User, matchPaths: ['/portal-ortu/akun'] },
]

function NavPendingOverlay() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
    </span>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-slate-200/70 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1">
      <div className="grid grid-cols-5 px-1.5">
        {TABS.map(tab => {
          const active = tab.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              className={`relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 py-1 transition-transform duration-150 active:scale-[0.92] ${
                active ? 'text-emerald-950' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div
                className={`flex items-center justify-center px-3 py-1 rounded-full transition-colors duration-150 ${
                  active ? 'bg-emerald-100/80 text-emerald-900' : 'text-slate-400'
                }`}
              >
                <Icon className="w-[20px] h-[20px]" weight={active ? 'bold' : 'regular'} />
              </div>
              <span
                className={`text-[10.5px] tracking-tight leading-none ${
                  active ? 'font-bold text-emerald-950' : 'font-medium text-slate-500'
                }`}
              >
                {tab.label}
              </span>
              <NavPendingOverlay />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
