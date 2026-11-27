'use client'

// Menu Kas Bank — Mutasi Kas Bank ↔ Tunai lintas sesi (ambil dari / setor ke rekening Koperasi).

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowCircleDown,
  ArrowCircleUp,
  ArrowClockwise,
  ArrowRight,
  Bank,
  FileImage,
  MagnifyingGlass,
  Plus,
  Storefront,
  Warning,
  X,
} from '@phosphor-icons/react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import CashTransferModal from '../loket/cash-transfer-modal'
import { voidLoketCashTransferAction } from '../loket/actions'
import { getKasBankData, type KasBankFilter } from './actions'
import type { CashTransferRow } from '@/lib/finance/cash-transfers'

type Data = Awaited<ReturnType<typeof getKasBankData>>

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const formatDateWib = (iso: string | null) => formatFinanceDate(iso, true)

const DIRECTION_OPTIONS: SelectPickerOption[] = [
  { value: 'SEMUA', label: 'Semua Arah' },
  { value: 'BANK_TO_CASH', label: 'Ambil dari Rekening' },
  { value: 'CASH_TO_BANK', label: 'Setor ke Rekening' },
]

const STATE_OPTIONS: SelectPickerOption[] = [
  { value: 'SEMUA', label: 'Semua Status' },
  { value: 'POSTED_UNMATCHED', label: 'Belum Dicocokkan' },
  { value: 'MATCHED', label: 'Cocok Rekening Koran' },
  { value: 'VOIDED', label: 'Dibatalkan' },
]

const DEFAULT_FILTER: KasBankFilter = {
  direction: 'SEMUA',
  state: 'SEMUA',
  fromDate: '',
  toDate: '',
  search: '',
}

function accountLabel(snapshot: string): string {
  try {
    const a = JSON.parse(snapshot) as { bank_name?: string; account_number?: string }
    const no = String(a.account_number ?? '')
    return `${a.bank_name ?? ''} ···${no.slice(-4)}`.trim()
  } catch {
    return '-'
  }
}

function StatusBadge({ row }: { row: CashTransferRow }) {
  if (row.status === 'VOIDED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
        Dibatalkan
      </span>
    )
  }
  if (row.statement_transaction_id) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
        Cocok Rekening Koran
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
      Belum Dicocokkan
    </span>
  )
}

