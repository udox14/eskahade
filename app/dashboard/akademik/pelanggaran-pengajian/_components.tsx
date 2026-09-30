'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  X,
  Check,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { TableSkeleton } from '@/components/ui/skeletons'
import { RowActionMenu, RowActionItem } from '@/components/ui/dropdown-menu'
import { formatWibDateTime } from '@/lib/date/wib'
import { SESSION_LABELS } from '@/lib/pengajian-violations/session'
import { cn } from '@/lib/utils'
import type { Bucket, Capabilities, Filters, Incident, Page } from '@/lib/pengajian-violations/types'

// Styling tokens aligning with Sistem Keuangan Baru (Status Pembayaran standard)
export const control =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50'

export const button =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'

export const primary = cn(
  button,
  'border-transparent bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 hover:text-white focus-visible:outline-emerald-600'
)

export const ghost =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 cursor-pointer'

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
          'relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/90 bg-white shadow-2xl outline-none transition-transform duration-250 ease-out',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl',
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
        <BookOpen className="h-5 w-5" />
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
        <TableSkeleton rows={5} cols={5} />
      </div>
    </div>
  )
}

export function StudentIdentity({
  student,
  large = false,
  placement = true,
  showNis = false,
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
  showNis?: boolean
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
        {/* Baris 1: Nama */}
        <p
          className={cn(
            'break-words font-semibold text-slate-900 transition group-hover:text-emerald-700',
            large ? 'text-base sm:text-lg' : 'text-sm'
          )}
        >
          {student.nama_lengkap}
        </p>

        {showNis && student.nis && (
          <p className="mt-0.5 text-xs text-slate-500">NIS: {student.nis}</p>
        )}

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

export function Combobox({
  items,
  value,
  onChange,
  label,
  disabled = false,
}: {
  items: { id: string; name: string }[]
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(0)

  const selected = items.find((r) => r.id === value)
  const matches = items.filter((r) =>
    r.name.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id'))
  )

  useEffect(() => {
    if (open) {
      document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [id, active, open])

  function pick(index: number) {
    if (matches[index]) {
      onChange(matches[index].id)
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <div className="relative">
        <input
          className={cn(control, 'pr-9')}
          aria-label={label}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
          value={open ? search : selected?.name ?? ''}
          placeholder="Cari dan pilih jenis pelanggaran…"
          autoComplete="off"
          onFocus={() => {
            setOpen(true)
            setSearch('')
            setActive(0)
          }}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              setActive((n) =>
                Math.max(0, Math.min(matches.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1)))
              )
            }
            if (e.key === 'Enter' && open) {
              e.preventDefault()
              pick(active)
            }
          }}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>

      {open && (
        <div
          id={id}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in duration-100"
        >
          {matches.map((item, index) => {
            const isSelected = item.id === value
            return (
              <button
                key={item.id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={isSelected}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(index)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs sm:text-sm font-medium transition cursor-pointer',
                  index === active
                    ? 'bg-emerald-50 text-emerald-800'
                    : isSelected
                    ? 'bg-slate-50 text-emerald-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <span>{item.name}</span>
                {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
              </button>
            )
          })}
          {!matches.length && (
            <p className="p-3 text-center text-xs text-slate-500">Jenis pelanggaran tidak ditemukan.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function Pager({
  data,
  onPage,
  noun = 'catatan',
  pageSize,
  onPageSizeChange,
}: {
  data: Page<unknown>
  onPage: (page: number) => void
  noun?: string
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}) {
  const currentSize = pageSize || 30
  const pages = Math.max(1, Math.ceil(data.total / currentSize))
  const start = data.total ? (data.page - 1) * currentSize + 1 : 0
  const end = Math.min(data.page * currentSize, data.total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/75 px-4 py-3 sm:px-6 text-xs text-slate-600">
      <div className="flex items-center gap-3">
        <p>
          Menampilkan <span className="font-semibold text-slate-800">{start}–{end}</span> dari{' '}
          <span className="font-semibold text-slate-800">{data.total}</span> {noun}
        </p>

        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="text-slate-400 text-[11px]">Tampilkan:</span>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
              value={currentSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <div className="flex sm:hidden items-center gap-1">
            <select
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
              value={currentSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Pilih jumlah per halaman"
            >
              <option value={10}>10/hal</option>
              <option value={20}>20/hal</option>
              <option value={30}>30/hal</option>
              <option value={50}>50/hal</option>
            </select>
          </div>
        )}

        <span className="mr-1 text-slate-500">
          Hal. {data.page} dari {pages}
        </span>
        <button
          className={cn(button, 'min-h-8 px-2.5 py-1 text-xs')}
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className={cn(button, 'min-h-8 px-2.5 py-1 text-xs')}
          disabled={data.page >= pages}
          onClick={() => onPage(data.page + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Actions({
  row,
  cap,
  onEdit,
  onCancel,
}: {
  row: Incident
  cap: Capabilities | null
  onEdit: (row: Incident) => void
  onCancel: (row: Incident) => void
}) {
  if (!cap || row.status === 'cancelled' || (!cap.manage && row.created_by !== cap.userId)) {
    return null
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {cap.update && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          onClick={() => onEdit(row)}
          aria-label={`Koreksi pelanggaran ${row.nama_lengkap}`}
        >
          <Pencil className="h-3.5 w-3.5 text-slate-500" />
          <span>Koreksi</span>
        </button>
      )}
      {cap.cancel && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition cursor-pointer"
          onClick={() => onCancel(row)}
          aria-label={`Batalkan pelanggaran ${row.nama_lengkap}`}
        >
          <X className="h-3.5 w-3.5 text-rose-600" />
          <span>Batalkan</span>
        </button>
      )}
    </div>
  )
}

function EvidencePhotoModal({
  row,
  onClose,
}: {
  row: Incident
  onClose: () => void
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <Modal
      title="Foto Bukti Kejadian"
      onClose={onClose}
      footer={
        <button className={button} onClick={onClose}>
          Tutup
        </button>
      }
    >
      <div className="space-y-4">
        {failed ? (
          <ErrorMessage message="Foto tidak tersedia atau sudah melewati batas simpan 30 hari." />
        ) : (
          <>
            {!loaded && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span className="text-xs">Memuat foto bukti…</span>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated no-store private route */}
            <img
              src={row.evidence_url!}
              alt={`Foto kejadian ${row.type_name} — ${row.nama_lengkap}`}
              className={cn(
                'max-h-[60dvh] w-full rounded-xl object-contain border border-slate-200 bg-slate-950',
                !loaded && 'hidden'
              )}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          </>
        )}
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 space-y-1 border border-slate-100">
          <p>
            Masa simpan foto hingga:{' '}
            <span className="font-semibold text-slate-700">
              {row.evidence_expires_at ? formatWibDateTime(row.evidence_expires_at) : '-'}
            </span>
          </p>
          <p className="text-[11px] text-slate-400">
            Setelah melewati masa simpan, file foto dihapus otomatis dari server. Catatan kejadian tetap tersimpan.
          </p>
        </div>
      </div>
    </Modal>
  )
}

function EvidencePhotoButton({ row }: { row: Incident }) {
  const [open, setOpen] = useState(false)
  const [expired, setExpired] = useState(
    () => !!row.evidence_expires_at && Date.parse(row.evidence_expires_at) <= Date.now()
  )

  useEffect(() => {
    if (!row.evidence_expires_at) return
    let timer: ReturnType<typeof setTimeout>
    function schedule() {
      const remaining = Date.parse(row.evidence_expires_at!) - Date.now()
      timer = setTimeout(() => {
        if (remaining <= 0) {
          setExpired(true)
          setOpen(false)
        } else {
          schedule()
        }
      }, Math.min(Math.max(remaining, 0), 86400000))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [row.evidence_expires_at])

  if (!row.evidence_expires_at) return null
  if (!row.evidence_url || expired) {
    return <span className="text-[11px] text-slate-400 italic">Foto telah melewati batas 30 hari</span>
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Camera className="h-3.5 w-3.5 text-slate-500" />
        <span>Foto Kejadian</span>
      </button>

      {open && <EvidencePhotoModal row={row} onClose={() => setOpen(false)} />}
    </>
  )
}

export function SortHeading({
  label,
  sort,
  filters,
  onSort,
}: {
  label: string
  sort: Filters['sort']
  filters?: Filters
  onSort?: (sort: Filters['sort']) => void
}) {
  return onSort ? (
    <button
      className="inline-flex min-h-9 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900 cursor-pointer"
      onClick={() => onSort(sort)}
    >
      <span>{label}</span>
      {filters && filters.sort === sort && (
        <span className="font-mono text-emerald-600 font-bold" aria-label={filters.direction === 'asc' ? 'Menaik' : 'Menurun'}>
          {filters.direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  ) : (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
  )
}

export function IncidentList({
  data,
  cap,
  onEdit,
  onCancel,
  onStudent,
  filters,
  onSort,
  compact = false,
}: {
  data: Page<Incident>
  cap: Capabilities | null
  onEdit: (row: Incident) => void
  onCancel: (row: Incident) => void
  onStudent?: (id: string) => void
  filters?: Filters
  onSort?: (sort: Filters['sort']) => void
  compact?: boolean
}) {
  const [photoModalRow, setPhotoModalRow] = useState<Incident | null>(null)

  if (!data.rows.length) {
    return (
      <Empty>
        Belum ada catatan pelanggaran yang sesuai filter.
        <br />
        Sesuaikan filter atau kata kunci untuk melihat data lainnya.
      </Empty>
    )
  }

  const renderStudentIdentity = (row: Incident) =>
    onStudent ? (
      <button
        type="button"
        className="group block w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-emerald-500 cursor-pointer"
        onClick={() => onStudent(row.santri_id)}
      >
        <StudentIdentity student={row} />
      </button>
    ) : (
      <StudentIdentity student={row} />
    )

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          MOBILE VIEW (Clean Card List with Dropdown Actions in Top-Right)
         ───────────────────────────────────────────────────────────── */}
      <div className={cn('p-3 sm:p-4 space-y-2.5', !compact && 'md:hidden')}>
        {data.rows.map((row) => {
          const isCancelled = row.status === 'cancelled'
          const canModify =
            cap &&
            !isCancelled &&
            (cap.manage || row.created_by === cap.userId)

          return (
            <article
              key={row.id}
              className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5 transition-colors hover:border-slate-300"
            >
              {/* Card Header: Student Avatar, Name, Dorm/Room & Class, and 3-dots Menu in Top-Right */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {!compact ? (
                    renderStudentIdentity(row)
                  ) : (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{row.type_name}</h4>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatWibDateTime(row.occurred_at)} · {SESSION_LABELS[row.session]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Dropdown Menu at Top-Right */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <RowActionMenu label={`Aksi untuk ${row.nama_lengkap}`}>
                    {onStudent && !compact && (
                      <RowActionItem
                        icon={<BookOpen className="h-3.5 w-3.5" />}
                        onSelect={() => onStudent(row.santri_id)}
                      >
                        Lihat Riwayat Santri
                      </RowActionItem>
                    )}
                    {row.evidence_url && (
                      <RowActionItem
                        icon={<Camera className="h-3.5 w-3.5" />}
                        onSelect={() => setPhotoModalRow(row)}
                      >
                        Lihat Foto Kejadian
                      </RowActionItem>
                    )}
                    {canModify && cap.update && (
                      <RowActionItem
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onSelect={() => onEdit(row)}
                      >
                        Koreksi Catatan
                      </RowActionItem>
                    )}
                    {canModify && cap.cancel && (
                      <RowActionItem
                        icon={<X className="h-3.5 w-3.5" />}
                        tone="danger"
                        onSelect={() => onCancel(row)}
                      >
                        Batalkan Catatan
                      </RowActionItem>
                    )}
                  </RowActionMenu>
                </div>
              </div>

              {/* Concise Violation Strip on Mobile */}
              {!compact && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-slate-800 truncate">{row.type_name}</span>
                    {isCancelled && (
                      <span className="inline-flex rounded-md bg-rose-50 px-1.5 py-0.2 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 shrink-0">
                        Batal
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1 text-slate-400 text-[11px]">
                    <span>{formatWibDateTime(row.occurred_at)}</span>
                    <span>·</span>
                    <span className="font-medium text-slate-600">{SESSION_LABELS[row.session]}</span>
                  </div>
                </div>
              )}

              {/* In compact mode (detail drawer), show notes or reasons if present */}
              {compact && (row.note || row.reason) && (
                <div className="space-y-1 pt-1 text-xs">
                  {row.note && (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-slate-600">
                      <span className="font-semibold text-slate-700 block text-[11px] uppercase tracking-wider mb-0.5">
                        Catatan:
                      </span>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{row.note}</p>
                    </div>
                  )}

                  {row.reason && (
                    <div
                      className={cn(
                        'rounded-lg p-2 text-xs border',
                        isCancelled
                          ? 'bg-rose-50/60 border-rose-100 text-rose-800'
                          : 'bg-amber-50/60 border-amber-100 text-amber-800'
                      )}
                    >
                      <span className="font-semibold block text-[11px] uppercase tracking-wider mb-0.5">
                        Alasan {isCancelled ? 'Pembatalan' : 'Koreksi'}:
                      </span>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{row.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP TABLE VIEW
         ───────────────────────────────────────────────────────────── */}
      {!compact && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="py-3 pl-6 pr-3">
                  <SortHeading label="Santri" sort="name" filters={filters} onSort={onSort} />
                </th>
                <th scope="col" className="px-3 py-3">
                  <SortHeading label="Pelanggaran" sort="type" filters={filters} onSort={onSort} />
                </th>
                <th scope="col" className="px-3 py-3">
                  <SortHeading label="Waktu & Sesi" sort="time" filters={filters} onSort={onSort} />
                </th>
                <th scope="col" className="px-3 py-3">
                  <SortHeading label="Pencatat" sort="actor" filters={filters} onSort={onSort} />
                </th>
                <th scope="col" className="py-3 pl-3 pr-6 text-right">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.rows.map((row) => {
                const isCancelled = row.status === 'cancelled'

                return (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="py-3.5 pl-6 pr-3">{renderStudentIdentity(row)}</td>

                    <td className="max-w-xs px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 break-words">{row.type_name}</span>
                        {isCancelled ? (
                          <span className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                            Dibatalkan
                          </span>
                        ) : null}
                      </div>

                      {(row.note || row.reason) && (
                        <div className="mt-1 space-y-1 text-xs">
                          {row.note && (
                            <p className="text-slate-500 line-clamp-2 leading-relaxed">
                              <span className="font-medium text-slate-600">Catatan: </span>
                              {row.note}
                            </p>
                          )}
                          {row.reason && (
                            <p
                              className={cn(
                                'text-[11px] leading-relaxed',
                                isCancelled ? 'text-rose-600' : 'text-amber-600'
                              )}
                            >
                              <span className="font-semibold">
                                Alasan {isCancelled ? 'batal' : 'koreksi'}:{' '}
                              </span>
                              {row.reason}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-1.5">
                        <EvidencePhotoButton row={row} />
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3.5">
                      <p className="font-medium text-slate-800">{formatWibDateTime(row.occurred_at)}</p>
                      <span className="inline-flex items-center gap-1 mt-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {SESSION_LABELS[row.session]}
                      </span>
                    </td>

                    <td className="px-3 py-3.5 text-slate-600 font-medium">{row.actor_name}</td>

                    <td className="py-3.5 pl-3 pr-6 text-right">
                      <Actions row={row} cap={cap} onEdit={onEdit} onCancel={onCancel} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Evidence photo modal triggered from row action menu */}
      {photoModalRow && (
        <EvidencePhotoModal
          row={photoModalRow}
          onClose={() => setPhotoModalRow(null)}
        />
      )}
    </>
  )
}

export function Bars({
  title,
  rows,
  onPick,
}: {
  title: string
  rows: Bucket[]
  onPick?: (row: Bucket) => void
}) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
          {total} Total
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{rows.length} Kelompok data</p>

      <div className="mt-4 max-h-72 space-y-3.5 overflow-y-auto pr-1">
        {!rows.length && (
          <p className="py-6 text-center text-xs text-slate-500">Belum ada kejadian pada periode ini.</p>
        )}
        {rows.map((row) => {
          const label =
            row.key in SESSION_LABELS
              ? SESSION_LABELS[row.key as keyof typeof SESSION_LABELS]
              : row.label
          const content = (
            <div className="group rounded-lg p-1.5 transition hover:bg-slate-50">
              <div className="mb-1.5 flex justify-between gap-3 text-xs">
                <span className="truncate font-medium text-slate-700 group-hover:text-emerald-800">
                  {label}
                </span>
                <span className="font-semibold tabular-nums text-slate-900">{row.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300 group-hover:bg-emerald-600"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </div>
          )

          return onPick ? (
            <button
              className="block w-full text-left focus-visible:outline-2 focus-visible:outline-emerald-500 cursor-pointer"
              key={row.key}
              onClick={() => onPick(row)}
            >
              {content}
            </button>
          ) : (
            <div key={row.key}>{content}</div>
          )
        })}
      </div>
    </section>
  )
}
