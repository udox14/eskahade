'use client'

// app/dashboard/keuangan/riwayat/_page-content.tsx
// Antarmuka Riwayat Transaksi Global (PRD Bab 30 & UI/UX Guidelines Bab 23)

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import {
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  Wallet,
  Send,
  ArrowUpRight,
} from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { DEFAULT_FINANCE_PAGE_SIZE } from '@/lib/finance/constants'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import { formatFinanceDate } from '@/lib/finance/date-format'
import { TransactionDetailDrawer } from './transaction-detail-drawer'
import { getGlobalHistoryData, type UserHistoryPermissions } from './actions'
import type {
  GlobalTransactionHistoryResponse,
  GlobalTransactionRow,
  FilterOptionsData,
  GlobalTransactionQueryParams,
} from '@/lib/finance/history'

interface RiwayatTransaksiContentProps {
  initialHistory: GlobalTransactionHistoryResponse
  filterOptions: FilterOptionsData
  userPermissions: UserHistoryPermissions
}

const PAGE_SIZE_OPTIONS: SelectPickerOption[] = [
  { value: '20', label: '20 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' },
]

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatReferenceDisplay(rawRef: string, category: GlobalTransactionRow['category']): string {
  if (!rawRef) return '—'
  const trimmed = rawRef.trim()
  if (trimmed.startsWith('LOKET_DEPOSIT:')) {
    const shortId = (trimmed.split(':')[1] || '').replace(/-/g, '').slice(0, 6).toUpperCase()
    return shortId ? `LOKET-${shortId}` : 'LOKET-SETOR'
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    const prefix = category === 'WITHDRAWAL' ? 'WDR' : category === 'TOPUP' ? 'TOP' : 'REF'
    return `${prefix}-${trimmed.slice(0, 8).toUpperCase()}`
  }
  return trimmed.length > 24 ? `${trimmed.slice(0, 21)}…` : trimmed
}

function formatItemDisplay(itemType: string | null, itemLabel: string | null): string {
  const source = itemType || itemLabel
  if (!source) return '—'
  if (source.includes(',')) {
    return source
      .split(',')
      .map((part) => {
        const key = part.trim()
        if (key === 'UANG_JAJAN') return 'Uang Jajan'
        if (key === 'KOREKSI') return 'Koreksi'
        return FINANCE_ITEM_LABELS[key as FinanceItemType] || key.replace(/_/g, ' ')
      })
      .join(', ')
  }
  if (source === 'UANG_JAJAN') return 'Uang Jajan'
  if (source === 'KOREKSI') return 'Koreksi'
  return FINANCE_ITEM_LABELS[source as FinanceItemType] || itemLabel || source.replace(/_/g, ' ')
}

function formatRecipientLabel(info: string | null): string {
  if (!info) return '—'
  switch (info) {
    case 'PESANTREN':
    case 'BENDAHARA':
      return 'Bendahara Pesantren'
    case 'KATERING':
      return 'Katering'
    case 'LAUNDRY':
      return 'Laundry'
    default:
      return info
  }
}

function formatMethodLabel(method?: string | null, channel?: string | null): string {
  const raw = method || channel || ''
  switch (raw) {
    case 'CASH':
      return 'Tunai'
    case 'MANUAL_TRANSFER':
    case 'TRANSFER':
      return 'Transfer Manual'
    case 'BRI_VA':
    case 'BRIVA':
    case 'BRI':
      return 'BRIVA'
    case 'BRI_QLOLA':
      return 'BRI QLola'
    case 'SYSTEM':
      return 'Sistem'
    default:
      return raw ? raw.replace(/_/g, ' ') : '—'
  }
}

