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
    <main className="public-theme min-h-dvh flex flex-col justify-center items-center bg-[#fffdf8] px-4 py-8 relative selection:bg-[#247451] selection:text-white overflow-hidden">
      {/* Decorative Topographic Waves Pattern Overlay */}
      <div className="absolute inset-0 bg-pattern-waves pointer-events-none z-0 opacity-70" />
      <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-[#12372a]/10 blur-[100px] pointer-events-none animate-blob-1 z-0" />
      <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full bg-[#247451]/10 blur-[120px] pointer-events-none animate-blob-2 z-0" />

      <div className="w-full max-w-sm relative z-10 public-rise">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-5 transition-opacity hover:opacity-80">
            <Image src="/logo.png" alt="Logo" width={44} height={44} className="h-11 w-11 object-contain" priority />
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[#247451]">ESKAHADE</span>
              <span className="block text-sm font-extrabold text-[#12372a]">Pesantren Sukahideng</span>
            </div>
          </Link>
          <h1 className="text-2xl font-black text-[#12372a] tracking-tight">Portal Orang Tua</h1>
          <p className="mt-1.5 text-xs font-semibold text-[#66736c]">Pantau presensi & hafalan santri dari mana saja.</p>
        </div>

        {/* Form Component */}
        <LoginForm />

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col items-center gap-3.5 text-sm">
          <Link href="/login" className="group flex items-center gap-1 text-[#12372a] font-bold hover:text-[#247451] transition-colors">
            Masuk Portal Internal <CaretRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-[#66736c] hover:text-[#12372a] transition-colors text-xs font-semibold">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
