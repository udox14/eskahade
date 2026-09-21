'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  KeyRound,
  Lock,
  LogOut,
  Wallet,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { formatRupiah } from '@/lib/portal/format'
import { BottomSheet } from '../../_components/bottom-sheet'
import { WalletLimitCard } from './_wallet-limit-card'
import { StudentPinCard } from './_student-pin-card'
import { gantiPasswordPortal } from './actions'

interface AkunClientProps {
  mustChangePassword?: boolean
  nis: string
  session?: {
    nama: string
    nis: string
    asrama?: string | null
    kamar?: string | null
    foto_url?: string | null
    must_change_password?: boolean
  }
  parentLimits?: {
    parent_daily_limit: number | null
    parent_weekly_limit: number | null
    parent_monthly_limit: number | null
  } | null
  globalDailyLimit?: number
  pinStatus?: {
    hasPin: boolean
    isLocked: boolean
  } | null
}

export function AkunClient({
  mustChangePassword = false,
  nis,
  session,
  parentLimits,
  globalDailyLimit = 100000,
  pinStatus,
}: AkunClientProps) {
  const router = useRouter()
  const [activeSheet, setActiveSheet] = useState<'LIMIT' | 'PIN' | 'PASSWORD' | 'LOGOUT' | null>(null)

  // Password Form State
  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const parentDaily = parentLimits?.parent_daily_limit ?? null
  const effectiveDaily = parentDaily !== null ? Math.min(globalDailyLimit, parentDaily) : globalDailyLimit

  async function handleGantiPassword(e: React.FormEvent) {
    e.preventDefault()
    if (savingPassword) return
    if (passwordBaru !== konfirmasi) {
      toast.error('Konfirmasi password tidak sesuai.')
      return
    }
    setSavingPassword(true)
    const res = await gantiPasswordPortal(passwordLama, passwordBaru)
    setSavingPassword(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success('Password berhasil diperbarui!')
    setPasswordLama('')
    setPasswordBaru('')
    setKonfirmasi('')
    setActiveSheet(null)
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
    <div className="space-y-6">
      {/* 1. TOP: PROFILE SUMMARY SEDERHANA (Tanpa Card Pembungkus Besar) */}
      <div className="flex items-center gap-3.5 py-1">
        <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shadow-2xs">
          {session?.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.foto_url} alt={session.nama} className="w-full h-full object-cover" />
          ) : (
            <span>{session?.nama ? session.nama.charAt(0) : 'S'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900 truncate">
            {session?.nama || 'Wali Santri'}
          </h2>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            NIS {session?.nis || nis}
            {session?.asrama ? ` · Asrama ${session.asrama}` : ''}
            {session?.kamar ? ` (${session.kamar})` : ''}
          </p>
        </div>
      </div>

      {/* Peringatan Wajib Ganti Password jika masih default */}
      {mustChangePassword && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 p-3.5 text-xs text-amber-900 border border-amber-500/20">
          <ShieldAlert className="mt-0.5 w-4 h-4 shrink-0 text-amber-600" />
          <p className="leading-relaxed">
            <span className="font-bold">Keamanan akun:</span> Silakan ganti password default Anda untuk melindungi akses portal orang tua.
          </p>
        </div>
      )}

      {/* 2. SECTION: UANG JAJAN (Android Settings Style) */}
      <div className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1">
          Uang Jajan
        </h3>
        <div className="divide-y divide-slate-100">
          <button
            type="button"
            onClick={() => setActiveSheet('LIMIT')}
            className="w-full flex items-center justify-between py-3.5 hover:bg-slate-50/70 active:scale-[0.99] transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Atur limit</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {formatRupiah(effectiveDaily)}/hari
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* 3. SECTION: KEAMANAN */}
      <div className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1">
          Keamanan
        </h3>
        <div className="divide-y divide-slate-100">
          <button
            type="button"
            onClick={() => setActiveSheet('PIN')}
            className="w-full flex items-center justify-between py-3.5 hover:bg-slate-50/70 active:scale-[0.99] transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-800">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Ubah PIN transaksi</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {pinStatus?.isLocked
                    ? 'PIN santri sedang terkunci'
                    : pinStatus?.hasPin
                    ? 'PIN aktif'
                    : 'Belum diatur'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('PASSWORD')}
            className="w-full flex items-center justify-between py-3.5 hover:bg-slate-50/70 active:scale-[0.99] transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Ganti password</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  Password portal orang tua
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* 4. SECTION: AKUN */}
      <div className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1">
          Akun
        </h3>
        <div className="divide-y divide-slate-100">
          <button
            type="button"
            onClick={() => setActiveSheet('LOGOUT')}
            className="w-full flex items-center justify-between py-3.5 hover:bg-rose-50/40 active:scale-[0.99] transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                <LogOut className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-rose-700">
                Keluar
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-300 shrink-0" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CONTEXTUAL BOTTOM SHEETS (Progressive Disclosure)
          ───────────────────────────────────────────────────────────── */}

      {/* Sheet 1: Atur Limit */}
      <BottomSheet
        open={activeSheet === 'LIMIT'}
        onClose={() => setActiveSheet(null)}
        title="Batas Limit Uang Jajan"
      >
        <WalletLimitCard
          initialDaily={parentLimits?.parent_daily_limit ?? null}
          initialWeekly={parentLimits?.parent_weekly_limit ?? null}
          initialMonthly={parentLimits?.parent_monthly_limit ?? null}
          globalDailyLimit={globalDailyLimit}
          isModal
          onSuccess={() => setActiveSheet(null)}
        />
      </BottomSheet>

      {/* Sheet 2: PIN Santri */}
      <BottomSheet
        open={activeSheet === 'PIN'}
        onClose={() => setActiveSheet(null)}
        title="PIN Transaksi Santri"
      >
        <StudentPinCard
          hasPin={pinStatus?.hasPin ?? false}
          isLocked={pinStatus?.isLocked ?? false}
          santriNama={session?.nama || 'Santri'}
          nis={session?.nis || nis}
          isModal
          onSuccess={() => setActiveSheet(null)}
        />
      </BottomSheet>

      {/* Sheet 3: Ganti Password */}
      <BottomSheet
        open={activeSheet === 'PASSWORD'}
        onClose={() => setActiveSheet(null)}
        title="Ganti Password Portal"
      >
        <form onSubmit={handleGantiPassword} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Password Lama</label>
            <input
              type="password"
              autoComplete="current-password"
              value={passwordLama}
              onChange={e => setPasswordLama(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden"
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
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden"
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
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              required
            />
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="w-full min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] py-2.5 text-xs font-bold text-[#bef264] shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" /> : null}
            <span>Simpan Password Baru</span>
          </button>
        </form>
      </BottomSheet>

      {/* Sheet 4: Konfirmasi Logout */}
      <BottomSheet
        open={activeSheet === 'LOGOUT'}
        onClose={() => setActiveSheet(null)}
        title="Keluar dari Portal"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin mengakhiri sesi login Portal Orang Tua untuk santri ini?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveSheet(null)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer active:scale-95 transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 transition"
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
