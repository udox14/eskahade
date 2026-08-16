import React from 'react'

// Header hitam seragam ala Swiss/Grid untuk sub-halaman portal
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
    <div className="relative overflow-hidden bg-[var(--p-ink)] px-6 pt-10 pb-16 rounded-b-[var(--p-radius-lg)]">
      <div className="absolute top-0 left-6 right-6 h-[3px] bg-[var(--p-red)]" />
      <div className="relative portal-rise">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-white/55">{kicker}</p>
        <h1 className="portal-display mt-1.5 text-[1.7rem] leading-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-xs text-white/65">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
