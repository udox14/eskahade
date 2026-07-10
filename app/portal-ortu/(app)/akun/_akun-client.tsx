'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Loader2, LogOut, ShieldAlert } from 'lucide-react'
import { gantiPasswordPortal } from './actions'

export function AkunClient({ mustChangePassword }: { mustChangePassword: boolean }) {
  const router = useRouter()
  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleGanti(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (passwordBaru !== konfirmasi) {
      toast.error('Konfirmasi password tidak sama.')
      return
    }
    setSaving(true)
    const res = await gantiPasswordPortal(passwordLama, passwordBaru)
    setSaving(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success('Password berhasil diganti.')
    setPasswordLama('')
    setPasswordBaru('')
    setKonfirmasi('')
    router.replace('/portal-ortu/beranda')
    router.refresh()
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await fetch('/api/portal-ortu/logout', { method: 'POST' }).catch(() => {})
    router.replace('/portal-ortu/login')
    router.refresh()
  }

  const inputCls =
    'mt-1.5 w-full rounded-2xl border border-[var(--p-line)] bg-[var(--p-cream)] px-4 py-3.5 text-sm font-semibold outline-none focus:border-[var(--p-emerald)] focus:ring-2 focus:ring-[var(--p-emerald)]/15'

  return (
    <div className="space-y-4">
      {mustChangePassword && (
        <div className="portal-rise flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5">
          <ShieldAlert className="mt-0.5 w-4 h-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            <span className="font-bold">Demi keamanan, ganti password default Anda</span> sebelum
            menggunakan fitur portal lainnya.
          </p>
        </div>
      )}

      <form
        onSubmit={handleGanti}
        className="portal-rise portal-rise-1 rounded-3xl border border-[var(--p-line)] bg-[var(--p-card)] p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[var(--p-emerald)]" />
          <h2 className="portal-display text-lg text-[var(--p-emerald-deep)]">Ganti Password</h2>
        </div>

        <label className="block mt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password Lama</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passwordLama}
            onChange={e => setPasswordLama(e.target.value)}
            className={inputCls}
            required
          />
        </label>
        <label className="block mt-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password Baru</span>
          <input
            type="password"
            autoComplete="new-password"
            value={passwordBaru}
            onChange={e => setPasswordBaru(e.target.value)}
            minLength={6}
            className={inputCls}
            required
          />
        </label>
        <label className="block mt-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Ulangi Password Baru</span>
          <input
            type="password"
            autoComplete="new-password"
            value={konfirmasi}
            onChange={e => setKonfirmasi(e.target.value)}
            minLength={6}
            className={inputCls}
            required
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full rounded-2xl bg-[var(--p-emerald)] py-3.5 text-sm font-bold text-white active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Menyimpan…' : 'Simpan Password Baru'}
        </button>
      </form>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="portal-rise portal-rise-2 w-full rounded-2xl border border-rose-200 bg-rose-50 py-3.5 text-sm font-bold text-rose-700 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        {loggingOut ? 'Keluar…' : 'Keluar dari Portal'}
      </button>
    </div>
  )
}
