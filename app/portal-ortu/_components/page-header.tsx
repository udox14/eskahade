import React from 'react'

// Header hitam siku ala katalog/konferensi Swiss untuk sub-halaman portal.
// Sengaja tanpa radius & tanpa overlap card — konten menyambung langsung
// di bawahnya supaya terasa satu permukaan struktural, bukan "hero + card
// mengambang" ala template SaaS generik.
export function PortalPageHeader({
  kicker,
  title,
  subtitle,
  children,
  tabs,
}: {
  index?: string
  kicker?: string
  title: string
  subtitle?: string
  children?: React.ReactNode
  tabs?: React.ReactNode
}) {
  return (
    <div className="bg-white border-b border-slate-200/80 px-5 pt-6 pb-5">
      <div className="portal-rise">
        {kicker && (
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {kicker}
          </p>
        )}
        <h1 className="portal-display mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-md">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-3">{children}</div>}
        {tabs && <div className="mt-4">{tabs}</div>}
      </div>
    </div>
  )
}
