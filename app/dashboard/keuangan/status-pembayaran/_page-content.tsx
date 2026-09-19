'use client'

import React, { useState, useTransition, useId } from 'react'
import {
  Search,
  X,
  Wallet,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Users,
  Info,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import Pagination from '@/components/ui/pagination'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import {
  getStatusPembayaranData,
  type EnrichedStudentObligationMatrixItem,
  type StatusPembayaranResponse,
  type FilterOptionsResponse,
} from './actions'
import type { FinanceObligationStatus } from '@/lib/finance/types'

interface StatusPembayaranContentProps {
  initialData: StatusPembayaranResponse
  filterOptions: FilterOptionsResponse
}

type TabType = 'RINGKASAN' | 'BULANAN' | 'TAHUNAN' | 'USPP' | 'TUNGGAKAN'

/**
 * Format nominal integer Rupiah sesuai standar UI_UX_GUIDELINES:
 * "Rp150.000" (tanpa spasi setelah Rp, tanpa desimal ,00)
 */
function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

export default function StatusPembayaranContent({
  initialData,
  filterOptions,
}: StatusPembayaranContentProps) {
  const [data, setData] = useState<StatusPembayaranResponse>(initialData)
  const [activeTab, setActiveTab] = useState<TabType>('RINGKASAN')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.selectedPeriod)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAsrama, setSelectedAsrama] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)

  // Accessible IDs for form controls
  const searchInputId = useId()
  const periodSelectId = useId()
  const asramaSelectId = useId()
  const statusSelectId = useId()

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAsrama !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedPeriod !== filterOptions.currentPeriod ||
    activeTab !== 'RINGKASAN'

  const fetchData = (overrides?: {
    period?: string
    asrama?: string
    status?: string
    search?: string
    page?: number
    size?: number
    tab?: TabType
  }) => {
    const period = overrides?.period !== undefined ? overrides.period : selectedPeriod
    const asrama = overrides?.asrama !== undefined ? overrides.asrama : selectedAsrama
    let status = overrides?.status !== undefined ? overrides.status : selectedStatus
    const search = overrides?.search !== undefined ? overrides.search : searchQuery
    const page = overrides?.page !== undefined ? overrides.page : currentPage
    const size = overrides?.size !== undefined ? overrides.size : pageSize
    const tab = overrides?.tab !== undefined ? overrides.tab : activeTab

    // Jika tab Tunggakan aktif dan status belum dispesifikkan, filter otomatis ke santri yang belum lunas
    if (tab === 'TUNGGAKAN' && status === 'ALL') {
      status = 'BELUM_LUNAS'
    }

    setErrorMessage(null)

    startTransition(async () => {
      try {
        const validStatus = status !== 'ALL' && ['LUNAS', 'CICILAN', 'BELUM_LUNAS', 'BEBAS'].includes(status)
          ? (status as 'LUNAS' | 'CICILAN' | 'BELUM_LUNAS' | 'BEBAS')
          : undefined

        const res = await getStatusPembayaranData({
          period,
          asrama: asrama !== 'ALL' ? asrama : undefined,
          status: validStatus,
          search: search.trim() || undefined,
          page,
          pageSize: size,
        })
        setData(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data status pembayaran. Silakan coba lagi.'
        setErrorMessage(msg)
      }
    })
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setCurrentPage(1)
    if (tab === 'TUNGGAKAN') {
      setSelectedStatus('BELUM_LUNAS')
      fetchData({ tab, status: 'BELUM_LUNAS', page: 1 })
    } else {
      fetchData({ tab, page: 1 })
    }
  }

  const handlePeriodChange = (val: string) => {
    setSelectedPeriod(val)
    setCurrentPage(1)
    fetchData({ period: val, page: 1 })
  }

  const handleAsramaChange = (val: string) => {
    setSelectedAsrama(val)
    setCurrentPage(1)
    fetchData({ asrama: val, page: 1 })
  }

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val)
    setCurrentPage(1)
    fetchData({ status: val, page: 1 })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchData({ page: 1 })
  }

  const handleResetFilters = () => {
    setSelectedPeriod(filterOptions.currentPeriod)
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedStatus('ALL')
    setActiveTab('RINGKASAN')
    setCurrentPage(1)
    fetchData({
      period: filterOptions.currentPeriod,
      search: '',
      asrama: 'ALL',
      status: 'ALL',
      tab: 'RINGKASAN',
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

  // Render badge semantik sesuai status obligasi
  const renderObligationBadge = (status: FinanceObligationStatus | 'NOT_MATERIALIZED', customLabel?: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3 w-3" />
            {customLabel || 'Lunas'}
          </span>
        )
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <Clock className="h-3 w-3" />
            {customLabel || 'Cicilan'}
          </span>
        )
      case 'EXEMPTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20">
            {customLabel || 'Bebas'}
          </span>
        )
      case 'NOT_MATERIALIZED':
        return (
          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
            Belum Ada
          </span>
        )
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            {customLabel || 'Belum Lunas'}
          </span>
        )
    }
  }

  // Render badge overall status santri
  const renderOverallStatusBadge = (status: EnrichedStudentObligationMatrixItem['overallStatus'], hasLegacy: boolean) => {
    if (hasLegacy) {
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
          Ada Tunggakan
        </span>
      )
    }

    switch (status) {
      case 'LUNAS':
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            Lunas
          </span>
        )
      case 'CICILAN':
        return (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
            Cicilan
          </span>
        )
      case 'BEBAS':
        return (
          <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20">
            Bebas
          </span>
        )
      case 'BELUM_LUNAS':
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            Belum Lunas
          </span>
        )
    }
  }

  // Ringkasan status iuran tahunan (EHB, Ekskul, Kesehatan)
  const renderTahunanSummary = (tahunan: EnrichedStudentObligationMatrixItem['tahunan']) => {
    if (!tahunan || tahunan.length === 0) {
      return <span className="text-xs text-slate-400">-</span>
    }
    const totalExpected = tahunan.reduce((acc, it) => acc + it.amountExpected, 0)
    const totalRemaining = tahunan.reduce((acc, it) => acc + it.remaining, 0)

    if (totalExpected === 0) {
      return <span className="text-xs text-slate-400">-</span>
    }

    if (totalRemaining === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <CheckCircle2 className="h-3 w-3" />
          Lunas ({tahunan.length})
        </span>
      )
    }

    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
          Sisa {formatRupiah(totalRemaining)}
        </span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      {/* 1. HEADER & PRIMARY CTA */}
      <DashboardPageHeader
        title="Status Pembayaran"
        description="Pantau kewajiban santri, pembayaran bulanan, tahunan, dan cicilan."
        action={
          data.userPermissions?.canRecordPayment ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Pencatatan pembayaran belum tersedia"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed shadow-none select-none"
              >
                <Wallet className="h-4 w-4 text-slate-400" />
                <span>Catat Pembayaran</span>
              </button>
            </div>
          ) : null
        }
      />

      {/* 2. TABS NAVIGASI */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto text-sm font-medium" aria-label="Tabs">
          {[
            { id: 'RINGKASAN', label: 'Ringkasan' },
            { id: 'BULANAN', label: 'Bulanan' },
            { id: 'TAHUNAN', label: 'Tahunan' },
            { id: 'USPP', label: 'USPP' },
            { id: 'TUNGGAKAN', label: 'Tunggakan' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id as TabType)}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 font-semibold text-emerald-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 3. ALERT PRA-CUTOVER (Jika periode sebelum Juli 2026 dipilih) */}
      {data.isPreCutoverPeriod && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">Informasi Cutover Sistem Keuangan Baru (Juli 2026)</p>
            <p className="text-amber-800 leading-relaxed">
              Periode tagihan <strong>{data.selectedPeriod}</strong> berada sebelum batas cutover resmi (2026-07).
              Kewajiban pada periode ini dikelola oleh sistem pembayaran legacy. Coexistence adapter aktif menjaga
              tunggakan tetap dapat dipantau tanpa menimbulkan duplikasi kewajiban pada sistem baru.
            </p>
          </div>
        </div>
      )}

      {/* 4. ERROR ALERT BANNER */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 5. 4 SUMMARY KPI CARDS (Sesuai batasan PRD & UI Guidelines) */}
      {isPending ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Santri Aktif */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Santri Aktif</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {data.kpi.totalSantri}
              </span>
              <span className="text-xs text-slate-400">Santri</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Populasi aktif dalam filter</p>
          </div>

          {/* Card 2: Lunas Periode Ini */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lunas Periode Ini</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {data.kpi.totalLunas}
              </span>
              <span className="text-xs font-medium text-emerald-600">
                {Math.round((data.kpi.totalLunas / (data.kpi.totalSantri || 1)) * 100)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Seluruh kewajiban terpenuhi</p>
          </div>

          {/* Card 3: Belum Lunas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Belum Lunas</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {data.kpi.totalBelumLunas}
              </span>
              <span className="text-xs text-slate-400">Santri</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Memiliki sisa tagihan aktif</p>
          </div>

          {/* Card 4: Total Tunggakan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Tunggakan</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {formatRupiah(data.kpi.totalTunggakanNominal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Termasuk sisa pra-cutover</p>
          </div>
        </div>
      )}

      {/* 6. CONTROL BAR / TOOLBAR FILTER */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row w-full gap-3 items-center">
            {/* Search Input */}
            <div className="relative w-full sm:w-64 md:w-72">
              <label htmlFor={searchInputId} className="sr-only">Cari santri</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id={searchInputId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau NIS..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    setSearchQuery('')
                    fetchData({ search: '', page: 1 })
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Periode Dropdown */}
            <div className="w-full sm:w-48">
              <label htmlFor={periodSelectId} className="sr-only">Periode</label>
              <select
                id={periodSelectId}
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {filterOptions.periodList.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Asrama Dropdown */}
            <div className="w-full sm:w-40">
              <label htmlFor={asramaSelectId} className="sr-only">Asrama</label>
              <select
                id={asramaSelectId}
                value={selectedAsrama}
                onChange={(e) => handleAsramaChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Asrama</option>
                {filterOptions.asramaList.map((asrama) => (
                  <option key={asrama} value={asrama}>
                    {asrama}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="w-full sm:w-36">
              <label htmlFor={statusSelectId} className="sr-only">Status</label>
              <select
                id={statusSelectId}
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="LUNAS">Lunas</option>
                <option value="CICILAN">Cicilan</option>
                <option value="BELUM_LUNAS">Belum Lunas</option>
                <option value="BEBAS">Bebas</option>
              </select>
            </div>
          </div>

          {/* Reset Action Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </form>
      </div>

      {/* 7. OVERVIEW MATRIX TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isPending ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : data.items.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
              <Filter className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Tidak ada data santri ditemukan</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md">
              Kriteria pencarian atau filter yang Anda gunakan tidak menghasilkan data santri pada periode ini.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-900 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>
        ) : (
          /* TABEL DATA UTAMA */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="py-3.5 pl-5 pr-3">Santri</th>
                  <th scope="col" className="px-3 py-3.5">SPP</th>
                  <th scope="col" className="px-3 py-3.5">Uang Makan</th>
                  <th scope="col" className="px-3 py-3.5">Uang Nyuci</th>
                  <th scope="col" className="px-3 py-3.5">Tahunan</th>
                  <th scope="col" className="px-3 py-3.5">USPP</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Total Sisa</th>
                  <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => {
                  return (
                    <tr
                      key={item.santriId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Kolom Identitas Santri */}
                      <td className="py-4 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar
                            name={item.namaLengkap}
                            size="sm"
                            clickable={false}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {item.namaLengkap}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              NIS {item.nis} · {item.asrama || 'Non-Asrama'}{item.kamar ? ` / ${item.kamar}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Kolom SPP + Indikator Tunggakan Pra-Cutover */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {renderObligationBadge(item.spp.status)}
                          {item.hasLegacyTunggakan && (
                            <div>
                              <span
                                title="Tunggakan SPP historis sebelum cutover Juli 2026"
                                className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20"
                              >
                                + Pra-Cutover: {formatRupiah(item.legacyTunggakanSpp)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kolom Uang Makan */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {renderObligationBadge(item.uangMakan.status)}
                          {item.uangMakan.providerName && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[120px]">
                              {item.uangMakan.providerName}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Kolom Uang Nyuci */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {renderObligationBadge(item.uangNyuci.status)}
                          {item.uangNyuci.providerName && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[120px]">
                              {item.uangNyuci.providerName}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Kolom Tahunan (EHB, Ekskul, Kesehatan) */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        {renderTahunanSummary(item.tahunan)}
                      </td>

                      {/* Kolom USPP */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {renderObligationBadge(item.uspp.status)}
                          {item.uspp.remaining > 0 && (
                            <p className="text-[11px] text-slate-500 font-mono">
                              Sisa {formatRupiah(item.uspp.remaining)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Kolom Total Sisa & Status */}
                      <td className="px-3 py-4 text-right whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="font-mono font-bold text-slate-900">
                            {formatRupiah(item.adjustedTotalRemaining)}
                          </p>
                          <div>
                            {renderOverallStatusBadge(item.overallStatus, item.hasLegacyTunggakan)}
                          </div>
                        </div>
                      </td>

                      {/* Kolom Aksi */}
                      <td className="py-4 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            toast.info(`Detail Kewajiban: ${item.namaLengkap}`, {
                              description: `Right Slide-over Drawer detail finansial santri dijadwalkan untuk Subfase 4B.`,
                            })
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. PAGINASI */}
        {!isPending && data.items.length > 0 && (
          <Pagination
            currentPage={data.pagination.currentPage}
            totalPages={data.pagination.totalPages}
            pageSize={data.pagination.pageSize}
            total={data.pagination.totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  )
}
