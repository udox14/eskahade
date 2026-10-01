'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { TableSkeleton } from '@/components/ui/skeletons'
import { cn } from '@/lib/utils'

// Styling tokens aligning with Sistem Keuangan Baru (Status Pembayaran standard)
export const control =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50'

export const button =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'

export const primary = cn(
  button,
  'border-transparent bg-slate-900 text-white shadow-xs hover:bg-slate-800 hover:text-white focus-visible:outline-slate-900'
)

export const primaryRose = cn(
  button,
  'border-transparent bg-rose-600 text-white shadow-xs hover:bg-rose-700 hover:text-white focus-visible:outline-rose-600'
)

export const primaryEmerald = cn(
  button,
  'border-transparent bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 hover:text-white focus-visible:outline-emerald-600'
)

export const ghost =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50 cursor-pointer'

const dialogs: HTMLElement[] = []
let originalOverflow = ''
let programmaticBackCount = 0

/**
 * Intercept mobile back button / swipe gesture to close modal/drawer
 * instead of navigating away from the dashboard page.
 */
export function useModalHistory(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return

    const key = `modal_${Math.random().toString(36).slice(2, 9)}`
    let closedByPop = false

    try {
      const currentState =
        typeof window.history.state === 'object' && window.history.state !== null
          ? window.history.state
          : {}
      window.history.pushState({ ...currentState, [key]: true }, '')
    } catch {
      // In case pushState fails in restricted sandbox
    }

    const handlePopState = (event: PopStateEvent) => {
      if (programmaticBackCount > 0) {
        programmaticBackCount--
        return
      }

      // Check if this modal's entry was popped
      if (event.state && event.state[key]) {
        return
      }

      closedByPop = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (!closedByPop) {
        try {
          if (window.history.state && window.history.state[key]) {
            programmaticBackCount++
            window.history.back()
          }
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen])
}

export function Modal({
  title,
  children,
  footer,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  wide?: boolean
  busy?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  const id = useId()
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (busyRef.current || closing) return
    setClosing(true)
    setTimeout(() => {
      closeRef.current()
    }, 240)
  }, [closing])

  const handleCloseRef = useRef(handleClose)
  useEffect(() => {
    handleCloseRef.current = handleClose
  })

  // Intercept phone back button / swipe gesture
  useModalHistory(true, handleClose)

  useEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  }, [onClose, busy])

  useEffect(() => {
    const element = ref.current!
    const previous = document.activeElement as HTMLElement | null

    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    dialogs.push(element)
    element.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (dialogs.at(-1) !== element) return

      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        event.stopImmediatePropagation()
        handleCloseRef.current()
      }

      if (event.key === 'Tab') {
        const items = Array.from(
          element.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
          )
        ).filter((el) => el.getClientRects().length)

        const first = items[0]
        const last = items.at(-1)

        if (!first) {
          event.preventDefault()
          element.focus()
          return
        }

        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (dialogs.at(-1) === element && !element.contains(event.target as Node)) {
        element.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      const index = dialogs.indexOf(element)
      if (index >= 0) dialogs.splice(index, 1)
      if (!dialogs.length) document.body.style.overflow = originalOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 transition-all duration-200',
        closing ? 'opacity-0' : 'opacity-100'
      )}
      style={{ zIndex: 300 + dialogs.length }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (!busy) handleClose()
        }}
      />

      {/* Modal Dialog Card (Bottom drawer on mobile, centered card on desktop) */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/90 bg-white shadow-2xl outline-none transition-transform duration-250 ease-out',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          closing
            ? 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
            : 'translate-y-0 sm:scale-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-250'
        )}
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 bg-slate-300/80 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header: Clean title and close button only (no green line, no icon, no subtitle) */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 sm:px-6 py-3.5 sm:py-4">
          <h2 id={id} className="text-base sm:text-lg font-bold leading-tight text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            disabled={busy}
            onClick={handleClose}
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Modal Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/80 px-5 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold text-slate-600 tracking-wide uppercase">{label}</span>
      {children}
    </label>
  )
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
      <p className="leading-relaxed">{message}</p>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <p className="text-xs sm:text-sm leading-relaxed text-slate-500 max-w-sm mx-auto">{children}</p>
    </div>
  )
}

export function ListLoading() {
  return (
    <div role="status" aria-label="Memuat data">
      <div className="space-y-3 p-4 md:hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex animate-pulse gap-3 rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="h-12 w-10 shrink-0 rounded-lg bg-slate-100" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="h-3 w-3/4 rounded bg-slate-50" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <TableSkeleton rows={5} cols={6} />
      </div>
    </div>
  )
}

export function StudentIdentity({
  student,
  large = false,
  placement = true,
}: {
  student: {
    nama_lengkap: string
    nis?: string | null
    foto_url?: string | null
    asrama?: string | null
    kamar?: string | null
    nama_kelas?: string | null
  }
  large?: boolean
  placement?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <SantriPhotoAvatar
        src={student.foto_url}
        name={student.nama_lengkap}
        alt={`Foto ${student.nama_lengkap}`}
        size={large ? 'md' : 'sm'}
        clickable={false}
      />
      <div className="min-w-0">
        {/* Baris 1: Nama Lengkap */}
        <p
          className={cn(
            'break-words font-semibold text-slate-900 transition group-hover:text-rose-700',
            large ? 'text-base sm:text-lg' : 'text-sm'
          )}
        >
          {student.nama_lengkap}
        </p>

        {/* Baris 2: Asrama / Kamar */}
        {placement && (
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            {student.asrama
              ? `${student.asrama}${student.kamar ? ` / ${student.kamar}` : ''}`
              : 'Non-Asrama'}
          </p>
        )}

        {/* Baris 3: Kelas */}
        {placement && (
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            {student.nama_kelas || '-'}
          </p>
        )}
      </div>
    </div>
  )
}

export function KategoriBadge({ kategori }: { kategori?: string | null }) {
  const kat = kategori?.toUpperCase()
  if (kat === 'BERAT') {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
        BERAT
      </span>
    )
  }
  if (kat === 'SEDANG') {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
        SEDANG
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/20">
      RINGAN
    </span>
  )
}

export function SpBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="text-xs text-slate-300">—</span>

  const l = level.toUpperCase()
  if (l === 'SK') {
    return (
      <span className="inline-flex items-center rounded-md bg-red-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
        SK
      </span>
    )
  }
  if (l === 'SP3') {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
        SP3
      </span>
    )
  }
  if (l === 'SP2') {
    return (
      <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-inset ring-orange-600/20">
        SP2
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
      SP1
    </span>
  )
}

export function Pager({
  page,
  totalPages,
  total,
  onPage,
  disabled = false,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (pg: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-3 text-xs text-slate-600">
      <div>
        Total <span className="font-semibold text-slate-900">{total}</span> santri tercatat
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500">
          Hal. {page} dari {Math.max(totalPages, 1)}
        </span>
        <button
          className={cn(button, 'min-h-8 px-2.5 py-1 text-xs')}
          disabled={page <= 1 || disabled}
          onClick={() => onPage(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className={cn(button, 'min-h-8 px-2.5 py-1 text-xs')}
          disabled={page >= totalPages || disabled}
          onClick={() => onPage(page + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
