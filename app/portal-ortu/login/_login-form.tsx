'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, User } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [nis, setNis] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/portal-ortu/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nis: nis.trim(), password: password.trim() }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'NIS atau password salah.'); setLoading(false); return }
      router.replace(data.mustChangePassword ? '/portal-ortu/akun?wajib=1' : '/portal-ortu/beranda')
      router.refresh()
    } catch { setError('Gagal terhubung ke server. Coba lagi.'); setLoading(false) }
  }

  return (
    <div className="bg-[var(--public-paper)] rounded-[2.5rem] p-8 sm:p-10 shadow-[0_30px_60px_rgba(0,0,0,.3)] border border-[var(--public-line)]/50 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[var(--public-leaf)] via-[var(--public-gold)] to-[var(--public-leaf)] opacity-80" />
      
      <form onSubmit={handleSubmit} className="space-y-6 mt-2">
        <div className="space-y-2">
          <label className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[var(--public-muted)]">NIS Santri</label>
          <div className="relative">
            <User aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--public-muted)]/70" />
            <input 
              inputMode="numeric" 
              autoComplete="username" 
              value={nis} 
              onChange={e => setNis(e.target.value.replace(/\s/g, ''))} 
              placeholder="Contoh: 20240123" 
              disabled={loading} 
              className="w-full rounded-2xl border border-[var(--public-line)] bg-white py-4 pl-12 pr-4 text-sm font-bold text-[var(--public-forest)] transition-all placeholder:text-[var(--public-muted)]/50 placeholder:font-normal focus:border-[var(--public-leaf)] focus:outline-none focus:ring-4 focus:ring-[var(--public-leaf)]/10 disabled:opacity-60" 
              required 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[var(--public-muted)]">Password</label>
          <div className="relative">
            <KeyRound aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--public-muted)]/70" />
            <input 
              type={showPassword ? 'text' : 'password'} 
              autoComplete="current-password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Masukkan password" 
              disabled={loading} 
              className="w-full rounded-2xl border border-[var(--public-line)] bg-white py-4 pl-12 pr-12 text-sm font-bold text-[var(--public-forest)] transition-all placeholder:text-[var(--public-muted)]/50 placeholder:font-normal focus:border-[var(--public-leaf)] focus:outline-none focus:ring-4 focus:ring-[var(--public-leaf)]/10 disabled:opacity-60" 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(v => !v)} 
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--public-muted)] transition hover:bg-[var(--public-leaf-light)] hover:text-[var(--public-leaf)] focus:outline-none focus:ring-2 focus:ring-[var(--public-leaf)]" 
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl border border-[var(--public-danger)]/20 bg-[var(--public-danger)]/10 px-4 py-3 text-[11px] font-bold leading-5 text-[var(--public-danger)]">{error}</p>}
        
        <button type="submit" disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--public-forest)] py-4 text-sm font-extrabold text-white transition-all hover:bg-[var(--public-forest-deep)] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[var(--public-forest)]/20 disabled:opacity-70 disabled:cursor-not-allowed">
          {loading ? <><Loader2 aria-hidden className="h-5 w-5 animate-spin" /> Memeriksa...</> : <>Masuk ke Portal <ArrowRight aria-hidden className="h-5 w-5" /></>}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-[var(--public-gold)]/25 bg-[var(--public-gold-light)]/40 p-4">
        <p className="text-[11px] leading-relaxed text-[#6f531c]">
          <span className="font-extrabold block mb-1">Login pertama kali?</span> 
          Password awal adalah <span className="font-extrabold">NIS</span> atau <span className="font-extrabold">tanggal lahir</span> putra Anda (format TGLBLNTHN, contoh: 01072012).
        </p>
      </div>
    </div>
  )
}
