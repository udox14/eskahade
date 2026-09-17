'use client'

import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Bank as Landmark,
  CaretDown as ChevronDown,
  CheckCircle as CheckCircle2,
  FileXls as FileSpreadsheet,
  ListChecks,
  LockKey as LockKeyhole,
  Question as CircleHelp,
  Receipt as ReceiptText,
  Stack as Layers3,
  Wallet as WalletCards,
  Warning as AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookBookmark,
  Compass,
  Info,
  X,
  XCircle,
} from '@phosphor-icons/react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { cn } from '@/lib/utils'

/**
 * Kelas dasar seluruh input keuangan. Sebelumnya string yang sama persis
 * disalin sebagai `const field` di delapan halaman, sehingga satu penyesuaian
 * tinggi sentuh atau warna fokus harus ditulis delapan kali.
 */
export const FINANCE_FIELD_CLASS = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'

export function FinancePageHeader({ title, description, eyebrow, meta, action }: {
  title: string; description: string; eyebrow?: string; meta?: string; action?: React.ReactNode
}) {
  return <DashboardPageHeader title={title} description={description} action={action} className="[&_h1]:text-xl [&_p]:text-xs sm:[&_h1]:text-[1.75rem] sm:[&_p]:text-sm" />
}

export function FinanceGuide({
  title = 'Cara menggunakan halaman ini', purpose, prerequisites = [], steps, notes = [],
  glossary = [], commonMistakes = [], onStartTour,
}: {
  title?: string
  purpose: string
  prerequisites?: string[]
  steps: string[]
  notes?: string[]
  /** Istilah khas keuangan terpusat yang tidak dikenal pengguna baru. */
  glossary?: Array<{ term: string; meaning: string }>
  /** Kesalahan yang paling sering terjadi di halaman ini, ditulis sebagai peringatan konkret. */
  commonMistakes?: string[]
  /**
   * Opsional; bila tidak diisi, tombol "Pandu saya" tetap muncul dan memicu
   * tour halaman lewat event `FINANCE_TOUR_EVENT`. Panduan ini dirender dari
   * server component sehingga callback tidak dapat dikirim sebagai prop —
   * tanpa jalur event, tour hanya bisa berjalan sekali seumur hidup peramban.
   */
  onStartTour?: () => void
}) {
  // Panel sebelumnya memakai `hidden sm:block`, sehingga justru hilang di layar
  // kecil — tempat pengguna paling butuh petunjuk. Semua panel kini tampil.
  return <details className="group rounded-xl border border-blue-200 bg-blue-50/60 open:bg-white">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-bold text-slate-800 sm:text-sm"><CircleHelp className="h-4 w-4 text-blue-600" />{title}</span>
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-blue-700 sm:text-xs">Buka <span className="hidden sm:inline">petunjuk</span> <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
    </summary>
    <div className="border-t border-blue-100 px-4 py-4">
      <button type="button" onClick={() => onStartTour ? onStartTour() : window.dispatchEvent(new CustomEvent(FINANCE_TOUR_EVENT))}
        className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white">
        <Compass className="h-4 w-4" />Pandu saya di layar
      </button>
      <div className="grid gap-4 text-xs leading-relaxed text-slate-600 md:grid-cols-2 xl:grid-cols-4">
        <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-800">Tujuan</p><p>{purpose}</p></div>
        <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-800">Sebelum mulai</p>{prerequisites.length ? <ul className="list-disc space-y-1 pl-4">{prerequisites.map(item => <li key={item}>{item}</li>)}</ul> : <p>Tidak ada persiapan khusus.</p>}</div>
        <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-800">Alur kerja</p><ol className="list-decimal space-y-1 pl-4">{steps.map(item => <li key={item}>{item}</li>)}</ol></div>
        <div><p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Catatan penting</p>{notes.length ? <ul className="list-disc space-y-1 pl-4">{notes.map(item => <li key={item}>{item}</li>)}</ul> : <p>Periksa kembali sebelum menyimpan.</p>}</div>
      </div>
      {commonMistakes.length ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide"><AlertTriangle className="h-3.5 w-3.5" />Sering keliru</p>
        <ul className="list-disc space-y-1 pl-4">{commonMistakes.map(item => <li key={item}>{item}</li>)}</ul>
      </div> : null}
      {glossary.length ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed">
        <p className="mb-2 flex items-center gap-1 font-bold uppercase tracking-wide text-slate-800"><BookBookmark className="h-3.5 w-3.5" />Istilah</p>
        <dl className="grid gap-2 sm:grid-cols-2">{glossary.map(item => <div key={item.term}>
          <dt className="font-bold text-slate-800">{item.term}</dt><dd className="text-slate-600">{item.meaning}</dd>
        </div>)}</dl>
      </div> : null}
    </div>
  </details>
}

