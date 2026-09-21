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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md bg-white/95 backdrop-blur-lg border-t border-slate-200/60 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 px-1">
        {TABS.map(tab => {
          const active = tab.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 py-2 transition active:scale-95 ${
                active ? 'text-emerald-800' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className="w-[22px] h-[22px]" weight={active ? 'bold' : 'regular'} />
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-600" />
                )}
              </div>
              <span className={`text-[11px] tracking-tight leading-none ${active ? 'font-bold text-emerald-900' : 'font-medium'}`}>
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
