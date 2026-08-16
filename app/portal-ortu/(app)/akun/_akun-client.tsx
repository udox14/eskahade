'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleNotch, Key, ShieldWarning, SignOut } from '@phosphor-icons/react'
import { gantiPasswordPortal } from './actions'

export function AkunClient({ mustChangePassword, nis }: { mustChangePassword: boolean; nis: string }) {
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

  return (
    <div className="space-y-4">
      {mustChangePassword && (
        <div className="portal-rise flex items-start gap-3 rounded-[var(--p-radius-md)] border-l-4 border-[var(--p-warning)] bg-[var(--p-warning-soft)] px-4 py-3.5">
          <ShieldWarning className="mt-0.5 w-4 h-4 shrink-0 text-[var(--p-warning)]" />
          <p className="text-xs leading-relaxed text-[var(--p-ink)]">
            <span className="font-bold">Demi keamanan, ganti password default Anda</span> sebelum
            menggunakan fitur portal lainnya.
          </p>
        </div>
      )}

      <form
        onSubmit={handleGanti}
        className="portal-rise portal-rise-1 portal-card p-5"
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[var(--p-ink)]" />
          <h2 className="portal-display text-lg text-[var(--p-ink)]">Ganti Password</h2>
        </div>
        <p className="mt-1 text-[11px] text-[var(--p-muted)]">
          Ini adalah password login untuk akun <span className="font-bold">NIS {nis}</span>. Jika Anda
          punya lebih dari satu anak dan baru memakai &ldquo;Ganti Anak&rdquo; di menu Saldo, pastikan NIS di atas
          benar sebelum menyimpan — password baru hanya berlaku untuk NIS tersebut.
        </p>

        <label className="block mt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password Lama</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passwordLama}
            onChange={e => setPasswordLama(e.target.value)}
            className="portal-field"
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
            className="portal-field"
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
            className="portal-field"
            required
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="portal-btn portal-btn-primary w-full mt-5"
        >
          {saving && <CircleNotch className="w-4 h-4 animate-spin" />}
          {saving ? 'Menyimpan…' : 'Simpan Password Baru'}
        </button>
      </form>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="portal-btn portal-btn-danger-outline w-full portal-rise portal-rise-2"
      >
        <SignOut className="w-4 h-4" />
        {loggingOut ? 'Keluar…' : 'Keluar dari Portal'}
      </button>
    </div>
  )
}
