'use client'

import Link, { useLinkStatus } from 'next/link'

export type KeuanganTab = 'saldo' | 'tagihan' | 'riwayat'

const TABS: { id: KeuanganTab; label: string }[] = [
  { id: 'saldo', label: 'Saldo' },
  { id: 'tagihan', label: 'Tagihan' },
  { id: 'riwayat', label: 'Riwayat' },
]

function TabPendingOverlay() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="absolute inset-0 flex items-center justify-center rounded-[var(--p-radius-sm)] bg-black/25">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    </span>
  )
}

export function KeuanganTabBar({
  active,
  badges,
}: {
  active: KeuanganTab
  badges?: Partial<Record<KeuanganTab, number>>
}) {
  return (
    <div role="tablist" aria-label="Sub menu Keuangan" className="mt-4 flex gap-1 rounded-[var(--p-radius-md)] bg-white/10 border border-white/15 p-1.5">
      {TABS.map(tab => {
        const isActive = active === tab.id
        const badge = badges?.[tab.id] || 0
        return (
          <Link
            key={tab.id}
            href={`/portal-ortu/keuangan?tab=${tab.id}`}
            role="tab"
            aria-selected={isActive}
            className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-[var(--p-radius-sm)] px-3 py-2 text-xs font-bold transition ${
              isActive ? 'bg-[var(--p-red)] text-white' : 'text-white/55 hover:text-white/80'
            }`}
          >
            {tab.label}
            {badge > 0 && (
              <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                isActive ? 'bg-white text-[var(--p-red)]' : 'bg-white/20 text-white'
              }`}>
                {badge}
              </span>
            )}
            <TabPendingOverlay />
          </Link>
        )
      })}
    </div>
  )
}
