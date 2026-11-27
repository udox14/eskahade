'use client'

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  approveTransferAction,
  approveTransferUnallocatedAction,
  getTransferQueueAction,
  getTransferReviewDetailAction,
  rejectTransferAction,
  requestTransferFixAction,
  type TransferQueueData,
} from './actions'
import type { TransferSubmissionRow, TransferSubmissionStatus } from '@/lib/finance/manual-transfer'

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatRupiah(n: number | null | undefined): string {
  if (!Number.isFinite(n ?? 0) || !n) return 'Rp0'
  return `Rp${Math.round(n).toLocaleString('id-ID')}`
}

function formatWib(iso: string | null | undefined): string {
  return formatFinanceDate(iso, true)
}

function formatPeriodLabel(period: string | null | undefined): string {
  if (!period || period === 'LIFETIME') return ''
  const parts = period.split('-')
  if (parts.length === 1 && /^\d{4}$/.test(period)) return `Tahun ${period}`
  if (parts.length === 2) {
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${BULAN_NAMES[monthIdx]} ${year}`
    }
  }
  return period
}

const STATUS_LABEL: Record<TransferSubmissionStatus, string> = {
  MENUNGGU_BUKTI: 'Menunggu Bukti',
  MENUNGGU_VERIFIKASI: 'Perlu Dicek',
  PERLU_PERBAIKAN: 'Menunggu Unggah Ulang',
  DITERIMA: 'Diterima',
  DITOLAK: 'Ditolak',
  DIBATALKAN: 'Dibatalkan',
  KEDALUWARSA: 'Kedaluwarsa',
}

const STATUS_CLASS: Partial<Record<TransferSubmissionStatus, string>> = {
  MENUNGGU_VERIFIKASI: 'bg-amber-50 text-amber-800 border-amber-200',
  PERLU_PERBAIKAN: 'bg-slate-100 text-slate-700 border-slate-200',
  DITERIMA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DITOLAK: 'bg-rose-50 text-rose-700 border-rose-200',
}

const ITEM_LABEL: Record<string, string> = {
  SPP: 'SPP',
  USPP: 'USPP / Bangunan',
  UANG_MAKAN: 'Uang Makan',
  UANG_NYUCI: 'Uang Nyuci',
  EHB: 'EHB',
  EKSKUL: 'Ekstrakurikuler',
  KESEHATAN: 'Kesehatan',
  UANG_JAJAN: 'Isi Uang Jajan',
}

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Pembayaran dibuat',
  PROOF_UPLOADED: 'Bukti diunggah',
  APPROVED: 'Pembayaran diterima',
  APPROVED_UNALLOCATED: 'Diterima (belum teralokasi)',
  REJECTED: 'Pengajuan ditolak',
  FIX_REQUESTED: 'Diminta unggah ulang',
  CANCELLED: 'Dibatalkan wali',
  EXPIRED: 'Kedaluwarsa',
  REPLACED: 'Diganti pembayaran baru',
}

function getEventDotClass(action: string): string {
  switch (action) {
    case 'APPROVED':
      return 'bg-emerald-600 ring-emerald-100'
    case 'APPROVED_UNALLOCATED':
    case 'FIX_REQUESTED':
      return 'bg-amber-500 ring-amber-100'
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'bg-rose-500 ring-rose-100'
    case 'PROOF_UPLOADED':
      return 'bg-slate-600 ring-slate-100'
    default:
      return 'bg-slate-400 ring-slate-100'
  }
}

function formatEventNotes(notes: string | null | undefined): string {
  if (!notes) return ''
  return notes
    .replace(/Rp\s?(\d{4,})/g, (_, digits: string) => `Rp${Number(digits).toLocaleString('id-ID')}`)
    .replace(/\bbiaya admin ADD\b/g, 'biaya admin ditambahkan')
    .replace(/\bbiaya admin DEDUCT\b/g, 'biaya admin dipotong')
}

const QUEUE_TABS: ReadonlyArray<{ id: TransferSubmissionStatus | 'SEMUA'; label: string }> = [
  { id: 'MENUNGGU_VERIFIKASI', label: 'Perlu Dicek' },
  { id: 'PERLU_PERBAIKAN', label: 'Menunggu Unggah Ulang' },
  { id: 'DITERIMA', label: 'Diterima' },
  { id: 'DITOLAK', label: 'Ditolak' },
  { id: 'SEMUA', label: 'Semua' },
]

function Amount({ value, className = '' }: { value: number; className?: string }) {
  const safeVal = Math.max(0, Math.round(value || 0))
  const text = safeVal.toLocaleString('id-ID')
  if (safeVal < 1000) {
    return (
      <span className={`tabular-nums ${className}`}>
        Rp<span className="rounded bg-amber-200/75 px-0.5">{text}</span>
      </span>
    )
  }
  const cut = Math.max(0, text.length - 3)
  return (
    <span className={`tabular-nums ${className}`}>
      Rp{text.slice(0, cut)}
      <span className="rounded bg-amber-200/75 px-0.5">{text.slice(cut)}</span>
    </span>
  )
}

type Filter = { status: TransferSubmissionStatus | 'SEMUA'; asrama: string; search: string }

export default function VerifikasiTransferContent({ initialData }: { initialData: TransferQueueData }) {
  const [data, setData] = useState(initialData)
  const [filter, setFilter] = useState<Filter>({
    status: 'MENUNGGU_VERIFIKASI',
    asrama: '',
    search: '',
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const tabIdPrefix = useId()
  const searchInputId = useId()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const load = (next: Filter = filter) => {
    startTransition(async () => {
      try {
        const res = await getTransferQueueAction({
          status: next.status,
          asrama: next.asrama || undefined,
          search: next.search.trim() || undefined,
        })
        setData(res)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Antrean verifikasi belum dapat dimuat.')
      }
    })
  }

  const apply = (patch: Partial<Filter>) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const next = { ...filter, ...patch }
    setFilter(next)
    load(next)
  }

  const handleSearchChange = (val: string) => {
    const next = { ...filter, search: val }
    setFilter(next)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      load(next)
    }, 350)
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null
    if (event.key === 'ArrowRight') nextIdx = (idx + 1) % QUEUE_TABS.length
    else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + QUEUE_TABS.length) % QUEUE_TABS.length
    else if (event.key === 'Home') nextIdx = 0
    else if (event.key === 'End') nextIdx = QUEUE_TABS.length - 1

    if (nextIdx !== null) {
      event.preventDefault()
      const nextTab = QUEUE_TABS[nextIdx]
      const el = tabRefs.current[nextTab.id]
      el?.focus()
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

  const asramaPickerOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: '', label: 'Semua Asrama' },
      ...data.asramaOptions.map((a) => ({ value: a, label: a })),
    ],
    [data.asramaOptions]
  )

  const noScope = !data.scope.all && data.scope.asrama.length === 0
  const hasSecondaryFilter = filter.asrama !== '' || filter.search.trim() !== ''

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 1. Header Halaman — tombol Segarkan sejajar di kanan judul di HP maupun desktop */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem] text-balance">
            Verifikasi Transfer
          </h1>
          <button
            type="button"
            onClick={() => load()}
            disabled={isPending}
            aria-label="Segarkan antrean verifikasi transfer"
            className="inline-flex min-h-[40px] sm:min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Segarkan</span>
          </button>
        </div>
        <p className="text-sm leading-5 text-slate-500 text-pretty">
          {data.scope.all
            ? 'Periksa bukti transfer wali dengan mutasi rekening Koperasi, lalu terima atau tolak.'
            : `Bukti transfer dari asrama tugas Anda: ${data.scope.asrama.join(', ') || '—'}.`}
        </p>
      </header>

      {noScope ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
          Anda belum ditugaskan ke asrama mana pun. Minta Admin Koperasi mengatur pembagian tugas di{' '}
          <strong>Pengaturan Keuangan &rarr; Jalur Pembayaran</strong>.
        </div>
      ) : (
        <div className="space-y-4">
          {/* 2. Tabs Navigasi (Selaras dengan Status Pembayaran & Penyaluran) */}
          <div className="border-b border-slate-200">
            <div
              role="tablist"
              aria-label="Filter status verifikasi transfer"
              className="flex gap-1 overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {QUEUE_TABS.map((tab, idx) => {
                const isActive = filter.status === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el
                    }}
                    id={`${tabIdPrefix}-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => {
                      tabRefs.current[tab.id]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                      apply({ status: tab.id })
                    }}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className="relative inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer aria-[selected=true]:text-emerald-800 aria-[selected=true]:after:content-[''] aria-[selected=true]:after:absolute aria-[selected=true]:after:inset-x-0 aria-[selected=true]:after:bottom-0 aria-[selected=true]:after:border-b-2 aria-[selected=true]:after:border-emerald-600"
                  >
                    <span>{tab.label}</span>
                    {tab.id === 'MENUNGGU_VERIFIKASI' && data.pendingCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900 tabular-nums">
                        {data.pendingCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Toolbar Pencarian & Filter Asrama */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                  load()
                }}
                className="relative flex-1"
              >
                <label htmlFor={searchInputId} className="sr-only">
                  Cari nama santri, NIS, nomor pengajuan, pengirim, atau nominal
                </label>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id={searchInputId}
                  type="text"
                  value={filter.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Cari nama, NIS, nomor pengajuan, pengirim, atau nominal…"
                  className="min-h-[44px] sm:min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15"
                />
                {filter.search && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => apply({ search: '' })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </form>

              {data.asramaOptions.length > 1 && (
                <SelectPicker
                  value={filter.asrama}
                  options={asramaPickerOptions}
                  onChange={(val) => apply({ asrama: val })}
                  ariaLabel="Filter asrama"
                  align="left"
                  className="w-full sm:w-auto [&>button]:w-full"
                />
              )}

              {hasSecondaryFilter && (
                <button
                  type="button"
                  onClick={() => apply({ asrama: '', search: '' })}
                  className="inline-flex min-h-[44px] sm:min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* 4. Panel Daftar Antrean */}
          <div
            role="tabpanel"
            aria-labelledby={`${tabIdPrefix}-${filter.status}`}
            aria-busy={isPending}
            className={`transition-opacity duration-200 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-2xs">
                {hasSecondaryFilter ? (
                  <>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Search className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Tidak ada pengajuan yang cocok
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-slate-500 text-pretty">
                      Coba ubah kata kunci pencarian atau pilih asrama lain untuk melihat daftar transfer.
                    </p>
                    <button
                      type="button"
                      onClick={() => apply({ asrama: '', search: '' })}
                      className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset Filter</span>
                    </button>
                  </>
                ) : filter.status === 'MENUNGGU_VERIFIKASI' ? (
                  <>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Semua bukti transfer sudah diperiksa
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-slate-500 text-pretty">
                      Tidak ada pengajuan baru dari wali santri yang menunggu verifikasi saat ini.
                    </p>
                    <button
                      type="button"
                      onClick={() => apply({ status: 'DITERIMA' })}
                      className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span>Lihat yang Sudah Diterima</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Belum ada pengajuan pada kategori ini
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-slate-500 text-pretty">
                      Riwayat transfer manual yang masuk atau selesai diperiksa akan tampil di sini.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs overflow-hidden">
                {data.items.map((item) => (
                  <QueueRow key={item.id} item={item} onOpen={() => setSelected(item.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <ReviewDrawer
          id={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function QueueRow({ item, onOpen }: { item: TransferSubmissionRow; onOpen: () => void }) {
  const senderLabel = item.sender_name
    ? item.sender_bank
      ? `dari ${item.sender_name} (${item.sender_bank})`
      : `dari ${item.sender_name}`
    : item.sender_bank || '-'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full min-h-[44px] text-left p-4 hover:bg-slate-50/90 active:bg-slate-100/60 transition-colors flex flex-wrap items-center gap-x-4 gap-y-2 cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
          {item.santri_nama}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 tabular-nums truncate">
          {item.santri_nis} · {item.asrama || '-'}
          {item.kamar ? ` / Kamar ${item.kamar}` : ''}
        </div>
      </div>

      <div className="text-right">
        <Amount value={item.expected_amount} className="text-sm font-bold text-slate-900" />
        <div className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]">{senderLabel}</div>
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:min-w-[180px] sm:flex-col sm:items-end sm:gap-1 text-xs text-slate-500">
        <span
          className={`inline-flex items-center border rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            STATUS_CLASS[item.status] || 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {STATUS_LABEL[item.status]}
        </span>
        <span className="tabular-nums text-[11px]">
          {item.status === 'MENUNGGU_VERIFIKASI'
            ? `Dikirim ${formatWib(item.submitted_at)}`
            : formatWib(item.reviewed_at || item.submitted_at)}
        </span>
      </div>

      <ChevronRight
        className="hidden sm:block h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-600 transition-colors"
        aria-hidden="true"
      />
    </button>
  )
}

type Detail = Awaited<ReturnType<typeof getTransferReviewDetailAction>>
type Mode = null | 'approve' | 'unallocated' | 'reject' | 'fix'

function ReviewDrawer({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const confirm = useConfirm()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [received, setReceived] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getTransferReviewDetailAction(id)
      .then((res) => {
        if (active) setDetail(res)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Detail pengajuan belum dapat dimuat.')
      })
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const s = detail?.submission
  const reviewable = !!detail?.canMutate && s?.status === 'MENUNGGU_VERIFIKASI'
  const closable = !!detail?.canMutate && s?.status === 'PERLU_PERBAIKAN'
  const receivedAmount = Number(received.replace(/\D/g, '')) || 0
  const trimmedNotes = notes.trim()
  const notesRequired = mode === 'unallocated' || mode === 'reject' || mode === 'fix'
  const notesTooShort = notesRequired && trimmedNotes.length < 5
  const isUnallocatedAmountInvalid = mode === 'unallocated' && receivedAmount <= 0

  const canSubmit =
    !busy &&
    !!s &&
    !!mode &&
    !notesTooShort &&
    !isUnallocatedAmountInvalid &&
    (mode !== 'approve' || receivedAmount === s.expected_amount)

  const submit = async () => {
    if (!s || !mode) return
    if (mode === 'approve') {
      if (receivedAmount !== s.expected_amount) {
        toast.error(
          'Nominal di mutasi tidak sama. Gunakan "Terima sebagai dana belum teralokasi" atau tolak.'
        )
        return
      }
      if (
        !(await confirm(
          `Terima transfer ${formatRupiah(s.expected_amount)} untuk ${s.santri_nama}? Tagihan langsung tercatat lunas/terbayar dan tidak bisa dibatalkan dari halaman ini.`,
          { title: 'Terima pembayaran', confirmLabel: 'Ya, terima', variant: 'success' }
        ))
      ) {
        return
      }
    }
    if (mode === 'unallocated') {
      if (receivedAmount <= 0) {
        toast.error('Masukkan nominal mutasi yang sebenarnya diterima.')
        return
      }
      if (trimmedNotes.length < 5) {
        toast.error('Alasan wajib diisi minimal 5 karakter.')
        return
      }
      if (
        !(await confirm(
          `Catat ${formatRupiah(receivedAmount)} sebagai dana belum teralokasi? Tagihan santri TIDAK berubah; Bendahara akan menyelesaikannya di Rekonsiliasi.`,
          { title: 'Dana belum teralokasi', confirmLabel: 'Ya, catat', variant: 'warning' }
        ))
      ) {
        return
      }
    }
    if (mode === 'reject') {
      if (trimmedNotes.length < 5) {
        toast.error('Alasan penolakan untuk wali wajib minimal 5 karakter.')
        return
      }
      if (
        !(await confirm(
          'Tolak bukti ini? Pembayaran ditutup dan wali perlu membuat pembayaran baru.',
          { title: 'Tolak pembayaran', confirmLabel: 'Ya, tolak', variant: 'danger' }
        ))
      ) {
        return
      }
    }
    if (mode === 'fix' && trimmedNotes.length < 5) {
      toast.error('Alasan permintaan unggah ulang wajib minimal 5 karakter.')
      return
    }

    setBusy(true)
    const res =
      mode === 'approve'
        ? await approveTransferAction({ submissionId: s.id, receivedAmount, notes: trimmedNotes })
        : mode === 'unallocated'
          ? await approveTransferUnallocatedAction({
              submissionId: s.id,
              receivedAmount,
              notes: trimmedNotes,
            })
          : mode === 'reject'
            ? await rejectTransferAction({ submissionId: s.id, reason: trimmedNotes })
            : await requestTransferFixAction({ submissionId: s.id, reason: trimmedNotes })
    setBusy(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(
      mode === 'approve'
        ? 'Pembayaran diterima.'
        : mode === 'unallocated'
          ? 'Dana dicatat sebagai belum teralokasi.'
          : mode === 'reject'
            ? 'Pembayaran ditolak.'
            : 'Wali diminta mengunggah ulang bukti.'
    )
    onDone()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Detail bukti transfer"
      onClick={() => !busy && onClose()}
    >
      <div
        className="h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">
              {s ? s.santri_nama : 'Memuat rincian transfer…'}
            </div>
            <div className="text-xs text-slate-500 font-mono">{s?.submission_number || ''}</div>
          </div>
          <button
            type="button"
            aria-label="Tutup panel detail"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
            {error}
          </div>
        )}

        {!detail && !error && (
          <div className="flex items-center justify-center gap-2 py-20 text-xs font-medium text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
            <span>Memuat bukti dan rincian pengajuan…</span>
          </div>
        )}

        {detail && s && (
          <div className="p-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Kolom Kiri: Gambar Bukti */}
            <div className="space-y-3">
              {detail.proofUrl ? (
                <a
                  href={detail.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-200 bg-slate-50 overflow-hidden hover:border-emerald-300 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.proofUrl}
                    alt="Bukti transfer wali santri"
                    className="w-full max-h-[70vh] object-contain"
                  />
                  <span className="flex items-center justify-center gap-1.5 border-t border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Buka ukuran penuh
                  </span>
                </a>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Belum ada bukti yang diunggah.
                </div>
              )}
              {detail.proofCount > 1 && (
                <p className="text-xs text-slate-500">
                  Ini unggahan bukti ke-{detail.proofCount}. Riwayat lengkap tercatat di jejak audit.
                </p>
              )}
            </div>

            {/* Kolom Kanan: Data & Keputusan Verifikasi */}
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                <div className="text-xs font-medium text-amber-900">
                  Nominal yang harus ada di mutasi
                </div>
                <Amount value={s.expected_amount} className="mt-1 block text-2xl font-bold text-slate-950" />
                <div className="mt-1 text-xs text-slate-700 tabular-nums">
                  Kode unik <strong>{String(s.unique_code).padStart(3, '0')}</strong> · ke{' '}
                  {detail.destination
                    ? `${detail.destination.bank_name} ${detail.destination.account_number}`
                    : '-'}
                </div>
              </div>

              <dl className="grid grid-cols-[118px_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-slate-500">Santri</dt>
                <dd className="font-medium text-slate-900">
                  {s.santri_nama} ({s.santri_nis})
                </dd>
                <dt className="text-slate-500">Asrama / kamar</dt>
                <dd className="text-slate-900">
                  {s.asrama || '-'} / {s.kamar || '-'}
                </dd>
                <dt className="text-slate-500">Pengirim</dt>
                <dd className="text-slate-900">
                  {s.sender_name || '-'}
                  {s.sender_bank ? ` · ${s.sender_bank}` : ''}
                </dd>
                <dt className="text-slate-500">Waktu transfer</dt>
                <dd className="text-slate-900 tabular-nums">
                  {formatWib(s.transferred_at)}{' '}
                  <span className="text-slate-500">(diisi wali)</span>
                </dd>
                <dt className="text-slate-500">Bukti dikirim</dt>
                <dd className="text-slate-900 tabular-nums">{formatWib(s.submitted_at)}</dd>
                <dt className="text-slate-500">Biaya admin</dt>
                <dd className="text-slate-900 tabular-nums">
                  {formatRupiah(s.cooperative_admin_fee)}{' '}
                  {s.fee_mode === 'DEDUCT' ? '(dipotong dari nominal)' : '(ditambahkan)'}
                </dd>
                {s.parent_notes && (
                  <>
                    <dt className="text-slate-500">Catatan wali</dt>
                    <dd className="text-slate-900">{s.parent_notes}</dd>
                  </>
                )}
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-900">
                  {STATUS_LABEL[s.status]}
                  {s.reviewer_name ? ` · ${s.reviewer_name}` : ''}
                </dd>
                {s.review_notes && (
                  <>
                    <dt className="text-slate-500">Catatan petugas</dt>
                    <dd className="text-slate-900">{s.review_notes}</dd>
                  </>
                )}
              </dl>

              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate-700">Rincian pembayaran</div>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
                  {detail.items.map((item, i) => {
                    const pLabel = formatPeriodLabel(item.period)
                    return (
                      <li key={i} className="flex justify-between gap-2 px-3 py-2">
                        <span className="text-slate-700">
                          {ITEM_LABEL[item.item_type] || item.item_type}
                          {pLabel ? ` · ${pLabel}` : ''}
                        </span>
                        <span className="font-medium text-slate-900 tabular-nums">
                          {formatRupiah(item.amount)}
                        </span>
                      </li>
                    )
                  })}
                  <li className="flex justify-between gap-2 px-3 py-2 text-slate-600">
                    <span>Biaya admin Koperasi</span>
                    <span className="tabular-nums">{formatRupiah(s.cooperative_admin_fee)}</span>
                  </li>
                  <li className="flex justify-between gap-2 px-3 py-2 text-slate-600">
                    <span>Kode unik</span>
                    <span className="tabular-nums">{formatRupiah(s.unique_code)}</span>
                  </li>
                  <li className="flex justify-between gap-2 bg-slate-50/70 px-3 py-2 font-bold text-slate-900">
                    <span>Total Mutasi</span>
                    <span className="tabular-nums">{formatRupiah(s.expected_amount)}</span>
                  </li>
                </ul>
              </div>

              {(detail.warnings.sameAmount.length > 0 || detail.warnings.sameSender.length > 0) && (
                <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <div className="space-y-1">
                    {detail.warnings.sameAmount.map((w) => (
                      <div key={w.submission_number}>
                        Nominal sama dengan <strong>{w.submission_number}</strong> ({w.santri_nama},{' '}
                        {STATUS_LABEL[w.status as TransferSubmissionStatus] || w.status}). Pastikan mutasi tidak dipakai dua kali.
                      </div>
                    ))}
                    {detail.warnings.sameSender.map((w) => (
                      <div key={w.submission_number}>
                        Pengirim yang sama juga mengajukan <strong>{w.submission_number}</strong> untuk{' '}
                        {w.santri_nama} ({formatRupiah(w.expected_amount)}).
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.history.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate-700">Transfer sebelumnya</div>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-xs">
                    {detail.history.map((h) => {
                      const st = h.status as TransferSubmissionStatus
                      return (
                        <li
                          key={h.submission_number}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 tabular-nums">
                              {formatRupiah(h.expected_amount)}
                            </div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {formatWib(h.created_at)}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                              STATUS_CLASS[st] || 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {STATUS_LABEL[st] || h.status}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-2 text-xs font-semibold text-slate-700">Jejak audit</div>
                <ol className="relative ml-2 border-l border-slate-200 space-y-3.5 pl-4">
                  {detail.events.map((e, i) => {
                    const actorLabel =
                      e.actor_name ||
                      (e.actor_kind === 'PARENT'
                        ? 'Wali Santri'
                        : e.actor_kind === 'SYSTEM'
                          ? 'Sistem'
                          : '')
                    const formattedNotes = formatEventNotes(e.notes)
                    const isHighlightNote =
                      e.action === 'FIX_REQUESTED' ||
                      e.action === 'REJECTED' ||
                      e.action === 'APPROVED_UNALLOCATED'

                    return (
                      <li key={i} className="relative">
                        <span
                          aria-hidden="true"
                          className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ${getEventDotClass(e.action)}`}
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span className="text-xs font-semibold text-slate-900">
                            {EVENT_LABEL[e.action] || e.action}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {formatWib(e.created_at)}
                          </span>
                        </div>
                        {actorLabel && (
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            Oleh: <span className="font-medium text-slate-700">{actorLabel}</span>
                          </div>
                        )}
                        {formattedNotes && (
                          <p
                            className={`mt-1 text-xs leading-relaxed text-pretty ${
                              isHighlightNote
                                ? 'rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-1.5 font-medium text-amber-950'
                                : 'text-slate-600'
                            }`}
                          >
                            {formattedNotes}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>

              {closable && mode !== 'reject' && (
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-2.5 text-xs text-slate-600 text-pretty">
                    Menunggu wali mengunggah ulang bukti. Jika wali tidak menanggapi, Anda dapat menolak agar wali bisa membuat pembayaran baru.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reject')
                      setNotes('')
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Tolak Pengajuan
                  </button>
                </div>
              )}

              {(reviewable || (closable && mode === 'reject')) && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  {!mode ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('approve')
                          setReceived('')
                          setNotes('')
                        }}
                        className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Terima Pembayaran
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('fix')
                          setNotes('')
                        }}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Minta Unggah Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reject')
                          setNotes('')
                        }}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('unallocated')
                          setReceived('')
                          setNotes('')
                        }}
                        className="col-span-2 min-h-[36px] text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                      >
                        Nominal di mutasi berbeda? Terima sebagai dana belum teralokasi
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                      {(mode === 'approve' || mode === 'unallocated') && (
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            Nominal yang tercatat di mutasi rekening <span className="text-rose-500">*</span>
                          </span>
                          <input
                            inputMode="numeric"
                            value={received}
                            autoFocus
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '')
                              setReceived(digits ? Number(digits).toLocaleString('id-ID') : '')
                            }}
                            placeholder="Ketik ulang dari mutasi rekening, bukan dari foto bukti"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                          />
                          {mode === 'approve' && received && (
                            <span
                              className={`mt-1 block text-xs font-medium ${
                                receivedAmount === s.expected_amount ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {receivedAmount === s.expected_amount
                                ? 'Nominal cocok dengan tagihan.'
                                : `Tidak sama dengan ${formatRupiah(s.expected_amount)}.`}
                            </span>
                          )}
                        </label>
                      )}

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-700">
                          {mode === 'approve'
                            ? 'Catatan petugas (opsional)'
                            : mode === 'unallocated'
                              ? 'Alasan selisih nominal (wajib, min. 5 karakter)'
                              : 'Alasan untuk wali (wajib, min. 5 karakter)'}
                        </span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          maxLength={300}
                          placeholder={
                            mode === 'fix'
                              ? 'Contoh: foto buram, nominal transfer tidak terbaca'
                              : mode === 'reject'
                                ? 'Contoh: transfer tidak ditemukan di mutasi rekening'
                                : mode === 'unallocated'
                                  ? 'Contoh: wali transfer tanpa kode unik'
                                  : 'Catatan tambahan jika perlu'
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                        {notesRequired && trimmedNotes.length > 0 && trimmedNotes.length < 5 && (
                          <span className="mt-1 block text-xs text-rose-700">
                            Minimal 5 karakter ({trimmedNotes.length}/5).
                          </span>
                        )}
                      </label>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setMode(null)}
                          className="min-h-[38px] rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                        >
                          Kembali
                        </button>
                        <button
                          type="button"
                          disabled={!canSubmit}
                          onClick={submit}
                          className={`min-h-[38px] rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            mode === 'reject'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : mode === 'fix'
                                ? 'bg-slate-700 hover:bg-slate-800'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {busy
                            ? 'Memproses…'
                            : mode === 'approve'
                              ? 'Terima Pembayaran'
                              : mode === 'unallocated'
                                ? 'Catat Belum Teralokasi'
                                : mode === 'reject'
                                  ? 'Tolak Pengajuan'
                                  : 'Kirim Permintaan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
