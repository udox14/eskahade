'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, House, Receipt, ShieldWarning, User } from '@phosphor-icons/react'

const TABS = [
  { href: '/portal-ortu/beranda', label: 'Beranda', icon: House },
  { href: '/portal-ortu/absensi', label: 'Pengajian', icon: CalendarCheck },
  { href: '/portal-ortu/tagihan', label: 'Tagihan', icon: Receipt },
  { href: '/portal-ortu/pelanggaran', label: 'Keamanan', icon: ShieldWarning },
  { href: '/portal-ortu/akun', label: 'Akun', icon: User },
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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-sm pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 transition-colors active:bg-slate-100 ${
                active ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" weight={active ? 'bold' : 'regular'} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-600" />
                )}
              </div>
              <span className={`text-[11px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
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
