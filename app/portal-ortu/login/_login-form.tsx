'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleNotch, Eye, EyeSlash } from '@phosphor-icons/react'

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
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-xl shadow-[#12372a]/5 border border-[#ddd4c3]/60">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-[#12372a]">NIS Santri</label>
          <input 
            inputMode="numeric" 
            autoComplete="username" 
            value={nis} 
            onChange={e => setNis(e.target.value.replace(/\s/g, ''))} 
            placeholder="Contoh: 20240123" 
            disabled={loading} 
            className="w-full rounded-xl border border-[#ddd4c3] bg-white px-4 py-2.5 text-sm text-[#1c2923] transition-colors placeholder:text-gray-400 focus:border-[#247451] focus:outline-none focus:ring-2 focus:ring-[#247451]/20 disabled:opacity-60 disabled:bg-gray-50" 
            required 
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-[#12372a]">Password</label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'} 
              autoComplete="current-password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              disabled={loading} 
              className="w-full rounded-xl border border-[#ddd4c3] bg-white pl-4 pr-10 py-2.5 text-sm text-[#1c2923] transition-colors placeholder:text-gray-400 focus:border-[#247451] focus:outline-none focus:ring-2 focus:ring-[#247451]/20 disabled:opacity-60 disabled:bg-gray-50" 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(v => !v)} 
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#247451]" 
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeSlash aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</p>}
        
        <div className="pt-2">
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#247451] py-3 text-sm font-extrabold text-white shadow-md shadow-[#247451]/20 hover:bg-[#1d6345] focus:outline-none focus:ring-2 focus:ring-[#247451] focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
            {loading ? <><CircleNotch aria-hidden className="h-4 w-4 animate-spin text-[#c9952e]" /> Memeriksa...</> : 'Masuk Portal Orang Tua'}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-[#ddd4c3]/60 bg-[#f7f1e5]/60 p-3.5">
        <p className="text-xs leading-relaxed text-[#12372a]">
          <span className="font-bold">Info Login:</span> Gunakan <span className="font-bold">NIS</span> santri & password default (NIS atau tanggal lahir santri).
        </p>
      </div>
    </div>
  )
}
