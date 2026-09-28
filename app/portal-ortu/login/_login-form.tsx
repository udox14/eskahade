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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="portal-login-nis" className="block text-xs font-semibold text-slate-700">NIS Santri</label>
          <input
            id="portal-login-nis"
            inputMode="numeric"
            autoComplete="username"
            value={nis}
            onChange={e => setNis(e.target.value.replace(/\s/g, ''))}
            placeholder="Contoh: 20240123"
            disabled={loading}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden disabled:bg-slate-100 transition"
            required
          />
        </div>

        <div>
          <label htmlFor="portal-login-password" className="block text-xs font-semibold text-slate-700">Password</label>
          <div className="relative mt-1">
            <input
              id="portal-login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden disabled:bg-slate-100 transition"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:text-slate-900 focus:outline-hidden"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeSlash aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            {error}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-semibold text-white shadow-xs transition active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> Memeriksa...</> : 'Masuk Portal Orang Tua'}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed">
        <p>
          <span className="font-semibold text-slate-800">Info Login:</span> Gunakan <span className="font-semibold text-slate-800">NIS</span> santri &amp; password default (NIS atau tanggal lahir santri).
        </p>
      </div>
    </div>
  )
}
