'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound, Loader2, User } from 'lucide-react'

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
      const res = await fetch('/api/portal-ortu/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nis: nis.trim(), password: password.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'NIS atau password salah.')
        setLoading(false)
        return
      }
      router.replace(data.mustChangePassword ? '/portal-ortu/akun?wajib=1' : '/portal-ortu/beranda')
      router.refresh()
    } catch {
      setError('Gagal terhubung ke server. Coba lagi.')
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="portal-rise portal-rise-2 bg-[var(--p-card)] border border-[var(--p-line)] rounded-3xl shadow-[0_18px_40px_-18px_rgba(11,94,63,0.35)] p-6"
    >
      <h2 className="portal-display text-xl text-[var(--p-emerald-deep)]">Masuk</h2>
      <p className="mt-1 text-xs text-[var(--p-muted)]">
        Gunakan NIS putra Anda sebagai nama pengguna.
      </p>

      <label className="block mt-5">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">NIS Santri</span>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--p-line)] bg-[var(--p-cream)] px-4 focus-within:border-[var(--p-emerald)] focus-within:ring-2 focus-within:ring-[var(--p-emerald)]/15">
          <User className="w-4 h-4 shrink-0 text-[var(--p-muted)]" />
          <input
            inputMode="numeric"
            autoComplete="username"
            value={nis}
            onChange={e => setNis(e.target.value.replace(/\s/g, ''))}
            placeholder="Contoh: 20240123"
            className="w-full bg-transparent py-3.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[var(--p-muted)]/60"
            required
          />
        </div>
      </label>

      <label className="block mt-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password</span>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--p-line)] bg-[var(--p-cream)] px-4 focus-within:border-[var(--p-emerald)] focus-within:ring-2 focus-within:ring-[var(--p-emerald)]/15">
          <KeyRound className="w-4 h-4 shrink-0 text-[var(--p-muted)]" />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password Anda"
            className="w-full bg-transparent py-3.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[var(--p-muted)]/60"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="p-1 text-[var(--p-muted)]"
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-2xl bg-[var(--p-emerald)] py-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Memeriksa…' : 'Masuk ke Portal'}
      </button>

      <div className="mt-5 rounded-2xl bg-[var(--p-gold-soft)] border border-[var(--p-gold)]/20 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-[#7a5a17]">
          <span className="font-bold">Login pertama kali?</span> Password awal adalah{' '}
          <span className="font-bold">NIS</span> atau <span className="font-bold">tanggal lahir</span> putra
          Anda (format TGLBLNTHN, contoh: 01072012). Anda akan diminta menggantinya.
        </p>
      </div>
    </form>
  )
}