export default function KasBankContent({ initialData }: { initialData: Data }) {
  const [data, setData] = useState(initialData)
  const [filter, setFilter] = useState<KasBankFilter>(DEFAULT_FILTER)
  const [searchInput, setSearchInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<CashTransferRow | null>(null)

  const loadSeqRef = useRef(0)
  const isFirstSearchMount = useRef(true)

  const invalidDateRange = Boolean(
    filter.fromDate && filter.toDate && filter.fromDate > filter.toDate
  )

  const hasActiveFilter = Boolean(
    filter.direction !== 'SEMUA' ||
      filter.state !== 'SEMUA' ||
      filter.fromDate ||
      filter.toDate ||
      searchInput.trim()
  )

  const canOpenReconciliation = data.viewer.roles.some(
    r => r === 'admin' || r === 'bendahara' || r === 'admin_koperasi'
  )

  const load = (next: KasBankFilter = filter) => {
    if (next.fromDate && next.toDate && next.fromDate > next.toDate) {
      toast.error('Tanggal awal tidak boleh melebihi tanggal akhir.')
      return
    }
    const seq = ++loadSeqRef.current
    startTransition(async () => {
      try {
        const res = await getKasBankData({ ...next, offset: 0 })
        if (seq !== loadSeqRef.current) return
        setData(res)
      } catch (e) {
        if (seq !== loadSeqRef.current) return
        toast.error(e instanceof Error ? e.message : 'Gagal memuat mutasi kas.')
      }
    })
  }

  // Debounced search
  useEffect(() => {
    if (isFirstSearchMount.current) {
      isFirstSearchMount.current = false
      return
    }
    const timer = setTimeout(() => {
      const next: KasBankFilter = { ...filter, search: searchInput.trim() }
      setFilter(next)
      load(next)
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const loadMore = () => {
    const seq = ++loadSeqRef.current
    startTransition(async () => {
      try {
        const more = await getKasBankData({ ...filter, offset: data.items.length })
        if (seq !== loadSeqRef.current) return
        setData(prev => {
          const seen = new Set(prev.items.map(item => item.id))
          const appended = more.items.filter(item => !seen.has(item.id))
          return { ...more, items: [...prev.items, ...appended] }
        })
      } catch (e) {
        if (seq !== loadSeqRef.current) return
        toast.error(e instanceof Error ? e.message : 'Gagal memuat mutasi kas.')
      }
    })
  }

  const update = (patch: Partial<KasBankFilter>) => {
    const next = { ...filter, ...patch }
    setFilter(next)
    if (next.fromDate && next.toDate && next.fromDate > next.toDate) return
    load(next)
  }

  const resetFilters = () => {
    setSearchInput('')
    setFilter(DEFAULT_FILTER)
    load(DEFAULT_FILTER)
  }

  const canVoid = (row: CashTransferRow) =>
    !data.viewer.isViewOnly &&
    row.status === 'POSTED' &&
    !row.statement_transaction_id &&
    row.session_status === 'OPEN' &&
    (row.operator_id === data.viewer.id ||
      data.viewer.roles.some(r => r === 'admin' || r === 'bendahara'))

  const dateInputClass =
    'w-full min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15'

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      <DashboardPageHeader
        title="Kas Bank"
        description="Perpindahan dana antara rekening Koperasi dan laci loket. Bukan pembayaran atau pendapatan — hanya pencatatan perpindahan tempat simpan uang."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ArrowClockwise className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} weight="bold" />
              <span>Segarkan</span>
            </button>
            {!data.viewer.isViewOnly && data.cashSession && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" weight="bold" />
                <span>Catat Mutasi Kas</span>
              </button>
            )}
          </div>
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
                  {!data.viewer.seesAll && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Mutasi Anda
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Petugas: <span className="font-medium text-slate-700">{data.viewer.name}</span>
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
                <span className="font-semibold">Sesi kas belum dibuka.</span> Mutasi kas dicatat di dalam sesi kas aktif.
                {!data.viewer.seesAll && ' Menampilkan riwayat mutasi yang Anda catat.'}
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

      {/* 4 Kartu Ringkasan KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Ambil dari Rekening',
            value: rupiah(data.summary.bankIn),
            sub: 'Masuk ke laci kas',
            icon: ArrowCircleDown,
            tone: 'text-emerald-700',
          },
          {
            label: 'Setor ke Rekening',
            value: rupiah(data.summary.bankOut),
            sub: 'Keluar dari laci kas',
            icon: ArrowCircleUp,
            tone: 'text-rose-700',
          },
          {
            label: 'Belum Dicocokkan',
            value: String(data.summary.unmatched),
            sub: 'Menunggu rekening koran',
            icon: Bank,
            tone: 'text-amber-700',
          },
          {
            label: 'Dibatalkan',
            value: String(data.summary.voided),
            sub: 'Status void pada filter',
            icon: Warning,
            tone: 'text-slate-600',
          },
        ].map(card => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <card.icon className={`w-4 h-4 shrink-0 ${card.tone}`} weight="bold" />
              <span className="truncate">{card.label}</span>
            </div>
            <div className={`mt-1.5 text-lg sm:text-xl font-bold whitespace-nowrap tabular-nums ${card.tone}`}>
              {card.value}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400 truncate">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Catatan Rekonsiliasi */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 -mt-1">
        <span>
          Ringkasan mengikuti filter aktif. Mutasi yang belum dicocokkan diselesaikan di Rekonsiliasi Bank.
        </span>
        {canOpenReconciliation && (
          <Link
            href="/dashboard/keuangan/rekonsiliasi"
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
          >
            <span>Buka Rekonsiliasi</span>
            <ArrowRight className="w-3.5 h-3.5" weight="bold" />
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end">
          {/* Pencarian */}
          <div className="col-span-2 sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cari Mutasi</label>
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="No. KAS, sesi, referensi, petugas…"
                className="w-full min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Arah */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Arah</label>
            <SelectPicker
              value={filter.direction ?? 'SEMUA'}
              options={DIRECTION_OPTIONS}
              align="left"
              className="w-full"
              menuClassName="w-full min-w-[190px]"
              onChange={val => update({ direction: val as KasBankFilter['direction'] })}
            />
          </div>

          {/* Status */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
            <SelectPicker
              value={filter.state ?? 'SEMUA'}
              options={STATE_OPTIONS}
              align="left"
              className="w-full"
              menuClassName="w-full min-w-[200px]"
              onChange={val => update({ state: val as KasBankFilter['state'] })}
            />
          </div>

          {/* Dari Tanggal */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dari (WIB)</label>
            <input
              type="date"
              className={dateInputClass}
              value={filter.fromDate ?? ''}
              onChange={e => update({ fromDate: e.target.value })}
            />
          </div>

          {/* Sampai Tanggal */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampai</label>
            <input
              type="date"
              className={dateInputClass}
              value={filter.toDate ?? ''}
              onChange={e => update({ toDate: e.target.value })}
            />
          </div>
        </div>

        {(invalidDateRange || hasActiveFilter) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
            <div>
              {invalidDateRange ? (
                <span className="font-medium text-red-600">
                  Tanggal awal lebih besar dari tanggal akhir. Sesuaikan rentang tanggal.
                </span>
              ) : (
                <span className="text-slate-500">
                  Menampilkan <b className="text-slate-800">{data.items.length}</b> dari{' '}
                  <b className="text-slate-800">{data.total}</b> mutasi
                </span>
              )}
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="w-3.5 h-3.5" weight="bold" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabel Desktop */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Waktu Bank</th>
                <th className="text-left px-4 py-2.5 font-semibold">Mutasi</th>
                <th className="text-right px-4 py-2.5 font-semibold">Nominal</th>
                <th className="text-left px-4 py-2.5 font-semibold">Rekening</th>
                <th className="text-left px-4 py-2.5 font-semibold">Petugas</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-right px-4 py-2.5 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-600">
                      Belum ada mutasi kas pada filter ini.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Catat pengambilan kas dari rekening atau setoran tunai ke bank melalui tombol Catat Mutasi Kas.
                    </p>
                  </td>
                </tr>
              ) : (
                data.items.map(row => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50/70 transition-colors ${row.status === 'VOIDED' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700 tabular-nums">
                      {formatDateWib(row.bank_transacted_at)}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="font-semibold text-slate-900">
                        {row.direction === 'BANK_TO_CASH' ? 'Ambil dari Rekening' : 'Setor ke Rekening'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {row.transfer_number} · {row.session_code}
                      </div>
                      {row.bank_reference && (
                        <div className="text-xs text-slate-500">Ref: {row.bank_reference}</div>
                      )}
                      {row.notes && (
                        <div className="text-xs text-slate-600 mt-0.5">Catatan: {row.notes}</div>
                      )}
                      {row.statement_transaction_id && (
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          Cocok {formatDateWib(row.matched_at)}
                          {row.match_notes ? ` · ${row.match_notes}` : ''}
                        </div>
                      )}
                      {row.status === 'VOIDED' && row.void_reason && (
                        <div className="text-xs text-rose-700 mt-0.5">
                          Dibatalkan: {row.void_reason}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap tabular-nums ${
                        row.direction === 'BANK_TO_CASH' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {row.direction === 'BANK_TO_CASH' ? '+' : '−'}
                      {rupiah(row.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">
                      {accountLabel(row.account_snapshot)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">{row.handled_by_name}</div>
                      <div className="text-[11px] text-slate-500">
                        dicatat {row.operator_name ?? '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(row.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors"
                        >
                          <FileImage className="w-3.5 h-3.5 text-slate-500" weight="bold" />
                          <span>Bukti</span>
                        </a>
                        {canVoid(row) && (
                          <button
                            type="button"
                            onClick={() => setVoidTarget(row)}
                            className="rounded-lg border border-rose-200 bg-white hover:bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daftar Kartu Mobile */}
      <div className="md:hidden space-y-2.5">
        {data.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-600">
              Belum ada mutasi kas pada filter ini.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Catat pengambilan atau setoran kas melalui tombol Catat Mutasi Kas.
            </p>
          </div>
        ) : (
          data.items.map(row => (
            <div
              key={row.id}
              className={`rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs ${
                row.status === 'VOIDED' ? 'opacity-65' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {row.direction === 'BANK_TO_CASH' ? 'Ambil dari Rekening' : 'Setor ke Rekening'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {row.transfer_number} · {row.session_code}
                  </div>
                </div>
                <div
                  className={`text-sm font-mono font-bold whitespace-nowrap tabular-nums ${
                    row.direction === 'BANK_TO_CASH' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {row.direction === 'BANK_TO_CASH' ? '+' : '−'}
                  {rupiah(row.amount)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <StatusBadge row={row} />
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {formatDateWib(row.bank_transacted_at)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Rekening</span>
                  <span className="font-medium text-slate-800">{accountLabel(row.account_snapshot)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Petugas ke Bank</span>
                  <span className="font-medium text-slate-800">{row.handled_by_name}</span>
                </div>
              </div>

              {(row.bank_reference || row.notes || row.match_notes || (row.status === 'VOIDED' && row.void_reason)) && (
                <div className="space-y-1 text-xs">
                  {row.bank_reference && (
                    <p className="text-slate-500">Ref: <span className="text-slate-700">{row.bank_reference}</span></p>
                  )}
                  {row.notes && (
                    <p className="text-slate-500">Catatan: <span className="text-slate-700">{row.notes}</span></p>
                  )}
                  {row.statement_transaction_id && (
                    <p className="text-emerald-700">
                      Cocok {formatDateWib(row.matched_at)}
                      {row.match_notes ? ` · ${row.match_notes}` : ''}
                    </p>
                  )}
                  {row.status === 'VOIDED' && row.void_reason && (
                    <p className="text-rose-700">Dibatalkan: {row.void_reason}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                <a
                  href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(row.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <FileImage className="w-3.5 h-3.5 text-slate-500" weight="bold" />
                  <span>Lihat Bukti</span>
                </a>
                {canVoid(row) && (
                  <button
                    type="button"
                    onClick={() => setVoidTarget(row)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    Batalkan
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {data.items.length < data.total && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? 'Memuat…'
              : `Tampilkan lebih banyak (${data.items.length} dari ${data.total})`}
          </button>
        </div>
      )}

      {/* Modal Catat Mutasi Kas */}
      <CashTransferModal
        isOpen={modalOpen}
        sessionId={data.cashSession?.id ?? null}
        drawerBalance={data.cashSession?.available ?? 0}
        operatorName={data.viewer.name}
        accounts={data.accounts}
        onClose={() => setModalOpen(false)}
        onChanged={() => load()}
      />

      {/* Modal Konfirmasi Pembatalan Mutasi (menggantikan window.prompt) */}
      {voidTarget && (
        <VoidTransferModal
          row={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={() => {
            setVoidTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function VoidTransferModal({
  row,
  onClose,
  onVoided,
}: {
  row: CashTransferRow
  onClose: () => void
  onVoided: () => void
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitting, onClose])

  const trimmed = reason.trim()
  const isValid = trimmed.length >= 5

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      const res = await voidLoketCashTransferAction({ id: row.id, reason: trimmed })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(`Mutasi ${row.transfer_number} dibatalkan.`)
      onVoided()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membatalkan mutasi kas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Batalkan Mutasi Kas"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Batalkan Mutasi Kas</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{row.transfer_number}</p>
          </div>
          <button
            type="button"
            disabled={submitting}
            aria-label="Tutup"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3.5 py-2.5 text-xs text-rose-900 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {row.direction === 'BANK_TO_CASH' ? 'Ambil dari Rekening' : 'Setor ke Rekening'}
                </span>
                <span className="font-mono font-bold whitespace-nowrap tabular-nums">
                  {rupiah(row.amount)}
                </span>
              </div>
              <p className="text-rose-800/90">
                Pembatalan akan mengembalikan saldo laci sesi <b>{row.session_code}</b> ke kondisi sebelum mutasi ini dicatat. Riwayat tetap tersimpan sebagai status Dibatalkan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Pembatalan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Contoh: Salah input nominal atau salah pilih rekening (minimal 5 karakter)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {trimmed.length < 5
                  ? `Minimal 5 karakter (${trimmed.length}/5)`
                  : 'Alasan valid dan akan tercatat di jejak audit.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Membatalkan…' : 'Ya, Batalkan Mutasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
