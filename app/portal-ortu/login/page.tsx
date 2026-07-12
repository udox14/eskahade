import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { LoginForm } from './_login-form'

export const dynamic = 'force-dynamic'

export default async function PortalLoginPage() {
  const session = await getPortalSession()
  if (session) redirect('/portal-ortu/beranda')

  return (
    <main className="public-theme min-h-dvh flex flex-col justify-center items-center bg-[var(--public-forest)] px-5 py-8 relative overflow-hidden">
      {/* Premium Background Decor */}
      <div className="public-grid absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" />
      <div className="public-noise absolute inset-0 opacity-[.05] mix-blend-soft-light pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[50rem] w-[50rem] rounded-full bg-[var(--public-gold)]/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[28rem] relative z-10 public-rise">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-leaf)] rounded-xl transition-transform hover:scale-105">
            <div className="rounded-xl bg-white/10 p-2 backdrop-blur-md border border-white/10 shadow-xl">
              <Image src="/logo.png" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain" priority />
            </div>
            <div className="text-left">
              <span className="block text-[10px] font-extrabold uppercase tracking-[.25em] text-[var(--public-leaf-light)]">ESKAHADE</span>
              <span className="block text-sm font-bold text-white">Pesantren Sukahideng</span>
            </div>
          </Link>
          <h1 className="text-3xl font-semibold text-white tracking-tight public-display">Portal Orang Tua</h1>
          <p className="mt-2 text-sm text-white/60 font-medium">Pantau perkembangan putra-putri Anda dari mana saja.</p>
        </div>

        {/* Form Component */}
        <LoginForm />

        {/* Footer Navigation */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-5 text-xs font-bold">
          <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-leaf)] rounded-md px-2 py-1">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Kembali ke Beranda
          </Link>
          <Link href="/login" className="flex items-center gap-2 text-[var(--public-leaf-light)] hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-leaf)] rounded-md px-2 py-1">
            <ShieldCheck aria-hidden className="h-4 w-4" /> Portal Pengurus
          </Link>
        </div>
      </div>
    </main>
  )
}
