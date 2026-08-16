'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bank, CalendarCheck, House, Receipt, ShieldWarning, User } from '@phosphor-icons/react'

const TABS = [
  { href: '/portal-ortu/beranda', label: 'Beranda', icon: House },
  { href: '/portal-ortu/absensi', label: 'Pengajian', icon: CalendarCheck },
  { href: '/portal-ortu/tagihan', label: 'Tagihan', icon: Receipt },
  { href: '/portal-ortu/keuangan', label: 'Saldo', icon: Bank },
  { href: '/portal-ortu/pelanggaran', label: 'Keamanan', icon: ShieldWarning },
  { href: '/portal-ortu/akun', label: 'Akun', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-[26rem]">
      <div className="flex items-stretch justify-between rounded-[var(--p-radius-lg)] bg-[var(--p-ink)] px-2 py-2 shadow-[0_10px_28px_-8px_rgba(17,17,17,0.5)]">
        {TABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-[var(--p-radius-sm)] py-2 transition active:scale-95 ${
                active ? 'text-white' : 'text-white/45 active:text-white/80'
              }`}
            >
              <span
                className={`absolute top-0 h-[3px] w-5 rounded-full transition-colors ${
                  active ? 'bg-[var(--p-red)]' : 'bg-transparent'
                }`}
              />
              <Icon className="w-5 h-5" weight={active ? 'bold' : 'regular'} />
              <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
