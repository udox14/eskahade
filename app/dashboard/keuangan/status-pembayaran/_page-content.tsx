'use client'

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Filter,
  GraduationCap,
  Utensils,
  Shirt,
  FileText,
  Activity,
  HeartPulse,
  Building2,
  TrendingUp,
  History,
  Calendar,
  ShieldCheck,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import { publicMediaUrl } from '@/lib/r2/references'
import { BillingAuditPanel } from './billing-audit-panel'
import { LegacySyncNotice } from './legacy-sync-notice'
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

const TABS: ReadonlyArray<{ id: TabType; label: string }> = [
  { id: 'RINGKASAN', label: 'Ringkasan' },
  { id: 'BULANAN', label: 'Bulanan' },
  { id: 'TAHUNAN', label: 'Tahunan' },
  { id: 'USPP', label: 'USPP' },
  { id: 'TUNGGAKAN', label: 'Tunggakan' },
]

const PAGE_SIZE_OPTIONS: SelectPickerOption[] = [
  { value: '20', label: '20 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' },
]

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
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(dateStr.trim())
      ? `${dateStr.trim().replace(' ', 'T')}Z`
      : dateStr
    const d = new Date(normalized)
    if (!Number.isFinite(d.getTime())) return dateStr
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

function formatMethodLabel(method?: string | null): string {
  if (!method) return '-'
  switch (method) {
    case 'CASH':
      return 'Tunai'
    case 'MANUAL_TRANSFER':
      return 'Transfer Manual'
    case 'BRI_VA':
    case 'BRI':
      return 'BRIVA'
    case 'BRI_QLOLA':
      return 'BRI QLola'
    case 'LEGACY':
      return 'Modul Lama'
    default:
      return method.replace(/_/g, ' ')
  }
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
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
  const [showBreakdown, setShowBreakdown] = useState<Record<string, boolean>>({
    BULANAN: false,
    TAHUNAN: false,
    TUNGGAKAN: false,
  })

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    initialData.activeTab === 'TUNGGAKAN' ? 'ALL' : initialData.selectedPeriod
  )
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    initialData.selectedAcademicYear || filterOptions.academicYearList[0]?.value || '2026'
  )
  const [selectedItemType, setSelectedItemType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAsrama, setSelectedAsrama] = useState<string>('ALL')
  const [selectedKelas, setSelectedKelas] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(initialData.pagination.currentPage || 1)
  const [pageSize, setPageSize] = useState<number>(initialData.pagination.pageSize || 50)

  const searchInputId = useId()
  const tabIdPrefix = useId()
  const tableRegionHeadingId = useId()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const defaultPeriodForTab = activeTab === 'TUNGGAKAN' ? 'ALL' : filterOptions.currentPeriod
  const defaultAcademicYear = filterOptions.academicYearList[0]?.value || '2026'

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAsrama !== 'ALL' ||
    selectedKelas !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedItemType !== 'ALL' ||
    (activeTab === 'TAHUNAN'
      ? selectedAcademicYear !== defaultAcademicYear
      : activeTab !== 'USPP' && selectedPeriod !== defaultPeriodForTab)

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
        const msg =
          err instanceof Error
            ? err.message
            : 'Data status pembayaran belum dapat dimuat. Coba lagi.'
        setErrorMessage(msg)
      }
    })
  }

  const handleTabChange = (tab: TabType) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const nextPeriod =
      tab === 'TUNGGAKAN'
        ? 'ALL'
        : selectedPeriod === 'ALL'
          ? filterOptions.currentPeriod
          : selectedPeriod
    setActiveTab(tab)
    setSelectedPeriod(nextPeriod)
    setCurrentPage(1)
    setSelectedStatus('ALL')
    setSelectedItemType('ALL')
    tabRefs.current[tab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    fetchData({ tab, period: nextPeriod, page: 1, status: 'ALL', itemType: 'ALL' })
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null
    if (event.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length
    else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') nextIdx = 0
    else if (event.key === 'End') nextIdx = TABS.length - 1

    if (nextIdx !== null) {
      event.preventDefault()
      const nextTab = TABS[nextIdx]
      const el = tabRefs.current[nextTab.id]
      el?.focus()
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
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

  const handleResetFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const resetPeriod = activeTab === 'TUNGGAKAN' ? 'ALL' : filterOptions.currentPeriod
    setSelectedPeriod(resetPeriod)
    setSelectedAcademicYear(defaultAcademicYear)
    setSelectedItemType('ALL')
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedKelas('ALL')
    setSelectedStatus('ALL')
    setCurrentPage(1)
    fetchData({
      period: resetPeriod,
      academicYear: defaultAcademicYear,
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

  // Opsi dropdown SelectPicker terstruktur per tab
  const periodOptions = useMemo<SelectPickerOption[]>(() => {
    const list: SelectPickerOption[] = []
    if (activeTab === 'TUNGGAKAN') {
      list.push({ value: 'ALL', label: 'Semua periode tunggakan' })
      for (const y of filterOptions.academicYearList) {
        list.push({ value: y.value.split('/')[0], label: `Tahun ajaran ${y.label}` })
      }
    }
    for (const p of filterOptions.periodList) {
      list.push({ value: p.value, label: p.label })
    }
    return list
  }, [activeTab, filterOptions.academicYearList, filterOptions.periodList])

  const academicYearOptions = useMemo<SelectPickerOption[]>(
    () => filterOptions.academicYearList.map((y) => ({ value: y.value, label: y.label })),
    [filterOptions.academicYearList]
  )

  const itemOptions = useMemo<SelectPickerOption[]>(() => {
    if (activeTab === 'BULANAN') {
      return [
        { value: 'ALL', label: 'Semua Pos' },
        { value: 'SPP', label: 'SPP' },
        { value: 'UANG_MAKAN', label: 'Uang Makan' },
        { value: 'UANG_NYUCI', label: 'Uang Nyuci' },
      ]
    }
    if (activeTab === 'TAHUNAN') {
      return [
        { value: 'ALL', label: 'Semua Pos' },
        { value: 'EHB', label: 'EHB' },
        { value: 'KESEHATAN', label: 'Kesehatan' },
        { value: 'EKSKUL', label: 'Ekstrakurikuler' },
      ]
    }
    return [
      { value: 'ALL', label: 'Semua Pos' },
      { value: 'SPP', label: 'SPP' },
      { value: 'UANG_MAKAN', label: 'Uang Makan' },
      { value: 'UANG_NYUCI', label: 'Uang Nyuci' },
      { value: 'EHB', label: 'EHB' },
      { value: 'EKSKUL', label: 'Ekstrakurikuler' },
      { value: 'KESEHATAN', label: 'Kesehatan' },
    ]
  }, [activeTab])

  const asramaOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Asrama' },
      ...filterOptions.asramaList.map((a) => ({ value: a, label: a })),
    ],
    [filterOptions.asramaList]
  )

  const kelasOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Kelas' },
      ...filterOptions.kelasList.map((k) => ({ value: k, label: k })),
    ],
    [filterOptions.kelasList]
  )

  const statusOptions = useMemo<SelectPickerOption[]>(() => {
    if (activeTab === 'USPP') {
      return [
        { value: 'ALL', label: 'Semua Status' },
        { value: 'BELUM_BAYAR', label: 'Belum Bayar' },
        { value: 'MENCICIL', label: 'Mencicil' },
        { value: 'LUNAS', label: 'Lunas' },
        { value: 'BEBAS', label: 'Dibebaskan' },
      ]
    }
    return [
      { value: 'ALL', label: 'Semua Status' },
      { value: 'LUNAS', label: 'Lunas' },
      { value: 'SEBAGIAN', label: 'Sebagian' },
      { value: 'BELUM_LUNAS', label: 'Belum Lunas' },
      { value: 'BEBAS', label: 'Dibebaskan' },
    ]
  }, [activeTab])

  // Render badge status semantik; NOT_MATERIALIZED tampil tenang sebagai "—" agar tidak membanjiri tabel
  const renderStatusBadge = (status: string, label: string, compactNotMaterialized = false) => {
    switch (status) {
      case 'PAID':
      case 'LUNAS':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {label}
          </span>
        )
      case 'PARTIALLY_PAID':
      case 'MENCICIL':
      case 'CICILAN':
      case 'SEBAGIAN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
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
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {label}
          </span>
        )
      case 'NOT_MATERIALIZED':
        if (compactNotMaterialized) {
          return (
            <span
              className="inline-block text-slate-300 select-none"
              title="Belum ada tagihan pada periode ini"
            >
              <span aria-hidden="true">—</span>
              <span className="sr-only">Belum ada tagihan</span>
            </span>
          )
        }
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
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
            {label}
          </span>
        )
    }
  }

  const renderSantriCell = (santri: {
    namaLengkap: string
    nis: string
    fotoUrl: string | null
    asrama: string | null
    kamar: string | null
  }) => (
    <div className="flex items-center gap-3 min-w-[200px]">
      <SantriPhotoAvatar
        src={publicMediaUrl(santri.fotoUrl)}
        alt={santri.namaLengkap}
        name={santri.namaLengkap}
        size="sm"
        clickable={false}
      />
      <div className="min-w-0">
        <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate block">
          {santri.namaLengkap}
        </span>
        <p className="text-xs text-slate-500 truncate tabular-nums">
          {santri.nis ? `${santri.nis} · ` : ''}
          {santri.asrama || 'Non-Asrama'}
          {santri.kamar ? ` / ${santri.kamar}` : ''}
        </p>
      </div>
    </div>
  )

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, santriId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedSantriId(santriId)
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

  const lunasPercent = Math.round((data.kpi.totalLunas / (data.kpi.totalSantri || 1)) * 100)
  const paginationStart =
    data.pagination.totalItems === 0
      ? 0
      : (data.pagination.currentPage - 1) * data.pagination.pageSize + 1
  const paginationEnd = Math.min(
    data.pagination.currentPage * data.pagination.pageSize,
    data.pagination.totalItems
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24 lg:pb-12">
      {/* 1. HEADER & PRIMARY CTA */}
      <DashboardPageHeader
        title="Status Pembayaran"
        description="Pantau kewajiban santri, pembayaran bulanan, tahunan, USPP, dan tunggakan."
        action={
          data.userPermissions?.canRecordPayment ? (
            <button
              type="button"
              onClick={() => {
                setCatatBayarSantriId(null)
                setIsCatatBayarOpen(true)
              }}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 min-h-[44px] sm:min-h-[40px] text-sm font-semibold text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Wallet className="h-4 w-4 text-white" aria-hidden="true" />
              <span>Catat Pembayaran</span>
            </button>
          ) : null
        }
      />

      <LegacySyncNotice
        count={data.billingReviewCount}
        canSync={!!data.userPermissions?.canRecordPayment}
        onUpdated={() => fetchData()}
      />

      {/* 2. TABS NAVIGASI (Single-row horizontal scroll, accessible tablist, activation on click/Enter) */}
      <div className="border-b border-slate-200">
        <div
          role="tablist"
          aria-label="Kategori status pembayaran"
          className="flex gap-1 overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id
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
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className="relative shrink-0 snap-start whitespace-nowrap min-h-[44px] px-3.5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer aria-[selected=true]:text-emerald-800 aria-[selected=true]:after:content-[''] aria-[selected=true]:after:absolute aria-[selected=true]:after:inset-x-0 aria-[selected=true]:after:bottom-0 aria-[selected=true]:after:border-b-2 aria-[selected=true]:after:border-emerald-600"
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* PANEL KONTEN TAB AKTIF */}
      <div
        role="tabpanel"
        aria-labelledby={`${tabIdPrefix}-${activeTab}`}
        aria-busy={isPending}
        className="space-y-5"
      >
        {/* 3. ALERT PRA-CUTOVER */}
        {data.isPreCutoverPeriod && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Periode Sebelum Peralihan Sistem Keuangan Baru (Juli 2026)</p>
              <p className="text-xs text-amber-900/90 leading-relaxed text-pretty">
                Periode <strong>{data.selectedPeriod}</strong> dikelola oleh modul pembayaran lama. Data tunggakan tetap ditampilkan untuk pemantauan tanpa menggandakan tagihan di sistem baru.
              </p>
            </div>
          </div>
        )}

        {/* 4. ERROR ALERT BANNER */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchData()}
              className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-200 transition cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* 5. SUMMARY KPI CARDS SESUAI TAB AKTIF */}
        {isPending ? (
          <StatCardSkeleton count={4} />
        ) : activeTab === 'RINGKASAN' ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Santri Terdaftar</span>
                  <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpi.totalSantri}
                  </span>
                  <span className="text-xs font-medium text-slate-500">santri</span>
                </div>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                Populasi aktif dalam filter
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleStatusChange(selectedStatus === 'LUNAS' ? 'ALL' : 'LUNAS')}
              className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
                selectedStatus === 'LUNAS'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Lunas Periode Ini</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpi.totalLunas}
                  </span>
                  <span className="text-xs font-medium text-slate-500">santri</span>
                  <span className="ml-auto rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 tabular-nums">
                    {lunasPercent}%
                  </span>
                </div>
              </div>
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span>Seluruh kewajiban terpenuhi</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700" aria-hidden="true" />
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                handleStatusChange(selectedStatus === 'BELUM_LUNAS' ? 'ALL' : 'BELUM_LUNAS')
              }
              className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
                selectedStatus === 'BELUM_LUNAS'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Belum Lunas</span>
                  <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpi.totalBelumLunas}
                  </span>
                  <span className="text-xs font-medium text-slate-500">santri</span>
                </div>
              </div>
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span>Memiliki sisa tagihan aktif</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('TUNGGAKAN')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xs hover:border-rose-300 hover:bg-rose-50/20 transition-colors cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Tunggakan</span>
                  <CreditCard className="h-4 w-4 text-rose-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.kpi.totalTunggakanNominal)}
                </div>
              </div>
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-rose-700 font-medium">
                <span>Lewat jatuh tempo · Lihat daftar</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-rose-700" aria-hidden="true" />
              </div>
            </button>
          </div>
        ) : activeTab === 'BULANAN' ? (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Tagihan Bulanan</span>
                  <Wallet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.bulanan?.totalTagihanNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                  {data.tabKpi?.bulanan?.totalTagihanCount ?? 0} kewajiban terbit
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Sudah Terbayar</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.bulanan?.sudahTerbayarNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-emerald-700 tabular-nums">
                  {data.tabKpi?.bulanan?.lunasCount ?? 0} tagihan lunas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Sisa Tagihan</span>
                  <Clock className="h-4 w-4 text-amber-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.bulanan?.sisaTagihanNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-amber-800 tabular-nums">
                  {Math.max(
                    0,
                    (data.tabKpi?.bulanan?.totalTagihanCount ?? 0) -
                      (data.tabKpi?.bulanan?.lunasCount ?? 0)
                  )}{' '}
                  belum lunas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Tingkat Kelunasan</span>
                  <TrendingUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.tabKpi?.bulanan?.totalTagihanNominal
                      ? Math.round(
                          ((data.tabKpi.bulanan.sudahTerbayarNominal || 0) /
                            data.tabKpi.bulanan.totalTagihanNominal) *
                            100
                        )
                      : 0}
                    %
                  </span>
                  <span className="text-xs font-medium text-slate-500">terkumpul</span>
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                  {data.tabKpi?.bulanan?.lunasCount ?? 0} dari {data.tabKpi?.bulanan?.totalTagihanCount ?? 0} tagihan
                </p>
              </div>
            </div>

            {data.tabKpi?.bulanan?.itemBreakdown && data.tabKpi.bulanan.itemBreakdown.length > 0 && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowBreakdown((prev) => ({ ...prev, BULANAN: !prev.BULANAN }))}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${showBreakdown.BULANAN ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  <span>
                    {showBreakdown.BULANAN
                      ? 'Sembunyikan Rincian Pos'
                      : 'Lihat Rincian Per Pos (SPP, Makan, Nyuci)'}
                  </span>
                </button>

                {showBreakdown.BULANAN && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {data.tabKpi.bulanan.itemBreakdown.map((item) => {
                      const itemPercent =
                        item.targetNominal > 0
                          ? Math.round((item.paidNominal / item.targetNominal) * 100)
                          : 0
                      const IconComponent =
                        item.itemType === 'SPP'
                          ? GraduationCap
                          : item.itemType === 'UANG_MAKAN'
                            ? Utensils
                            : Shirt

                      return (
                        <div
                          key={item.itemType}
                          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                                <span className="text-xs font-bold text-slate-800">{item.itemLabel}</span>
                              </div>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
                                {itemPercent}%
                              </span>
                            </div>
                            <div className="mt-3 flex items-baseline justify-between tabular-nums">
                              <div>
                                <span className="text-[11px] text-slate-500 block">Terbayar</span>
                                <span className="text-base font-bold text-slate-900">
                                  {formatRupiah(item.paidNominal)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[11px] text-slate-500 block">Sisa</span>
                                <span className="text-sm font-semibold text-amber-800">
                                  {formatRupiah(item.remainingNominal)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                            <span>
                              Lunas: <strong className="text-slate-700">{item.lunasCount}</strong>/{item.totalCount}
                            </span>
                            <span>
                              Target: <strong className="text-slate-700">{formatRupiah(item.targetNominal)}</strong>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'TAHUNAN' ? (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Tagihan Tahunan</span>
                  <Calendar className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.tahunan?.totalTagihanNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                  {data.tabKpi?.tahunan?.totalTagihanCount ?? 0} kewajiban tahunan
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Sudah Terbayar</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.tahunan?.sudahTerbayarNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-emerald-700 tabular-nums">
                  {data.tabKpi?.tahunan?.lunasCount ?? 0} tagihan lunas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Sisa Tagihan</span>
                  <Clock className="h-4 w-4 text-amber-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.tahunan?.sisaTagihanNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-amber-800 tabular-nums">
                  {Math.max(
                    0,
                    (data.tabKpi?.tahunan?.totalTagihanCount ?? 0) -
                      (data.tabKpi?.tahunan?.lunasCount ?? 0) -
                      (data.tabKpi?.tahunan?.bebasCount ?? 0)
                  )}{' '}
                  belum lunas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Bebas / Keringanan</span>
                  <ShieldCheck className="h-4 w-4 text-sky-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.tabKpi?.tahunan?.bebasCount ?? 0}
                  </span>
                  <span className="text-xs font-medium text-slate-500">tagihan</span>
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  Penerima pembebasan pos
                </p>
              </div>
            </div>

            {data.tabKpi?.tahunan?.itemBreakdown && data.tabKpi.tahunan.itemBreakdown.length > 0 && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowBreakdown((prev) => ({ ...prev, TAHUNAN: !prev.TAHUNAN }))}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${showBreakdown.TAHUNAN ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  <span>
                    {showBreakdown.TAHUNAN
                      ? 'Sembunyikan Rincian Pos'
                      : 'Lihat Rincian Per Pos (EHB, Ekskul, Kesehatan)'}
                  </span>
                </button>

                {showBreakdown.TAHUNAN && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {data.tabKpi.tahunan.itemBreakdown.map((item) => {
                      const itemPercent =
                        item.targetNominal > 0
                          ? Math.round((item.paidNominal / item.targetNominal) * 100)
                          : 0
                      const IconComponent =
                        item.itemType === 'EHB'
                          ? FileText
                          : item.itemType === 'EKSKUL'
                            ? Activity
                            : HeartPulse

                      return (
                        <div
                          key={item.itemType}
                          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                                <span className="text-xs font-bold text-slate-800">{item.itemLabel}</span>
                              </div>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
                                {itemPercent}%
                              </span>
                            </div>
                            <div className="mt-3 flex items-baseline justify-between tabular-nums">
                              <div>
                                <span className="text-[11px] text-slate-500 block">Terbayar</span>
                                <span className="text-base font-bold text-slate-900">
                                  {formatRupiah(item.paidNominal)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[11px] text-slate-500 block">Sisa</span>
                                <span className="text-sm font-semibold text-amber-800">
                                  {formatRupiah(item.remainingNominal)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                            <span>
                              Lunas: <strong className="text-slate-700">{item.lunasCount}</strong>/{item.totalCount}
                            </span>
                            <span>
                              Target: <strong className="text-slate-700">{formatRupiah(item.targetNominal)}</strong>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'USPP' ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Total Komitmen USPP</span>
                <Building2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(data.tabKpi?.uspp?.totalKomitmenNominal ?? 0)}
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                Akumulasi komitmen uang pangkal
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Terkumpul</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.uspp?.terkumpulNominal ?? 0)}
                </span>
                <span className="ml-auto rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 tabular-nums">
                  {data.tabKpi?.uspp?.totalKomitmenNominal
                    ? Math.round(
                        ((data.tabKpi.uspp.terkumpulNominal || 0) /
                          data.tabKpi.uspp.totalKomitmenNominal) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                Dana pembangunan terealisasi
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Sisa Piutang USPP</span>
                <Clock className="h-4 w-4 text-amber-700" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(data.tabKpi?.uspp?.sisaPiutangNominal ?? 0)}
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-amber-800">
                Belum terbayar / dalam cicilan
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Status Santri</span>
                <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {data.tabKpi?.uspp?.santriLunasCount ?? 0}
                </span>
                <span className="text-xs font-semibold text-emerald-700">lunas</span>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                {data.tabKpi?.uspp?.santriMencicilCount ?? 0} mencicil ·{' '}
                {data.tabKpi?.uspp?.santriBelumBayarCount ?? 0} belum bayar
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Nominal Tunggakan</span>
                  <CreditCard className="h-4 w-4 text-rose-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.tabKpi?.tunggakan?.totalTunggakanNominal ?? 0)}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-rose-700">
                  Kewajiban lewat jatuh tempo
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Tagihan Menunggak</span>
                  <AlertCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.tabKpi?.tunggakan?.totalTagihanMenunggak ?? 0}
                  </span>
                  <span className="text-xs font-medium text-slate-500">tagihan</span>
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  Item bulanan &amp; tahunan menunggak
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Santri Menunggak</span>
                  <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.tabKpi?.tunggakan?.totalSantriMenunggak ?? 0}
                  </span>
                  <span className="text-xs font-medium text-slate-500">santri</span>
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  Memiliki minimal 1 tunggakan
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Keterlambatan Terlama</span>
                  <History className="h-4 w-4 text-amber-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-xl font-bold tracking-tight text-slate-900 truncate">
                  {data.tabKpi?.tunggakan?.tunggakanTertuaLabel || '-'}
                </div>
                <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  Periode tunggakan paling awal
                </p>
              </div>
            </div>

            {data.tabKpi?.tunggakan?.itemBreakdown &&
              data.tabKpi.tunggakan.itemBreakdown.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      setShowBreakdown((prev) => ({ ...prev, TUNGGAKAN: !prev.TUNGGAKAN }))
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${showBreakdown.TUNGGAKAN ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                    <span>
                      {showBreakdown.TUNGGAKAN
                        ? 'Sembunyikan Rincian Tunggakan'
                        : 'Lihat Rincian Tunggakan Per Pos'}
                    </span>
                  </button>

                  {showBreakdown.TUNGGAKAN && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {data.tabKpi.tunggakan.itemBreakdown.map((item) => {
                        const IconComponent =
                          item.itemType === 'SPP'
                            ? GraduationCap
                            : item.itemType === 'UANG_MAKAN'
                              ? Utensils
                              : item.itemType === 'UANG_NYUCI'
                                ? Shirt
                                : item.itemType === 'EHB'
                                  ? FileText
                                  : item.itemType === 'EKSKUL'
                                    ? Activity
                                    : HeartPulse

                        return (
                          <div
                            key={item.itemType}
                            className="flex flex-col justify-between rounded-xl border border-rose-200/70 bg-white p-4 shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4 text-rose-600" aria-hidden="true" />
                                  <span className="text-xs font-bold text-slate-800">{item.itemLabel}</span>
                                </div>
                                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 tabular-nums">
                                  {item.countTagihan} item
                                </span>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] text-slate-500 block">Sisa Tunggakan</span>
                                <span className="text-lg font-bold text-rose-700 tabular-nums">
                                  {formatRupiah(item.nominalTunggakan)}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                              <span>
                                Tagihan: <strong className="text-slate-700">{item.countTagihan}</strong>
                              </span>
                              <span>
                                Target: <strong className="text-slate-700">{formatRupiah(item.targetNominal)}</strong>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* 6. CONTROL BAR / TOOLBAR FILTER TERPADU (SelectPicker + Debounce Search) */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Input (auto-debounce 350ms + Enter instan) */}
            <div className="relative w-full lg:w-64 lg:shrink-0">
              <label htmlFor={searchInputId} className="sr-only">
                Cari santri berdasarkan nama atau NIS
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id={searchInputId}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari nama atau NIS…"
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

            {/* Filter SelectPickers: Grid 2 kolom di mobile, flex rapi di desktop */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:flex-1 sm:items-center">
              {(activeTab === 'RINGKASAN' || activeTab === 'BULANAN' || activeTab === 'TUNGGAKAN') && (
                <SelectPicker
                  value={selectedPeriod}
                  options={periodOptions}
                  onChange={handlePeriodChange}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  ariaLabel="Pilih periode"
                  align="left"
                  className="col-span-2 sm:col-span-1 w-full sm:w-auto [&>button]:w-full"
                />
              )}

              {activeTab === 'TAHUNAN' && (
                <SelectPicker
                  value={selectedAcademicYear}
                  options={academicYearOptions}
                  onChange={handleAcademicYearChange}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  ariaLabel="Pilih tahun ajaran"
                  align="left"
                  className="col-span-2 sm:col-span-1 w-full sm:w-auto [&>button]:w-full"
                />
              )}

              {(activeTab === 'BULANAN' || activeTab === 'TAHUNAN' || activeTab === 'TUNGGAKAN') && (
                <SelectPicker
                  value={selectedItemType}
                  options={itemOptions}
                  onChange={handleItemTypeChange}
                  ariaLabel="Filter pos tagihan"
                  align="left"
                  className="w-full sm:w-auto [&>button]:w-full"
                />
              )}

              <SelectPicker
                value={selectedAsrama}
                options={asramaOptions}
                onChange={handleAsramaChange}
                ariaLabel="Filter asrama"
                align="left"
                className="w-full sm:w-auto [&>button]:w-full"
              />

              <SelectPicker
                value={selectedKelas}
                options={kelasOptions}
                onChange={handleKelasChange}
                ariaLabel="Filter kelas"
                align="left"
                className="w-full sm:w-auto [&>button]:w-full"
              />

              {activeTab !== 'TUNGGAKAN' && (
                <SelectPicker
                  value={selectedStatus}
                  options={statusOptions}
                  onChange={handleStatusChange}
                  ariaLabel="Filter status pembayaran"
                  align="left"
                  className="w-full sm:w-auto [&>button]:w-full"
                />
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="col-span-2 sm:col-span-1 inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer sm:ml-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 7. DATA TABLES PER TAB */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <h2 id={tableRegionHeadingId} className="sr-only">
            Daftar status pembayaran santri tab {activeTab.toLowerCase()}
          </h2>

          {isPending ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={activeTab === 'RINGKASAN' ? 8 : 8} />
            </div>
          ) : currentItemsCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Filter className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                {activeTab === 'TUNGGAKAN'
                  ? 'Tidak ada santri yang menunggak'
                  : 'Tidak ada data ditemukan'}
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500 text-pretty">
                {activeTab === 'TUNGGAKAN'
                  ? 'Seluruh kewajiban santri pada periode yang dipilih telah diselesaikan dengan baik.'
                  : 'Kriteria pencarian atau filter yang digunakan tidak menghasilkan data pada periode ini.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 7A. MOBILE STACKED CARD LISTS (md:hidden) — Bebas scroll horizontal di HP */}
              <div className="divide-y divide-slate-100 md:hidden">
                {activeTab === 'RINGKASAN' &&
                  data.ringkasanItems?.map((item: RingkasanRowItem) => {
                    const activeItems = [
                      { label: 'SPP', data: item.spp },
                      { label: 'Makan', data: item.uangMakan },
                      { label: 'Nyuci', data: item.uangNyuci },
                      { label: 'EHB', data: item.ehb },
                      { label: 'Kesehatan', data: item.kesehatan },
                      { label: 'Ekskul', data: item.ekskul },
                      { label: 'USPP', data: item.uspp },
                    ].filter((x) => x.data.status !== 'NOT_MATERIALIZED')

                    return (
                      <button
                        key={`m-ring-${item.santriId}`}
                        type="button"
                        onClick={() => setSelectedSantriId(item.santriId)}
                        className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          {renderSantriCell(item)}
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {activeItems.length > 0 ? (
                            activeItems.map((entry) => (
                              <span
                                key={entry.label}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-slate-50/70 px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                <span className="font-semibold text-slate-800">{entry.label}:</span>
                                <span
                                  className={
                                    entry.data.status === 'PAID'
                                      ? 'font-semibold text-emerald-700'
                                      : entry.data.status === 'PARTIALLY_PAID'
                                        ? 'font-semibold text-amber-800'
                                        : entry.data.status === 'EXEMPTED'
                                          ? 'font-semibold text-sky-700'
                                          : 'text-slate-600'
                                  }
                                >
                                  {entry.data.label}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">
                              Belum ada tagihan terbit pada periode ini
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}

                {activeTab === 'BULANAN' &&
                  data.bulananItems?.map((item: BulananRowItem) => (
                    <button
                      key={`m-bul-${item.obligationId}`}
                      type="button"
                      onClick={() => setSelectedSantriId(item.santriId)}
                      className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renderSantriCell(item)}
                        {renderStatusBadge(item.status, item.statusLabel)}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                        <span>
                          <strong className="text-slate-800">{item.itemLabel}</strong> · {item.periodLabel}
                        </span>
                        <span className="font-bold text-slate-900">
                          Sisa {formatRupiah(item.remaining)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>
                          Tagihan {formatRupiah(item.amountExpected)} · Dibayar {formatRupiah(item.amountPaid)}
                        </span>
                        <span>{formatMethodLabel(item.lastPaymentMethod)}</span>
                      </div>
                    </button>
                  ))}

                {activeTab === 'TAHUNAN' &&
                  data.tahunanItems?.map((item: TahunanRowItem) => (
                    <button
                      key={`m-tah-${item.obligationId}`}
                      type="button"
                      onClick={() => setSelectedSantriId(item.santriId)}
                      className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renderSantriCell(item)}
                        {renderStatusBadge(item.status, item.statusLabel)}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                        <span>
                          <strong className="text-slate-800">{item.itemLabel}</strong> · {item.academicYearLabel}
                        </span>
                        <span className="font-bold text-slate-900">
                          Sisa {formatRupiah(item.remaining)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>
                          Tagihan {formatRupiah(item.amountExpected)} · Dibayar {formatRupiah(item.amountPaid)}
                        </span>
                        <span>{formatMethodLabel(item.lastPaymentMethod)}</span>
                      </div>
                    </button>
                  ))}

                {activeTab === 'USPP' &&
                  data.usppItems?.map((item: UsppRowItem) => (
                    <button
                      key={`m-uspp-${item.santriId}`}
                      type="button"
                      onClick={() => setSelectedSantriId(item.santriId)}
                      className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renderSantriCell(item)}
                        {renderStatusBadge(item.status, item.statusLabel)}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                        <span>{item.installmentCount}x cicilan</span>
                        <span className="font-bold text-slate-900">
                          Sisa {formatRupiah(item.remaining)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>
                          Total {formatRupiah(item.amountExpected)} · Dibayar {formatRupiah(item.amountPaid)}
                        </span>
                        <span>{formatMethodLabel(item.lastInstallmentMethod)}</span>
                      </div>
                    </button>
                  ))}

                {activeTab === 'TUNGGAKAN' &&
                  data.tunggakanItems?.map((item: TunggakanRowItem) => (
                    <button
                      key={`m-tung-${item.obligationId}`}
                      type="button"
                      onClick={() => setSelectedSantriId(item.santriId)}
                      className="w-full min-h-[44px] p-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renderSantriCell(item)}
                        <span className="shrink-0 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                          {item.overdueDuration}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                        <span>
                          <strong className="text-slate-800">{item.itemLabel}</strong> · {item.periodLabel}
                        </span>
                        <span className="font-bold text-rose-700">
                          {formatRupiah(item.remaining)}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>

              {/* 7B. DESKTOP / TABLET TABLES (hidden md:block) — Keyboard-scrollable region + sticky headers */}
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={tableRegionHeadingId}
                className="hidden md:block overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                {/* 7.1 TAB RINGKASAN */}
                {activeTab === 'RINGKASAN' && data.ringkasanItems && (
                  <table className="w-full border-collapse text-left text-sm text-slate-600">
                    <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th scope="col" className="sticky left-0 z-30 bg-slate-50 py-3.5 pl-5 pr-3">
                          Santri
                        </th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">SPP</th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">Makan</th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">Nyuci</th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">EHB</th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">Kesehatan</th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">Ekskul</th>
                        <th scope="col" className="px-2.5 py-3.5 text-center">USPP</th>
                        <th scope="col" className="w-10 py-3.5 pr-4 text-right">
                          <span className="sr-only">Detail</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.ringkasanItems.map((item: RingkasanRowItem) => (
                        <tr
                          key={item.santriId}
                          tabIndex={0}
                          onClick={() => setSelectedSantriId(item.santriId)}
                          onKeyDown={(e) => handleRowKeyDown(e, item.santriId)}
                          className="group hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3.5 pl-5 pr-3">
                            {renderSantriCell(item)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.spp.status, item.spp.label, true)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.uangMakan.status, item.uangMakan.label, true)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.uangNyuci.status, item.uangNyuci.label, true)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.ehb.status, item.ehb.label, true)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.kesehatan.status, item.kesehatan.label, true)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.ekskul.status, item.ekskul.label, true)}
                          </td>
                          <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.uspp.status, item.uspp.label, true)}
                          </td>
                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                            <ChevronRight
                              className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors inline-block"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 7.2 TAB BULANAN */}
                {activeTab === 'BULANAN' && data.bulananItems && (
                  <table className="w-full border-collapse text-left text-sm text-slate-600">
                    <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th scope="col" className="sticky left-0 z-30 bg-slate-50 py-3.5 pl-5 pr-3">Santri</th>
                        <th scope="col" className="px-3 py-3.5">Pos &amp; Periode</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Tagihan</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Dibayar</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Sisa</th>
                        <th scope="col" className="px-3 py-3.5 text-center">Status</th>
                        <th scope="col" className="px-3 py-3.5">Bayar Terakhir</th>
                        <th scope="col" className="w-10 py-3.5 pr-4 text-right">
                          <span className="sr-only">Detail</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.bulananItems.map((item: BulananRowItem) => (
                        <tr
                          key={item.obligationId}
                          tabIndex={0}
                          onClick={() => setSelectedSantriId(item.santriId)}
                          onKeyDown={(e) => handleRowKeyDown(e, item.santriId)}
                          className="group hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3.5 pl-5 pr-3">
                            {renderSantriCell(item)}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                            <div className="font-semibold text-slate-800">{item.itemLabel}</div>
                            <div className="text-[11px] text-slate-500">
                              {item.periodLabel}
                              {item.providerName ? ` · ${item.providerName}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs text-slate-700 tabular-nums">
                            {formatRupiah(item.amountExpected)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-medium text-emerald-700 tabular-nums">
                            {formatRupiah(item.amountPaid)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-bold text-slate-900 tabular-nums">
                            {formatRupiah(item.remaining)}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.status, item.statusLabel)}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                            <div className="text-slate-700 tabular-nums">
                              {item.lastPaymentAt ? formatDateDisplay(item.lastPaymentAt) : '—'}
                            </div>
                            {item.lastPaymentMethod && (
                              <div className="text-[11px] text-slate-500">
                                {formatMethodLabel(item.lastPaymentMethod)}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                            <ChevronRight
                              className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors inline-block"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 7.3 TAB TAHUNAN */}
                {activeTab === 'TAHUNAN' && data.tahunanItems && (
                  <table className="w-full border-collapse text-left text-sm text-slate-600">
                    <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th scope="col" className="sticky left-0 z-30 bg-slate-50 py-3.5 pl-5 pr-3">Santri</th>
                        <th scope="col" className="px-3 py-3.5">Pos &amp; Tahun Ajaran</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Tagihan</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Dibayar</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Sisa</th>
                        <th scope="col" className="px-3 py-3.5 text-center">Status</th>
                        <th scope="col" className="px-3 py-3.5">Bayar Terakhir</th>
                        <th scope="col" className="w-10 py-3.5 pr-4 text-right">
                          <span className="sr-only">Detail</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.tahunanItems.map((item: TahunanRowItem) => (
                        <tr
                          key={item.obligationId}
                          tabIndex={0}
                          onClick={() => setSelectedSantriId(item.santriId)}
                          onKeyDown={(e) => handleRowKeyDown(e, item.santriId)}
                          className="group hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3.5 pl-5 pr-3">
                            {renderSantriCell(item)}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                            <div className="font-semibold text-slate-800">{item.itemLabel}</div>
                            <div className="text-[11px] text-slate-500">{item.academicYearLabel}</div>
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs text-slate-700 tabular-nums">
                            {formatRupiah(item.amountExpected)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-medium text-emerald-700 tabular-nums">
                            {formatRupiah(item.amountPaid)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-bold text-slate-900 tabular-nums">
                            {formatRupiah(item.remaining)}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.status, item.statusLabel)}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                            <div className="text-slate-700 tabular-nums">
                              {item.lastPaymentAt ? formatDateDisplay(item.lastPaymentAt) : '—'}
                            </div>
                            {item.lastPaymentMethod && (
                              <div className="text-[11px] text-slate-500">
                                {formatMethodLabel(item.lastPaymentMethod)}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                            <ChevronRight
                              className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors inline-block"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 7.4 TAB USPP */}
                {activeTab === 'USPP' && data.usppItems && (
                  <table className="w-full border-collapse text-left text-sm text-slate-600">
                    <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th scope="col" className="sticky left-0 z-30 bg-slate-50 py-3.5 pl-5 pr-3">Santri</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Total USPP</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Dibayar</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Sisa</th>
                        <th scope="col" className="px-3 py-3.5 text-center">Cicilan</th>
                        <th scope="col" className="px-3 py-3.5">Cicilan Terakhir</th>
                        <th scope="col" className="px-3 py-3.5 text-center">Status</th>
                        <th scope="col" className="w-10 py-3.5 pr-4 text-right">
                          <span className="sr-only">Detail</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.usppItems.map((item: UsppRowItem) => (
                        <tr
                          key={item.santriId}
                          tabIndex={0}
                          onClick={() => setSelectedSantriId(item.santriId)}
                          onKeyDown={(e) => handleRowKeyDown(e, item.santriId)}
                          className="group hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3.5 pl-5 pr-3">
                            {renderSantriCell(item)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs text-slate-700 tabular-nums">
                            {formatRupiah(item.amountExpected)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-medium text-emerald-700 tabular-nums">
                            {formatRupiah(item.amountPaid)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-bold text-slate-900 tabular-nums">
                            {formatRupiah(item.remaining)}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap text-xs font-semibold text-slate-700 tabular-nums">
                            {item.installmentCount > 0 ? `${item.installmentCount}x` : '0x'}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                            {item.lastInstallmentAmount ? (
                              <>
                                <div className="font-semibold text-slate-800 tabular-nums">
                                  {formatRupiah(item.lastInstallmentAmount)}
                                  {item.lastInstallmentMethod
                                    ? ` · ${formatMethodLabel(item.lastInstallmentMethod)}`
                                    : ''}
                                </div>
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  {item.lastInstallmentAt ? formatDateDisplay(item.lastInstallmentAt) : '—'}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(item.status, item.statusLabel)}
                          </td>
                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                            <ChevronRight
                              className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors inline-block"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 7.5 TAB TUNGGAKAN */}
                {activeTab === 'TUNGGAKAN' && data.tunggakanItems && (
                  <table className="w-full border-collapse text-left text-sm text-slate-600">
                    <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th scope="col" className="sticky left-0 z-30 bg-slate-50 py-3.5 pl-5 pr-3">Santri</th>
                        <th scope="col" className="px-3 py-3.5">Pos &amp; Periode</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Tagihan</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Dibayar</th>
                        <th scope="col" className="px-3 py-3.5 text-right">Sisa Tunggakan</th>
                        <th scope="col" className="px-3 py-3.5 text-center">Umur</th>
                        <th scope="col" className="px-3 py-3.5">Bayar Terakhir</th>
                        <th scope="col" className="w-10 py-3.5 pr-4 text-right">
                          <span className="sr-only">Detail</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.tunggakanItems.map((item: TunggakanRowItem) => (
                        <tr
                          key={item.obligationId}
                          tabIndex={0}
                          onClick={() => setSelectedSantriId(item.santriId)}
                          onKeyDown={(e) => handleRowKeyDown(e, item.santriId)}
                          className="group hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3.5 pl-5 pr-3">
                            {renderSantriCell(item)}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                            <div className="font-semibold text-slate-800">{item.itemLabel}</div>
                            <div className="text-[11px] text-slate-500">{item.periodLabel}</div>
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs text-slate-700 tabular-nums">
                            {formatRupiah(item.amountExpected)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs text-slate-500 tabular-nums">
                            {formatRupiah(item.amountPaid)}
                          </td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap text-xs font-bold text-rose-700 tabular-nums">
                            {formatRupiah(item.remaining)}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                              {item.overdueDuration}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                            {item.lastPaymentAt ? formatDateDisplay(item.lastPaymentAt) : '—'}
                          </td>
                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                            <ChevronRight
                              className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors inline-block"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* 8. PAGINASI BERSIH (SelectPicker + single-fetch tanpa bug double-trigger) */}
          {!isPending && currentItemsCount > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 tabular-nums">
                Menampilkan <strong className="font-semibold text-slate-700">{paginationStart}–{paginationEnd}</strong> dari{' '}
                <strong className="font-semibold text-slate-700">{data.pagination.totalItems}</strong> data
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

        {/* 8b. PEMERIKSAAN PENERBITAN TAGIHAN */}
        <BillingAuditPanel
          canApply={!!data.userPermissions?.canRecordPayment}
          onUpdated={() => fetchData()}
        />
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