function formatStatusInfo(status: string): { label: string; className: string } {
  switch (status) {
    case 'SETTLED':
      return {
        label: 'Settled Bank',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      }
    case 'PAID':
      return {
        label: 'Diterima',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      }
    case 'COMPLETED':
      return {
        label: 'Selesai',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      }
    case 'VOID':
      return {
        label: 'Dibatalkan',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    case 'REVERSAL':
      return {
        label: 'Koreksi',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    case 'REFUND':
      return {
        label: 'Pengembalian',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      }
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      }
  }
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function RiwayatTransaksiContent({
  initialHistory,
  filterOptions,
}: RiwayatTransaksiContentProps) {
  const [history, setHistory] = useState<GlobalTransactionHistoryResponse>(initialHistory)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Filter States
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [category, setCategory] = useState('ALL')
  const [itemType, setItemType] = useState('ALL')
  const [channel, setChannel] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [asrama, setAsrama] = useState('ALL')

  // Sorting & Pagination States
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount' | 'transactionNumber'>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(initialHistory.pagination.currentPage || 1)
  const [pageSize, setPageSize] = useState(initialHistory.pagination.pageSize || DEFAULT_FINANCE_PAGE_SIZE)

  // Drawer Selected Transaction State
  const [selectedTransaction, setSelectedTransaction] = useState<GlobalTransactionRow | null>(null)

  const searchId = useId()
  const startDateId = useId()
  const endDateId = useId()
  const tableRegionHeadingId = useId()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const advancedFilterCount =
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (itemType !== 'ALL' ? 1 : 0) +
    (status !== 'ALL' ? 1 : 0) +
    (asrama !== 'ALL' ? 1 : 0)

  const hasActiveFilters =
    search.trim() !== '' ||
    category !== 'ALL' ||
    channel !== 'ALL' ||
    advancedFilterCount > 0

  const fetchTransactions = (overrides?: Partial<GlobalTransactionQueryParams>) => {
    const queryPayload: GlobalTransactionQueryParams = {
      search: overrides?.search !== undefined ? overrides.search : search,
      startDate: overrides?.startDate !== undefined ? overrides.startDate : startDate,
      endDate: overrides?.endDate !== undefined ? overrides.endDate : endDate,
      category: overrides?.category !== undefined ? overrides.category : category,
      itemType: overrides?.itemType !== undefined ? overrides.itemType : itemType,
      channel: overrides?.channel !== undefined ? overrides.channel : channel,
      status: overrides?.status !== undefined ? overrides.status : status,
      asrama: overrides?.asrama !== undefined ? overrides.asrama : asrama,
      sortBy: overrides?.sortBy !== undefined ? overrides.sortBy : sortBy,
      sortDirection: overrides?.sortDirection !== undefined ? overrides.sortDirection : sortDirection,
      page: overrides?.page !== undefined ? overrides.page : currentPage,
      pageSize: overrides?.pageSize !== undefined ? overrides.pageSize : pageSize,
    }

    startTransition(async () => {
      try {
        setErrorMessage(null)
        const res = await getGlobalHistoryData(queryPayload)
        setHistory(res)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Riwayat transaksi belum dapat dimuat. Coba lagi.')
      }
    })
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1)
      fetchTransactions({ search: val, page: 1 })
    }, 350)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setCurrentPage(1)
    fetchTransactions({ page: 1, search })
  }

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    setCurrentPage(1)
    fetchTransactions({ category: val, page: 1 })
  }

  const handleResetFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setSearch('')
    setStartDate('')
    setEndDate('')
    setCategory('ALL')
    setItemType('ALL')
    setChannel('ALL')
    setStatus('ALL')
    setAsrama('ALL')
    setCurrentPage(1)
    fetchTransactions({
      search: '',
      startDate: '',
      endDate: '',
      category: 'ALL',
      itemType: 'ALL',
      channel: 'ALL',
      status: 'ALL',
      asrama: 'ALL',
      page: 1,
    })
  }

  const handleSortToggle = (col: 'createdAt' | 'amount' | 'transactionNumber') => {
    let newDirection: 'asc' | 'desc' = 'desc'
    if (sortBy === col) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      newDirection = col === 'createdAt' ? 'desc' : 'asc'
    }
    setSortBy(col)
    setSortDirection(newDirection)
    fetchTransactions({ sortBy: col, sortDirection: newDirection })
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchTransactions({ page })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    fetchTransactions({ pageSize: size, page: 1 })
  }

  const asramaOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Asrama' },
      ...filterOptions.asramaList.map((a) => ({ value: a, label: a })),
    ],
    [filterOptions.asramaList]
  )

  const { items, pagination, summary } = history
  const rangeStart =
    pagination.totalRecords === 0 ? 0 : (pagination.currentPage - 1) * pagination.pageSize + 1
  const rangeEnd = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords)

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 1. Header — Segarkan sejajar di kanan judul di HP maupun desktop */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem] text-balance">
            Riwayat Transaksi
          </h1>
          <button
            type="button"
            onClick={() => fetchTransactions()}
            disabled={isPending}
            aria-label="Segarkan riwayat transaksi"
            className="inline-flex min-h-[40px] sm:min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Segarkan</span>
          </button>
        </div>
        <p className="text-sm leading-5 text-slate-500 text-pretty">
          Histori terpadu seluruh mutasi keuangan: pembayaran tagihan, uang jajan santri, penyaluran dana, dan koreksi.
        </p>
      </header>

      {/* Pesan Error */}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      )}

      <div
        aria-busy={isPending}
        className={`space-y-5 transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}
      >
        {/* 2. 4 Kartu Ringkasan Clickable (Seragam dengan modul keuangan lain) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => handleCategoryChange(category === 'PAYMENT' ? 'ALL' : 'PAYMENT')}
            className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
              category === 'PAYMENT'
                ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Penerimaan Pesantren</span>
                <Coins className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(summary.totalInPesantren)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <span>Dana masuk operasional</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange(category === 'TOPUP' ? 'ALL' : 'TOPUP')}
            className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
              category === 'TOPUP'
                ? 'border-indigo-500 ring-2 ring-indigo-500/15'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Top-Up Uang Jajan</span>
                <Wallet className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(summary.totalInTitipan)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <span>Dana titipan santri</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-700" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange(category === 'DISTRIBUTION' ? 'ALL' : 'DISTRIBUTION')}
            className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
              category === 'DISTRIBUTION'
                ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Penyaluran Dana</span>
                <Send className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(summary.totalOutPesantren)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <span>Pesantren, katering &amp; laundry</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange(category === 'WITHDRAWAL' ? 'ALL' : 'WITHDRAWAL')}
            className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
              category === 'WITHDRAWAL'
                ? 'border-indigo-500 ring-2 ring-indigo-500/15'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Pencairan Uang Jajan</span>
                <ArrowUpRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(summary.totalOutTitipan)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <span>Pencairan kolektif &amp; loket</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-700" aria-hidden="true" />
            </div>
          </button>
        </div>

        {/* 3. Filter Toolbar Ramping + Filter Lainnya (tidak memenuhi layar HP) */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <label htmlFor={searchId} className="sr-only">
                Cari nomor transaksi, NIS, nama santri, atau referensi
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="text"
                placeholder="Cari no. transaksi, NIS, nama santri, atau referensi…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="min-h-[44px] sm:min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                    setSearch('')
                    setCurrentPage(1)
                    fetchTransactions({ search: '', page: 1 })
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </form>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <SelectPicker
                value={category}
                options={filterOptions.categoryList}
                onChange={handleCategoryChange}
                ariaLabel="Filter kategori transaksi"
                align="left"
                className="w-full sm:w-auto [&>button]:w-full"
              />

              <SelectPicker
                value={channel}
                options={filterOptions.channelList}
                onChange={(val) => {
                  setChannel(val)
                  setCurrentPage(1)
                  fetchTransactions({ channel: val, page: 1 })
                }}
                ariaLabel="Filter kanal atau metode pembayaran"
                align="left"
                className="w-full sm:w-auto [&>button]:w-full"
              />

              <button
                type="button"
                aria-expanded={showAdvancedFilters}
                onClick={() => setShowAdvancedFilters((v) => !v)}
                className={`col-span-2 sm:col-span-1 inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  showAdvancedFilters || advancedFilterCount > 0
                    ? 'border-emerald-300 bg-emerald-50/60 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Filter Lainnya</span>
                {advancedFilterCount > 0 && (
                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {advancedFilterCount}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="col-span-2 sm:col-span-1 inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Lanjutan (Collapsible) */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
              <div>
                <label htmlFor={startDateId} className="mb-1 block font-semibold text-slate-600">
                  Mulai Tanggal
                </label>
                <input
                  id={startDateId}
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setCurrentPage(1)
                    fetchTransactions({ startDate: e.target.value, page: 1 })
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor={endDateId} className="mb-1 block font-semibold text-slate-600">
                  Sampai Tanggal
                </label>
                <input
                  id={endDateId}
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setCurrentPage(1)
                    fetchTransactions({ endDate: e.target.value, page: 1 })
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <span className="mb-1 block font-semibold text-slate-600">Pos Tagihan</span>
                <SelectPicker
                  value={itemType}
                  options={filterOptions.itemTypeList}
                  onChange={(val) => {
                    setItemType(val)
                    setCurrentPage(1)
                    fetchTransactions({ itemType: val, page: 1 })
                  }}
                  ariaLabel="Filter pos tagihan"
                  align="left"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div>
                <span className="mb-1 block font-semibold text-slate-600">Status</span>
                <SelectPicker
                  value={status}
                  options={filterOptions.statusList}
                  onChange={(val) => {
                    setStatus(val)
                    setCurrentPage(1)
                    fetchTransactions({ status: val, page: 1 })
                  }}
                  ariaLabel="Filter status transaksi"
                  align="left"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div>
                <span className="mb-1 block font-semibold text-slate-600">Asrama</span>
                <SelectPicker
                  value={asrama}
                  options={asramaOptions}
                  onChange={(val) => {
                    setAsrama(val)
                    setCurrentPage(1)
                    fetchTransactions({ asrama: val, page: 1 })
                  }}
                  ariaLabel="Filter asrama"
                  align="left"
                  className="w-full [&>button]:w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Data Table & Mobile List */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <h2 id={tableRegionHeadingId} className="sr-only">
            Daftar riwayat transaksi keuangan
          </h2>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <p className="text-sm font-semibold text-slate-800">
                Tidak ada transaksi ditemukan
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Ubah kata kunci pencarian atau sesuaikan filter untuk melihat riwayat mutasi lainnya.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Stacked List (md:hidden) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {items.map((tx) => {
                  const isIncoming = tx.direction === 'IN'
                  const statusInfo = formatStatusInfo(tx.status)
                  const refDisplay = formatReferenceDisplay(tx.transactionNumber, tx.category)
                  const itemDisplay = formatItemDisplay(tx.itemType, tx.itemLabel)
                  const partyName = tx.santriName || formatRecipientLabel(tx.recipientInfo)

                  return (
                    <button
                      key={`m-${tx.sourceTable}-${tx.id}`}
                      type="button"
                      onClick={() => setSelectedTransaction(tx)}
                      className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {partyName}
                            {tx.santriNis && (
                              <span className="ml-1 text-xs font-normal text-slate-500 tabular-nums">
                                ({tx.santriNis})
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600 truncate">
                            {tx.categoryLabel} · {formatMethodLabel(tx.method, tx.channel)}
                          </div>
                          {itemDisplay !== '—' && (
                            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                              {itemDisplay}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <div
                            className={`text-sm font-bold tabular-nums ${
                              isIncoming ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {isIncoming ? '+' : '-'} {formatRupiah(tx.amount)}
                          </div>
                          <span
                            className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>{tx.createdAt ? formatFinanceDate(tx.createdAt, true) : '—'}</span>
                        <span className="font-mono text-slate-600" title={tx.transactionNumber}>
                          {refDisplay}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Desktop Table (hidden md:block) */}
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={tableRegionHeadingId}
                className="hidden md:block overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleSortToggle('createdAt')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                        >
                          <span>Waktu</span>
                          {sortBy === 'createdAt' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-300" aria-hidden="true" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleSortToggle('transactionNumber')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                        >
                          <span>Referensi</span>
                          {sortBy === 'transactionNumber' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-300" aria-hidden="true" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="px-4 py-3">Santri / Penerima</th>
                      <th scope="col" className="px-4 py-3">Jenis &amp; Pos</th>
                      <th scope="col" className="px-4 py-3">Metode</th>
                      <th scope="col" className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSortToggle('amount')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                        >
                          <span>Nominal</span>
                          {sortBy === 'amount' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-300" aria-hidden="true" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">Status</th>
                      <th scope="col" className="w-8 py-3 pr-4">
                        <span className="sr-only">Detail</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {items.map((tx) => {
                      const isIncoming = tx.direction === 'IN'
                      const statusInfo = formatStatusInfo(tx.status)
                      const refDisplay = formatReferenceDisplay(tx.transactionNumber, tx.category)
                      const itemDisplay = formatItemDisplay(tx.itemType, tx.itemLabel)

                      return (
                        <tr
                          key={`${tx.sourceTable}-${tx.id}`}
                          tabIndex={0}
                          onClick={() => setSelectedTransaction(tx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedTransaction(tx)
                            }
                          }}
                          className="group cursor-pointer hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                            {tx.createdAt ? formatFinanceDate(tx.createdAt, true) : '—'}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="font-mono font-medium text-slate-800"
                              title={tx.transactionNumber}
                            >
                              {refDisplay}
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {tx.santriName ? (
                              <div>
                                <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {tx.santriName}
                                </span>
                                {tx.santriNis && (
                                  <span className="ml-1.5 text-[11px] text-slate-500 tabular-nums">
                                    ({tx.santriNis})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="font-semibold text-slate-900">
                                {formatRecipientLabel(tx.recipientInfo)}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 max-w-[240px]">
                            <div className="font-medium text-slate-800 truncate">{tx.categoryLabel}</div>
                            <div className="text-[11px] text-slate-500 truncate" title={itemDisplay}>
                              {itemDisplay}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {formatMethodLabel(tx.method, tx.channel)}
                          </td>

                          <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums">
                            <span className={isIncoming ? 'text-emerald-700' : 'text-slate-900'}>
                              {isIncoming ? '+' : '-'} {formatRupiah(tx.amount)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>

                          <td className="py-3 pr-4 text-right whitespace-nowrap">
                            <ChevronRight
                              className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors inline-block"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginasi Bersih (SelectPicker placement="top" + single-fetch) */}
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500 tabular-nums">
                  Menampilkan{' '}
                  <strong className="font-semibold text-slate-700">
                    {rangeStart}–{rangeEnd}
                  </strong>{' '}
                  dari{' '}
                  <strong className="font-semibold text-slate-700">
                    {pagination.totalRecords}
                  </strong>{' '}
                  transaksi
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <SelectPicker
                    value={String(pageSize)}
                    options={PAGE_SIZE_OPTIONS}
                    onChange={(val) => handlePageSizeChange(Number(val))}
                    prefixLabel="Tampilkan"
                    ariaLabel="Jumlah baris per halaman"
                    placement="top"
                    align="right"
                    menuClassName="w-36"
                  />

                  {pagination.totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePageChange(1)}
                        disabled={pagination.currentPage === 1}
                        aria-label="Halaman pertama"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage === 1}
                        aria-label="Halaman sebelumnya"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      {getPageRange(pagination.currentPage, pagination.totalPages).map((p, idx) =>
                        p === '...' ? (
                          <span key={`dots-${idx}`} className="px-1 text-xs text-slate-400">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePageChange(p)}
                            aria-current={p === pagination.currentPage ? 'page' : undefined}
                            className={`h-8 w-8 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                              p === pagination.currentPage
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        aria-label="Halaman berikutnya"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange(pagination.totalPages)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        aria-label="Halaman terakhir"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 5. Slide-over Detail Drawer (key mencegah stale detail saat ganti baris) */}
      <TransactionDetailDrawer
        key={
          selectedTransaction
            ? `${selectedTransaction.sourceTable}-${selectedTransaction.id}`
            : 'tx-drawer'
        }
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  )
}
