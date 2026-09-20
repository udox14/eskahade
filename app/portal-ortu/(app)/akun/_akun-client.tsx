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
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 shadow-xs">
          <ShieldWarning className="mt-0.5 w-4 h-4 shrink-0 text-amber-600" />
          <p className="leading-relaxed">
            <span className="font-bold">Demi keamanan, ganti password default Anda</span> sebelum
            menggunakan fitur portal lainnya.
          </p>
        </div>
      )}

      <form
        onSubmit={handleGanti}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Ganti Password</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Ini adalah password login untuk akun <span className="font-semibold text-slate-700">NIS {nis}</span>. Jika Anda
            punya lebih dari satu anak dan baru memakai menu Saldo santri lain, pastikan NIS di atas
            benar sebelum menyimpan.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Password Lama</label>
          <input
            type="password"
            autoComplete="current-password"
            value={passwordLama}
            onChange={e => setPasswordLama(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Password Baru</label>
          <input
            type="password"
            autoComplete="new-password"
            value={passwordBaru}
            onChange={e => setPasswordBaru(e.target.value)}
            minLength={6}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Ulangi Password Baru</label>
          <input
            type="password"
            autoComplete="new-password"
            value={konfirmasi}
            onChange={e => setKonfirmasi(e.target.value)}
            minLength={6}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving && <CircleNotch className="w-4 h-4 animate-spin" />}
          <span>{saving ? 'Menyimpan…' : 'Simpan Password Baru'}</span>
        </button>
      </form>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 py-2.5 text-xs font-semibold text-rose-700 transition flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
      >
        <SignOut className="w-4 h-4" />
        <span>{loggingOut ? 'Keluar…' : 'Keluar dari Portal'}</span>
      </button>
    </div>
  )
}
