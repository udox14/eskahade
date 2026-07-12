'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LayoutDashboard, Loader2, Lock, Mail, ShieldCheck, UsersRound } from 'lucide-react'
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
    <main className="public-theme min-h-dvh flex flex-col justify-center items-center bg-[var(--public-forest)] px-5 py-8 relative overflow-hidden">
      {/* Premium Background Decor */}
      <div className="public-grid absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" />
      <div className="public-noise absolute inset-0 opacity-[.05] mix-blend-soft-light pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[50rem] w-[50rem] rounded-full bg-[var(--public-leaf)]/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[28rem] relative z-10 public-rise">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-gold)] rounded-xl transition-transform hover:scale-105">
            <div className="rounded-xl bg-white/10 p-2 backdrop-blur-md border border-white/10 shadow-xl">
              <Image src="/logo.png" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain" priority />
            </div>
            <div className="text-left">
              <span className="block text-[10px] font-extrabold uppercase tracking-[.25em] text-[var(--public-gold-light)]">ESKAHADE</span>
              <span className="block text-sm font-bold text-white">Pesantren Sukahideng</span>
            </div>
          </Link>
          <h1 className="text-3xl font-semibold text-white tracking-tight public-display">Portal Pengurus</h1>
          <p className="mt-2 text-sm text-white/60 font-medium">Masuk ke sistem manajemen operasional pesantren.</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--public-paper)] rounded-[2.5rem] p-8 sm:p-10 shadow-[0_30px_60px_rgba(0,0,0,.3)] border border-[var(--public-line)]/50 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[var(--public-leaf)] via-[var(--public-gold)] to-[var(--public-leaf)] opacity-80" />
          
          <form onSubmit={handleLogin} className="space-y-6 mt-2">
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[var(--public-muted)]">Email</label>
              <div className="relative">
                <Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--public-muted)]/70" />
                <input 
                  name="email" 
                  type="email" 
                  required 
                  autoComplete="username" 
                  placeholder="admin@sukahideng.or.id" 
                  disabled={isSubmitting} 
                  className="w-full rounded-2xl border border-[var(--public-line)] bg-white py-4 pl-12 pr-4 text-sm font-bold text-[var(--public-forest)] transition-all placeholder:text-[var(--public-muted)]/50 placeholder:font-normal focus:border-[var(--public-leaf)] focus:outline-none focus:ring-4 focus:ring-[var(--public-leaf)]/10 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[var(--public-muted)]">Password</label>
              <div className="relative">
                <Lock aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--public-muted)]/70" />
                <input 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  autoComplete="current-password" 
                  placeholder="Masukkan password" 
                  disabled={isSubmitting} 
                  className="w-full rounded-2xl border border-[var(--public-line)] bg-white py-4 pl-12 pr-12 text-sm font-bold text-[var(--public-forest)] transition-all placeholder:text-[var(--public-muted)]/50 placeholder:font-normal focus:border-[var(--public-leaf)] focus:outline-none focus:ring-4 focus:ring-[var(--public-leaf)]/10 disabled:opacity-60"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--public-muted)] transition hover:bg-[var(--public-leaf-light)] hover:text-[var(--public-leaf)] focus:outline-none focus:ring-2 focus:ring-[var(--public-leaf)]" 
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--public-forest)] py-4 text-sm font-extrabold text-white transition-all hover:bg-[var(--public-forest-deep)] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[var(--public-forest)]/20 disabled:opacity-70 disabled:cursor-not-allowed">
              {isSubmitting ? <><Loader2 aria-hidden className="h-5 w-5 animate-spin" /> Memproses...</> : <>Masuk ke Dashboard <ArrowRight aria-hidden className="h-5 w-5" /></>}
            </button>
          </form>

          <a href="https://wa.me/6282218943383" target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-[var(--public-cream)]/50 py-3.5 text-[11px] font-bold text-[var(--public-muted)] transition hover:bg-[var(--public-leaf-light)] hover:text-[var(--public-leaf)] border border-transparent hover:border-[var(--public-leaf)]/20">
            <ShieldCheck aria-hidden className="h-4 w-4" /> 
            Lupa sandi? Hubungi Admin IT
          </a>
        </div>

        {/* Footer Navigation */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-5 text-xs font-bold">
          <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-gold)] rounded-md px-2 py-1">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Kembali ke Beranda
          </Link>
          <Link href="/portal-ortu/login" className="flex items-center gap-2 text-[var(--public-gold-light)] hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-gold)] rounded-md px-2 py-1">
            <UsersRound aria-hidden className="h-4 w-4" /> Portal Orang Tua
          </Link>
        </div>
      </div>
    </main>
  )
}
