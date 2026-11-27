'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowClockwise,
  CalendarBlank,
  CheckCircle,
  ClockCountdown,
  Eye,
  HandCoins,
  MagnifyingGlass,
  Printer,
  Storefront,
  UsersThree,
  Warning,
  X,
} from '@phosphor-icons/react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { SelectPicker } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  createPayoutAction,
  getPayoutCandidatesAction,
  getPayoutDetailAction,
  getPencairanInitialData,
  listPayoutHistoryAction,
  settlePayoutAction,
} from './actions'
import type { PayoutBatchRow, PayoutCandidate } from '@/lib/finance/wallet-payout'

type InitialData = Awaited<ReturnType<typeof getPencairanInitialData>>
type Detail = Awaited<ReturnType<typeof getPayoutDetailAction>>

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const formatThousands = (n: number) => (n > 0 ? Math.round(n).toLocaleString('id-ID') : '')
const parseDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}
const formatDateWib = (iso: string | null) => formatFinanceDate(iso, true)
const newKey = () => crypto.randomUUID()

export default function PencairanContent({ initialData }: { initialData: InitialData }) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [settling, setSettling] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  // Riwayat pencairan berdasarkan tanggal (default hari ini)
  const [historyDate, setHistoryDate] = useState(initialData.today)
  const [historyRows, setHistoryRows] = useState<PayoutBatchRow[]>(initialData.todayBatches)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const openTotalAmount = useMemo(
    () => data.openBatches.reduce((sum, b) => sum + (b.total_amount || 0), 0),
    [data.openBatches]
  )

  const fetchHistoryForDate = async (date: string) => {
    setLoadingHistory(true)
    try {
      const rows = await listPayoutHistoryAction(date)
      setHistoryRows(rows.filter(b => b.status === 'SELESAI'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat riwayat pencairan.')
    } finally {
      setLoadingHistory(false)
    }
  }

  const reload = () =>
    startTransition(async () => {
      try {
        const fresh = await getPencairanInitialData()
        setData(fresh)
        if (historyDate === fresh.today) {
          setHistoryRows(fresh.todayBatches)
        } else {
          await fetchHistoryForDate(historyDate)
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat ulang data.')
      }
    })

  const handleHistoryDateChange = (nextDate: string) => {
    if (!nextDate) return
    setHistoryDate(nextDate)
    void fetchHistoryForDate(nextDate)
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <DashboardPageHeader
        title="Pencairan Uang Jajan"
        description="Penyerahan uang jajan kolektif melalui perwakilan kamar atau lantai. Setiap santri wajib berakhir Diterima atau Dibatalkan."
        action={
          <button
            type="button"
            onClick={reload}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <ArrowClockwise className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} weight="bold" />
            <span>Segarkan</span>
          </button>
        }
      />

      {/* Status Sesi Kas */}
      {data.cashSession ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Sesi Kas Aktif
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {data.cashSession.code}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Petugas: <span className="font-medium text-slate-700">{data.operatorName}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-2.5 sm:border-t-0 sm:pt-0">
              <div>
                <p className="text-[11px] font-medium text-slate-500">Tersedia di Laci</p>
                <p className="text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                  {rupiah(data.cashSession.available)}
                </p>
              </div>
              {data.openBatches.length > 0 && (
                <div className="sm:border-l sm:border-slate-200 sm:pl-5">
                  <p className="text-[11px] font-medium text-amber-700">Dibawa Perwakilan</p>
                  <p className="text-sm font-bold text-amber-800 whitespace-nowrap tabular-nums">
                    {data.openBatches.length} batch · {rupiah(openTotalAmount)}
                  </p>
                </div>
              )}
              {data.cashSession.reservedCashOut > 0 && (
                <div className="sm:border-l sm:border-slate-200 sm:pl-5">
                  <p className="text-[11px] font-medium text-slate-500">Dicadangkan</p>
                  <p className="text-sm font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                    {rupiah(data.cashSession.reservedCashOut)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Warning className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" weight="bold" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold">Sesi kas belum dibuka.</span> Buka sesi kas terlebih dahulu di Loket Kasir sebelum menyerahkan uang ke perwakilan atau menerima uang kembali.
              </div>
            </div>
            <Link
              href="/dashboard/koperasi/loket"
              className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors"
            >
              <Storefront className="w-3.5 h-3.5" weight="bold" />
              <span>Buka di Loket Kasir</span>
            </Link>
          </div>
        </div>
      )}

      {/* Batch Sedang Dibawa Perwakilan */}
      {data.openBatches.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-2xs">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-amber-50/70 border-b border-amber-200/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <ClockCountdown className="w-4 h-4 text-amber-700 shrink-0" weight="bold" />
              <h2 className="text-sm font-semibold text-slate-900">
                Sedang Dibawa Perwakilan
              </h2>
              <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800 tabular-nums">
                {data.openBatches.length}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80">
              Sesi kas tidak dapat ditutup selama masih ada pencairan aktif di daftar ini.
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {data.openBatches.map(batch => (
              <BatchRow
                key={batch.id}
                batch={batch}
                onView={() => setViewing(batch.id)}
                action={
                  !data.isViewOnly ? (
                    <button
                      type="button"
                      onClick={() => setSettling(batch.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                      <span>Selesaikan</span>
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Form Buat Pencairan Baru */}
      {!data.isViewOnly && (
        <CreatePayout
          data={data}
          onCreated={id => {
            reload()
            setViewing(id)
          }}
        />
      )}

      {/* Riwayat Pencairan Selesai (dengan filter tanggal) */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <CalendarBlank className="w-4 h-4 text-slate-500 shrink-0" weight="bold" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Riwayat Pencairan Selesai
              </h2>
              <p className="text-[11px] text-slate-500">
                {historyDate === data.today
                  ? `Menampilkan pencairan selesai hari ini (${formatFinanceDate(historyDate)})`
                  : `Menampilkan pencairan selesai tanggal ${formatFinanceDate(historyDate)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={historyDate}
              max={data.today}
              onChange={e => handleHistoryDateChange(e.target.value)}
              aria-label="Filter tanggal riwayat pencairan"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
            {historyDate !== data.today && (
              <button
                type="button"
                onClick={() => handleHistoryDateChange(data.today)}
                className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
              >
                Hari Ini
              </button>
            )}
          </div>
        </div>

        {loadingHistory ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500">
            Memuat riwayat pencairan…
          </div>
        ) : historyRows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs font-medium text-slate-600">
              Belum ada pencairan selesai pada {formatFinanceDate(historyDate)}.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Ganti tanggal di atas untuk memeriksa atau mencetak ulang daftar pencairan sebelumnya.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {historyRows.map(batch => (
              <BatchRow
                key={batch.id}
                batch={batch}
                onView={() => setViewing(batch.id)}
              />
            ))}
          </div>
        )}
      </section>

      {settling && (
        <SettleDialog
          batchId={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null)
            reload()
          }}
        />
      )}
      {viewing && (
        <DetailDialog batchId={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

function BatchRow({
  batch,
  onView,
  action,
}: {
  batch: PayoutBatchRow
  onView: () => void
  action?: React.ReactNode
}) {
  const isOpen = batch.status === 'DIBAWA'
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 transition-colors">
      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {batch.representative_name}
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            {batch.asrama}
            {batch.scope_label ? ` · ${batch.scope_label}` : ''}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isOpen
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {isOpen ? 'Dibawa' : 'Selesai'}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span className="font-mono text-slate-600">{batch.batch_number}</span>
          <span>·</span>
          <span>{batch.item_count} santri</span>
          <span>·</span>
          <span>{formatDateWib(batch.created_at)}</span>
          {batch.operator_name && (
            <>
              <span>·</span>
              <span>{batch.operator_name}</span>
            </>
          )}
        </div>
      </button>

      <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 pt-2.5 sm:border-t-0 sm:pt-0">
        <div className="sm:text-right">
          <div className="text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {rupiah(batch.total_amount)}
          </div>
          {!isOpen && (
            <div className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
              Diterima <span className="font-semibold text-emerald-700">{rupiah(batch.total_delivered)}</span>
              {batch.total_returned > 0 && (
                <>
                  {' · '}Kembali <span className="font-semibold text-amber-700">{rupiah(batch.total_returned)}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" weight="bold" />
            <span>Detail</span>
          </button>
          {action}
        </div>
      </div>
    </div>
  )
}

function CreatePayout({
  data,
  onCreated,
}: {
  data: InitialData
  onCreated: (batchId: string) => void
}) {
  const confirm = useConfirm()
  const loadSeqRef = useRef(0)

  const [asrama, setAsrama] = useState('')
  const [kamar, setKamar] = useState('')
  const [blok, setBlok] = useState('')
  const [rooms, setRooms] = useState<string[]>([])
  const [blocks, setBlocks] = useState<string[]>([])
  const [candidates, setCandidates] = useState<PayoutCandidate[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [defaultAmount, setDefaultAmount] = useState(20000)
  const [repId, setRepId] = useState('')
  const [repName, setRepName] = useState('')
  const [scopeLabel, setScopeLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideBlocked, setHideBlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(newKey)

  const maxItems = data.maxPayoutItems ?? 60

  const load = async (next: { asrama: string; kamar?: string; blok?: string }) => {
    const seq = ++loadSeqRef.current
    setRepId('')
    setRepName('')
    setSearchQuery('')
    if (!next.asrama) {
      setCandidates([])
      setRooms([])
      setBlocks([])
      setPicked(new Set())
      setAmounts({})
      return
    }
    setLoading(true)
    try {
      const res = await getPayoutCandidatesAction({
        asrama: next.asrama,
        kamar: next.kamar || null,
        blok: next.blok || null,
      })
      if (seq !== loadSeqRef.current) return
      setCandidates(res.candidates)
      setRooms(res.rooms)
      setBlocks(res.blocks)
      const eligible = res.candidates.filter(c => !c.blocked_reason)
      const initialPick = eligible.slice(0, maxItems)
      setPicked(new Set(initialPick.map(c => c.id)))
      setAmounts(
        Object.fromEntries(
          eligible.map(c => [c.id, Math.min(defaultAmount, c.balance, c.remaining_quota)])
        )
      )
      if (eligible.length > maxItems) {
        toast.info(
          `Ditemukan ${eligible.length} santri memenuhi syarat. ${maxItems} santri pertama dipilih otomatis (batas maksimal per batch).`
        )
      }
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      toast.error(e instanceof Error ? e.message : 'Gagal memuat daftar santri.')
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }

  const maxFor = (c: PayoutCandidate) => Math.min(c.balance, c.remaining_quota)

  const eligibleCandidates = useMemo(
    () => candidates.filter(c => !c.blocked_reason),
    [candidates]
  )
  const blockedCount = candidates.length - eligibleCandidates.length

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return candidates
      .filter(c => {
        if (hideBlocked && c.blocked_reason) return false
        if (!q) return true
        return (
          c.nama_lengkap.toLowerCase().includes(q) ||
          c.nis.toLowerCase().includes(q) ||
          (c.kamar || '').toLowerCase().includes(q)
        )
      })
      .map(c => {
        const amount = amounts[c.id] ?? 0
        const max = maxFor(c)
        const invalid = picked.has(c.id) && !c.blocked_reason && (amount <= 0 || amount > max)
        return { c, amount, max, invalid }
      })
  }, [candidates, amounts, picked, searchQuery, hideBlocked])

  const chosen = useMemo(
    () =>
      eligibleCandidates
        .filter(c => picked.has(c.id))
        .map(c => {
          const amount = amounts[c.id] ?? 0
          const max = maxFor(c)
          return { c, amount, invalid: amount <= 0 || amount > max }
        }),
    [eligibleCandidates, picked, amounts]
  )

  const total = chosen.reduce((sum, r) => sum + r.amount, 0)
  const hasInvalid = chosen.some(r => r.invalid)
  const overMaxItems = chosen.length > maxItems
  const overCash = data.cashSession ? total > data.cashSession.available : true

  const visibleEligible = rows.filter(r => !r.c.blocked_reason)
  const allVisibleEligiblePicked =
    visibleEligible.length > 0 && visibleEligible.every(r => picked.has(r.c.id))

  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      const next = new Set(picked)
      visibleEligible.forEach(r => next.delete(r.c.id))
      setPicked(next)
      return
    }
    const next = new Set(picked)
    let skipped = 0
    for (const r of visibleEligible) {
      if (next.has(r.c.id)) continue
      if (next.size >= maxItems) {
        skipped++
        continue
      }
      next.add(r.c.id)
    }
    setPicked(next)
    if (skipped > 0) {
      toast.info(`Maksimal ${maxItems} santri per pencairan. ${skipped} santri tidak ditambahkan.`)
    }
  }

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(picked)
    if (checked) {
      if (next.size >= maxItems) {
        toast.error(`Maksimal ${maxItems} santri per pencairan. Bagi menjadi beberapa perwakilan.`)
        return
      }
      next.add(id)
    } else {
      next.delete(id)
    }
    setPicked(next)
  }

  const applyDefault = () => {
    setAmounts(
      Object.fromEntries(
        eligibleCandidates.map(c => [c.id, Math.min(defaultAmount, maxFor(c))])
      )
    )
    toast.success(`Nominal ${rupiah(defaultAmount)} diterapkan (disesuaikan saldo & sisa limit).`)
  }

  const submit = async () => {
    if (!data.cashSession) {
      toast.error('Buka sesi kas terlebih dahulu sebelum menyerahkan uang ke perwakilan.')
      return
    }
    if (!repName.trim()) {
      toast.error('Isi nama perwakilan terlebih dahulu.')
      return
    }
    if (!chosen.length) {
      toast.error('Pilih minimal satu santri.')
      return
    }
    if (overMaxItems) {
      toast.error(`Maksimal ${maxItems} santri per pencairan.`)
      return
    }
    if (hasInvalid) {
      toast.error('Ada nominal yang kosong atau melebihi saldo / sisa limit santri.')
      return
    }
    if (overCash) {
      toast.error('Total pencairan melebihi uang tersedia di laci kas.')
      return
    }
    const ok = await confirm(
      `Serahkan ${rupiah(total)} untuk ${chosen.length} santri kepada ${repName.trim()}? Saldo santri langsung berkurang. Santri yang tidak hadir nanti dibatalkan dan uangnya wajib dikembalikan ke loket.`,
      {
        title: 'Serahkan Uang ke Perwakilan',
        confirmLabel: 'Ya, Serahkan',
        variant: 'warning',
      }
    )
    if (!ok) return
    setSaving(true)
    const res = await createPayoutAction({
      idempotencyKey,
      asrama,
      scopeLabel: scopeLabel.trim() || null,
      representativeSantriId: repId || null,
      representativeName: repName.trim(),
      notes: notes.trim() || null,
      items: chosen.map(r => ({ santriId: r.c.id, amount: r.amount })),
    })
    setSaving(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`Pencairan ${res.data!.batchNumber} dibuat. Silakan cetak daftar untuk perwakilan.`)
    setIdempotencyKey(newKey())
    setAsrama('')
    setKamar('')
    setBlok('')
    setRooms([])
    setBlocks([])
    setCandidates([])
    setPicked(new Set())
    setAmounts({})
    setRepId('')
    setRepName('')
    setScopeLabel('')
    setNotes('')
    setSearchQuery('')
    onCreated(res.data!.batchId)
  }

  const asramaOptions = useMemo(
    () => [
      { value: '', label: 'Pilih asrama…' },
      ...data.asramaOptions.map(a => ({ value: a, label: a })),
    ],
    [data.asramaOptions]
  )
  const blockOptions = useMemo(
    () => [
      { value: '', label: 'Semua blok' },
      ...blocks.map(b => ({ value: b, label: b })),
    ],
    [blocks]
  )
  const roomOptions = useMemo(
    () => [
      { value: '', label: 'Semua kamar' },
      ...rooms.map(r => ({ value: r, label: `Kamar ${r}` })),
    ],
    [rooms]
  )
  const repOptions = useMemo(
    () => [
      { value: '', label: 'Pilih dari daftar (opsional)' },
      ...candidates.map(c => ({
        value: c.id,
        label: `${c.nama_lengkap} · Kamar ${c.kamar || '-'}`,
      })),
    ],
    [candidates]
  )

  const inputClass =
    'w-full min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15'

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-emerald-700" weight="bold" />
          <span>Buat Pencairan Baru</span>
        </h2>
        <span className="text-[11px] text-slate-500 tabular-nums">
          Maks. {maxItems} santri/batch
        </span>
      </div>

      {/* Baris Filter Lokasi & Nominal Default */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-12 items-end">
        <div className={blocks.length > 0 ? 'col-span-2 sm:col-span-3' : 'col-span-1 sm:col-span-4'}>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Asrama</label>
          <SelectPicker
            value={asrama}
            options={asramaOptions}
            align="left"
            className="w-full"
            menuClassName="w-full min-w-[200px]"
            onChange={val => {
              setAsrama(val)
              setKamar('')
              setBlok('')
              void load({ asrama: val })
            }}
          />
        </div>

        {blocks.length > 0 && (
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Blok</label>
            <SelectPicker
              value={blok}
              options={blockOptions}
              align="left"
              className="w-full"
              menuClassName="w-full min-w-[160px]"
              onChange={val => {
                setBlok(val)
                void load({ asrama, kamar, blok: val })
              }}
            />
          </div>
        )}

        <div className={blocks.length > 0 ? 'col-span-1 sm:col-span-2' : 'col-span-1 sm:col-span-3'}>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kamar</label>
          <SelectPicker
            value={kamar}
            options={roomOptions}
            disabled={!asrama}
            align="left"
            className="w-full"
            menuClassName="w-full min-w-[160px]"
            onChange={val => {
              setKamar(val)
              void load({ asrama, kamar: val, blok })
            }}
          />
        </div>

        <div className="col-span-2 sm:col-span-5">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Nominal per Santri
          </label>
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={formatThousands(defaultAmount)}
                placeholder="20.000"
                onChange={e => setDefaultAmount(parseDigits(e.target.value))}
                className={`${inputClass} pl-8 font-mono tabular-nums`}
              />
            </div>
            <button
              type="button"
              onClick={applyDefault}
              disabled={!eligibleCandidates.length}
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40 transition-colors"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>

      {/* Informasi Perwakilan */}
      {asrama && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 border-t border-slate-100 pt-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Perwakilan (Santri)
            </label>
            <SelectPicker
              value={repId}
              options={repOptions}
              disabled={!candidates.length}
              align="left"
              className="w-full"
              menuClassName="w-full min-w-[220px]"
              onChange={val => {
                setRepId(val)
                const c = candidates.find(x => x.id === val)
                if (c) setRepName(c.nama_lengkap)
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Nama Perwakilan <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              value={repName}
              onChange={e => setRepName(e.target.value)}
              placeholder="Wajib diisi"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Cakupan (Opsional)
            </label>
            <input
              className={inputClass}
              value={scopeLabel}
              onChange={e => setScopeLabel(e.target.value)}
              placeholder="Mis. Kamar 3 / Lt. 2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Catatan (Opsional)
            </label>
            <input
              className={inputClass}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Catatan penyerahan…"
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-6 text-center text-xs text-slate-500">
          Memuat daftar santri dan sisa limit…
        </div>
      )}

      {!loading && candidates.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Toolbar Kandidat */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
            <div className="relative flex-1 max-w-xs">
              <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIS, atau kamar…"
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <UsersThree className="w-3.5 h-3.5 text-emerald-700" weight="bold" />
                <b className="text-slate-900">{eligibleCandidates.length}</b> siap dicairkan
                {blockedCount > 0 && (
                  <span className="text-slate-400">· {blockedCount} tidak memenuhi syarat</span>
                )}
              </span>
              {blockedCount > 0 && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={hideBlocked}
                    onChange={e => setHideBlocked(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Sembunyikan yang diblokir</span>
                </label>
              )}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua santri yang memenuhi syarat"
                      disabled={visibleEligible.length === 0}
                      checked={allVisibleEligiblePicked}
                      onChange={e => toggleAllVisible(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                    />
                  </th>
                  <th className="p-2.5 text-left font-semibold">Santri</th>
                  <th className="p-2.5 text-left font-semibold">Kamar</th>
                  <th className="p-2.5 text-right font-semibold">Saldo</th>
                  <th className="p-2.5 text-right font-semibold">Sisa Limit</th>
                  <th className="p-2.5 text-right font-semibold w-40">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, amount, max, invalid }) => {
                  const isChecked = picked.has(c.id) && !c.blocked_reason
                  return (
                    <tr
                      key={c.id}
                      className={
                        c.blocked_reason
                          ? 'bg-slate-50/50 text-slate-400'
                          : isChecked
                            ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                            : 'hover:bg-slate-50/70'
                      }
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          disabled={!!c.blocked_reason}
                          checked={isChecked}
                          aria-label={`Pilih ${c.nama_lengkap}`}
                          onChange={e => toggleOne(c.id, e.target.checked)}
                          className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                        />
                      </td>
                      <td className="p-2.5">
                        <div className={`font-medium ${c.blocked_reason ? 'text-slate-500' : 'text-slate-900'}`}>
                          {c.nama_lengkap}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-400">{c.nis}</span>
                          {c.blocked_reason && (
                            <span className="inline-flex items-center rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {c.blocked_reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 whitespace-nowrap text-slate-600">
                        {c.kamar ? `Kamar ${c.kamar}` : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {rupiah(c.balance)}
                      </td>
                      <td className="p-2.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {rupiah(c.remaining_quota)}
                      </td>
                      <td className="p-2.5 text-right">
                        {!c.blocked_reason ? (
                          <div>
                            <div className="relative inline-block w-32">
                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatThousands(amount)}
                                placeholder="0"
                                aria-label={`Nominal ${c.nama_lengkap}`}
                                onChange={e =>
                                  setAmounts({
                                    ...amounts,
                                    [c.id]: parseDigits(e.target.value),
                                  })
                                }
                                className={`w-full rounded-md border pl-7 pr-2 py-1 text-right font-mono tabular-nums focus:outline-none ${
                                  invalid
                                    ? 'border-red-400 bg-red-50 text-red-900'
                                    : 'border-slate-200 bg-white text-slate-900 focus:border-emerald-600'
                                }`}
                              />
                            </div>
                            {invalid && (
                              <p className="text-[10px] text-red-600 mt-0.5">
                                {amount <= 0 ? 'Wajib > Rp0' : `Maks. ${rupiah(max)}`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-xs text-slate-500">
                      Tidak ada santri yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {visibleEligible.length > 0 && (
              <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 text-xs">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allVisibleEligiblePicked}
                    onChange={e => toggleAllVisible(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  <span>Pilih semua ({visibleEligible.length})</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Terpilih: <b>{chosen.length}</b>
                </span>
              </div>
            )}

            {rows.map(({ c, amount, max, invalid }) => {
              const isChecked = picked.has(c.id) && !c.blocked_reason
              return (
                <div
                  key={c.id}
                  className={`p-3.5 space-y-2.5 ${
                    c.blocked_reason
                      ? 'bg-slate-50/60 opacity-75'
                      : isChecked
                        ? 'bg-emerald-50/20'
                        : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      disabled={!!c.blocked_reason}
                      checked={isChecked}
                      aria-label={`Pilih ${c.nama_lengkap}`}
                      onChange={e => toggleOne(c.id, e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-700 disabled:opacity-40"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {c.nama_lengkap}
                        </p>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {c.kamar ? `Kamar ${c.kamar}` : '-'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400">{c.nis}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 tabular-nums">
                        <span>
                          Saldo: <b className="font-mono text-slate-800">{rupiah(c.balance)}</b>
                        </span>
                        <span>
                          Sisa limit: <b className="font-mono text-slate-800">{rupiah(c.remaining_quota)}</b>
                        </span>
                      </div>
                      {c.blocked_reason && (
                        <span className="mt-1.5 inline-flex items-center rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {c.blocked_reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {!c.blocked_reason && (
                    <div className="pl-6">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatThousands(amount)}
                          placeholder="0"
                          aria-label={`Nominal ${c.nama_lengkap}`}
                          onChange={e =>
                            setAmounts({ ...amounts, [c.id]: parseDigits(e.target.value) })
                          }
                          className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-sm font-mono tabular-nums focus:outline-none ${
                            invalid
                              ? 'border-red-400 bg-red-50 text-red-900'
                              : 'border-slate-200 bg-white text-slate-900 focus:border-emerald-600'
                          }`}
                        />
                      </div>
                      {invalid && (
                        <p className="text-[11px] text-red-600 mt-1">
                          {amount <= 0 ? 'Nominal harus lebih dari Rp0.' : `Maksimal ${rupiah(max)}.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {rows.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                Tidak ada santri yang cocok dengan filter pencarian.
              </div>
            )}
          </div>

          {/* Footer Summary & Submit */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="space-y-0.5">
              <div className="text-sm text-slate-700">
                <b className="text-slate-900 tabular-nums">{chosen.length}</b>
                <span className="text-slate-400">/{maxItems}</span> santri · Total{' '}
                <b className="font-mono text-slate-900 whitespace-nowrap tabular-nums">
                  {rupiah(total)}
                </b>
              </div>
              {overCash && data.cashSession && (
                <p className="text-xs font-medium text-red-600">
                  Melebihi uang tersedia di laci ({rupiah(data.cashSession.available)}).
                </p>
              )}
              {overMaxItems && (
                <p className="text-xs font-medium text-red-600">
                  Melebihi batas maksimal {maxItems} santri per pencairan.
                </p>
              )}
              {hasInvalid && (
                <p className="text-xs font-medium text-red-600">
                  Periksa kembali nominal santri yang ditandai merah.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={
                saving ||
                !data.cashSession ||
                !chosen.length ||
                hasInvalid ||
                overCash ||
                overMaxItems
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            >
              <HandCoins className="w-4 h-4" weight="bold" />
              <span>{saving ? 'Menyimpan…' : 'Serahkan ke Perwakilan'}</span>
            </button>
          </div>
        </div>
      )}

      {asrama && !loading && candidates.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">
          Tidak ada santri aktif pada pilihan asrama/kamar ini.
        </div>
      )}
    </section>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function useDetail(batchId: string) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getPayoutDetailAction(batchId)
      .then(res => {
        if (active) setDetail(res)
      })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : 'Gagal memuat detail pencairan.')
      })
    return () => {
      active = false
    }
  }, [batchId])
  return { detail, error }
}

function printChecklist(detail: Detail) {
  const h = detail.header
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
  const isSettled = h.status === 'SELESAI'
  const dateLabel = formatFinanceDate(h.payout_date)
  const rows = detail.items
    .map((item, i) => {
      const statusCell = isSettled
        ? item.status === 'DITERIMA'
          ? 'Diterima'
          : `Dibatalkan${item.cancel_reason ? ` (${esc(item.cancel_reason)})` : ''}`
        : ''
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(item.nama_lengkap)}<div style="font-size:10px;color:#555">${esc(item.nis)}</div></td>
        <td style="text-align:center">${esc(item.kamar || '-')}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${rupiah(item.amount)}</td>
        <td>${statusCell}</td>
      </tr>`
    })
    .join('')

  const win = window.open('', '_blank', 'width=840,height=920')
  if (!win) {
    toast.error('Izinkan pop-up browser untuk mencetak daftar pencairan.')
    return
  }
  win.document.write(`<!doctype html><html><head><title>${esc(h.batch_number)}</title><style>
    body{font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#0f172a;padding:24px}
    h1{font-size:16px;margin:0 0 6px}
    .meta{margin-bottom:4px;color:#334155}
    .note{margin:10px 0 14px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;font-size:11px}
    table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #94a3b8;padding:6px 8px;vertical-align:top}
    th{background:#f1f5f9;text-align:left;font-size:11px}
    tfoot td{font-weight:700;background:#f8fafc}
    .sign{margin-top:36px;display:flex;justify-content:space-between;gap:24px}
    .sign div{width:42%;text-align:center}
    .sign .line{margin-top:48px;border-top:1px solid #334155;padding-top:4px}
  </style></head><body>
    <h1>Daftar Pencairan Uang Jajan Kolektif</h1>
    <div class="meta"><b>${esc(h.batch_number)}</b> · ${esc(dateLabel)} · ${esc(h.asrama)}${h.scope_label ? ' · ' + esc(h.scope_label) : ''}</div>
    <div class="meta">Perwakilan: <b>${esc(h.representative_name)}</b> · Petugas Loket: ${esc(h.operator_name || '-')} · ${h.item_count} santri</div>
    ${
      isSettled
        ? `<div class="note">Status: <b>SELESAI</b> (${esc(formatDateWib(h.settled_at))}) · Total Dibawa: <b>${rupiah(h.total_amount)}</b> · Diterima: <b>${rupiah(h.total_delivered)}</b> · Dikembalikan: <b>${rupiah(h.total_returned)}</b></div>`
        : `<div class="note">Petunjuk: Serahkan uang hanya kepada santri yang hadir dan minta paraf penerima. Untuk santri yang tidak hadir, jangan diberikan — kembalikan uangnya ke loket koperasi.</div>`
    }
    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center">No</th>
          <th>Nama Santri / NIS</th>
          <th style="width:72px;text-align:center">Kamar</th>
          <th style="width:110px;text-align:right">Nominal</th>
          <th style="width:150px">${isSettled ? 'Status Akhir' : 'Paraf Penerima'}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right">Total (${h.item_count} santri)</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${rupiah(h.total_amount)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <div class="sign">
      <div><div>Perwakilan Penerima</div><div class="line">${esc(h.representative_name)}</div></div>
      <div><div>Petugas Loket Koperasi</div><div class="line">${esc(h.operator_name || 'Petugas')}</div></div>
    </div>
    <script>window.onload=()=>window.print()</script>
  </body></html>`)
  win.document.close()
}

function DetailDialog({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { detail, error } = useDetail(batchId)
  const h = detail?.header

  return (
    <Modal
      title={h ? `${h.batch_number} · ${h.representative_name}` : 'Detail Pencairan'}
      subtitle={
        h
          ? `${h.asrama}${h.scope_label ? ` · ${h.scope_label}` : ''} · Dibuat ${formatDateWib(h.created_at)}`
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700"
          >
            Tutup
          </button>
          {detail && (
            <button
              type="button"
              onClick={() => printChecklist(detail)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white"
            >
              <Printer className="w-4 h-4" weight="bold" />
              <span>Cetak Daftar</span>
            </button>
          )}
        </>
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!detail && !error && (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat detail pencairan…</p>
      )}
      {detail && h && (
        <div className="space-y-4 text-sm">
          {/* Ringkasan Nominal */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[11px] text-slate-500">Total Dibawa</p>
              <p className="text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums">
                {rupiah(h.total_amount)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 p-2.5">
              <p className="text-[11px] text-emerald-700">Diterima Santri</p>
              <p className="text-sm font-bold text-emerald-800 whitespace-nowrap tabular-nums">
                {h.status === 'SELESAI' ? rupiah(h.total_delivered) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 p-2.5">
              <p className="text-[11px] text-amber-700">Kembali ke Laci</p>
              <p className="text-sm font-bold text-amber-800 whitespace-nowrap tabular-nums">
                {h.status === 'SELESAI' ? rupiah(h.total_returned) : '—'}
              </p>
            </div>
          </div>

          {/* Info Petugas & Catatan */}
          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600 space-y-1">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Status:{' '}
                <b className={h.status === 'DIBAWA' ? 'text-amber-700' : 'text-emerald-700'}>
                  {h.status === 'DIBAWA' ? 'Sedang Dibawa Perwakilan' : 'Selesai'}
                </b>
              </span>
              <span>
                Petugas serah: <b className="text-slate-800">{h.operator_name || '-'}</b>
              </span>
              {h.status === 'SELESAI' && (
                <span>
                  Diselesaikan: <b className="text-slate-800">{h.settled_by_name || '-'}</b> ({formatDateWib(h.settled_at)})
                </span>
              )}
            </div>
            {h.notes && (
              <p>
                Catatan penyerahan: <span className="text-slate-800">{h.notes}</span>
              </p>
            )}
            {h.settle_notes && (
              <p>
                Catatan penyelesaian: <span className="text-slate-800">{h.settle_notes}</span>
              </p>
            )}
          </div>

          {/* Daftar Santri */}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs overflow-hidden">
            {detail.items.map((item, idx) => {
              const badgeClass =
                item.status === 'DITERIMA'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : item.status === 'DIBATALKAN'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
              const statusLabel =
                item.status === 'DITERIMA'
                  ? 'Diterima'
                  : item.status === 'DIBATALKAN'
                    ? 'Dibatalkan'
                    : 'Dibawa'
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 px-3.5 py-2.5 bg-white"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      <span className="text-slate-400 mr-1.5 tabular-nums">{idx + 1}.</span>
                      {item.nama_lengkap}
                      <span className="text-slate-500 font-normal">
                        {' '}· Kamar {item.kamar || '-'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{item.nis}</div>
                    {item.cancel_reason && (
                      <p className="mt-1 text-[11px] text-red-700">
                        Alasan batal: {item.cancel_reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {rupiah(item.amount)}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function SettleDialog({
  batchId,
  onClose,
  onDone,
}: {
  batchId: string
  onClose: () => void
  onDone: () => void
}) {
  const confirm = useConfirm()
  const { detail, error } = useDetail(batchId)
  const [absent, setAbsent] = useState<Record<string, string>>({})
  const [returned, setReturned] = useState('')
  const [settleNotes, setSettleNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [idempotencyKey] = useState(newKey)

  const cancelled = detail ? detail.items.filter(i => i.id in absent) : []
  const deliveredCount = detail ? detail.items.length - cancelled.length : 0
  const cancelledTotal = cancelled.reduce((sum, i) => sum + i.amount, 0)
  const deliveredTotal = detail ? detail.header.total_amount - cancelledTotal : 0
  const returnedAmount = cancelledTotal === 0 ? 0 : parseDigits(returned)
  const missingReason = cancelled.some(i => (absent[i.id] || '').trim().length < 3)
  const cashMismatch = cancelledTotal > 0 && returnedAmount !== cancelledTotal

  const submit = async () => {
    if (!detail) return
    if (missingReason) {
      toast.error('Isi alasan minimal 3 karakter untuk setiap santri yang dibatalkan.')
      return
    }
    if (cashMismatch) {
      toast.error(`Uang fisik yang dikembalikan harus tepat ${rupiah(cancelledTotal)}.`)
      return
    }
    const summaryText =
      cancelled.length > 0
        ? `${deliveredCount} santri diterima (${rupiah(deliveredTotal)}), ${cancelled.length} santri dibatalkan dan uang fisik ${rupiah(cancelledTotal)} dikembalikan ke laci. Lanjutkan?`
        : `Semua ${deliveredCount} santri (${rupiah(deliveredTotal)}) telah menerima uang jajan. Selesaikan pencairan ini?`

    const ok = await confirm(summaryText, {
      title: 'Selesaikan Pencairan',
      confirmLabel: 'Ya, Selesaikan',
      variant: 'success',
    })
    if (!ok) return

    setSaving(true)
    const res = await settlePayoutAction({
      batchId,
      idempotencyKey,
      returnedCash: returnedAmount,
      notes: settleNotes.trim() || null,
      cancelled: cancelled.map(i => ({ itemId: i.id, reason: absent[i.id].trim() })),
    })
    setSaving(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success('Pencairan berhasil diselesaikan.')
    onDone()
  }

  return (
    <Modal
      title="Selesaikan Pencairan"
      subtitle={
        detail
          ? `${detail.header.batch_number} · Perwakilan ${detail.header.representative_name}`
          : undefined
      }
      onClose={() => !saving && onClose()}
      footer={
        <>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Batal
          </button>
          {detail && (
            <button
              type="button"
              onClick={submit}
              disabled={saving || missingReason || cashMismatch}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" weight="bold" />
              <span>{saving ? 'Menyimpan…' : 'Selesaikan Pencairan'}</span>
            </button>
          )}
        </>
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!detail && !error && (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat daftar santri…</p>
      )}
      {detail && (
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600 leading-relaxed">
            Hilangkan centang hanya pada santri yang <b>tidak menerima</b> uang jajan (misal pulang/izin). Saldo santri yang dibatalkan otomatis dikembalikan dan uang fisiknya wajib diterima kembali di loket.
          </p>

          {/* Ringkasan Live */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2">
              <p className="text-[11px] text-emerald-700">Diterima ({deliveredCount} santri)</p>
              <p className="font-mono font-bold text-emerald-900 whitespace-nowrap tabular-nums">
                {rupiah(deliveredTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2">
              <p className="text-[11px] text-amber-800">Dibatalkan ({cancelled.length} santri)</p>
              <p className="font-mono font-bold text-amber-900 whitespace-nowrap tabular-nums">
                {rupiah(cancelledTotal)}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs overflow-hidden">
            {detail.items.map(item => {
              const isAbsent = item.id in absent
              return (
                <li
                  key={item.id}
                  className={`px-3.5 py-2.5 space-y-2 ${isAbsent ? 'bg-red-50/60' : 'bg-white'}`}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isAbsent}
                      onChange={e => {
                        const next = { ...absent }
                        if (e.target.checked) delete next[item.id]
                        else next[item.id] = ''
                        setAbsent(next)
                        if (Object.keys(next).length === 0) setReturned('')
                      }}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="flex-1 min-w-0">
                      <span className={`font-medium ${isAbsent ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {item.nama_lengkap}
                      </span>
                      <span className="text-slate-500"> · Kamar {item.kamar || '-'}</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {rupiah(item.amount)}
                    </span>
                  </label>
                  {isAbsent && (
                    <input
                      value={absent[item.id]}
                      onChange={e => setAbsent({ ...absent, [item.id]: e.target.value })}
                      placeholder="Alasan pembatalan (wajib, misal: pulang ke rumah)"
                      aria-label={`Alasan pembatalan ${item.nama_lengkap}`}
                      className="w-full rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none"
                    />
                  )}
                </li>
              )
            })}
          </ul>

          {/* Konfirmasi Uang Fisik Kembali */}
          {cancelledTotal === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" weight="bold" />
              <span>Semua santri menerima uang jajan. Tidak ada uang fisik yang dikembalikan ke laci.</span>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-950">Wajib kembali ke laci kas</span>
                <span className="font-mono font-bold text-amber-950 tabular-nums">
                  {rupiah(cancelledTotal)}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uang fisik yang dikembalikan perwakilan (hitung fisik)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={returned}
                    placeholder="0"
                    onChange={e => {
                      const n = parseDigits(e.target.value)
                      setReturned(n > 0 ? n.toLocaleString('id-ID') : '')
                    }}
                    className={`w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm font-mono tabular-nums focus:outline-none ${
                      returned !== '' && cashMismatch
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                </div>
                {cashMismatch && (
                  <p className="text-[11px] text-red-600 mt-1">
                    Nominal harus tepat <b>{rupiah(cancelledTotal)}</b>. Jika uang kurang, selesaikan dulu dengan perwakilan.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Catatan Penyelesaian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Penyelesaian (Opsional)
            </label>
            <input
              value={settleNotes}
              onChange={e => setSettleNotes(e.target.value)}
              placeholder="Catatan tambahan saat serah terima…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
