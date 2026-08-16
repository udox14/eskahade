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
    <div className="portal-card bg-[var(--p-white)] p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--p-ink)]">NIS Santri</label>
          <input
            inputMode="numeric"
            autoComplete="username"
            value={nis}
            onChange={e => setNis(e.target.value.replace(/\s/g, ''))}
            placeholder="Contoh: 20240123"
            disabled={loading}
            className="portal-field"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--p-ink)]">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="portal-field pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--p-radius-sm)] text-[var(--p-muted)] transition hover:text-[var(--p-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--p-ink)]"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeSlash aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-[var(--p-radius-sm)] border border-[#f3c6c2] bg-[var(--p-danger-soft)] px-4 py-3 text-xs font-semibold text-[var(--p-red)]">
            {error}
          </p>
        )}

        <div className="pt-2">
          <button type="submit" disabled={loading} className="portal-btn portal-btn-primary w-full">
            {loading ? <><CircleNotch aria-hidden className="h-4 w-4 animate-spin" /> Memeriksa...</> : 'Masuk Portal Orang Tua'}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-[var(--p-radius-sm)] border border-[var(--p-line)] bg-[var(--p-paper)] p-3.5">
        <p className="text-xs leading-relaxed text-[var(--p-ink)]">
          <span className="font-bold">Info Login:</span> Gunakan <span className="font-bold">NIS</span> santri &amp; password default (NIS atau tanggal lahir santri).
        </p>
      </div>
    </div>
  )
}
