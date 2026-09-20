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
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import Pagination from '@/components/ui/pagination'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import { StatusPembayaranDetailDrawer } from './detail-drawer'
import { CatatPembayaranModal } from './catat-bayar-modal'
import {
  getStatusPembayaranData,
  type TabType,
  type StatusPembayaranResponse,
  type FilterOptionsResponse,
  type RingkasanRowItem,
  type BulananRowItem,
  type TahunanRowItem,
  type UsppRowItem,
  type TunggakanRowItem,
} from './actions'

interface StatusPembayaranContentProps {
  initialData: StatusPembayaranResponse
  filterOptions: FilterOptionsResponse
}

/**
 * Format nominal integer Rupiah sesuai standar UI_UX_GUIDELINES:
 * "Rp150.000" (tanpa spasi setelah Rp, tanpa desimal ,00)
 */
function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
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

export default function StatusPembayaranContent({
  initialData,
  filterOptions,
}: StatusPembayaranContentProps) {
  const [data, setData] = useState<StatusPembayaranResponse>(initialData)
  const [activeTab, setActiveTab] = useState<TabType>(initialData.activeTab || 'RINGKASAN')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedSantriId, setSelectedSantriId] = useState<string | null>(null)
  const [isCatatBayarOpen, setIsCatatBayarOpen] = useState<boolean>(false)
  const [catatBayarSantriId, setCatatBayarSantriId] = useState<string | null>(null)

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.selectedPeriod)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    initialData.selectedAcademicYear || filterOptions.academicYearList[0]?.value || '2026'
  )
  const [selectedItemType, setSelectedItemType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAsrama, setSelectedAsrama] = useState<string>('ALL')
  const [selectedKelas, setSelectedKelas] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

  // Accessible IDs for form controls
  const searchInputId = useId()
  const periodSelectId = useId()
  const yearSelectId = useId()
  const itemSelectId = useId()
  const asramaSelectId = useId()
  const kelasSelectId = useId()
  const statusSelectId = useId()

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAsrama !== 'ALL' ||
    selectedKelas !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedItemType !== 'ALL' ||
    selectedPeriod !== filterOptions.currentPeriod

  const fetchData = (overrides?: {
    period?: string
    academicYear?: string
    itemType?: string
    asrama?: string
    kelas?: string
    status?: string
    search?: string
    page?: number
    size?: number
    tab?: TabType
  }) => {
    const tab = overrides?.tab !== undefined ? overrides.tab : activeTab
    const period = overrides?.period !== undefined ? overrides.period : selectedPeriod
    const academicYear = overrides?.academicYear !== undefined ? overrides.academicYear : selectedAcademicYear
    const itemType = overrides?.itemType !== undefined ? overrides.itemType : selectedItemType
    const asrama = overrides?.asrama !== undefined ? overrides.asrama : selectedAsrama
    const kelas = overrides?.kelas !== undefined ? overrides.kelas : selectedKelas
    const status = overrides?.status !== undefined ? overrides.status : selectedStatus
    const search = overrides?.search !== undefined ? overrides.search : searchQuery
    const page = overrides?.page !== undefined ? overrides.page : currentPage
    const size = overrides?.size !== undefined ? overrides.size : pageSize

    setErrorMessage(null)

    startTransition(async () => {
      try {
        const res = await getStatusPembayaranData({
          tab,
          period,
          academicYear,
          itemType: itemType !== 'ALL' ? itemType : undefined,
          asrama: asrama !== 'ALL' ? asrama : undefined,
          kelas: kelas !== 'ALL' ? kelas : undefined,
          status: status !== 'ALL' ? status : undefined,
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
    setSelectedStatus('ALL')
    setSelectedItemType('ALL')
    fetchData({ tab, page: 1, status: 'ALL', itemType: 'ALL' })
  }

  const handlePeriodChange = (val: string) => {
    setSelectedPeriod(val)
    setCurrentPage(1)
    fetchData({ period: val, page: 1 })
  }

  const handleAcademicYearChange = (val: string) => {
    setSelectedAcademicYear(val)
    setCurrentPage(1)
    fetchData({ academicYear: val, page: 1 })
  }

  const handleItemTypeChange = (val: string) => {
    setSelectedItemType(val)
    setCurrentPage(1)
    fetchData({ itemType: val, page: 1 })
  }

  const handleAsramaChange = (val: string) => {
    setSelectedAsrama(val)
    setCurrentPage(1)
    fetchData({ asrama: val, page: 1 })
  }

  const handleKelasChange = (val: string) => {
    setSelectedKelas(val)
    setCurrentPage(1)
    fetchData({ kelas: val, page: 1 })
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
    setSelectedAcademicYear(filterOptions.academicYearList[0]?.value || '2026')
    setSelectedItemType('ALL')
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedKelas('ALL')
    setSelectedStatus('ALL')
    setCurrentPage(1)
    fetchData({
      period: filterOptions.currentPeriod,
      academicYear: filterOptions.academicYearList[0]?.value || '2026',
      itemType: 'ALL',
      search: '',
      asrama: 'ALL',
      kelas: 'ALL',
      status: 'ALL',
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

  // Render badge status semantik
  const renderStatusBadge = (status: string, label: string) => {
    switch (status) {
      case 'PAID':
      case 'LUNAS':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3 w-3" />
            {label}
          </span>
        )
      case 'PARTIALLY_PAID':
      case 'MENCICIL':
      case 'CICILAN':
      case 'SEBAGIAN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <Clock className="h-3 w-3" />
            {label}
          </span>
        )
      case 'EXEMPTED':
      case 'BEBAS':
        return (
          <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20">
            {label}
          </span>
        )
      case 'TUNGGAKAN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
            <AlertCircle className="h-3 w-3" />
            {label}
          </span>
        )
      case 'NOT_MATERIALIZED':
        return (
          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
            {label}
          </span>
        )
      case 'UNPAID':
      case 'BELUM_BAYAR':
      case 'BELUM_LUNAS':
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            {label}
          </span>
        )
    }
  }

  // Hitung item yang aktif untuk tabel
  const currentItemsCount =
    activeTab === 'RINGKASAN'
      ? (data.ringkasanItems?.length ?? 0)
      : activeTab === 'BULANAN'
      ? (data.bulananItems?.length ?? 0)
      : activeTab === 'TAHUNAN'
      ? (data.tahunanItems?.length ?? 0)
      : activeTab === 'USPP'
      ? (data.usppItems?.length ?? 0)
      : (data.tunggakanItems?.length ?? 0)

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
                onClick={() => {
                  setCatatBayarSantriId(null)
                  setIsCatatBayarOpen(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition cursor-pointer"
              >
                <Wallet className="h-4 w-4 text-white" />
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

      {/* 3. ALERT PRA-CUTOVER */}
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

      {/* 5. 4 SUMMARY KPI CARDS */}
      {isPending ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <p className="mt-1 text-xs text-slate-500">Kewajiban terlambat bayar</p>
          </div>
        </div>
      )}

      {/* 6. CONTROL BAR / TOOLBAR FILTER TERPADU */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-1 flex-wrap w-full gap-3 items-center">
            {/* Search Input */}
            <div className="relative w-full sm:w-56 md:w-64">
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

            {/* Periode Dropdown (Untuk Ringkasan, Bulanan, Tunggakan) */}
            {(activeTab === 'RINGKASAN' || activeTab === 'BULANAN' || activeTab === 'TUNGGAKAN') && (
              <div className="w-full sm:w-44">
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
            )}

            {/* Tahun Ajaran Dropdown (Untuk Tahunan) */}
            {activeTab === 'TAHUNAN' && (
              <div className="w-full sm:w-44">
                <label htmlFor={yearSelectId} className="sr-only">Tahun Ajaran</label>
                <select
                  id={yearSelectId}
                  value={selectedAcademicYear}
                  onChange={(e) => handleAcademicYearChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {filterOptions.academicYearList.map((y) => (
                    <option key={y.value} value={y.value}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Item Dropdown (Untuk Bulanan, Tahunan, Tunggakan) */}
            {activeTab === 'BULANAN' && (
              <div className="w-full sm:w-36">
                <label htmlFor={itemSelectId} className="sr-only">Item Bulanan</label>
                <select
                  id={itemSelectId}
                  value={selectedItemType}
                  onChange={(e) => handleItemTypeChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Item</option>
                  <option value="SPP">SPP</option>
                  <option value="UANG_MAKAN">Uang Makan</option>
                  <option value="UANG_NYUCI">Uang Nyuci</option>
                </select>
              </div>
            )}

            {activeTab === 'TAHUNAN' && (
              <div className="w-full sm:w-40">
                <label htmlFor={itemSelectId} className="sr-only">Item Tahunan</label>
                <select
                  id={itemSelectId}
                  value={selectedItemType}
                  onChange={(e) => handleItemTypeChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Item</option>
                  <option value="EHB">EHB</option>
                  <option value="KESEHATAN">Kesehatan</option>
                  <option value="EKSKUL">Ekstrakurikuler</option>
                </select>
              </div>
            )}

            {activeTab === 'TUNGGAKAN' && (
              <div className="w-full sm:w-36">
                <label htmlFor={itemSelectId} className="sr-only">Item Tunggakan</label>
                <select
                  id={itemSelectId}
                  value={selectedItemType}
                  onChange={(e) => handleItemTypeChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Item</option>
                  <option value="SPP">SPP</option>
                  <option value="UANG_MAKAN">Uang Makan</option>
                  <option value="UANG_NYUCI">Uang Nyuci</option>
                </select>
              </div>
            )}

            {/* Asrama Dropdown */}
            <div className="w-full sm:w-36">
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

            {/* Kelas Dropdown */}
            <div className="w-full sm:w-32">
              <label htmlFor={kelasSelectId} className="sr-only">Kelas</label>
              <select
                id={kelasSelectId}
                value={selectedKelas}
                onChange={(e) => handleKelasChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Kelas</option>
                {filterOptions.kelasList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            {activeTab !== 'TUNGGAKAN' && (
              <div className="w-full sm:w-36">
                <label htmlFor={statusSelectId} className="sr-only">Status</label>
                <select
                  id={statusSelectId}
                  value={selectedStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  {activeTab === 'USPP' ? (
                    <>
                      <option value="BELUM_BAYAR">Belum Bayar</option>
                      <option value="MENCICIL">Mencicil</option>
                      <option value="LUNAS">Lunas</option>
                      <option value="BEBAS">Dibebaskan</option>
                    </>
                  ) : (
                    <>
                      <option value="LUNAS">Lunas</option>
                      <option value="SEBAGIAN">Sebagian</option>
                      <option value="BELUM_LUNAS">Belum Lunas</option>
                      <option value="BEBAS">Dibebaskan</option>
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Reset Filter Button */}
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

      {/* 7. DATA TABLES PER TAB */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isPending ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={activeTab === 'RINGKASAN' ? 10 : 9} />
          </div>
        ) : currentItemsCount === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
              <Filter className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {activeTab === 'TUNGGAKAN'
                ? 'Tidak ada santri yang menunggak'
                : 'Tidak ada data ditemukan'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md">
              {activeTab === 'TUNGGAKAN'
                ? 'Seluruh kewajiban santri pada periode sebelum bulan ini telah diselesaikan dengan baik.'
                : 'Kriteria pencarian atau filter yang Anda gunakan tidak menghasilkan data pada periode ini.'}
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
          /* TABEL DATA */
          <div className="overflow-x-auto">
            {/* 7.1 TAB RINGKASAN */}
            {activeTab === 'RINGKASAN' && data.ringkasanItems && (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-3.5 pl-5 pr-3">Santri</th>
                    <th scope="col" className="px-3 py-3.5">Asrama / Kamar</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">SPP</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">Uang Makan</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">Uang Nyuci</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">EHB</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">Kesehatan</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">Ekstrakurikuler</th>
                    <th scope="col" className="px-2.5 py-3.5 text-center">USPP</th>
                    <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.ringkasanItems.map((item: RingkasanRowItem) => (
                    <tr key={item.santriId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar name={item.namaLengkap} size="sm" clickable={false} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedSantriId(item.santriId)}
                              className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors truncate block text-left cursor-pointer"
                            >
                              {item.namaLengkap}
                            </button>
                            <p className="text-xs text-slate-500 truncate">
                              NIS {item.nis}{item.kelasSekolah ? ` · Kelas ${item.kelasSekolah}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.asrama || 'Non-Asrama'}{item.kamar ? ` / ${item.kamar}` : ''}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.spp.status, item.spp.label)}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.uangMakan.status, item.uangMakan.label)}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.uangNyuci.status, item.uangNyuci.label)}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.ehb.status, item.ehb.label)}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.kesehatan.status, item.kesehatan.label)}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.ekskul.status, item.ekskul.label)}
                      </td>
                      <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.uspp.status, item.uspp.label)}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedSantriId(item.santriId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 7.2 TAB BULANAN */}
            {activeTab === 'BULANAN' && data.bulananItems && (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-3.5 pl-5 pr-3">Santri</th>
                    <th scope="col" className="px-3 py-3.5">Asrama</th>
                    <th scope="col" className="px-3 py-3.5">Item</th>
                    <th scope="col" className="px-3 py-3.5">Periode</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Nominal Tagihan</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sudah Dibayar</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sisa</th>
                    <th scope="col" className="px-3 py-3.5 text-center">Status</th>
                    <th scope="col" className="px-3 py-3.5">Pembayaran Terakhir</th>
                    <th scope="col" className="px-3 py-3.5">Metode</th>
                    <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.bulananItems.map((item: BulananRowItem) => (
                    <tr key={item.obligationId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar name={item.namaLengkap} size="sm" clickable={false} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedSantriId(item.santriId)}
                              className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors truncate block text-left cursor-pointer"
                            >
                              {item.namaLengkap}
                            </button>
                            <p className="text-xs text-slate-500 truncate">
                              NIS {item.nis}{item.kelasSekolah ? ` · ${item.kelasSekolah}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.asrama || 'Non-Asrama'}{item.kamar ? ` / ${item.kamar}` : ''}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap font-medium text-slate-800 text-xs">
                        {item.itemLabel}
                        {item.providerName && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {item.providerName}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.periodLabel}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-700">
                        {formatRupiah(item.amountExpected)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-emerald-600 font-medium">
                        {formatRupiah(item.amountPaid)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                        {formatRupiah(item.remaining)}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.status, item.statusLabel)}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {item.lastPaymentAt ? formatDateDisplay(item.lastPaymentAt) : '-'}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.lastPaymentMethod || '-'}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedSantriId(item.santriId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 7.3 TAB TAHUNAN */}
            {activeTab === 'TAHUNAN' && data.tahunanItems && (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-3.5 pl-5 pr-3">Santri</th>
                    <th scope="col" className="px-3 py-3.5">Asrama</th>
                    <th scope="col" className="px-3 py-3.5">Item</th>
                    <th scope="col" className="px-3 py-3.5">Tahun Ajaran</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Nominal</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sudah Dibayar</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sisa</th>
                    <th scope="col" className="px-3 py-3.5 text-center">Status</th>
                    <th scope="col" className="px-3 py-3.5">Tanggal Pembayaran Terakhir</th>
                    <th scope="col" className="px-3 py-3.5">Metode</th>
                    <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tahunanItems.map((item: TahunanRowItem) => (
                    <tr key={item.obligationId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar name={item.namaLengkap} size="sm" clickable={false} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedSantriId(item.santriId)}
                              className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors truncate block text-left cursor-pointer"
                            >
                              {item.namaLengkap}
                            </button>
                            <p className="text-xs text-slate-500 truncate">
                              NIS {item.nis}{item.kelasSekolah ? ` · ${item.kelasSekolah}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.asrama || 'Non-Asrama'}{item.kamar ? ` / ${item.kamar}` : ''}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap font-medium text-slate-800 text-xs">
                        {item.itemLabel}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.academicYearLabel}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-700">
                        {formatRupiah(item.amountExpected)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-emerald-600 font-medium">
                        {formatRupiah(item.amountPaid)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                        {formatRupiah(item.remaining)}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.status, item.statusLabel)}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {item.lastPaymentAt ? formatDateDisplay(item.lastPaymentAt) : '-'}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.lastPaymentMethod || '-'}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedSantriId(item.santriId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 7.4 TAB USPP */}
            {activeTab === 'USPP' && data.usppItems && (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-3.5 pl-5 pr-3">Santri</th>
                    <th scope="col" className="px-3 py-3.5">Asrama</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Total USPP</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sudah Dibayar</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sisa</th>
                    <th scope="col" className="px-3 py-3.5 text-center">Jumlah Cicilan</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Cicilan Terakhir</th>
                    <th scope="col" className="px-3 py-3.5">Tanggal Cicilan Terakhir</th>
                    <th scope="col" className="px-3 py-3.5">Metode Terakhir</th>
                    <th scope="col" className="px-3 py-3.5 text-center">Status</th>
                    <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.usppItems.map((item: UsppRowItem) => (
                    <tr key={item.santriId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar name={item.namaLengkap} size="sm" clickable={false} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedSantriId(item.santriId)}
                              className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors truncate block text-left cursor-pointer"
                            >
                              {item.namaLengkap}
                            </button>
                            <p className="text-xs text-slate-500 truncate">
                              NIS {item.nis}{item.kelasSekolah ? ` · ${item.kelasSekolah}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.asrama || 'Non-Asrama'}{item.kamar ? ` / ${item.kamar}` : ''}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-700">
                        {formatRupiah(item.amountExpected)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-emerald-600 font-medium">
                        {formatRupiah(item.amountPaid)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                        {formatRupiah(item.remaining)}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap text-xs font-semibold text-slate-700">
                        {item.installmentCount > 0 ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">
                            {item.installmentCount}x cicilan
                          </span>
                        ) : (
                          <span className="text-slate-400">0x</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-700">
                        {item.lastInstallmentAmount ? formatRupiah(item.lastInstallmentAmount) : '-'}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {item.lastInstallmentAt ? formatDateDisplay(item.lastInstallmentAt) : '-'}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.lastInstallmentMethod || '-'}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.status, item.statusLabel)}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedSantriId(item.santriId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 7.5 TAB TUNGGAKAN */}
            {activeTab === 'TUNGGAKAN' && data.tunggakanItems && (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-3.5 pl-5 pr-3">Santri</th>
                    <th scope="col" className="px-3 py-3.5">Asrama</th>
                    <th scope="col" className="px-3 py-3.5">Item</th>
                    <th scope="col" className="px-3 py-3.5">Periode</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Nominal Tagihan</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sudah Dibayar</th>
                    <th scope="col" className="px-3 py-3.5 text-right">Sisa Tunggakan</th>
                    <th scope="col" className="px-3 py-3.5 text-center">Sejak / Umur</th>
                    <th scope="col" className="px-3 py-3.5">Pembayaran Terakhir</th>
                    <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tunggakanItems.map((item: TunggakanRowItem) => (
                    <tr key={item.obligationId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar name={item.namaLengkap} size="sm" clickable={false} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedSantriId(item.santriId)}
                              className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors truncate block text-left cursor-pointer"
                            >
                              {item.namaLengkap}
                            </button>
                            <p className="text-xs text-slate-500 truncate">
                              NIS {item.nis}{item.kelasSekolah ? ` · ${item.kelasSekolah}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.asrama || 'Non-Asrama'}{item.kamar ? ` / ${item.kamar}` : ''}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap font-medium text-slate-800 text-xs">
                        {item.itemLabel}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {item.periodLabel}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-700">
                        {formatRupiah(item.amountExpected)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-500">
                        {formatRupiah(item.amountPaid)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono text-xs font-bold text-rose-700">
                        {formatRupiah(item.remaining)}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                          {item.overdueDuration}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {item.lastPaymentAt ? formatDateDisplay(item.lastPaymentAt) : '-'}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedSantriId(item.santriId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 8. PAGINASI */}
        {!isPending && currentItemsCount > 0 && (
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

      {/* 9. RIGHT SLIDE-OVER DETAIL DRAWER */}
      <StatusPembayaranDetailDrawer
        key={selectedSantriId || 'drawer'}
        santriId={selectedSantriId}
        selectedPeriod={selectedPeriod}
        onClose={() => setSelectedSantriId(null)}
        onRecordPayment={(santriId) => {
          setSelectedSantriId(null)
          setCatatBayarSantriId(santriId)
          setIsCatatBayarOpen(true)
        }}
      />

      {/* 10. MODAL CATAT PEMBAYARAN TUNAI */}
      <CatatPembayaranModal
        isOpen={isCatatBayarOpen}
        initialSantriId={catatBayarSantriId}
        onClose={() => {
          setIsCatatBayarOpen(false)
          setCatatBayarSantriId(null)
        }}
        onSuccess={() => {
          fetchData()
        }}
      />
    </div>
  )
}
