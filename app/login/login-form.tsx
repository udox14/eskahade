'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LayoutDashboard, Loader2, Lock, Mail, ShieldCheck, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { login } from './actions'

export default function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await login(formData)
      if (result?.error) {
        setIsSubmitting(false)
        toast.error('Login Gagal', { description: result.error })
      }
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'digest' in err && typeof err.digest === 'string' && err.digest.startsWith('NEXT_REDIRECT')) return
      setIsSubmitting(false)
      toast.error('Login Gagal', { description: 'Tidak dapat terhubung ke server.' })
    }
  }

  return (
    <main className="public-theme min-h-dvh lg:grid lg:grid-cols-[1.02fr_.98fr]">
      <section className="relative hidden min-h-dvh overflow-hidden bg-[var(--public-forest)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="public-grid absolute inset-0 opacity-60" />
        <div className="public-noise absolute inset-0 opacity-[.07]" />
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[var(--public-leaf)]/45 blur-3xl" />
        <div className="absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-[var(--public-gold)]/20 blur-3xl" />

        <Link href="/" className="relative z-10 flex w-fit items-center gap-3 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--public-gold)]">
          <Image src="/logo.png" alt="Logo Pondok Pesantren Sukahideng" width={58} height={58} className="h-14 w-14 object-contain" priority />
          <div><span className="block text-[10px] font-extrabold uppercase tracking-[.24em] text-emerald-200/70">ESKAHADE</span><span className="block font-extrabold">Pesantren Sukahideng</span></div>
        </Link>

        <div className="public-rise relative z-10 max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-[10px] font-bold uppercase tracking-[.22em] text-emerald-100"><ShieldCheck aria-hidden className="h-4 w-4" /> Akses Pengurus</div>
          <h1 className="public-display text-5xl font-semibold leading-[1.04] tracking-[-.035em] xl:text-6xl">Kelola amanah dengan data yang tertata.</h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/60">Masuk ke pusat pengelolaan santri, akademik, asrama, keuangan, dan pelayanan pesantren.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {['Akses berbasis wewenang', 'Data tersimpan terpusat', 'Laporan siap digunakan', 'Operasional lebih efisien'].map(item => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4 text-sm font-bold text-white/80"><CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-[var(--public-gold-light)]" />{item}</div>)}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/35">Sistem Informasi Manajemen Pondok Pesantren Sukahideng</p>
      </section>

      <section className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--public-cream)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute -right-44 top-0 h-96 w-96 rounded-full bg-[var(--public-gold-light)]/55 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[var(--public-leaf-light)] blur-3xl" />
        <div className="public-rise relative z-10 w-full max-w-md">
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--public-gold)]"><Image src="/logo.png" alt="Logo Pondok Pesantren Sukahideng" width={48} height={48} className="h-12 w-12 object-contain" priority /><span className="text-sm font-extrabold text-[var(--public-forest)]">ESKAHADE</span></Link>
            <span className="rounded-full bg-[var(--public-leaf-light)] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--public-leaf)]">Pengurus</span>
          </div>

          <div className="rounded-[2rem] border border-[var(--public-line)] bg-[var(--public-paper)] p-6 shadow-[0_28px_80px_rgba(18,55,42,.13)] sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--public-leaf-light)] text-[var(--public-leaf)]"><LayoutDashboard aria-hidden className="h-6 w-6" /></span>
            <h2 className="public-display mt-6 text-3xl font-semibold text-[var(--public-forest)] sm:text-4xl">Selamat datang kembali.</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">Gunakan akun pengurus Anda untuk mengakses dashboard.</p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <label className="public-field block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.13em] text-[var(--public-muted)]">Email</span>
                <span className="relative block"><Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" /><input name="email" type="email" required autoComplete="username" placeholder="email@sukahideng.or.id" disabled={isSubmitting} className="py-3 pl-11 pr-4 text-sm font-semibold placeholder:font-normal placeholder:text-[var(--public-muted)]/50" /></span>
              </label>
              <label className="public-field block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.13em] text-[var(--public-muted)]">Password</span>
                <span className="relative block"><Lock aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" /><input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Masukkan password" disabled={isSubmitting} className="py-3 pl-11 pr-12 text-sm font-semibold placeholder:font-normal placeholder:text-[var(--public-muted)]/50" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--public-muted)] transition hover:bg-[var(--public-leaf-light)] hover:text-[var(--public-leaf)] focus-visible:outline-3 focus-visible:outline-[var(--public-gold)]" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}</button></span>
              </label>
              <button type="submit" disabled={isSubmitting} className="public-button public-button-primary w-full py-4 text-sm">{isSubmitting ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Memproses...</> : <>Masuk ke Dashboard <ArrowRight aria-hidden className="h-4 w-4" /></>}</button>
            </form>

            <a href="https://wa.me/6282218943383" target="_blank" rel="noopener noreferrer" className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--public-line)] bg-[var(--public-cream)]/60 px-4 text-center text-xs font-bold text-[var(--public-leaf)] transition hover:border-[var(--public-leaf)]/35 hover:bg-[var(--public-leaf-light)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-gold)]"><ShieldCheck aria-hidden className="h-4 w-4 shrink-0" /> Hubungi Admin IT untuk reset password</a>
          </div>

          <div className="mt-5 flex flex-col items-center justify-between gap-3 text-xs font-bold sm:flex-row"><Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[var(--public-muted)] transition hover:text-[var(--public-forest)] focus-visible:outline-3 focus-visible:outline-[var(--public-gold)]"><ArrowLeft aria-hidden className="h-4 w-4" /> Kembali ke beranda</Link><Link href="/portal-ortu/login" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[var(--public-leaf)] transition hover:text-[var(--public-forest)] focus-visible:outline-3 focus-visible:outline-[var(--public-gold)]"><UsersRound aria-hidden className="h-4 w-4" /> Login Orang Tua</Link></div>
        </div>
      </section>
    </main>
  )
}
