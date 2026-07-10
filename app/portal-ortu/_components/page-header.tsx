import React from 'react'

// Header hijau seragam untuk sub-halaman portal
export function PortalPageHeader({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="portal-pattern relative overflow-hidden bg-[var(--p-emerald-deep)] px-6 pt-10 pb-16 rounded-b-[2.25rem]">
      <div className="absolute -top-20 -right-14 w-52 h-52 rounded-full bg-[var(--p-emerald)] opacity-60 blur-2xl" />
      <div className="relative portal-rise">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-emerald-200/80">{kicker}</p>
        <h1 className="portal-display mt-1.5 text-[1.7rem] leading-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-xs text-emerald-100/80">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
