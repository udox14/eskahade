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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Portal Pengurus</h1>
          <p className="mt-2 text-sm text-gray-500">Masuk ke sistem manajemen operasional pesantren.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 sm:p-10 shadow-xl shadow-gray-200/40">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Email</label>
              <div className="relative">
                <Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input 
                  name="email" 
                  type="email" 
                  required 
                  autoComplete="username" 
                  placeholder="admin@sukahideng.or.id" 
                  disabled={isSubmitting} 
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm font-medium text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--public-leaf)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Password</label>
              <div className="relative">
                <Lock aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  autoComplete="current-password" 
                  placeholder="Masukkan password" 
                  disabled={isSubmitting} 
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-12 text-sm font-medium text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--public-leaf)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 disabled:opacity-60"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--public-leaf)]" 
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--public-leaf)] py-4 text-sm font-bold text-white transition hover:bg-[#1d6345] focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-70 disabled:cursor-not-allowed">
              {isSubmitting ? <><Loader2 aria-hidden className="h-5 w-5 animate-spin" /> Memproses...</> : <>Masuk ke Dashboard <ArrowRight aria-hidden className="h-5 w-5" /></>}
            </button>
          </form>

          <a href="https://wa.me/6282218943383" target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-3 text-xs font-medium text-gray-600 transition hover:bg-gray-100">
            <ShieldCheck aria-hidden className="h-4 w-4" /> 
            Lupa sandi? Hubungi Admin IT
          </a>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-medium">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Kembali ke Beranda
          </Link>
          <Link href="/portal-ortu/login" className="flex items-center gap-2 text-[var(--public-leaf)] hover:text-[#1d6345] transition">
            <UsersRound aria-hidden className="h-4 w-4" /> Portal Orang Tua
          </Link>
        </div>
      </div>
    </main>
  )
}
