import React from 'react'
import type { Metadata } from 'next'
import './portal-accessibility.css'

export const metadata: Metadata = {
  title: 'Portal Orang Tua — ESKAHADE',
  description: 'Portal orang tua santri Pondok Pesantren Sukahideng',
}

// Shell portal ortu: mobile-first, terpisah total dari layout dashboard staf.
export default function PortalOrtuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-theme min-h-dvh bg-[#fafaf9] text-slate-900 antialiased selection:bg-emerald-600 selection:text-white">
      <div className="w-full min-h-dvh relative">
        {children}
      </div>
    </div>
  )
}
