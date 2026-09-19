'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, House, Receipt, ShieldWarning, User } from '@phosphor-icons/react'

const TABS = [
  { n: '01', href: '/portal-ortu/beranda', label: 'Beranda', icon: House },
  { n: '02', href: '/portal-ortu/absensi', label: 'Pengajian', icon: CalendarCheck },
  { n: '03', href: '/portal-ortu/tagihan', label: 'Tagihan', icon: Receipt },
  { n: '04', href: '/portal-ortu/pelanggaran', label: 'Keamanan', icon: ShieldWarning },
  { n: '05', href: '/portal-ortu/akun', label: 'Akun', icon: User },
]

function NavPendingOverlay() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-[var(--p-ink)]/70">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </span>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md bg-[var(--p-ink)] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 border-r border-white/10 last:border-r-0 transition-colors active:bg-white/10 ${
                active ? 'bg-[var(--p-red)] text-white' : 'text-white/45'
              }`}
            >
              <span className={`portal-index absolute top-1 left-1.5 text-[8px] ${active ? 'text-white/70' : 'text-white/25'}`}>
                {tab.n}
              </span>
              <Icon className="w-5 h-5" weight={active ? 'bold' : 'regular'} />
              <span className={`text-[9px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
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
