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
      <div className="flex items-stretch justify-between rounded-[1.75rem] bg-[var(--p-emerald-deep)] px-2 py-2 shadow-[0_14px_35px_-10px_rgba(7,64,43,0.55)]">
        {TABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition ${
                active ? 'bg-white/10 text-white' : 'text-emerald-100/60 active:text-white'
              }`}
            >
              <Icon className="w-5 h-5" weight={active ? 'bold' : 'regular'} />
              <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
              <span
                className={`h-1 w-1 rounded-full transition ${active ? 'bg-[var(--p-gold)]' : 'bg-transparent'}`}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
