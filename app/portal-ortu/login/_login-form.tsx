'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CircleUserRound, Eye, EyeOff, KeyRound, Loader2, User } from 'lucide-react'

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
    <div className="rounded-[2rem] border border-[var(--public-line)] bg-[var(--public-paper)] p-6 shadow-[0_28px_80px_rgba(18,55,42,.13)] sm:p-9">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--public-gold-light)] text-[#735417]"><CircleUserRound aria-hidden className="h-6 w-6" /></span>
      <h2 className="public-display mt-6 text-3xl font-semibold text-[var(--public-forest)] sm:text-4xl">Portal Orang Tua</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">Gunakan NIS putra Anda sebagai nama pengguna.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="public-field block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[.13em] text-[var(--public-muted)]">NIS Santri</span><span className="relative block"><User aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" /><input inputMode="numeric" autoComplete="username" value={nis} onChange={e => setNis(e.target.value.replace(/\s/g, ''))} placeholder="Contoh: 20240123" disabled={loading} className="py-3 pl-11 pr-4 text-sm font-semibold placeholder:font-normal placeholder:text-[var(--public-muted)]/50" required /></span></label>
        <label className="public-field block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[.13em] text-[var(--public-muted)]">Password</span><span className="relative block"><KeyRound aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" disabled={loading} className="py-3 pl-11 pr-12 text-sm font-semibold placeholder:font-normal placeholder:text-[var(--public-muted)]/50" required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--public-muted)] transition hover:bg-[var(--public-leaf-light)] hover:text-[var(--public-leaf)] focus-visible:outline-3 focus-visible:outline-[var(--public-gold)]" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}</button></span></label>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-700">{error}</p>}
        <button type="submit" disabled={loading} className="public-button public-button-primary w-full py-4 text-sm">{loading ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Memeriksa...</> : <>Masuk ke Portal <ArrowRight aria-hidden className="h-4 w-4" /></>}</button>
      </form>

      <div className="mt-5 rounded-2xl border border-[var(--public-gold)]/25 bg-[var(--public-gold-light)]/45 px-4 py-3"><p className="text-[11px] leading-relaxed text-[#6f531c]"><span className="font-extrabold">Login pertama kali?</span> Password awal adalah <span className="font-extrabold">NIS</span> atau <span className="font-extrabold">tanggal lahir</span> putra Anda (format TGLBLNTHN, contoh: 01072012). Anda akan diminta menggantinya.</p></div>
    </div>
  )
}
