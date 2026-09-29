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
  X,
  ZoomIn,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { formatRupiah } from '@/lib/portal/format'
import { BottomSheet } from '../../_components/bottom-sheet'
import { usePortalTheme } from '../../_components/theme-provider'
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
  namaKelas?: string | null
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
  namaKelas,
  parentLimits,
  globalDailyLimit = 100000,
  pinStatus,
}: AkunClientProps) {
  const router = useRouter()
  const { theme, resolvedTheme, setTheme } = usePortalTheme()
  const [activeSheet, setActiveSheet] = useState<'LIMIT' | 'PIN' | 'PASSWORD' | 'LOGOUT' | null>(null)
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false)

  // Password Form State
  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const parentDaily = parentLimits?.parent_daily_limit ?? null
  const effectiveDaily = parentDaily !== null ? Math.min(globalDailyLimit, parentDaily) : globalDailyLimit

  const asramaKamar = session?.asrama
    ? session.kamar
      ? `${session.asrama}/${session.kamar}`
      : session.asrama
    : '-'

  const namaSantri = session?.nama || 'Santri'
  const namaLen = namaSantri.length
  const nameFontSizeClass =
    namaLen > 40
      ? 'text-lg sm:text-xl'
      : namaLen > 22
      ? 'text-xl sm:text-2xl'
      : 'text-2xl sm:text-3xl'

  const initials =
    namaSantri
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || 'SN'

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
      {/* =============================================================== */}
      {/* 1. HERO PROFILE: SOFT CARD DENGAN FOTO 3:4 & 3 KOLOM HALUS     */}
      {/* =============================================================== */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xs flex flex-col items-center text-center transition-all duration-300">
        {/* Foto 3:4 Besar di Tengah (Klik untuk Fullscreen Lightbox) */}
        <button
          type="button"
          onClick={() => setIsPhotoModalOpen(true)}
          className="relative w-32 sm:w-36 aspect-3/4 rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 shadow-md bg-slate-900 group cursor-pointer active:scale-95 transition-all duration-200 mx-auto"
          aria-label="Foto santri, klik untuk perbesar layar penuh"
          title="Klik foto untuk melihat ukuran penuh"
        >
          {session?.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.foto_url}
              alt={namaSantri}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full bg-emerald-950 text-[#bef264] font-black text-4xl flex items-center justify-center font-mono">
              {initials}
            </div>
          )}

          {/* Subtle Zoom Hint Icon (Discreet di Pojok Bawah) */}
          <span className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-xs text-white p-1 rounded-md opacity-70 group-hover:opacity-100 transition">
            <ZoomIn className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Nama Santri GEDE di Tengah (Maksimal 2 Baris, Auto-size) */}
        <h2
          className={`font-black text-slate-950 dark:text-slate-100 tracking-tight leading-tight line-clamp-2 mt-4 max-w-xs sm:max-w-sm break-words ${nameFontSizeClass}`}
        >
          {namaSantri}
        </h2>

        {/* ============================================================= */}
        {/* IDENTITAS SANTRI: TIGA KOLOM HALUS (NOWRAP, AUTO FIT LEBAR)   */}
        {/* ============================================================= */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 w-full flex items-center justify-center divide-x divide-slate-150 dark:divide-slate-800 text-center">
          <div className="px-2.5 sm:px-3.5 text-center flex-initial">
            <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">NIS</span>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {session?.nis || nis}
            </span>
          </div>
          <div className="px-2.5 sm:px-3.5 text-center flex-initial">
            <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Asrama</span>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {asramaKamar}
            </span>
          </div>
          <div className="px-2.5 sm:px-3.5 text-center flex-initial">
            <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Kelas</span>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase whitespace-nowrap">
              {namaKelas || '-'}
            </span>
          </div>
        </div>
      </section>

      {/* Peringatan Wajib Ganti Password jika masih default */}
      {mustChangePassword && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-500/20">
          <ShieldAlert className="mt-0.5 w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            <span className="font-bold">Keamanan akun:</span> Silakan ganti password default Anda untuk melindungi akses portal orang tua.
          </p>
        </div>
      )}

      {/* =============================================================== */}
      {/* 2. SECTION: TAMPILAN (TEMA DARK / LIGHT / SYSTEM TOGGLE)        */}
      {/* =============================================================== */}
      <section className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Tampilan
        </h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              {resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">Tema Tampilan</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {theme === 'light' ? 'Mode Terang' : theme === 'dark' ? 'Mode Gelap' : 'Ikuti Sistem'}
              </p>
            </div>
          </div>

          {/* Toggle Switch Ikon Saja */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setTheme('light')}
              title="Mode Terang"
              aria-label="Mode Terang"
              className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                theme === 'light'
                  ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              title="Mode Gelap"
              aria-label="Mode Gelap"
              className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-white dark:bg-slate-700 text-indigo-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('system')}
              title="Ikuti Sistem"
              aria-label="Ikuti Sistem"
              className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                theme === 'system'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* =============================================================== */}
      {/* 3. SECTION: UANG JAJAN                                         */}
      {/* =============================================================== */}
      <section className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Uang Jajan
        </h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveSheet('LIMIT')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100/70 dark:active:bg-slate-800 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">Limit Uang Jajan Harian</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Maksimal <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatRupiah(effectiveDaily)}</span> / hari
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">Ubah</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* =============================================================== */}
      {/* 4. SECTION: KEAMANAN & AKSES                                   */}
      {/* =============================================================== */}
      <section className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Keamanan &amp; Akses
        </h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {/* PIN Santri */}
          <button
            type="button"
            onClick={() => setActiveSheet('PIN')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100/70 dark:active:bg-slate-800 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">PIN Santri</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  untuk penarikan uang jajan di koperasi
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  pinStatus?.isLocked
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                    : pinStatus?.hasPin
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                }`}
              >
                {pinStatus?.isLocked ? 'Terkunci' : pinStatus?.hasPin ? 'Aktif' : 'Belum Diatur'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </button>

          {/* Ganti Password Portal */}
          <button
            type="button"
            onClick={() => setActiveSheet('PASSWORD')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100/70 dark:active:bg-slate-800 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">Password Portal</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Kata sandi login akun orang tua
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>
        </div>
      </section>

      {/* =============================================================== */}
      {/* 5. SECTION: AKUN / KELUAR                                      */}
      {/* =============================================================== */}
      <section className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Sesi Akun
        </h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveSheet('LOGOUT')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-rose-50/60 dark:hover:bg-rose-950/30 active:bg-rose-100/70 dark:active:bg-rose-950/50 transition cursor-pointer text-left group"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 flex items-center justify-center group-hover:bg-rose-100 dark:group-hover:bg-rose-900/60 transition">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-rose-700 dark:text-rose-400 group-hover:text-rose-800 dark:group-hover:text-rose-300">
                Keluar dari Portal
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-300 dark:text-rose-500/70 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition" />
          </button>
        </div>
      </section>

      {/* =============================================================== */}
      {/* FULLSCREEN PHOTO LIGHTBOX MODAL                                */}
      {/* =============================================================== */}
      {isPhotoModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-between p-5 transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          {/* Top Action Bar */}
          <div className="w-full flex items-center justify-between text-white pt-2 max-w-md mx-auto">
            <span className="text-xs font-semibold text-slate-300">Foto Profil Santri</span>
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer active:scale-95"
              aria-label="Tutup foto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Photo Display Container */}
          <div
            className="flex-1 flex flex-col items-center justify-center w-full max-w-xs sm:max-w-sm py-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative w-full aspect-3/4 max-h-[62vh] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-slate-900">
              {session?.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.foto_url}
                  alt={namaSantri}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-emerald-950 text-[#bef264] font-black text-6xl flex items-center justify-center font-mono">
                  {initials}
                </div>
              )}
            </div>

            {/* Caption Ringkas */}
            <div className="mt-4 text-center space-y-0.5 text-white">
              <h3 className="text-base font-bold tracking-tight">{namaSantri}</h3>
              <p className="text-xs text-slate-400 font-mono">
                NIS: {session?.nis || nis} · {asramaKamar} · {namaKelas || '-'}
              </p>
            </div>
          </div>

          {/* Bottom Close Button */}
          <div className="w-full max-w-xs pb-3 mx-auto">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              className="w-full min-h-[44px] rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition active:scale-95 cursor-pointer backdrop-blur-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* CONTEXTUAL BOTTOM SHEETS                                        */}
      {/* =============================================================== */}

      {/* Sheet 1: Atur Limit */}
      <BottomSheet
        open={activeSheet === 'LIMIT'}
        onClose={() => setActiveSheet(null)}
        title="Limit Uang Jajan Harian"
        subtitle="Batasi penarikan & belanja di kantin/koperasi"
        icon={<Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
      >
        <WalletLimitCard
          initialDaily={parentLimits?.parent_daily_limit ?? null}
          initialWeekly={parentLimits?.parent_weekly_limit ?? null}
          initialMonthly={parentLimits?.parent_monthly_limit ?? null}
          globalDailyLimit={globalDailyLimit}
          isModal
          onSuccess={() => setActiveSheet(null)}
          onCancel={() => setActiveSheet(null)}
        />
      </BottomSheet>

      {/* Sheet 2: PIN Santri */}
      <BottomSheet
        open={activeSheet === 'PIN'}
        onClose={() => setActiveSheet(null)}
        title="PIN Santri"
        subtitle="untuk penarikan uang jajan di koperasi"
        icon={<KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
      >
        <StudentPinCard
          hasPin={pinStatus?.hasPin ?? false}
          isLocked={pinStatus?.isLocked ?? false}
          santriNama={namaSantri}
          nis={session?.nis || nis}
          isModal
          onSuccess={() => setActiveSheet(null)}
          onCancel={() => setActiveSheet(null)}
        />
      </BottomSheet>

      {/* Sheet 3: Ganti Password */}
      <BottomSheet
        open={activeSheet === 'PASSWORD'}
        onClose={() => setActiveSheet(null)}
        title="Ganti Password"
        subtitle="Kata sandi login portal orang tua"
        icon={<Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
      >
        <form onSubmit={handleGantiPassword} className="space-y-3.5 pt-1">
          <div>
            <label htmlFor="portal-password-old" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Password Saat Ini
            </label>
            <input
              id="portal-password-old"
              type="password"
              autoComplete="current-password"
              value={passwordLama}
              onChange={e => setPasswordLama(e.target.value)}
              placeholder="Masukkan password lama"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
              required
            />
          </div>

          <div>
            <label htmlFor="portal-password-new" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Password Baru (Min. 6 Karakter)
            </label>
            <input
              id="portal-password-new"
              type="password"
              autoComplete="new-password"
              value={passwordBaru}
              onChange={e => setPasswordBaru(e.target.value)}
              minLength={6}
              placeholder="Buat password baru"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
              required
            />
          </div>

          <div>
            <label htmlFor="portal-password-confirm" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ulangi Password Baru
            </label>
            <input
              id="portal-password-confirm"
              type="password"
              autoComplete="new-password"
              value={konfirmasi}
              onChange={e => setKonfirmasi(e.target.value)}
              minLength={6}
              placeholder="Ketik ulang password baru"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
              required
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSheet(null)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingPassword}
              className="flex-1 min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] text-[#bef264] text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" /> : null}
              <span>Perbarui Password</span>
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Sheet 4: Konfirmasi Logout */}
      <BottomSheet
        open={activeSheet === 'LOGOUT'}
        onClose={() => setActiveSheet(null)}
        title="Keluar dari Portal?"
        subtitle="Sesi login santri ini akan berakhir. Anda bisa masuk kembali kapan saja dengan NIS dan password."
        icon={<LogOut className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveSheet(null)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95 transition"
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : null}
              <span>Ya, Keluar</span>
            </button>
          </>
        }
      >
        <div className="py-2 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Pastikan Anda telah menyimpan atau mencatat kuitansi dan transaksi yang diperlukan sebelum keluar.
          </p>
        </div>
      </BottomSheet>
    </div>
  )
}
