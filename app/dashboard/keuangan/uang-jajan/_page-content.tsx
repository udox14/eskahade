'use client'

import React, { useState, useTransition, useId } from 'react'
import {
  Search,
  Wallet,
  RotateCcw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Users,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import Pagination from '@/components/ui/pagination'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import { WalletDetailDrawer } from './wallet-detail-drawer'
import {
  getUangJajanData,
  type UangJajanResponse,
} from './actions'

interface UangJajanContentProps {
  initialData: UangJajanResponse
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
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
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Accessible IDs
  const searchInputId = useId()
  const asramaSelectId = useId()
  const saldoSelectId = useId()

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
        const msg = err instanceof Error ? err.message : 'Gagal memuat data uang jajan.'
        setErrorMessage(msg)
      }
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchData({ page: 1 })
  }

  const handleResetFilters = () => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardPageHeader
        title="Uang Jajan Santri"
        description="Pantau saldo dana titipan, limit penarikan, dan mutasi buku besar santri secara real-time."
      />

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isPending ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Saldo Titipan</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatRupiah(data.kpi.totalSaldoTitipan)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Akumulasi seluruh santri aktif
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Santri Bersaldo</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {data.kpi.santriBersaldoCount.toLocaleString('id-ID')}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Santri dengan saldo &gt; Rp0
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Top-Up Bulan Ini</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-emerald-700">
                {formatRupiah(data.kpi.mutasiInBulanIniNominal)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Setoran online & tunai
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Pencairan Bulan Ini</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-rose-700">
                {formatRupiah(data.kpi.mutasiOutBulanIniNominal)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Penarikan uang jajan di loket
              </p>
            </div>
          </>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id={searchInputId}
              type="text"
              placeholder="Cari santri berdasarkan nama lengkap atau NIS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id={asramaSelectId}
              value={selectedAsrama}
              onChange={(e) => {
                setSelectedAsrama(e.target.value)
                setCurrentPage(1)
                fetchData({ asrama: e.target.value, page: 1 })
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Semua Asrama</option>
              {data.asramaList.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              id={saldoSelectId}
              value={selectedSaldoFilter}
              onChange={(e) => {
                const val = e.target.value as 'ALL' | 'BER_SALDO' | 'SALDO_KOSONG'
                setSelectedSaldoFilter(val)
                setCurrentPage(1)
                fetchData({ saldoFilter: val, page: 1 })
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Semua Status Saldo</option>
              <option value="BER_SALDO">Memiliki Saldo (&gt; Rp0)</option>
              <option value="SALDO_KOSONG">Saldo Kosong (Rp0)</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              Terapkan
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={8} cols={5} />
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Tidak ada data santri yang cocok dengan filter pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-left">Santri</th>
                  <th className="px-5 py-3.5 text-right">Saldo Uang Jajan</th>
                  <th className="px-5 py-3.5 text-left">Limit Harian Efektif</th>
                  <th className="px-5 py-3.5 text-left">Transaksi Terakhir</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((row) => {
                  const hasSaldo = row.saldoUangJajan > 0
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedSantriId(row.id)}
                      className="hover:bg-slate-50/70 cursor-pointer transition"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar
                            src={row.fotoUrl}
                            name={row.namaLengkap}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {row.namaLengkap}
                            </div>
                            <div className="text-xs text-slate-500">
                              NIS: {row.nis}
                              {row.asrama && <> • {row.asrama}</>}
                              {row.kamar && <> / Kamar {row.kamar}</>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-bold">
                        <span className={hasSaldo ? 'text-emerald-700 font-extrabold' : 'text-slate-400'}>
                          {formatRupiah(row.saldoUangJajan)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-semibold text-slate-900">
                          {formatRupiah(row.effectiveDailyLimit)}/hari
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {row.parentDailyLimit !== null ? (
                            <span className="text-indigo-600 font-medium">Limit khusus ortu</span>
                          ) : (
                            <span>Limit global pesantren</span>
                          )}
                          {row.withdrawnToday > 0 && (
                            <> • Ditarik hari ini: {formatRupiah(row.withdrawnToday)}</>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {row.lastTransactionAt ? (
                          <div>
                            <div className="flex items-center gap-1">
                              {row.lastTransactionDirection === 'IN' ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                                  <ArrowDownLeft className="h-3 w-3" />
                                  +{formatRupiah(row.lastTransactionAmount || 0)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-rose-700 font-semibold">
                                  <ArrowUpRight className="h-3 w-3" />
                                  -{formatRupiah(row.lastTransactionAmount || 0)}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {formatDateShort(row.lastTransactionAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSantriId(row.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                        >
                          Detail & Mutasi
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.pagination.totalPages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination
              currentPage={data.pagination.currentPage}
              totalPages={data.pagination.totalPages}
              pageSize={data.pagination.pageSize}
              total={data.pagination.totalItems}
              onPageChange={(page) => {
                setCurrentPage(page)
                fetchData({ page })
              }}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCurrentPage(1)
                fetchData({ size, page: 1 })
              }}
            />
          </div>
        )}
      </div>

      {/* Slide-over Right Drawer */}
      <WalletDetailDrawer
        santriId={selectedSantriId}
        canMutate={data.userPermissions.canMutate}
        onClose={() => setSelectedSantriId(null)}
        onBalanceUpdated={() => fetchData()}
      />
    </div>
  )
}
