import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal Orang Tua — ESKAHADE',
  description: 'Portal orang tua santri Pondok Pesantren Sukahideng',
}

// Shell portal ortu: mobile-first, terpisah total dari layout dashboard staf.
// Palet: krem hangat + hijau emerald pesantren + aksen emas.
export default function PortalOrtuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .portal-root {
          --p-cream: #faf6ee;
          --p-card: #ffffff;
          --p-line: #ebe3d3;
          --p-ink: #1f2a24;
          --p-muted: #6b7a71;
          --p-emerald: #0b5e3f;
          --p-emerald-deep: #07402b;
          --p-gold: #c98a1b;
          --p-gold-soft: #f7ecd7;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: var(--p-ink);
        }
        .portal-display { font-family: 'Fraunces', serif; }
        .portal-pattern {
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 1px, transparent 0);
          background-size: 18px 18px;
        }
        @keyframes portal-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .portal-rise { animation: portal-rise .5s cubic-bezier(.2,.7,.3,1) both; }
        .portal-rise-1 { animation-delay: .05s } .portal-rise-2 { animation-delay: .12s }
        .portal-rise-3 { animation-delay: .19s } .portal-rise-4 { animation-delay: .26s }
      `}</style>
      <div className="portal-root min-h-dvh bg-[var(--p-cream)]">
        <div className="w-full min-h-dvh relative">
          {children}
        </div>
      </div>
    </>
  )
}