export function EmptyState({ title, description, action, icon: Icon = ListChecks }: {
  title: string; description: string; action?: React.ReactNode; icon?: React.ElementType
}) {
  return <div className="grid place-items-center px-6 py-12 text-center">
    <Icon className="h-9 w-9 text-slate-300" />
    <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
}

export type FinanceResult = { tone: 'success' | 'duplicate' | 'error'; message: string; detail?: string }

/**
 * Hasil aksi ditampilkan menetap di dekat form, bukan hanya toast yang lewat.
 * Nada `duplicate` sengaja dibedakan dari `success`: transaksi yang tidak jadi
 * diposting karena kiriman ulang tidak boleh terlihat seperti transaksi baru.
 */
export function ResultBanner({ result, onDismiss }: { result: FinanceResult | null; onDismiss?: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  // Banyak formulir keuangan berada jauh di bawah bannernya. Tanpa digulirkan,
  // hasil tindakan tidak terlihat dan petugas mengira tombolnya tidak bekerja.
  useEffect(() => {
    if (!result || !box.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' })
  }, [result])

  if (!result) return null
  const style = {
    success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
    duplicate: { box: 'border-blue-200 bg-blue-50 text-blue-900', Icon: Info },
    error: { box: 'border-red-200 bg-red-50 text-red-900', Icon: XCircle },
  }[result.tone]
  return <div ref={box} role="status" aria-live="polite" className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-xs sm:text-sm', style.box)}>
    <style.Icon className="mt-0.5 h-5 w-5 shrink-0" />
    <div className="min-w-0 flex-1"><p className="font-bold">{result.message}</p>{result.detail ? <p className="mt-0.5 leading-5 opacity-90">{result.detail}</p> : null}</div>
    {onDismiss ? <button type="button" onClick={onDismiss} aria-label="Tutup pesan" className="shrink-0 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button> : null}
  </div>
}

export function FormField({ label, hint, error, children, required }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; required?: boolean
}) {
  const id = useId()
  return <div className="grid gap-1.5">
    <label htmlFor={id} className="text-xs font-bold text-slate-800">{label}{required ? <span className="ml-0.5 text-red-600">*</span> : null}</label>
    {/* Field diberi id lewat cloneElement agar label tetap terhubung tanpa memaksa setiap pemanggil mengurus id sendiri. */}
    {isValidElement(children) ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}
    {error ? <p className="text-[11px] font-semibold text-red-700">{error}</p>
      : hint ? <p className="text-[11px] leading-4 text-slate-500">{hint}</p> : null}
  </div>
}

/**
 * Konfirmasi untuk tindakan yang tidak dapat dibatalkan. `confirmPhrase`
 * mewajibkan pengguna mengetik ulang kata kunci untuk aksi paling berat
 * (tutup buku, reopen periode, eksekusi payout).
 */
/**
 * Tab kerja. Diekstrak dari markup yang sebelumnya ditulis tiga kali berbeda di
 * operasi, kredensial, dan tarif-layanan.
 *
 * Alasan ada tab sama sekali: sebelumnya setiap modul menumpuk semua panel di
 * satu layar, sehingga pekerjaan harian (antrean) terdorong jauh ke bawah oleh
 * data setup yang jarang diubah. Aturannya sekarang: tab pertama selalu
 * pekerjaan harian.
 */
export function FinanceTabs({ tabs, active, onChange, label = 'Kelompok pekerjaan' }: {
  tabs: ReadonlyArray<{ id: string; label: string; hint?: string; badge?: number; icon?: React.ComponentType<{ className?: string }> }>
  active: string
  onChange: (id: string) => void
  label?: string
}) {
  const current = tabs.find(item => item.id === active)
  return <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {tabs.map(item => {
        const aktif = item.id === active
        return <button key={item.id} type="button" onClick={() => onChange(item.id)}
          aria-current={aktif ? 'page' : undefined}
          className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold transition',
            aktif ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
          {item.icon ? <item.icon className="h-4 w-4" /> : null}
          {item.label}
          {item.badge ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{item.badge}</span> : null}
        </button>
      })}
    </div>
    {current?.hint ? <p className="mt-2 px-1 text-[11px] text-slate-500">{current.hint}</p> : null}
  </nav>
}

const UKURAN_MODAL = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

/**
 * Cangkang modal untuk formulir dan impor massal.
 *
 * Sebelum ini setiap modul menyalin sendiri `fixed inset-0` beserta backdrop-nya,
 * dan sebagian besar form justru tidak dimodalkan sama sekali - panel impor Excel
 * dirender di dasar halaman, ratusan baris jauh dari tombol yang membukanya.
 *
 * Menangani hal yang mudah terlewat bila ditulis ulang tiap kali: Esc menutup,
 * klik latar menutup, fokus terkunci di dalam dialog, fokus kembali ke tombol
 * pemicu setelah tertutup, dan scroll halaman latar dikunci selama terbuka.
 */
export function FinanceModal({ open, title, description, size = 'md', onClose, children, footer }: {
  open: boolean
  title: string
  description?: string
  size?: keyof typeof UKURAN_MODAL
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  if (!open) return null
  return <ModalShell {...{ title, description, size, onClose, footer }}>{children}</ModalShell>
}

function ModalShell({ title, description, size, onClose, children, footer }: {
  title: string
  description?: string
  size: keyof typeof UKURAN_MODAL
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>(FOKUS)?.focus()
    return () => {
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOKUS)].filter(el => !el.hasAttribute('disabled'))
      if (!focusable.length) return
      const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1]
      if (document.activeElement === edge) {
        event.preventDefault()
        ;(event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/60 p-4" onClick={onClose}>
    <section ref={panel} role="dialog" aria-modal="true" aria-label={title}
      className={cn('my-auto w-full rounded-xl bg-white shadow-2xl', UKURAN_MODAL[size])}
      onClick={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Tutup"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
      </header>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <footer className="border-t border-slate-100 px-5 py-3">{footer}</footer> : null}
    </section>
  </div>
}

/** Elemen yang bisa menerima fokus di dalam dialog. */
const FOKUS = 'input, select, textarea, button:not([disabled]), a[href]'

export function ConfirmAction({ open, title, description, impact = [], confirmLabel = 'Lanjutkan', confirmPhrase, tone = 'amber', pending, onConfirm, onCancel }: {
  open: boolean
  title: string
  description: string
  impact?: string[]
  confirmLabel?: string
  confirmPhrase?: string
  tone?: 'amber' | 'red'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Dialog dipisah agar state ketikan lahir bersama dialognya dan tidak perlu
  // direset lewat effect setiap kali dibuka.
  if (!open) return null
  return <ConfirmDialog {...{ title, description, impact, confirmLabel, confirmPhrase, tone, pending, onConfirm, onCancel }} />
}

function ConfirmDialog({ title, description, impact = [], confirmLabel = 'Lanjutkan', confirmPhrase, tone = 'amber', pending, onConfirm, onCancel }: {
  title: string
  description: string
  impact?: string[]
  confirmLabel?: string
  confirmPhrase?: string
  tone?: 'amber' | 'red'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    // Fokus dikembalikan ke tombol pemicu setelah dialog tertutup, supaya
    // pengguna keyboard tidak terlempar ke awal halaman.
    const opener = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('input, button')
    first?.focus()
    return () => opener?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onCancel(); return }
      // Tab dikurung di dalam dialog; tanpa ini fokus bisa nyasar ke halaman
      // yang sedang tertutup overlay dan tombol "Batal" jadi sulit dicapai.
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = [...panel.current.querySelectorAll<HTMLElement>('input, button:not([disabled])')]
      if (!focusable.length) return
      const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1]
      if (document.activeElement === edge) {
        event.preventDefault()
        ;(event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const ready = !confirmPhrase || typed.trim().toUpperCase() === confirmPhrase.toUpperCase()
  const accent = tone === 'red' ? 'bg-red-700' : 'bg-amber-600'
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" onClick={onCancel}>
    <section ref={panel} role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}><AlertTriangle className="h-5 w-5" /></span>
        <div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{description}</p></div>
      </div>
      {impact.length ? <ul className="mt-4 list-disc space-y-1 rounded-lg bg-slate-50 p-3 pl-7 text-xs leading-5 text-slate-700">{impact.map(item => <li key={item}>{item}</li>)}</ul> : null}
      {confirmPhrase ? <label className="mt-4 block text-xs font-bold text-slate-800">Ketik <code className="rounded bg-slate-100 px-1">{confirmPhrase}</code> untuk melanjutkan
        <input autoFocus value={typed} onChange={event => setTyped(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
      </label> : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-slate-200 text-sm font-bold text-slate-700">Batal</button>
        <button type="button" disabled={!ready || pending} onClick={onConfirm} className={cn('min-h-11 rounded-lg px-3 text-sm font-bold text-white disabled:opacity-50', accent)}>{confirmLabel}</button>
      </div>
    </section>
  </div>
}

export type TourStep = {
  /** Selector elemen yang disorot, biasanya `[data-tour="nama"]`. */
  target: string
  title: string
  body: string
}

/**
 * Tour berpandu tanpa dependensi: overlay gelap, sorotan pada elemen target,
 * dan tooltip berisi penjelasan langkah. Progres disimpan per halaman sehingga
 * tour hanya berjalan otomatis sekali, tapi selalu bisa dipanggil ulang.
 */
/** Event yang menjalankan ulang tour halaman dari tombol di dalam FinanceGuide. */
export const FINANCE_TOUR_EVENT = 'finance-tour:start'

export function useFinanceTour(storageKey: string) {
  const [running, setRunning] = useState(false)
  const seen = useRef(false)

  useEffect(() => {
    const onStart = () => setRunning(true)
    window.addEventListener(FINANCE_TOUR_EVENT, onStart)
    return () => window.removeEventListener(FINANCE_TOUR_EVENT, onStart)
  }, [])

  useEffect(() => {
    if (seen.current) return
    seen.current = true
    // Ditunda satu frame supaya elemen target sudah terpasang sebelum diukur,
    // sekaligus menghindari setState langsung di badan effect.
    const timer = window.setTimeout(() => {
      try { if (!localStorage.getItem(`finance-tour:${storageKey}`)) setRunning(true) } catch { /* localStorage bisa diblokir */ }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [storageKey])
  const finish = useCallback(() => {
    setRunning(false)
    try { localStorage.setItem(`finance-tour:${storageKey}`, new Date().toISOString()) } catch { /* abaikan */ }
  }, [storageKey])
  return { running, start: useCallback(() => setRunning(true), []), finish }
}

export function FinanceTour({ steps, running, onFinish }: { steps: TourStep[]; running: boolean; onFinish: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const step = steps[index]

  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => setIndex(0), 0)
    return () => window.clearTimeout(timer)
  }, [running])

  useEffect(() => {
    if (!running || !step) return
    const target = document.querySelector(step.target)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!target) {
      const clear = window.setTimeout(() => setRect(null), 0)
      return () => window.clearTimeout(clear)
    }
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    const measure = () => setRect(target.getBoundingClientRect())
    // Diukur setelah scroll selesai; pengukuran langsung akan menangkap posisi lama.
    const first = window.setTimeout(measure, 0)
    const settled = window.setTimeout(measure, reduced ? 0 : 320)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(first); window.clearTimeout(settled)
      window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true)
    }
  }, [running, step])

  useEffect(() => {
    if (!running) return
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onFinish(); return }
      // Fokus dikurung di dalam panel tour supaya tab tidak nyasar ke halaman
      // yang sedang tertutup overlay.
      if (event.key !== 'Tab' || !dialog.current) return
      const focusable = dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, onFinish, index])

  if (!running || !step) return null
  const pad = 8
  const spotlight = rect ? {
    top: Math.max(0, rect.top - pad), left: Math.max(0, rect.left - pad),
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  } : null
  // Tooltip diletakkan di bawah sorotan bila muat, jika tidak di atasnya.
  const below = !spotlight || spotlight.top + spotlight.height + 220 < window.innerHeight
  const tooltipStyle: React.CSSProperties = spotlight
    ? below
      ? { top: spotlight.top + spotlight.height + 12, left: Math.min(Math.max(12, spotlight.left), Math.max(12, window.innerWidth - 340)) }
      : { top: Math.max(12, spotlight.top - 200), left: Math.min(Math.max(12, spotlight.left), Math.max(12, window.innerWidth - 340)) }
    : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

  return <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={`Panduan langkah ${index + 1}: ${step.title}`}>
    <div className="absolute inset-0 bg-slate-950/60" onClick={onFinish} />
    {spotlight ? <div aria-hidden className="pointer-events-none absolute rounded-xl ring-4 ring-emerald-400" style={{ ...spotlight, boxShadow: '0 0 0 9999px rgba(2,6,23,.6)' }} /> : null}
    <div ref={dialog} tabIndex={-1} className="absolute w-[min(20rem,calc(100vw-1.5rem))] rounded-xl bg-white p-4 shadow-2xl outline-none" style={tooltipStyle}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Langkah {index + 1} dari {steps.length}</p>
        <button type="button" onClick={onFinish} aria-label="Tutup panduan" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <h3 className="mt-1 text-sm font-bold text-slate-900">{step.title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-600">{step.body}</p>
      {!rect ? <p className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-800">Bagian ini belum tampil di layar — biasanya karena datanya belum ada.</p> : null}
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" onClick={onFinish} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">Lewati</button>
        <div className="flex gap-2">
          <button type="button" disabled={index === 0} onClick={() => setIndex(current => current - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" />Kembali</button>
          <button type="button" onClick={() => index + 1 < steps.length ? setIndex(current => current + 1) : onFinish()} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white">{index + 1 < steps.length ? <>Lanjut<ArrowRight className="h-3.5 w-3.5" /></> : 'Selesai'}</button>
        </div>
      </div>
    </div>
  </div>
}

const metricIcons = {
  checkCircle: CheckCircle2,
  fileSpreadsheet: FileSpreadsheet,
  landmark: Landmark,
  layers: Layers3,
  listChecks: ListChecks,
  lock: LockKeyhole,
  receipt: ReceiptText,
  wallet: WalletCards,
} as const

export type MetricIcon = keyof typeof metricIcons

export function MetricCard({ label, value, detail, icon, tone = 'emerald' }: {
  label: string; value: string; detail: string; icon: MetricIcon; tone?: 'emerald' | 'blue' | 'amber' | 'slate'
}) {
  const Icon = metricIcons[icon]
  const toneClass = { emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700' }[tone]
  return <div className="flex min-h-[108px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:block sm:min-h-0 sm:p-4">
    <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={cn('grid h-8 w-8 place-items-center rounded-lg', toneClass)}><Icon className="h-4 w-4" /></span></div>
    <p className="mt-2 break-words text-sm font-extrabold tabular-nums text-slate-900 sm:truncate sm:text-xl">{value}</p>
    <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">{detail}</p>
  </div>
}

export function SectionPanel({ id, title, description, action, children, className }: {
  /** Dipakai sebagai target tautan langsung dari halaman lain, mis. `/operasi#review`. */
  id?: string
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return <section id={id} className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', id ? 'scroll-mt-24' : null, className)}>
    <div className="flex flex-col items-stretch justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div><h2 className="text-xs font-bold text-slate-900 sm:text-sm">{title}</h2>{description ? <p className="mt-0.5 text-[11px] leading-4 text-slate-500 sm:text-xs">{description}</p> : null}</div>{action}
    </div>
    {children}
  </section>
}

export function StatusBadge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate' }) {
  const styles = { emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100', red: 'bg-red-50 text-red-700 ring-red-100', blue: 'bg-blue-50 text-blue-700 ring-blue-100', slate: 'bg-slate-100 text-slate-600 ring-slate-200' }[tone]
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1', styles)}>{children}</span>
}
