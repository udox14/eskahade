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
          <h1 className="text-2xl font-black text-[#12372a] tracking-tight">Portal Internal</h1>
          <p className="mt-1.5 text-xs font-semibold text-[#66736c]">Silakan masuk ke akun Anda.</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-xl shadow-[#12372a]/5 border border-[#ddd4c3]/60">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#12372a]">Email / Username</label>
              <input 
                name="email" 
                type="email" 
                required 
                autoComplete="username" 
                placeholder="admin@sukahideng.or.id" 
                disabled={isSubmitting} 
                className="w-full rounded-xl border border-[#ddd4c3] bg-white px-4 py-2.5 text-sm text-[#1c2923] transition-colors placeholder:text-gray-400 focus:border-[#247451] focus:outline-none focus:ring-2 focus:ring-[#247451]/20 disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#12372a]">Password</label>
              <div className="relative">
                <input 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  autoComplete="current-password" 
                  placeholder="••••••••" 
                  disabled={isSubmitting} 
                  className="w-full rounded-xl border border-[#ddd4c3] bg-white pl-4 pr-10 py-2.5 text-sm text-[#1c2923] transition-colors placeholder:text-gray-400 focus:border-[#247451] focus:outline-none focus:ring-2 focus:ring-[#247451]/20 disabled:opacity-60 disabled:bg-gray-50"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#247451]" 
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12372a] py-3 text-sm font-extrabold text-white shadow-md shadow-[#12372a]/20 hover:bg-[#09251c] focus:outline-none focus:ring-2 focus:ring-[#12372a] focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
                {isSubmitting ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin text-[#c9952e]" /> Memproses...</> : 'Masuk Portal Internal'}
              </button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <a href="https://wa.me/6282218943383" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#66736c] hover:text-[#12372a] transition-colors">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-[#247451]" /> 
              Lupa sandi? Hubungi Admin IT
            </a>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col items-center gap-3.5 text-sm">
          <Link href="/portal-ortu/login" className="group flex items-center gap-1 text-[#247451] font-bold hover:text-[#12372a] transition-colors">
            Masuk Portal Orang Tua <ChevronRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-[#66736c] hover:text-[#12372a] transition-colors text-xs font-semibold">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
