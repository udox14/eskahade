'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Eye, EyeOff, Loader2, ShieldCheck, UsersRound } from 'lucide-react'
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Portal Pengurus</h1>
          <p className="mt-2 text-sm text-gray-500">Silakan masuk ke akun Anda.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.04]">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-900">Email</label>
              <input 
                name="email" 
                type="email" 
                required 
                autoComplete="username" 
                placeholder="admin@sukahideng.or.id" 
                disabled={isSubmitting} 
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--public-leaf)] focus:outline-none focus:ring-1 focus:ring-[var(--public-leaf)] disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-900">Password</label>
              <div className="relative">
                <input 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  autoComplete="current-password" 
                  placeholder="••••••••" 
                  disabled={isSubmitting} 
                  className="w-full rounded-xl border border-gray-200 bg-white pl-4 pr-10 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--public-leaf)] focus:outline-none focus:ring-1 focus:ring-[var(--public-leaf)] disabled:opacity-60 disabled:bg-gray-50"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--public-leaf)]" 
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--public-forest)] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d281e] focus:outline-none focus:ring-2 focus:ring-[var(--public-forest)] focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Memproses...</> : 'Masuk'}
              </button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <a href="https://wa.me/6282218943383" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> 
              Lupa sandi? Hubungi Admin IT
            </a>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col items-center gap-4 text-sm">
          <Link href="/portal-ortu/login" className="group flex items-center gap-1 text-[var(--public-forest)] font-medium hover:text-[var(--public-leaf)] transition-colors">
            Login sebagai Orang Tua <ChevronRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-xs">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
