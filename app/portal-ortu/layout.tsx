import React from 'react'
import type { Metadata } from 'next'
import './portal-accessibility.css'
import { PortalThemeProvider } from './_components/theme-provider'

export const metadata: Metadata = {
  title: 'Portal Orang Tua — ESKAHADE',
  description: 'Portal orang tua santri Pondok Pesantren Sukahideng',
}

// Shell portal ortu: mobile-first, terpisah total dari layout dashboard staf.
export default function PortalOrtuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('eskahade_portal_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`,
        }}
      />
      <PortalThemeProvider>
        <div className="portal-theme min-h-dvh bg-[#fafaf9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-600 selection:text-white transition-colors duration-200">
          <div className="w-full min-h-dvh relative">
            {children}
          </div>
        </div>
      </PortalThemeProvider>
    </>
  )
}
