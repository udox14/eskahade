'use client'

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Search,
  Wallet,
  RotateCcw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Users,
  RefreshCw,
  X,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { TableSkeleton } from '@/components/ui/skeletons'
import { publicMediaUrl } from '@/lib/r2/references'
import { formatFinanceDate } from '@/lib/finance/date-format'
import { WalletDetailDrawer } from './wallet-detail-drawer'
import { getUangJajanData, type UangJajanResponse } from './actions'

interface UangJajanContentProps {
  initialData: UangJajanResponse
}

const SALDO_FILTER_OPTIONS: SelectPickerOption[] = [
  { value: 'ALL', label: 'Semua Status Saldo' },
  { value: 'BER_SALDO', label: 'Memiliki Saldo (> Rp0)' },
  { value: 'SALDO_KOSONG', label: 'Saldo Kosong (Rp0)' },
]

const PAGE_SIZE_OPTIONS: SelectPickerOption[] = [
  { value: '20', label: '20 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' },
]

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function UangJajanContent({ initialData }: UangJajanContentProps) {
  const [data, setData] = useState<UangJajanResponse>(initialData)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedSantriId, setSelectedSantriId] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAsrama, setSelectedAsrama] = useState<string>('ALL')
  const [selectedSaldoFilter, setSelectedSaldoFilter] = useState<'ALL' | 'BER_SALDO' | 'SALDO_KOSONG'>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(initialData.pagination.currentPage || 1)
  const [pageSize, setPageSize] = useState<number>(initialData.pagination.pageSize || 50)

  const searchInputId = useId()
  const tableRegionHeadingId = useId()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAsrama !== 'ALL' ||
    selectedSaldoFilter !== 'ALL'

  const fetchData = (overrides?: {
    search?: string
    asrama?: string
    saldoFilter?: 'ALL' | 'BER_SALDO' | 'SALDO_KOSONG'
    page?: number
    size?: number
  }) => {
    const search = overrides?.search !== undefined ? overrides.search : searchQuery
    const asrama = overrides?.asrama !== undefined ? overrides.asrama : selectedAsrama
    const saldoFilter = overrides?.saldoFilter !== undefined ? overrides.saldoFilter : selectedSaldoFilter
    const page = overrides?.page !== undefined ? overrides.page : currentPage
    const size = overrides?.size !== undefined ? overrides.size : pageSize

    startTransition(async () => {
      try {
        const res = await getUangJajanData({
          search,
          asrama,
          saldoFilter,
          page,
          pageSize: size,
        })
        setData(res)
        setErrorMessage(null)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Data uang jajan belum dapat dimuat. Coba lagi.'
        setErrorMessage(msg)
      }
    })
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1)
      fetchData({ search: val, page: 1 })
    }, 350)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setCurrentPage(1)
    fetchData({ search: searchQuery, page: 1 })
  }

  const handleAsramaChange = (val: string) => {
    setSelectedAsrama(val)
    setCurrentPage(1)
    fetchData({ asrama: val, page: 1 })
  }

  const handleSaldoFilterChange = (val: 'ALL' | 'BER_SALDO' | 'SALDO_KOSONG') => {
    setSelectedSaldoFilter(val)
    setCurrentPage(1)
    fetchData({ saldoFilter: val, page: 1 })
  }

  const handleResetFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedSaldoFilter('ALL')
    setCurrentPage(1)
    fetchData({
      search: '',
      asrama: 'ALL',
      saldoFilter: 'ALL',
      page: 1,
    })
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchData({ page })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    fetchData({ size, page: 1 })
  }

  const asramaOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Asrama' },
      ...data.asramaList.map((a) => ({ value: a, label: a })),
    ],
    [data.asramaList]
  )

  const paginationStart =
    data.pagination.totalItems === 0
      ? 0
      : (data.pagination.currentPage - 1) * data.pagination.pageSize + 1
  const paginationEnd = Math.min(
    data.pagination.currentPage * data.pagination.pageSize,
    data.pagination.totalItems
  )

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 1. Header + Aksi Cepat Pencairan Kolektif & Segarkan */}
      <DashboardPageHeader
        title="Uang Jajan Santri"
        description="Pantau saldo dana titipan, limit pencairan harian, dan mutasi buku besar santri."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/koperasi/pencairan-uang-jajan"
              className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Pencairan Kolektif</span>
            </Link>
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={isPending}
              aria-label="Segarkan data uang jajan"
              className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Segarkan</span>
            </button>
          </div>
        }
      />

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 2. KPI Cards (Seragam dengan Dashboard Keuangan & Status Pembayaran) */}
      <div
        aria-busy={isPending}
        className={`space-y-5 transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Total Saldo Titipan</span>
                <Wallet className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(data.kpi.totalSaldoTitipan)}
              </div>
            </div>
            <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              Amanah dana titipan santri aktif
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              handleSaldoFilterChange(selectedSaldoFilter === 'BER_SALDO' ? 'ALL' : 'BER_SALDO')
            }
            className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
              selectedSaldoFilter === 'BER_SALDO'
                ? 'border-indigo-500 ring-2 ring-indigo-500/15'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Santri Bersaldo</span>
                <Users className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {data.kpi.santriBersaldoCount.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-medium text-slate-500">santri</span>
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <span>Memiliki saldo &gt; Rp0</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-700" aria-hidden="true" />
            </div>
          </button>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Top-Up Bulan Ini</span>
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(data.kpi.mutasiInBulanIniNominal)}
              </div>
            </div>
            <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              Setoran BRIVA, transfer &amp; tunai
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Pencairan Bulan Ini</span>
                <ArrowUpRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(data.kpi.mutasiOutBulanIniNominal)}
              </div>
            </div>
            <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              Pencairan kolektif asrama &amp; loket
            </p>
          </div>
        </div>

        {/* 3. Filter Toolbar (Auto-debounce Search + SelectPicker) */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <label htmlFor={searchInputId} className="sr-only">
                Cari santri berdasarkan nama lengkap atau NIS
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id={searchInputId}
                type="text"
                placeholder="Cari santri berdasarkan nama lengkap atau NIS…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="min-h-[44px] sm:min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                    setSearchQuery('')
                    setCurrentPage(1)
                    fetchData({ search: '', page: 1 })
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <SelectPicker
                value={selectedAsrama}
                options={asramaOptions}
                onChange={handleAsramaChange}
                ariaLabel="Filter asrama"
                align="left"
                className="w-full sm:w-auto [&>button]:w-full"
              />

              <SelectPicker
                value={selectedSaldoFilter}
                options={SALDO_FILTER_OPTIONS}
                onChange={(val) =>
                  handleSaldoFilterChange(val as 'ALL' | 'BER_SALDO' | 'SALDO_KOSONG')
                }
                ariaLabel="Filter status saldo"
                align="left"
                className="w-full sm:w-auto [&>button]:w-full"
              />

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
          </form>
        </div>

        {/* 4. Daftar Santri (Mobile Stacked List + Desktop Semantic Table) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <h2 id={tableRegionHeadingId} className="sr-only">
            Daftar saldo uang jajan santri
          </h2>

          {isPending && data.items.length === 0 ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={5} />
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Tidak ada santri yang cocok
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Coba ubah kata kunci pencarian atau pilih asrama / status saldo lain.
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
              {/* Mobile Cards (md:hidden) — Bebas scroll horizontal */}
              <div className="divide-y divide-slate-100 md:hidden">
                {data.items.map((row) => {
                  const hasSaldo = row.saldoUangJajan > 0
                  return (
                    <button
                      key={`m-uj-${row.id}`}
                      type="button"
                      onClick={() => setSelectedSantriId(row.id)}
                      className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <SantriPhotoAvatar
                            src={publicMediaUrl(row.fotoUrl)}
                            name={row.namaLengkap}
                            size="sm"
                            clickable={false}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {row.namaLengkap}
                            </div>
                            <div className="text-xs text-slate-500 truncate tabular-nums">
                              {row.nis}
                              {row.asrama && ` · ${row.asrama}`}
                              {row.kamar && ` / ${row.kamar}`}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right tabular-nums">
                          <div
                            className={`text-sm font-bold ${
                              hasSaldo ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {formatRupiah(row.saldoUangJajan)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Limit {formatRupiah(row.effectiveDailyLimit)}/hr
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>
                          {row.parentDailyLimit !== null ? (
                            <span className="font-medium text-indigo-700">Limit khusus wali</span>
                          ) : (
                            <span>Limit global</span>
                          )}
                          {row.withdrawnToday > 0 && ` · Hari ini ${formatRupiah(row.withdrawnToday)}`}
                        </span>
                        {row.lastTransactionAt ? (
                          <span
                            className={`font-semibold ${
                              row.lastTransactionDirection === 'IN'
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {row.lastTransactionDirection === 'IN' ? '+' : '-'}
                            {formatRupiah(row.lastTransactionAmount || 0)} ·{' '}
                            {formatFinanceDate(row.lastTransactionAt, false)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum ada mutasi</span>
                        )}
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
                <table className="w-full border-collapse text-left text-sm text-slate-600">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="py-3.5 pl-5 pr-4">Santri</th>
                      <th scope="col" className="px-4 py-3.5 text-right">Saldo Uang Jajan</th>
                      <th scope="col" className="px-4 py-3.5">Limit Harian Efektif</th>
                      <th scope="col" className="px-4 py-3.5">Transaksi Terakhir</th>
                      <th scope="col" className="w-10 py-3.5 pr-4 text-right">
                        <span className="sr-only">Detail</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.items.map((row) => {
                      const hasSaldo = row.saldoUangJajan > 0
                      return (
                        <tr
                          key={row.id}
                          tabIndex={0}
                          onClick={() => setSelectedSantriId(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedSantriId(row.id)
                            }
                          }}
                          className="group hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3.5 pl-5 pr-4">
                            <div className="flex items-center gap-3">
                              <SantriPhotoAvatar
                                src={publicMediaUrl(row.fotoUrl)}
                                name={row.namaLengkap}
                                size="sm"
                                clickable={false}
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                  {row.namaLengkap}
                                </div>
                                <div className="text-xs text-slate-500 tabular-nums truncate">
                                  {row.nis}
                                  {row.asrama && ` · ${row.asrama}`}
                                  {row.kamar && ` / Kamar ${row.kamar}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-bold whitespace-nowrap tabular-nums">
                            <span className={hasSaldo ? 'text-emerald-700' : 'text-slate-400'}>
                              {formatRupiah(row.saldoUangJajan)}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                            <div className="font-semibold text-slate-900 tabular-nums">
                              {formatRupiah(row.effectiveDailyLimit)}/hari
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              {row.parentDailyLimit !== null ? (
                                <span className="text-indigo-700 font-medium">Limit khusus wali</span>
                              ) : (
                                <span>Limit global pesantren</span>
                              )}
                              {row.withdrawnToday > 0 && (
                                <> · Hari ini {formatRupiah(row.withdrawnToday)}</>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                            {row.lastTransactionAt ? (
                              <div>
                                <div className="flex items-center gap-1 tabular-nums">
                                  {row.lastTransactionDirection === 'IN' ? (
                                    <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700">
                                      <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                      +{formatRupiah(row.lastTransactionAmount || 0)}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 font-semibold text-slate-800">
                                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                                      -{formatRupiah(row.lastTransactionAmount || 0)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                  {formatFinanceDate(row.lastTransactionAt, false)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
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
            </>
          )}

          {/* 5. Paginasi Bersih (SelectPicker placement="top" + single-fetch) */}
          {data.items.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 tabular-nums">
                Menampilkan{' '}
                <strong className="font-semibold text-slate-700">
                  {paginationStart}–{paginationEnd}
                </strong>{' '}
                dari{' '}
                <strong className="font-semibold text-slate-700">
                  {data.pagination.totalItems}
                </strong>{' '}
                santri
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

                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      disabled={data.pagination.currentPage === 1}
                      aria-label="Halaman pertama"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange(data.pagination.currentPage - 1)}
                      disabled={data.pagination.currentPage === 1}
                      aria-label="Halaman sebelumnya"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    {getPageRange(data.pagination.currentPage, data.pagination.totalPages).map(
                      (p, idx) =>
                        p === '...' ? (
                          <span key={`dots-${idx}`} className="px-1 text-xs text-slate-400">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePageChange(p)}
                            aria-current={p === data.pagination.currentPage ? 'page' : undefined}
                            className={`h-8 w-8 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                              p === data.pagination.currentPage
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
                      onClick={() => handlePageChange(data.pagination.currentPage + 1)}
                      disabled={data.pagination.currentPage === data.pagination.totalPages}
                      aria-label="Halaman berikutnya"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange(data.pagination.totalPages)}
                      disabled={data.pagination.currentPage === data.pagination.totalPages}
                      aria-label="Halaman terakhir"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Right Drawer (key memastikan tidak ada stale state saat ganti santri) */}
      <WalletDetailDrawer
        key={selectedSantriId || 'wallet-drawer'}
        santriId={selectedSantriId}
        canMutate={data.userPermissions.canMutate}
        onClose={() => setSelectedSantriId(null)}
        onBalanceUpdated={() => fetchData()}
      />
    </div>
  )
}
