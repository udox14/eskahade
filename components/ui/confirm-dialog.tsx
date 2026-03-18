'use client'

/**
 * ConfirmDialogProvider + useConfirm
 *
 * Mount provider INI SEKALI di client-layout.tsx, lalu gunakan hook
 * useConfirm() di semua handler sebagai pengganti window.confirm().
 *
 * POLA PEMAKAIAN (ganti semua confirm() lama):
 *
 *   // Sebelum:
 *   const handleHapus = () => {
 *     if (!confirm('Hapus ini?')) return
 *     ...
 *   }
 *
 *   // Sesudah:
 *   const confirm = useConfirm()
 *   const handleHapus = async () => {
 *     if (!await confirm('Hapus ini?')) return
 *     ...
 *   }
 *
 * Tidak perlu import apapun selain useConfirm — dialog tampil otomatis
 * karena provider sudah terpasang di layout.
 */

import {
  useEffect, useRef, useState, useCallback,
  createContext, useContext,
} from 'react'
import { AlertTriangle, Trash2, Info, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type DialogVariant = 'danger' | 'warning' | 'success' | 'info'

export interface ConfirmOptions {
  /** Override teks judul (default: diekstrak dari message) */
  title?: string
  /** Override label tombol konfirmasi */
  confirmLabel?: string
  /** Override label tombol batal */
  cancelLabel?: string
  /** Override variant warna/ikon */
  variant?: DialogVariant
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmFn | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detect variant dari pesan
// ─────────────────────────────────────────────────────────────────────────────
function detectVariant(msg: string): DialogVariant {
  const m = msg.toLowerCase()
  if (
    m.includes('hapus') || m.includes('permanen') || m.includes('tidak bisa dibatalkan') ||
    m.includes('reset') || m.includes('dihapus') || m.includes('alumni') || m.includes('⚠️')
  ) return 'danger'
  if (
    m.includes('yakin') || m.includes('pastikan') || m.includes('vonis') ||
    m.includes('telat') || m.includes('peringatan')
  ) return 'warning'
  if (
    m.includes('simpan') || m.includes('bayar') || m.includes('proses') ||
    m.includes('aktifkan') || m.includes('naik') || m.includes('restore') ||
    m.includes('kembalikan') || m.includes('import') || m.includes('apply') ||
    m.includes('terima') || m.includes('serahkan') || m.includes('lunasi')
  ) return 'success'
  return 'info'
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse message → title + body
// ─────────────────────────────────────────────────────────────────────────────
function parseMessage(raw: string) {
  const cleaned = raw.replace(/^[⚠️❗✅ℹ️\s]+/, '').trim()
  const lines   = cleaned.split('\n')
  const title   = lines[0].trim()
  const body    = lines.slice(1).join('\n').trim()
  return {
    title: title.length > 90 ? title.slice(0, 87) + '…' : title,
    body,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant config
// ─────────────────────────────────────────────────────────────────────────────
const VARIANT: Record<DialogVariant, {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  bar: string
  btn: string
  label: string
}> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    bar: 'bg-red-500',
    btn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    label: 'Ya, Hapus',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    bar: 'bg-amber-400',
    btn: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white',
    label: 'Ya, Lanjutkan',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    bar: 'bg-emerald-500',
    btn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white',
    label: 'Ya, Simpan',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    bar: 'bg-blue-400',
    btn: 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-500 text-white',
    label: 'Ya, Lanjutkan',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
interface State {
  open: boolean
  message: string
  options: ConfirmOptions
  resolve: ((v: boolean) => void) | null
}
const CLOSED: State = { open: false, message: '', options: {}, resolve: null }

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(CLOSED)
  const btnRef    = useRef<HTMLButtonElement>(null)

  const show = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise(resolve => setS({ open: true, message, options, resolve }))
  }, [])

  // Expose ke window untuk dipanggil dari luar React tree (edge case)
  useEffect(() => {
    ;(window as any).__confirmDialog = show
    return () => { delete (window as any).__confirmDialog }
  }, [show])

  // Auto-focus tombol konfirmasi
  useEffect(() => { if (s.open) setTimeout(() => btnRef.current?.focus(), 80) }, [s.open])

  // Escape = cancel
  useEffect(() => {
    if (!s.open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [s.open])

  const confirm = useCallback(() => { s.resolve?.(true);  setS(CLOSED) }, [s])
  const cancel  = useCallback(() => { s.resolve?.(false); setS(CLOSED) }, [s])

  // Resolve values
  const variant      = s.options.variant ?? detectVariant(s.message)
  const cfg          = VARIANT[variant]
  const Icon         = cfg.icon
  const { title, body } = parseMessage(s.message)
  const confirmLabel = s.options.confirmLabel ?? cfg.label
  const cancelLabel  = s.options.cancelLabel  ?? 'Batal'
  const displayTitle = s.options.title        ?? title

  return (
    <ConfirmContext.Provider value={show}>
      {children}

      {s.open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cdlg-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={cancel}
          />

          {/* Card */}
          <div className="relative z-10 w-full max-w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ease-out">

            {/* Accent bar */}
            <div className={cn('h-1 w-full', cfg.bar)} />

            <div className="p-5 pb-4">
              {/* Icon + close */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                  cfg.iconBg
                )}>
                  <Icon className={cn('w-5 h-5', cfg.iconColor)} />
                </div>
                <button
                  onClick={cancel}
                  className="p-1.5 -mt-0.5 -mr-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Batal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Teks */}
              <p
                id="cdlg-title"
                className="font-bold text-[15px] leading-snug text-slate-900"
              >
                {displayTitle}
              </p>
              {body && (
                <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line mt-1.5">
                  {body}
                </p>
              )}
            </div>

            {/* Tombol */}
            <div className="px-5 pb-5 flex gap-2.5">
              <button
                onClick={cancel}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                ref={btnRef}
                onClick={confirm}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2',
                  cfg.btn
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — gunakan ini di semua komponen
// ─────────────────────────────────────────────────────────────────────────────
/**
 * useConfirm()
 *
 * Mengembalikan fungsi async confirm(message, options?).
 * Gunakan sebagai pengganti window.confirm() di semua event handler.
 *
 * @example
 * const confirm = useConfirm()
 *
 * const handleHapus = async () => {
 *   if (!await confirm('Hapus data ini?')) return
 *   await deleteData(id)
 * }
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)

  return useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    if (ctx) return ctx(message, options)
    // Fallback jika hook dipanggil di luar provider
    if (typeof window !== 'undefined' && (window as any).__confirmDialog) {
      return (window as any).__confirmDialog(message, options)
    }
    return Promise.resolve(window.confirm(message))
  }, [ctx])
}
