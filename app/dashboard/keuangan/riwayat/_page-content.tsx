'use client'

// app/dashboard/keuangan/riwayat/_page-content.tsx
// Antarmuka Riwayat Transaksi Global (Fase 9: PRD Bab 30)

import React, { useState, useTransition, useId } from 'react'
import Link from 'next/link'
import {
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import Pagination from '@/components/ui/pagination'
import { DEFAULT_FINANCE_PAGE_SIZE } from '@/lib/finance/constants'
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

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
  } catch {
    return dateStr
  }
}

export default function RiwayatTransaksiContent({
  initialHistory,
  filterOptions,
}: RiwayatTransaksiContentProps) {
  const [history, setHistory] = useState<GlobalTransactionHistoryResponse>(initialHistory)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_FINANCE_PAGE_SIZE)

  // Drawer Selected Transaction State
  const [selectedTransaction, setSelectedTransaction] = useState<GlobalTransactionRow | null>(null)

  // Accessible IDs
  const searchId = useId()
  const categoryId = useId()
  const itemTypeId = useId()
  const channelId = useId()
  const statusId = useId()
  const asramaId = useId()
  const startDateId = useId()
  const endDateId = useId()

  const hasActiveFilters =
    search.trim() !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    category !== 'ALL' ||
    itemType !== 'ALL' ||
    channel !== 'ALL' ||
    status !== 'ALL' ||
    asrama !== 'ALL'

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
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat riwayat transaksi.')
      }
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchTransactions({ page: 1, search })
  }

  const handleResetFilters = () => {
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

  const { items, pagination, summary } = history

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <DashboardPageHeader
        title="Riwayat Transaksi Global"
        description="Histori terpadu seluruh mutasi keuangan pesantren: pembayaran online & tunai, uang jajan santri, penyaluran, dan koreksi."
        action={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/dashboard/keuangan"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <span>&larr; Ke Dashboard</span>
            </Link>

            <button
              onClick={() => fetchTransactions()}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        }
      />

      {/* Pesan Error */}
      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* 2. Summary Mini Cards (Arus Kas Hasil Filter) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Penerimaan Pesantren
          </span>
          <div className="mt-1 text-lg font-bold font-mono text-emerald-700">
            {formatRupiah(summary.totalInPesantren)}
          </div>
          <span className="text-[11px] text-slate-500">Dana masuk operasional</span>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
            Top-Up Uang Jajan
          </span>
          <div className="mt-1 text-lg font-bold font-mono text-indigo-950">
            {formatRupiah(summary.totalInTitipan)}
          </div>
          <span className="text-[11px] text-indigo-700">Dana titipan santri</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Penyaluran Vendor
          </span>
          <div className="mt-1 text-lg font-bold font-mono text-purple-700">
            {formatRupiah(summary.totalOutPesantren)}
          </div>
          <span className="text-[11px] text-slate-500">Katering, laundry & bendahara</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Penarikan Loket Jajan
          </span>
          <div className="mt-1 text-lg font-bold font-mono text-slate-800">
            {formatRupiah(summary.totalOutTitipan)}
          </div>
          <span className="text-[11px] text-slate-500">Pencairan uang santri</span>
        </div>
      </div>

      {/* 3. Filter Toolbar & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">
              Cari transaksi
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id={searchId}
              type="text"
              placeholder="Cari no. transaksi, NIS, nama santri, atau referensi external..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Cari
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                title="Reset semua filter"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </form>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-7 text-xs">
          {/* Rentang Tanggal Mulai */}
          <div>
            <label htmlFor={startDateId} className="mb-1 block font-medium text-slate-500">
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
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Rentang Tanggal Selesai */}
          <div>
            <label htmlFor={endDateId} className="mb-1 block font-medium text-slate-500">
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
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Kategori */}
          <div>
            <label htmlFor={categoryId} className="mb-1 block font-medium text-slate-500">
              Kategori
            </label>
            <select
              id={categoryId}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setCurrentPage(1)
                fetchTransactions({ category: e.target.value, page: 1 })
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              {filterOptions.categoryList.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Pos Biaya */}
          <div>
            <label htmlFor={itemTypeId} className="mb-1 block font-medium text-slate-500">
              Pos Tagihan
            </label>
            <select
              id={itemTypeId}
              value={itemType}
              onChange={(e) => {
                setItemType(e.target.value)
                setCurrentPage(1)
                fetchTransactions({ itemType: e.target.value, page: 1 })
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              {filterOptions.itemTypeList.map((it) => (
                <option key={it.value} value={it.value}>
                  {it.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kanal / Metode */}
          <div>
            <label htmlFor={channelId} className="mb-1 block font-medium text-slate-500">
              Kanal / Metode
            </label>
            <select
              id={channelId}
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value)
                setCurrentPage(1)
                fetchTransactions({ channel: e.target.value, page: 1 })
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              {filterOptions.channelList.map((ch) => (
                <option key={ch.value} value={ch.value}>
                  {ch.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label htmlFor={statusId} className="mb-1 block font-medium text-slate-500">
              Status
            </label>
            <select
              id={statusId}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setCurrentPage(1)
                fetchTransactions({ status: e.target.value, page: 1 })
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              {filterOptions.statusList.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Asrama */}
          <div>
            <label htmlFor={asramaId} className="mb-1 block font-medium text-slate-500">
              Asrama
            </label>
            <select
              id={asramaId}
              value={asrama}
              onChange={(e) => {
                setAsrama(e.target.value)
                setCurrentPage(1)
                fetchTransactions({ asrama: e.target.value, page: 1 })
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="ALL">Semua Asrama</option>
              {filterOptions.asramaList.map((asr) => (
                <option key={asr} value={asr}>
                  {asr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Data Table Riwayat Transaksi */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                {/* Waktu (Sortable) */}
                <th
                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100"
                  onClick={() => handleSortToggle('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    <span>Waktu</span>
                    {sortBy === 'createdAt' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-300" />
                    )}
                  </div>
                </th>

                {/* No. Transaksi (Sortable) */}
                <th
                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100"
                  onClick={() => handleSortToggle('transactionNumber')}
                >
                  <div className="flex items-center gap-1">
                    <span>No. Transaksi</span>
                    {sortBy === 'transactionNumber' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-300" />
                    )}
                  </div>
                </th>

                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Pos / Item</th>
                <th className="px-4 py-3">Santri / Penerima</th>
                <th className="px-4 py-3">Kanal & Metode</th>

                {/* Nominal (Sortable) */}
                <th
                  className="px-4 py-3 text-right cursor-pointer select-none hover:bg-slate-100"
                  onClick={() => handleSortToggle('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Nominal</span>
                    {sortBy === 'amount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-300" />
                    )}
                  </div>
                </th>

                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isPending ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      <span>Memuat data transaksi...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((tx) => {
                  const isIncoming = tx.direction === 'IN'

                  let badgeColor = 'bg-slate-100 text-slate-700'
                  if (tx.status === 'PAID' || tx.status === 'SETTLED' || tx.status === 'COMPLETED') {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  } else if (tx.status === 'VOID' || tx.status === 'REFUND' || tx.status === 'REVERSAL') {
                    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200'
                  }

                  let catBadge = 'bg-slate-100 text-slate-700'
                  if (tx.category === 'PAYMENT') catBadge = 'bg-blue-50 text-blue-700'
                  if (tx.category === 'TOPUP') catBadge = 'bg-indigo-50 text-indigo-700'
                  if (tx.category === 'WITHDRAWAL') catBadge = 'bg-amber-50 text-amber-800'
                  if (tx.category === 'DISTRIBUTION') catBadge = 'bg-purple-50 text-purple-700'
                  if (tx.category === 'CORRECTION') catBadge = 'bg-rose-50 text-rose-700'

                  return (
                    <tr
                      key={`${tx.sourceTable}-${tx.id}`}
                      onClick={() => setSelectedTransaction(tx)}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDateDisplay(tx.createdAt)}
                      </td>

                      <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {tx.transactionNumber}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold ${catBadge}`}>
                          {tx.categoryLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                        {tx.itemLabel || '-'}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.santriName ? (
                          <div>
                            <span className="font-semibold text-slate-900">{tx.santriName}</span>
                            {tx.santriNis && (
                              <span className="ml-1 text-[11px] text-slate-400">({tx.santriNis})</span>
                            )}
                          </div>
                        ) : tx.recipientInfo ? (
                          <span className="font-medium text-purple-900">{tx.recipientInfo}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        <span>{tx.channel}</span>
                        {tx.method && tx.method !== tx.channel && (
                          <span className="text-[11px] text-slate-400 ml-1">({tx.method})</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isIncoming ? 'text-emerald-700' : 'text-slate-800'}>
                          {isIncoming ? '+ ' : '- '}
                          {formatRupiah(tx.amount)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                          {tx.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedTransaction(tx)
                          }}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada transaksi yang cocok dengan kriteria pencarian dan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Server-Side */}
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          total={pagination.totalRecords}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* 5. Slide-over Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  )
}
