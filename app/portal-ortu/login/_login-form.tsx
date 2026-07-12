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
    <div className="bg-white rounded-[2rem] border border-gray-100 p-6 sm:p-10 shadow-xl shadow-gray-200/40">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">NIS Santri</label>
          <div className="relative">
            <User aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input 
              inputMode="numeric" 
              autoComplete="username" 
              value={nis} 
              onChange={e => setNis(e.target.value.replace(/\s/g, ''))} 
              placeholder="Contoh: 20240123" 
              disabled={loading} 
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm font-medium text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--public-leaf)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 disabled:opacity-60" 
              required 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Password</label>
          <div className="relative">
            <KeyRound aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input 
              type={showPassword ? 'text' : 'password'} 
              autoComplete="current-password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Masukkan password" 
              disabled={loading} 
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-12 text-sm font-medium text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--public-leaf)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 disabled:opacity-60" 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(v => !v)} 
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--public-leaf)]" 
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-700">{error}</p>}
        
        <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--public-leaf)] py-4 text-sm font-bold text-white transition hover:bg-[#1d6345] focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-70 disabled:cursor-not-allowed">
          {loading ? <><Loader2 aria-hidden className="h-5 w-5 animate-spin" /> Memeriksa...</> : <>Masuk ke Portal <ArrowRight aria-hidden className="h-5 w-5" /></>}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <p className="text-xs leading-relaxed text-emerald-800">
          <span className="font-bold block mb-1">Login pertama kali?</span> 
          Password awal adalah <span className="font-bold text-emerald-900">NIS</span> atau <span className="font-bold text-emerald-900">tanggal lahir</span> putra Anda (format TGLBLNTHN, contoh: 01072012).
        </p>
      </div>
    </div>
  )
}
