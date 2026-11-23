'use client'

import { useEffect, useState } from 'react'
import { BellRinging, BellSlash, CircleNotch, Export, PlusSquare, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useWebPush, type WebPushStatus } from './use-web-push'

const DISMISS_KEY = 'eskahade_push_prompt_dismissed_at'
const DISMISS_MS = 7 * 86400_000

function InstallSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
      <li className="flex items-start gap-2"><Export className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Ketuk tombol <b>Bagikan</b> di Safari.</li>
      <li className="flex items-start gap-2"><PlusSquare className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Pilih <b>Tambahkan ke Layar Utama</b>.</li>
      <li className="flex items-start gap-2"><BellRinging className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Buka ESKAHADE dari ikon di Layar Utama, lalu aktifkan notifikasi.</li>
    </ol>
  )
}

const TEXT: Record<Exclude<WebPushStatus, 'loading' | 'unsupported' | 'not-configured'>, string> = {
  'needs-install': 'Di iPhone/iPad, notifikasi hanya bisa diterima setelah ESKAHADE ditambahkan ke Layar Utama.',
  denied: 'Izin notifikasi diblokir. Buka pengaturan situs di browser, izinkan Notifikasi, lalu muat ulang halaman.',
  available: 'Terima kabar penting langsung di perangkat ini, walau aplikasi sedang tidak dibuka.',
  enabled: 'Notifikasi aktif di perangkat ini.',
  error: 'Status notifikasi perangkat ini belum dapat diperiksa. Coba muat ulang halaman.',
}

/** Kontrol lengkap: dipakai di halaman Notifikasi & Akun. Tidak tampil bila push tidak relevan. */
export function PushToggleCard({ audience, ownerKey, className }: { audience: 'staff' | 'portal'; ownerKey: string; className?: string }) {
  const { status, busy, error, enable, disable } = useWebPush(audience, ownerKey)
  if (status === 'loading' || status === 'unsupported' || status === 'not-configured') return null
  const enabled = status === 'enabled'
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5', className)}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>
          {enabled ? <BellRinging className="h-5 w-5" aria-hidden="true" /> : <BellSlash className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifikasi di perangkat ini</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{TEXT[status]}</p>
          {status === 'needs-install' && <InstallSteps />}
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          {(status === 'available' || enabled) && (
            <button
              type="button"
              onClick={enabled ? disable : enable}
              disabled={busy}
              className={cn('mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60',
                enabled
                  ? 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700')}
            >
              {busy && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {enabled ? 'Matikan di perangkat ini' : 'Aktifkan notifikasi'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Ajakan ringkas di beranda portal; bisa ditutup (muncul lagi setelah 7 hari). */
export function PushPromptBanner({ audience, ownerKey }: { audience: 'staff' | 'portal'; ownerKey: string }) {
  const { status, busy, error, enable } = useWebPush(audience, ownerKey)
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    const timer = window.setTimeout(() => setDismissed(Date.now() - at < DISMISS_MS), 0)
    return () => window.clearTimeout(timer)
  }, [])
  if (dismissed || (status !== 'available' && status !== 'needs-install')) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 pr-10 dark:border-emerald-900 dark:bg-emerald-950/30">
      <button type="button" onClick={dismiss} aria-label="Tutup" className="absolute right-2 top-2 rounded-full p-1.5 text-slate-500 hover:bg-white/70 dark:hover:bg-slate-800">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aktifkan notifikasi</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {status === 'needs-install' ? TEXT['needs-install'] : 'Dapatkan kabar pembayaran, tagihan, dan uang jajan langsung di HP.'}
      </p>
      {status === 'needs-install' ? <InstallSteps /> : (
        <button type="button" onClick={enable} disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {busy && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Aktifkan
        </button>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
