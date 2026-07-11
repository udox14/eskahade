import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, BookOpenCheck, CheckCircle2, HeartHandshake, ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { LoginForm } from './_login-form'

export const dynamic = 'force-dynamic'

export default async function PortalLoginPage() {
  const session = await getPortalSession()
  if (session) redirect('/portal-ortu/beranda')

  return (
    <main className="public-theme min-h-dvh lg:grid lg:grid-cols-[.98fr_1.02fr]">
      <section className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--public-cream)] px-5 py-8 sm:px-8 lg:order-2 lg:px-12">
        <div className="absolute -right-44 top-0 h-96 w-96 rounded-full bg-[var(--public-gold-light)]/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[var(--public-leaf-light)] blur-3xl" />
        <div className="public-rise relative z-10 w-full max-w-md">
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--public-gold)]"><Image src="/logo.png" alt="Logo Pondok Pesantren Sukahideng" width={48} height={48} className="h-12 w-12 object-contain" priority /><span className="text-sm font-extrabold text-[var(--public-forest)]">ESKAHADE</span></Link>
            <span className="rounded-full bg-[var(--public-gold-light)] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#735417]">Orang Tua</span>
          </div>
          <LoginForm />
          <div className="mt-5 flex flex-col items-center justify-between gap-3 text-xs font-bold sm:flex-row"><Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[var(--public-muted)] transition hover:text-[var(--public-forest)] focus-visible:outline-3 focus-visible:outline-[var(--public-gold)]"><ArrowLeft aria-hidden className="h-4 w-4" /> Kembali ke beranda</Link><Link href="/login" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[var(--public-leaf)] transition hover:text-[var(--public-forest)] focus-visible:outline-3 focus-visible:outline-[var(--public-gold)]"><ShieldCheck aria-hidden className="h-4 w-4" /> Login Pengurus</Link></div>
        </div>
      </section>

      <section className="relative hidden min-h-dvh overflow-hidden bg-[var(--public-forest)] p-10 text-white lg:order-1 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="public-grid absolute inset-0 opacity-60" /><div className="public-noise absolute inset-0 opacity-[.07]" /><div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[var(--public-leaf)]/45 blur-3xl" /><div className="absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-[var(--public-gold)]/20 blur-3xl" />
        <Link href="/" className="relative z-10 flex w-fit items-center gap-3 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--public-gold)]"><Image src="/logo.png" alt="Logo Pondok Pesantren Sukahideng" width={58} height={58} className="h-14 w-14 object-contain" priority /><div><span className="block text-[10px] font-extrabold uppercase tracking-[.24em] text-emerald-200/70">ESKAHADE</span><span className="block font-extrabold">Pesantren Sukahideng</span></div></Link>
        <div className="public-rise relative z-10 max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-[10px] font-bold uppercase tracking-[.22em] text-emerald-100"><HeartHandshake aria-hidden className="h-4 w-4" /> Portal Orang Tua</div>
          <h1 className="public-display text-5xl font-semibold leading-[1.04] tracking-[-.035em] xl:text-6xl">Tetap dekat dengan perjalanan putra Anda.</h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/60">Pantau perkembangan, keamanan, dan administrasi santri dalam satu portal yang sederhana.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {['Perkembangan terpantau', 'Informasi pembayaran', 'Riwayat kehadiran', 'Akses pribadi keluarga'].map(item => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4 text-sm font-bold text-white/80"><CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-[var(--public-gold-light)]" />{item}</div>)}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3 text-xs text-white/35"><BookOpenCheck aria-hidden className="h-4 w-4" /> Mendampingi pendidikan dari rumah</div>
      </section>
    </main>
  )
}
