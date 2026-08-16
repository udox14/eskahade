import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CaretRight } from '@phosphor-icons/react/dist/ssr'
import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { LoginForm } from './_login-form'

export const dynamic = 'force-dynamic'

export default async function PortalLoginPage() {
  const session = await getPortalSession()
  if (session) redirect('/portal-ortu/beranda')

  return (
    <main className="portal-theme portal-grid-bg min-h-dvh flex flex-col justify-center items-center bg-[var(--p-paper)] px-4 py-8 relative selection:bg-[var(--p-ink)] selection:text-white overflow-hidden">
      <div className="w-full max-w-sm relative z-10 portal-rise">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-5 transition-opacity hover:opacity-80">
            <Image src="/logo.png" alt="Logo" width={44} height={44} className="h-11 w-11 object-contain" priority />
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--p-red)]">ESKAHADE</span>
              <span className="block text-sm font-extrabold text-[var(--p-ink)]">Pesantren Sukahideng</span>
            </div>
          </Link>
          <h1 className="portal-display text-2xl text-[var(--p-ink)] tracking-tight">Portal Orang Tua</h1>
          <p className="mt-1.5 text-xs font-semibold text-[var(--p-muted)]">Pantau presensi &amp; hafalan santri dari mana saja.</p>
        </div>

        {/* Form Component */}
        <LoginForm />

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col items-center gap-3.5 text-sm">
          <Link href="/login" className="group flex items-center gap-1 text-[var(--p-ink)] font-bold hover:text-[var(--p-red)] transition-colors">
            Masuk Portal Internal <CaretRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-[var(--p-muted)] hover:text-[var(--p-ink)] transition-colors text-xs font-semibold">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
