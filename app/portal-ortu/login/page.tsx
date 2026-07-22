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
    <main className="public-theme min-h-dvh flex flex-col justify-center items-center bg-[#FBFBFA] px-4 py-8 relative selection:bg-[var(--public-leaf)] selection:text-white">
      <div className="w-full max-w-sm relative z-10 public-rise">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 transition-opacity hover:opacity-80">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="h-10 w-10 object-contain" priority />
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--public-leaf)]">ESKAHADE</span>
              <span className="block text-sm font-bold text-gray-900">Pesantren Sukahideng</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Portal Orang Tua</h1>
          <p className="mt-2 text-sm text-gray-500">Pantau perkembangan santri dari mana saja.</p>
        </div>

        {/* Form Component */}
        <LoginForm />

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col items-center gap-4 text-sm">
          <Link href="/login" className="group flex items-center gap-1 text-[var(--public-leaf)] font-medium hover:text-[var(--public-forest)] transition-colors">
            Login sebagai Pengurus <CaretRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-xs">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
