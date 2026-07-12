import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, UsersRound } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { LoginForm } from './_login-form'

export const dynamic = 'force-dynamic'

export default async function PortalLoginPage() {
  const session = await getPortalSession()
  if (session) redirect('/portal-ortu/beranda')

  return (
    <main className="public-theme min-h-dvh flex flex-col justify-center items-center bg-gray-50/50 px-4 py-8">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-emerald-50/80 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-blue-50/80 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 public-rise">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-leaf)] rounded-xl">
            <Image src="/logo.png" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain" priority />
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--public-leaf)]">ESKAHADE</span>
              <span className="block text-sm font-bold text-gray-900">Pesantren Sukahideng</span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Portal Orang Tua</h1>
          <p className="mt-2 text-sm text-gray-500">Pantau perkembangan santri dari mana saja.</p>
        </div>

        {/* Form Component */}
        <LoginForm />

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-medium">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Kembali ke Beranda
          </Link>
          <Link href="/login" className="flex items-center gap-2 text-[var(--public-leaf)] hover:text-[#1d6345] transition">
            <ShieldCheck aria-hidden className="h-4 w-4" /> Portal Pengurus
          </Link>
        </div>
      </div>
    </main>
  )
}
