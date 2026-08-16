import React from 'react'

// Header hitam siku ala katalog/konferensi Swiss untuk sub-halaman portal.
// Sengaja tanpa radius & tanpa overlap card — konten menyambung langsung
// di bawahnya supaya terasa satu permukaan struktural, bukan "hero + card
// mengambang" ala template SaaS generik.
export function PortalPageHeader({
  index,
  kicker,
  title,
  subtitle,
  children,
}: {
  index?: string
  kicker: string
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="relative bg-[var(--p-ink)] pl-7 pr-6 pt-10 pb-8 border-l-4 border-[var(--p-red)]">
      <div className="relative portal-rise">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-white/55">{kicker}</p>
          {index && <span className="portal-index text-white/35">N&deg; {index}</span>}
        </div>
        <h1 className="portal-display mt-1.5 text-[1.85rem] leading-[1.05] text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-xs text-white/65 max-w-[26rem]">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
