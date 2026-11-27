'use client'

// app/dashboard/keuangan/laporan/_page-content.tsx
// Antarmuka Modul Laporan & Cetak Ekspor Keuangan (PRD Bab 34, 40, 42)

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import {
  FileSpreadsheet,
  Printer,
  Search,
  RotateCcw,
  Receipt,
  SendHorizontal,
  AlertCircle,
  Award,
  UserCheck,
  Wallet,
  Coins,
  Landmark,
  Scale,
  Eye,
  X,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Users,
  Banknote,
} from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import { toast } from 'sonner'
import CooperativeIncomeCard from './cooperative-income-card'
import { CashSessionDetailModal } from './cash-session-detail-modal'
import { ReportPrintModals } from './report-print-modals'
import {
  formatAllocationsSummary,
  formatCashSessionStatus,
  formatDistributionMethod,
  formatDistributionStatus,
  formatExemptionStatus,
  formatItemsCsv,
  formatMatchStatus,
  formatObligationStatus,
  formatPaymentChannel,
  formatPaymentMethod,
  formatPaymentStatus,
  formatPeriodLabel,
  formatRecipientType,
  formatResolutionAction,
  formatRupiah,
  formatSettlementStatus,
  formatWalletMovement,
} from './report-formatters'
import {
  fetchReceiptsReport,
  fetchDistributionsReport,
  fetchArrearsReport,
  fetchExemptionsReport,
  fetchStudentDetailReport,
  fetchWalletReport,
  fetchCashSessionsReport,
  fetchCashSessionDetailReport,
  fetchSettlementsReport,
  fetchReconciliationsReport,
  fetchReceiptsForExport,
  fetchDistributionsForExport,
  fetchArrearsForExport,
  fetchExemptionsForExport,
  fetchWalletForExport,
  fetchCashSessionsForExport,
  fetchSettlementsForExport,
  fetchReconciliationsForExport,
} from './actions'
import {
  exportReceiptsExcel,
  exportDistributionsExcel,
  exportArrearsExcel,
  exportExemptionsExcel,
  exportStudentDetailExcel,
  exportWalletExcel,
  exportCashSessionsExcel,
  exportSettlementsExcel,
  exportReconciliationsExcel,
} from '@/lib/finance/report-exports'
import type {
  ReportType,
  ReportFilterOptions,
  ReceiptsReportResponse,
  DistributionsReportResponse,
  ArrearsReportResponse,
  ExemptionsReportResponse,
  StudentDetailReportResponse,
  WalletReportResponse,
  WalletSummaryRow,
  WalletMutationRow,
  CashSessionsReportResponse,
  CashSessionDetailReportResponse,
  SettlementsReportResponse,
  ReconciliationsReportResponse,
} from '@/lib/finance/reports'

interface LaporanKeuanganContentProps {
  filterOptions: ReportFilterOptions
  initialReceipts: ReceiptsReportResponse
}

interface FilterOverrides {
  search?: string
  startDate?: string
  endDate?: string
  period?: string
  asrama?: string
  kelas?: string
  itemType?: string
  selectedStudentId?: string
  walletMode?: 'SUMMARY' | 'MUTATION'
  operatorId?: string
  recipientType?: string
  providerId?: string
  exemptionStatus?: 'ACTIVE' | 'REVOKED' | 'ALL'
}

const PAGE_SIZE_OPTIONS: SelectPickerOption[] = [
  { value: '20', label: '20 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' },
]

const RECIPIENT_OPTIONS: SelectPickerOption[] = [
  { value: 'ALL', label: 'Semua Penerima' },
  { value: 'BENDAHARA_PESANTREN', label: 'Bendahara Pesantren' },
  { value: 'KATERING', label: 'Katering' },
  { value: 'LAUNDRY', label: 'Laundry' },
]

const EXEMPTION_STATUS_OPTIONS: SelectPickerOption[] = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'REVOKED', label: 'Dicabut' },
]

const WALLET_MODE_OPTIONS: SelectPickerOption[] = [
  { value: 'SUMMARY', label: 'Rekap Saldo Santri' },
  { value: 'MUTATION', label: 'Buku Besar Mutasi' },
]

const TAB_CONFIGS: Array<{
  id: ReportType
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'PENERIMAAN', label: 'Penerimaan', icon: Receipt },
  { id: 'PENYALURAN', label: 'Penyaluran', icon: SendHorizontal },
  { id: 'PENUNGGAK', label: 'Penunggak', icon: AlertCircle },
  { id: 'PEMBEBASAN', label: 'Dibebaskan', icon: Award },
  { id: 'DETAIL_SANTRI', label: 'Detail Santri', icon: UserCheck },
  { id: 'UANG_JAJAN', label: 'Uang Jajan', icon: Wallet },
  { id: 'TRANSAKSI_LOKET', label: 'Sesi Loket', icon: Coins },
  { id: 'SETTLEMENT', label: 'Settlement', icon: Landmark },
  { id: 'REKONSILIASI', label: 'Rekonsiliasi', icon: Scale },
]

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  valueClassName = 'text-slate-900',
  iconClassName = 'text-slate-500',
}: {
  label: string
  value: string | number
  subtext: string
  icon: React.ComponentType<{ className?: string }>
  valueClassName?: string
  iconClassName?: string
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div>
        <div className="flex items-center justify-between gap-2 text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
          <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden="true" />
        </div>
        <div className={`mt-2.5 text-2xl font-bold tracking-tight tabular-nums ${valueClassName}`}>
          {value}
        </div>
      </div>
      <div className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">{subtext}</div>
    </div>
  )
}

export default function LaporanKeuanganContent({
  filterOptions,
  initialReceipts,
}: LaporanKeuanganContentProps) {
  const [activeTab, setActiveTab] = useState<ReportType>('PENERIMAAN')
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Filter States
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [period, setPeriod] = useState('')
  const [asrama, setAsrama] = useState('ALL')
  const [kelas, setKelas] = useState('ALL')
  const [itemType, setItemType] = useState('ALL')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(filterOptions.students[0]?.id || '')
  const [studentSubTab, setStudentSubTab] = useState<'OBLIGATIONS' | 'PAYMENTS' | 'WALLET'>('OBLIGATIONS')
  const [walletMode, setWalletMode] = useState<'SUMMARY' | 'MUTATION'>('SUMMARY')
  const [operatorId, setOperatorId] = useState('ALL')
  const [recipientType, setRecipientType] = useState('ALL')
  const [providerId, setProviderId] = useState('ALL')
  const [exemptionStatus, setExemptionStatus] = useState<'ACTIVE' | 'REVOKED' | 'ALL'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Report Data States
  const [receiptsData, setReceiptsData] = useState<ReceiptsReportResponse>(initialReceipts)
  const [distributionsData, setDistributionsData] = useState<DistributionsReportResponse | null>(null)
  const [arrearsData, setArrearsData] = useState<ArrearsReportResponse | null>(null)
  const [exemptionsData, setExemptionsData] = useState<ExemptionsReportResponse | null>(null)
  const [studentDetailData, setStudentDetailData] = useState<StudentDetailReportResponse | null>(null)
  const [walletData, setWalletData] = useState<WalletReportResponse | null>(null)
  const [cashSessionsData, setCashSessionsData] = useState<CashSessionsReportResponse | null>(null)
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<CashSessionDetailReportResponse | null>(null)
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false)
  const [settlementsData, setSettlementsData] = useState<SettlementsReportResponse | null>(null)
  const [reconciliationsData, setReconciliationsData] = useState<ReconciliationsReportResponse | null>(null)

  const searchId = useId()
  const periodId = useId()
  const startDateId = useId()
  const endDateId = useId()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Dropdown Options
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

  const itemTypeOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Pos Biaya' },
      ...filterOptions.itemTypes.map((it) => ({ value: it.code, label: it.label })),
    ],
    [filterOptions.itemTypes]
  )

  const operatorOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Kasir' },
      ...filterOptions.operators.map((op) => ({ value: op.id, label: op.name })),
    ],
    [filterOptions.operators]
  )

  const providerOptions = useMemo<SelectPickerOption[]>(() => {
    const filtered =
      recipientType === 'KATERING' || recipientType === 'LAUNDRY'
        ? filterOptions.providers.filter((p) => p.type.toUpperCase() === recipientType)
        : filterOptions.providers
    return [
      { value: 'ALL', label: 'Semua Penyedia' },
      ...filtered.map((p) => ({ value: p.id, label: p.name })),
    ]
  }, [filterOptions.providers, recipientType])

  // Client-side filtered students list for DETAIL_SANTRI tab
  const filteredStudentOptions = useMemo<SelectPickerOption[]>(() => {
    const q = search.trim().toLowerCase()
    const list = filterOptions.students.filter((st) => {
      if (asrama !== 'ALL' && st.asrama !== asrama) return false
      if (!q) return true
      return st.name.toLowerCase().includes(q) || st.nis.toLowerCase().includes(q)
    })
    return list.map((st) => ({
      value: st.id,
      label: `${st.name} (${st.nis}${st.asrama ? ` · ${st.asrama}` : ''})`,
    }))
  }, [filterOptions.students, asrama, search])

  const buildBaseFilter = (page: number, size: number, overrides?: FilterOverrides) => {
    const effSearch = overrides?.search !== undefined ? overrides.search : search
    const effStartDate = overrides?.startDate !== undefined ? overrides.startDate : startDate
    const effEndDate = overrides?.endDate !== undefined ? overrides.endDate : endDate
    const effPeriod = overrides?.period !== undefined ? overrides.period : period
    const effAsrama = overrides?.asrama !== undefined ? overrides.asrama : asrama
    const effKelas = overrides?.kelas !== undefined ? overrides.kelas : kelas

    return {
      search: effSearch || undefined,
      startDate: effStartDate || undefined,
      endDate: effEndDate || undefined,
      period: effPeriod || undefined,
      asrama: effAsrama !== 'ALL' ? effAsrama : undefined,
      kelas: effKelas !== 'ALL' ? effKelas : undefined,
      page,
      pageSize: size,
    }
  }

  const loadReportData = (
    tab: ReportType = activeTab,
    page: number = currentPage,
    size: number = pageSize,
    overrides?: FilterOverrides
  ) => {
    const effItemType = overrides?.itemType !== undefined ? overrides.itemType : itemType
    const effRecipientType = overrides?.recipientType !== undefined ? overrides.recipientType : recipientType
    const effProviderId = overrides?.providerId !== undefined ? overrides.providerId : providerId
    const effExemptionStatus = overrides?.exemptionStatus !== undefined ? overrides.exemptionStatus : exemptionStatus
    const effStudentId = overrides?.selectedStudentId !== undefined ? overrides.selectedStudentId : selectedStudentId
    const effPeriod = overrides?.period !== undefined ? overrides.period : period
    const effWalletMode = overrides?.walletMode !== undefined ? overrides.walletMode : walletMode
    const effOperatorId = overrides?.operatorId !== undefined ? overrides.operatorId : operatorId

    startTransition(async () => {
      try {
        setErrorMessage(null)
        const baseFilter = buildBaseFilter(page, size, overrides)

        if (tab === 'PENERIMAAN') {
          setReceiptsData(
            await fetchReceiptsReport({
              ...baseFilter,
              itemType: effItemType !== 'ALL' ? effItemType : undefined,
            })
          )
        } else if (tab === 'PENYALURAN') {
          setDistributionsData(
            await fetchDistributionsReport({
              ...baseFilter,
              recipientType:
                effRecipientType !== 'ALL'
                  ? (effRecipientType as 'BENDAHARA_PESANTREN' | 'KATERING' | 'LAUNDRY')
                  : undefined,
              providerId: effProviderId !== 'ALL' ? effProviderId : undefined,
            })
          )
        } else if (tab === 'PENUNGGAK') {
          setArrearsData(
            await fetchArrearsReport({
              ...baseFilter,
              itemType: effItemType !== 'ALL' ? effItemType : undefined,
            })
          )
        } else if (tab === 'PEMBEBASAN') {
          setExemptionsData(
            await fetchExemptionsReport({
              ...baseFilter,
              status: effExemptionStatus,
              itemType: effItemType !== 'ALL' ? effItemType : undefined,
            })
          )
        } else if (tab === 'DETAIL_SANTRI') {
          setStudentDetailData(
            await fetchStudentDetailReport({
              santriId: effStudentId || undefined,
              period: effPeriod || undefined,
            })
          )
        } else if (tab === 'UANG_JAJAN') {
          setWalletData(
            await fetchWalletReport({
              ...baseFilter,
              mode: effWalletMode,
            })
          )
        } else if (tab === 'TRANSAKSI_LOKET') {
          setCashSessionsData(
            await fetchCashSessionsReport({
              ...baseFilter,
              operatorId: effOperatorId !== 'ALL' ? effOperatorId : undefined,
            })
          )
        } else if (tab === 'SETTLEMENT') {
          setSettlementsData(await fetchSettlementsReport(baseFilter))
        } else if (tab === 'REKONSILIASI') {
          setReconciliationsData(await fetchReconciliationsReport(baseFilter))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Laporan belum dapat dimuat. Silakan coba lagi.'
        setErrorMessage(msg)
        toast.error(msg)
      }
    })
  }

  const handleTabChange = (newTab: ReportType) => {
    setActiveTab(newTab)
    setCurrentPage(1)
    setShowAdvancedFilters(false)
    loadReportData(newTab, 1, pageSize)
  }

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TAB_CONFIGS.length
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TAB_CONFIGS.length) % TAB_CONFIGS.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = TAB_CONFIGS.length - 1
    if (nextIdx !== null) {
      e.preventDefault()
      tabRefs.current[nextIdx]?.focus()
    }
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (activeTab === 'DETAIL_SANTRI') return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1)
      loadReportData(activeTab, 1, pageSize, { search: val })
    }, 350)
  }

  const handleResetFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const defaultStudentId = filterOptions.students[0]?.id || ''
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPeriod('')
    setAsrama('ALL')
    setKelas('ALL')
    setItemType('ALL')
    setOperatorId('ALL')
    setRecipientType('ALL')
    setProviderId('ALL')
    setExemptionStatus('ALL')
    setSelectedStudentId(defaultStudentId)
    setCurrentPage(1)
    loadReportData(activeTab, 1, pageSize, {
      search: '',
      startDate: '',
      endDate: '',
      period: '',
      asrama: 'ALL',
      kelas: 'ALL',
      itemType: 'ALL',
      operatorId: 'ALL',
      recipientType: 'ALL',
      providerId: 'ALL',
      exemptionStatus: 'ALL',
      selectedStudentId: defaultStudentId,
    })
  }

  const handleOpenSessionDetail = async (sessionId: string) => {
    setLoadingSessionDetail(true)
    try {
      const detail = await fetchCashSessionDetailReport(sessionId)
      if (!detail) {
        toast.warning('Data sesi kasir tidak ditemukan.')
      } else {
        setSelectedSessionDetail(detail)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat detail sesi kasir.')
    } finally {
      setLoadingSessionDetail(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Menyiapkan berkas Excel…')
    try {
      const filterSummary = `Asrama: ${asrama === 'ALL' ? 'Semua' : asrama} | Kelas: ${
        kelas === 'ALL' ? 'Semua' : kelas
      } | Periode: ${period ? formatPeriodLabel(period) : 'Semua'}`

      const notify = (exported: number, totalRecords: number, truncated: boolean) => {
        if (exported === 0) {
          toast.warning('Tidak ada data yang cocok dengan filter untuk diekspor.', { id: toastId })
          return
        }
        if (truncated) {
          toast.warning(
            `Ekspor dibatasi ${exported.toLocaleString('id-ID')} baris dari total ${totalRecords.toLocaleString('id-ID')} baris. Persempit filter untuk data lengkap.`,
            { id: toastId, duration: 8000 }
          )
          return
        }
        toast.success(`Ekspor Excel selesai: ${exported.toLocaleString('id-ID')} baris.`, { id: toastId })
      }

      if (activeTab === 'PENERIMAAN') {
        const { items, totalRecords, truncated } = await fetchReceiptsForExport({
          ...buildBaseFilter(1, pageSize),
          itemType: itemType !== 'ALL' ? itemType : undefined,
        })
        await exportReceiptsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'PENYALURAN') {
        const { items, totalRecords, truncated } = await fetchDistributionsForExport({
          ...buildBaseFilter(1, pageSize),
          recipientType:
            recipientType !== 'ALL'
              ? (recipientType as 'BENDAHARA_PESANTREN' | 'KATERING' | 'LAUNDRY')
              : undefined,
          providerId: providerId !== 'ALL' ? providerId : undefined,
        })
        await exportDistributionsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'PENUNGGAK') {
        const { items, totalRecords, truncated } = await fetchArrearsForExport({
          ...buildBaseFilter(1, pageSize),
          itemType: itemType !== 'ALL' ? itemType : undefined,
        })
        await exportArrearsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'PEMBEBASAN') {
        const { items, totalRecords, truncated } = await fetchExemptionsForExport({
          ...buildBaseFilter(1, pageSize),
          status: exemptionStatus,
          itemType: itemType !== 'ALL' ? itemType : undefined,
        })
        await exportExemptionsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'DETAIL_SANTRI') {
        const report =
          studentDetailData ??
          (await fetchStudentDetailReport({
            santriId: selectedStudentId,
            period: period || undefined,
          }))
        if (!report?.student) {
          toast.warning('Pilih santri terlebih dahulu sebelum mengekspor lembar keuangan.', { id: toastId })
        } else {
          await exportStudentDetailExcel(report)
          toast.success(`Ekspor Excel selesai: lembar keuangan ${report.student.nama}.`, { id: toastId })
        }
      } else if (activeTab === 'UANG_JAJAN') {
        const { items, totalRecords, truncated } = await fetchWalletForExport({
          ...buildBaseFilter(1, pageSize),
          mode: walletMode,
        })
        await exportWalletExcel(
          {
            mode: walletMode,
            summaryItems: walletMode === 'SUMMARY' ? (items as WalletSummaryRow[]) : [],
            mutationItems: walletMode === 'MUTATION' ? (items as WalletMutationRow[]) : [],
          },
          filterSummary
        )
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'TRANSAKSI_LOKET') {
        const { items, totalRecords, truncated } = await fetchCashSessionsForExport({
          ...buildBaseFilter(1, pageSize),
          operatorId: operatorId !== 'ALL' ? operatorId : undefined,
        })
        await exportCashSessionsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'SETTLEMENT') {
        const { items, totalRecords, truncated } = await fetchSettlementsForExport(buildBaseFilter(1, pageSize))
        await exportSettlementsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      } else if (activeTab === 'REKONSILIASI') {
        const { items, totalRecords, truncated } = await fetchReconciliationsForExport(
          buildBaseFilter(1, pageSize)
        )
        await exportReconciliationsExcel(items, filterSummary)
        notify(items.length, totalRecords, truncated)
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? `Ekspor Excel gagal: ${err.message}` : 'Ekspor Excel gagal. Coba lagi.',
        { id: toastId, duration: 8000 }
      )
    } finally {
      setIsExporting(false)
    }
  }

  // Hitung jumlah filter lanjutan aktif sesuai tab aktif
  const hasAdvancedSection = activeTab !== 'DETAIL_SANTRI' && activeTab !== 'SETTLEMENT' && activeTab !== 'REKONSILIASI'
  const advancedCount = useMemo(() => {
    if (activeTab === 'PENERIMAAN') {
      return (asrama !== 'ALL' ? 1 : 0) + (kelas !== 'ALL' ? 1 : 0) + (period ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)
    }
    if (activeTab === 'PENYALURAN') {
      return (providerId !== 'ALL' ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)
    }
    if (activeTab === 'PENUNGGAK') {
      return (kelas !== 'ALL' ? 1 : 0) + (period ? 1 : 0)
    }
    if (activeTab === 'PEMBEBASAN') {
      return (asrama !== 'ALL' ? 1 : 0) + (kelas !== 'ALL' ? 1 : 0)
    }
    if (activeTab === 'UANG_JAJAN') {
      return (
        (kelas !== 'ALL' ? 1 : 0) +
        (walletMode === 'MUTATION' ? (startDate ? 1 : 0) + (endDate ? 1 : 0) : 0)
      )
    }
    if (activeTab === 'TRANSAKSI_LOKET') {
      return (startDate ? 1 : 0) + (endDate ? 1 : 0)
    }
    return 0
  }, [activeTab, asrama, kelas, period, startDate, endDate, providerId, walletMode])

  const hasAnyActiveFilter =
    search.trim() !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    period !== '' ||
    asrama !== 'ALL' ||
    kelas !== 'ALL' ||
    itemType !== 'ALL' ||
    operatorId !== 'ALL' ||
    recipientType !== 'ALL' ||
    providerId !== 'ALL' ||
    exemptionStatus !== 'ALL'

  // Active pagination info
  const activePagination = useMemo(() => {
    if (activeTab === 'PENERIMAAN') return receiptsData.pagination
    if (activeTab === 'PENYALURAN') return distributionsData?.pagination
    if (activeTab === 'PENUNGGAK') return arrearsData?.pagination
    if (activeTab === 'PEMBEBASAN') return exemptionsData?.pagination
    if (activeTab === 'UANG_JAJAN') return walletData?.pagination
    if (activeTab === 'TRANSAKSI_LOKET') return cashSessionsData?.pagination
    if (activeTab === 'SETTLEMENT') return settlementsData?.pagination
    if (activeTab === 'REKONSILIASI') return reconciliationsData?.pagination
    return null
  }, [
    activeTab,
    receiptsData,
    distributionsData,
    arrearsData,
    exemptionsData,
    walletData,
    cashSessionsData,
    settlementsData,
    reconciliationsData,
  ])

  const totalPages = activePagination?.totalPages || 1
  const totalRecords = activePagination?.totalRecords || 0
  const rangeStart = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, totalRecords)

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      {/* 1. Header */}
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem] text-balance">
                Laporan Keuangan
              </h1>
              <button
                type="button"
                onClick={() => loadReportData(activeTab, currentPage, pageSize)}
                disabled={isPending}
                aria-label="Segarkan data laporan"
                className="sm:hidden inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>Segarkan</span>
              </button>
            </div>
            <p className="text-sm leading-5 text-slate-500 text-pretty">
              Rekap penerimaan, penyaluran, piutang, uang jajan, dan audit kas siap cetak maupun ekspor Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadReportData(activeTab, currentPage, pageSize)}
              disabled={isPending}
              aria-label="Segarkan data laporan"
              className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Segarkan</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex min-h-[40px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Cetak / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex-1 sm:flex-none inline-flex min-h-[40px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              <span>{isExporting ? 'Mengekspor…' : 'Ekspor Excel'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Accessible Horizontal Underline Tabs (bersih tanpa scrollbar abu-abu tebal) */}
      <div className="border-b border-slate-200">
        <div
          role="tablist"
          aria-label="Jenis laporan keuangan"
          className="-mb-px flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TAB_CONFIGS.map((tab, idx) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                onClick={() => handleTabChange(tab.id)}
                className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  isActive ? 'text-emerald-800' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-t-full bg-emerald-600" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      <div
        aria-busy={isPending}
        className={`space-y-5 transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}
      >
        {/* 3. KPI Summary Cards (4 kartu seragam, tampil di atas fold) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {activeTab === 'PENERIMAAN' && (
            <>
              <KpiCard
                label="Total Penerimaan Bruto"
                value={formatRupiah(receiptsData.kpi.totalGross)}
                subtext={`${receiptsData.kpi.totalTransactions} transaksi sesuai filter`}
                icon={Receipt}
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Penerimaan Bersih"
                value={formatRupiah(receiptsData.kpi.totalNet)}
                subtext="Kas riil diterima pesantren & titipan"
                icon={CheckCircle2}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Pendapatan Koperasi"
                value={formatRupiah(receiptsData.kpi.totalFee + receiptsData.kpi.totalUniqueCode)}
                subtext={`Admin ${formatRupiah(receiptsData.kpi.totalFee)} · Kode unik ${formatRupiah(receiptsData.kpi.totalUniqueCode)}`}
                icon={Coins}
                iconClassName="text-slate-600"
              />
              <KpiCard
                label="Penerimaan Tunai Loket"
                value={formatRupiah(receiptsData.kpi.cashGross)}
                subtext={`BRIVA ${formatRupiah(Math.max(0, receiptsData.kpi.onlineGross - receiptsData.kpi.transferGross))} · Transfer ${formatRupiah(receiptsData.kpi.transferGross)}`}
                icon={Banknote}
                iconClassName="text-slate-600"
              />
            </>
          )}

          {activeTab === 'PENYALURAN' && (
            <>
              <KpiCard
                label="Total Dana Disalurkan"
                value={formatRupiah(distributionsData?.kpi.totalDisbursed || 0)}
                subtext={`${distributionsData?.kpi.totalDistributionsCount || 0} catatan penyaluran`}
                icon={SendHorizontal}
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Bendahara Pesantren"
                value={formatRupiah(distributionsData?.kpi.totalBendahara || 0)}
                subtext="SPP & biaya pesantren"
                icon={Landmark}
              />
              <KpiCard
                label="Katering"
                value={formatRupiah(distributionsData?.kpi.totalKatering || 0)}
                subtext="Hak uang makan santri"
                icon={Coins}
              />
              <KpiCard
                label="Laundry"
                value={formatRupiah(distributionsData?.kpi.totalLaundry || 0)}
                subtext="Hak uang nyuci santri"
                icon={Coins}
              />
            </>
          )}

          {activeTab === 'PENUNGGAK' && (
            <>
              <KpiCard
                label="Total Piutang Tertunggak"
                value={formatRupiah(arrearsData?.kpi.totalArrears || 0)}
                subtext="Sisa kewajiban belum lunas"
                icon={AlertCircle}
                valueClassName="text-rose-700"
                iconClassName="text-rose-600"
              />
              <KpiCard
                label="Santri Menunggak"
                value={`${arrearsData?.kpi.uniqueStudentsCount || 0} santri`}
                subtext="Santri aktif dengan tunggakan"
                icon={Users}
              />
              <KpiCard
                label="Jumlah Tagihan"
                value={`${arrearsData?.kpi.totalObligations || 0} item`}
                subtext="Pos tagihan belum lunas"
                icon={Receipt}
              />
              <KpiCard
                label="Rata-rata per Santri"
                value={formatRupiah(arrearsData?.kpi.averageArrearsPerStudent || 0)}
                subtext="Estimasi tunggakan per santri"
                icon={Scale}
              />
            </>
          )}

          {activeTab === 'PEMBEBASAN' && (
            <>
              <KpiCard
                label="Pembebasan Aktif"
                value={`${exemptionsData?.kpi.activeExemptionsCount || 0} data`}
                subtext="Berlaku saat ini"
                icon={Award}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Total Keringanan"
                value={formatRupiah(exemptionsData?.kpi.totalNominalExempted || 0)}
                subtext="Akumulasi nominal dibebaskan"
                icon={Coins}
              />
              <KpiCard
                label="Pembebasan Dicabut"
                value={`${exemptionsData?.kpi.revokedExemptionsCount || 0} data`}
                subtext="Sudah tidak aktif"
                icon={AlertCircle}
                valueClassName="text-amber-700"
                iconClassName="text-amber-600"
              />
              <KpiCard
                label="Santri Penerima"
                value={`${exemptionsData?.kpi.uniqueStudentsCount || 0} santri`}
                subtext="Santri dengan keringanan"
                icon={Users}
              />
            </>
          )}

          {activeTab === 'DETAIL_SANTRI' && (
            <>
              <KpiCard
                label="Total Kewajiban"
                value={formatRupiah(studentDetailData?.summary.totalExpected || 0)}
                subtext={`Keringanan: ${formatRupiah(studentDetailData?.summary.totalExempted || 0)}`}
                icon={Receipt}
              />
              <KpiCard
                label="Telah Terbayar"
                value={formatRupiah(studentDetailData?.summary.totalPaid || 0)}
                subtext="Akumulasi pembayaran lunas"
                icon={CheckCircle2}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Sisa Tagihan"
                value={formatRupiah(studentDetailData?.summary.totalRemaining || 0)}
                subtext="Sisa kewajiban belum lunas"
                icon={AlertCircle}
                valueClassName={(studentDetailData?.summary.totalRemaining || 0) > 0 ? 'text-rose-700' : 'text-slate-900'}
                iconClassName={(studentDetailData?.summary.totalRemaining || 0) > 0 ? 'text-rose-600' : 'text-slate-500'}
              />
              <KpiCard
                label="Saldo Uang Jajan"
                value={formatRupiah(studentDetailData?.summary.walletBalance || 0)}
                subtext="Dana titipan santri"
                icon={Wallet}
                iconClassName="text-indigo-600"
              />
            </>
          )}

          {activeTab === 'UANG_JAJAN' && (
            <>
              <KpiCard
                label="Total Saldo Titipan"
                value={formatRupiah(walletData?.kpi.totalCurrentBalance || 0)}
                subtext="Dana titipan, bukan pendapatan pondok"
                icon={Wallet}
                iconClassName="text-indigo-600"
              />
              <KpiCard
                label="Total Setoran Masuk"
                value={formatRupiah(walletData?.kpi.totalDepositIn || 0)}
                subtext="Top-up online & setoran loket"
                icon={Coins}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Total Pencairan Bersih"
                value={formatRupiah(walletData?.kpi.totalWithdrawalOut || 0)}
                subtext="Setelah dikurangi pembatalan kolektif"
                icon={Banknote}
              />
              <KpiCard
                label="Jumlah Mutasi"
                value={`${walletData?.kpi.totalMutationsCount || 0} baris`}
                subtext="Catatan buku besar sesuai filter"
                icon={Receipt}
              />
            </>
          )}

          {activeTab === 'TRANSAKSI_LOKET' && (
            <>
              <KpiCard
                label="Total Sesi Kasir"
                value={`${cashSessionsData?.kpi.totalSessionsCount || 0} sesi`}
                subtext="Sesi loket Koperasi"
                icon={Coins}
              />
              <KpiCard
                label="Total Kas Masuk"
                value={formatRupiah(cashSessionsData?.kpi.totalCashInAllSessions || 0)}
                subtext="Tagihan, top-up & ambil bank"
                icon={Banknote}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Total Kas Keluar"
                value={formatRupiah(cashSessionsData?.kpi.totalCashOutAllSessions || 0)}
                subtext="Pencairan jajan, refund & setor bank"
                icon={SendHorizontal}
              />
              <KpiCard
                label="Selisih Kas Fisik"
                value={formatRupiah(cashSessionsData?.kpi.totalDifference || 0)}
                subtext={`${cashSessionsData?.kpi.discrepancySessionsCount || 0} sesi memiliki selisih`}
                icon={Scale}
                valueClassName={(cashSessionsData?.kpi.totalDifference || 0) === 0 ? 'text-slate-900' : 'text-rose-700'}
                iconClassName={(cashSessionsData?.kpi.totalDifference || 0) === 0 ? 'text-slate-500' : 'text-rose-600'}
              />
            </>
          )}

          {activeTab === 'SETTLEMENT' && (
            <>
              <KpiCard
                label="Batch Settlement"
                value={`${settlementsData?.kpi.totalSettlementBatches || 0} batch`}
                subtext="Arsip pencairan bank"
                icon={Landmark}
              />
              <KpiCard
                label="Bruto Settlement"
                value={formatRupiah(settlementsData?.kpi.totalGrossSettled || 0)}
                subtext="Termasuk admin Koperasi"
                icon={Coins}
              />
              <KpiCard
                label="Potongan Settlement"
                value={formatRupiah(settlementsData?.kpi.totalFeeDeducted || 0)}
                subtext="Bukan biaya BRI yang dibayar wali"
                icon={Scale}
              />
              <KpiCard
                label="Net Masuk Rekening"
                value={formatRupiah(settlementsData?.kpi.totalNetReceived || 0)}
                subtext="Hak salur tetap mengikuti alokasi"
                icon={CheckCircle2}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
            </>
          )}

          {activeTab === 'REKONSILIASI' && (
            <>
              <KpiCard
                label="Item Cocok"
                value={reconciliationsData?.kpi.totalMatchedItems || 0}
                subtext="Pembayaran cocok rekening bank"
                icon={CheckCircle2}
                valueClassName="text-emerald-700"
                iconClassName="text-emerald-700"
              />
              <KpiCard
                label="Perlu Pemeriksaan"
                value={reconciliationsData?.kpi.totalDiscrepancyItems || 0}
                subtext="Selisih atau belum dialokasi"
                icon={AlertCircle}
                valueClassName={(reconciliationsData?.kpi.totalDiscrepancyItems || 0) > 0 ? 'text-rose-700' : 'text-slate-900'}
                iconClassName={(reconciliationsData?.kpi.totalDiscrepancyItems || 0) > 0 ? 'text-rose-600' : 'text-slate-500'}
              />
              <KpiCard
                label="Nominal Selisih"
                value={formatRupiah(reconciliationsData?.kpi.totalDiscrepancyAmount || 0)}
                subtext="Total selisih pencocokan"
                icon={Scale}
                valueClassName={(reconciliationsData?.kpi.totalDiscrepancyAmount || 0) > 0 ? 'text-amber-700' : 'text-slate-900'}
              />
              <KpiCard
                label="Diselesaikan"
                value={reconciliationsData?.kpi.totalResolvedItems || 0}
                subtext="Dengan catatan audit lengkap"
                icon={Award}
              />
            </>
          )}
        </div>

        {/* Rincian Bulanan Pendapatan Koperasi (ringkas di bawah KPI tab Penerimaan) */}
        {activeTab === 'PENERIMAAN' && <CooperativeIncomeCard />}

        {/* 4. Toolbar Filter Ramping & Kontekstual */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
          {activeTab === 'DETAIL_SANTRI' ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-end text-xs">
              <div className="lg:col-span-3">
                <label htmlFor={searchId} className="mb-1 block font-semibold text-slate-600">
                  Saring Daftar Santri
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    id={searchId}
                    type="text"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Ketik nama atau NIS…"
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian santri"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2">
                <span className="mb-1 block font-semibold text-slate-600">Asrama</span>
                <SelectPicker
                  value={asrama}
                  options={asramaOptions}
                  onChange={(val) => setAsrama(val)}
                  ariaLabel="Saring asrama santri"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-5">
                <span className="mb-1 block font-semibold text-slate-600">
                  Pilih Santri ({filteredStudentOptions.length})
                </span>
                <SelectPicker
                  value={selectedStudentId}
                  options={
                    filteredStudentOptions.length > 0
                      ? filteredStudentOptions
                      : [{ value: '', label: 'Tidak ada santri cocok' }]
                  }
                  onChange={(val) => {
                    if (!val) return
                    setSelectedStudentId(val)
                    loadReportData('DETAIL_SANTRI', 1, pageSize, { selectedStudentId: val })
                  }}
                  ariaLabel="Pilih santri"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor={periodId} className="mb-1 block font-semibold text-slate-600">
                  Periode Tagihan
                </label>
                <input
                  id={periodId}
                  type="month"
                  value={period}
                  onChange={(e) => {
                    const val = e.target.value
                    setPeriod(val)
                    loadReportData('DETAIL_SANTRI', 1, pageSize, { period: val })
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                    setCurrentPage(1)
                    loadReportData(activeTab, 1, pageSize, { search })
                  }}
                  className="relative flex-1"
                >
                  <label htmlFor={searchId} className="sr-only">
                    Pencarian laporan
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id={searchId}
                    type="text"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={
                      activeTab === 'PENYALURAN'
                        ? 'Cari no. penyaluran, penerima, catatan…'
                        : activeTab === 'TRANSAKSI_LOKET'
                          ? 'Cari kode sesi, nama kasir, catatan…'
                          : activeTab === 'SETTLEMENT'
                            ? 'Cari no. settlement, bank, rekening…'
                            : activeTab === 'REKONSILIASI'
                              ? 'Cari referensi bank, nama santri, catatan…'
                              : 'Cari NIS, nama santri, no. bukti…'
                    }
                    className="min-h-[42px] sm:min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian"
                      onClick={() => {
                        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                        setSearch('')
                        setCurrentPage(1)
                        loadReportData(activeTab, 1, pageSize, { search: '' })
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </form>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  {/* Primary Contextual Filters */}
                  {(activeTab === 'PENERIMAAN' || activeTab === 'PENUNGGAK' || activeTab === 'PEMBEBASAN') && (
                    <SelectPicker
                      value={itemType}
                      options={itemTypeOptions}
                      onChange={(val) => {
                        setItemType(val)
                        setCurrentPage(1)
                        loadReportData(activeTab, 1, pageSize, { itemType: val })
                      }}
                      ariaLabel="Filter pos biaya"
                      className="w-full sm:w-auto [&>button]:w-full"
                    />
                  )}

                  {activeTab === 'PENUNGGAK' && (
                    <SelectPicker
                      value={asrama}
                      options={asramaOptions}
                      onChange={(val) => {
                        setAsrama(val)
                        setCurrentPage(1)
                        loadReportData(activeTab, 1, pageSize, { asrama: val })
                      }}
                      ariaLabel="Filter asrama"
                      className="w-full sm:w-auto [&>button]:w-full"
                    />
                  )}

                  {activeTab === 'PEMBEBASAN' && (
                    <SelectPicker
                      value={exemptionStatus}
                      options={EXEMPTION_STATUS_OPTIONS}
                      onChange={(val) => {
                        const next = val as 'ACTIVE' | 'REVOKED' | 'ALL'
                        setExemptionStatus(next)
                        setCurrentPage(1)
                        loadReportData(activeTab, 1, pageSize, { exemptionStatus: next })
                      }}
                      ariaLabel="Filter status pembebasan"
                      className="w-full sm:w-auto [&>button]:w-full"
                    />
                  )}

                  {activeTab === 'PENYALURAN' && (
                    <SelectPicker
                      value={recipientType}
                      options={RECIPIENT_OPTIONS}
                      onChange={(val) => {
                        setRecipientType(val)
                        setProviderId('ALL')
                        setCurrentPage(1)
                        loadReportData(activeTab, 1, pageSize, { recipientType: val, providerId: 'ALL' })
                      }}
                      ariaLabel="Filter penerima penyaluran"
                      className="w-full sm:w-auto [&>button]:w-full"
                    />
                  )}

                  {activeTab === 'UANG_JAJAN' && (
                    <>
                      <SelectPicker
                        value={walletMode}
                        options={WALLET_MODE_OPTIONS}
                        onChange={(val) => {
                          const next = val as 'SUMMARY' | 'MUTATION'
                          setWalletMode(next)
                          setCurrentPage(1)
                          loadReportData('UANG_JAJAN', 1, pageSize, { walletMode: next })
                        }}
                        ariaLabel="Mode tampilan uang jajan"
                        className="w-full sm:w-auto [&>button]:w-full"
                      />
                      <SelectPicker
                        value={asrama}
                        options={asramaOptions}
                        onChange={(val) => {
                          setAsrama(val)
                          setCurrentPage(1)
                          loadReportData('UANG_JAJAN', 1, pageSize, { asrama: val })
                        }}
                        ariaLabel="Filter asrama"
                        className="w-full sm:w-auto [&>button]:w-full"
                      />
                    </>
                  )}

                  {activeTab === 'TRANSAKSI_LOKET' && (
                    <SelectPicker
                      value={operatorId}
                      options={operatorOptions}
                      onChange={(val) => {
                        setOperatorId(val)
                        setCurrentPage(1)
                        loadReportData('TRANSAKSI_LOKET', 1, pageSize, { operatorId: val })
                      }}
                      ariaLabel="Filter kasir"
                      className="w-full sm:w-auto [&>button]:w-full"
                    />
                  )}

                  {(activeTab === 'SETTLEMENT' || activeTab === 'REKONSILIASI') && (
                    <>
                      <input
                        type="date"
                        aria-label="Dari tanggal"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value)
                          setCurrentPage(1)
                          loadReportData(activeTab, 1, pageSize, { startDate: e.target.value })
                        }}
                        className="min-h-[42px] sm:min-h-[38px] w-full sm:w-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                      <input
                        type="date"
                        aria-label="Sampai tanggal"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value)
                          setCurrentPage(1)
                          loadReportData(activeTab, 1, pageSize, { endDate: e.target.value })
                        }}
                        className="min-h-[42px] sm:min-h-[38px] w-full sm:w-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </>
                  )}

                  {hasAdvancedSection && (
                    <button
                      type="button"
                      aria-expanded={showAdvancedFilters}
                      onClick={() => setShowAdvancedFilters((v) => !v)}
                      className={`inline-flex min-h-[42px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        showAdvancedFilters || advancedCount > 0
                          ? 'border-emerald-300 bg-emerald-50/60 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Filter Lainnya</span>
                      {advancedCount > 0 && (
                        <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                          {advancedCount}
                        </span>
                      )}
                    </button>
                  )}

                  {hasAnyActiveFilter && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="col-span-2 sm:col-span-1 inline-flex min-h-[42px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Lanjutan (Collapsible) */}
              {hasAdvancedSection && showAdvancedFilters && (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
                  {(activeTab === 'PENERIMAAN' || activeTab === 'PEMBEBASAN') && (
                    <div>
                      <span className="mb-1 block font-semibold text-slate-600">Asrama</span>
                      <SelectPicker
                        value={asrama}
                        options={asramaOptions}
                        onChange={(val) => {
                          setAsrama(val)
                          setCurrentPage(1)
                          loadReportData(activeTab, 1, pageSize, { asrama: val })
                        }}
                        ariaLabel="Filter asrama"
                        className="w-full [&>button]:w-full"
                      />
                    </div>
                  )}

                  {(activeTab === 'PENERIMAAN' ||
                    activeTab === 'PENUNGGAK' ||
                    activeTab === 'PEMBEBASAN' ||
                    activeTab === 'UANG_JAJAN') && (
                    <div>
                      <span className="mb-1 block font-semibold text-slate-600">Kelas</span>
                      <SelectPicker
                        value={kelas}
                        options={kelasOptions}
                        onChange={(val) => {
                          setKelas(val)
                          setCurrentPage(1)
                          loadReportData(activeTab, 1, pageSize, { kelas: val })
                        }}
                        ariaLabel="Filter kelas"
                        className="w-full [&>button]:w-full"
                      />
                    </div>
                  )}

                  {activeTab === 'PENYALURAN' && (
                    <div>
                      <span className="mb-1 block font-semibold text-slate-600">Penyedia Jasa</span>
                      <SelectPicker
                        value={providerId}
                        options={providerOptions}
                        onChange={(val) => {
                          setProviderId(val)
                          setCurrentPage(1)
                          loadReportData('PENYALURAN', 1, pageSize, { providerId: val })
                        }}
                        ariaLabel="Filter penyedia jasa"
                        className="w-full [&>button]:w-full"
                      />
                    </div>
                  )}

                  {(activeTab === 'PENERIMAAN' || activeTab === 'PENUNGGAK') && (
                    <div>
                      <label htmlFor={periodId} className="mb-1 block font-semibold text-slate-600">
                        Periode Bulan
                      </label>
                      <input
                        id={periodId}
                        type="month"
                        value={period}
                        onChange={(e) => {
                          setPeriod(e.target.value)
                          setCurrentPage(1)
                          loadReportData(activeTab, 1, pageSize, { period: e.target.value })
                        }}
                        className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  )}

                  {(activeTab === 'PENERIMAAN' ||
                    activeTab === 'PENYALURAN' ||
                    activeTab === 'TRANSAKSI_LOKET' ||
                    (activeTab === 'UANG_JAJAN' && walletMode === 'MUTATION')) && (
                    <>
                      <div>
                        <label htmlFor={startDateId} className="mb-1 block font-semibold text-slate-600">
                          Dari Tanggal
                        </label>
                        <input
                          id={startDateId}
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value)
                            setCurrentPage(1)
                            loadReportData(activeTab, 1, pageSize, { startDate: e.target.value })
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
                            loadReportData(activeTab, 1, pageSize, { endDate: e.target.value })
                          }}
                          className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 5. Konten Data (Mobile Card View + Desktop Table) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {/* ── TAB 1: PENERIMAAN ──────────────────────────────────────────── */}
          {activeTab === 'PENERIMAAN' && (
            <>
              {receiptsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Tidak ada transaksi penerimaan pada kriteria filter ini.
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {receiptsData.items.map((row) => {
                      const ch = formatPaymentChannel(row.channel)
                      const st = formatPaymentStatus(row.status)
                      const alloc = formatAllocationsSummary(row.allocationsSummary)
                      return (
                        <div key={`m-r-${row.id}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {row.santriName}
                              </div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {row.santriNis} · {row.santriAsrama || '—'}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatRupiah(row.netAmount)}
                              </div>
                              {row.gatewayFee > 0 && (
                                <div className="text-[10px] text-slate-500 tabular-nums">
                                  Admin Kop. {formatRupiah(row.gatewayFee)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 line-clamp-2" title={alloc.full}>
                            {alloc.display}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                            <span className="tabular-nums">
                              {formatFinanceDate(row.paidAt, true)} ·{' '}
                              <span className="font-mono text-slate-700">{row.paymentNumber}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${ch.className}`}>
                                {ch.label}
                              </span>
                              <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${st.className}`}>
                                {st.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">No. Pembayaran</th>
                          <th className="py-3 px-3">Waktu (WIB)</th>
                          <th className="py-3 px-3">Santri</th>
                          <th className="py-3 px-3">Saluran</th>
                          <th className="py-3 px-3">Alokasi Pos</th>
                          <th className="py-3 px-3 text-right">Nominal</th>
                          <th className="py-3 px-3 text-right">Admin Koperasi</th>
                          <th className="py-3 px-3 text-right">Bersih</th>
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptsData.items.map((row, idx) => {
                          const ch = formatPaymentChannel(row.channel)
                          const st = formatPaymentStatus(row.status)
                          const alloc = formatAllocationsSummary(row.allocationsSummary)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                                {row.paymentNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                {formatFinanceDate(row.paidAt, true)}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{row.santriName}</div>
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  {row.santriNis} · {row.santriAsrama || '—'}
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${ch.className}`}>
                                  {ch.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={alloc.full}>
                                {alloc.display}
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.grossAmount)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.gatewayFee)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.netAmount)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB 2: PENYALURAN ──────────────────────────────────────────── */}
          {activeTab === 'PENYALURAN' && distributionsData && (
            <>
              {distributionsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Tidak ada transaksi penyaluran pada kriteria filter ini.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {distributionsData.items.map((row) => {
                      const st = formatDistributionStatus(row.status)
                      return (
                        <div key={`m-d-${row.id}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {row.recipientName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatRecipientType(row.recipientType)} · {formatDistributionMethod(row.method)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatRupiah(row.amount)}
                              </div>
                              <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${st.className}`}>
                                {st.label}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-600">{formatItemsCsv(row.itemsSummary)}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                            <span>{formatFinanceDate(row.reportDate, true)}</span>
                            <span className="font-mono text-slate-700">{row.distributionNumber}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">No. Penyaluran</th>
                          <th className="py-3 px-3">Waktu (WIB)</th>
                          <th className="py-3 px-3">Penerima</th>
                          <th className="py-3 px-3">Metode &amp; Rekening</th>
                          <th className="py-3 px-3">Rincian Pos</th>
                          <th className="py-3 px-3 text-right">Nominal</th>
                          <th className="py-3 px-3">Petugas</th>
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {distributionsData.items.map((row, idx) => {
                          const st = formatDistributionStatus(row.status)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                                {row.distributionNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                {formatFinanceDate(row.reportDate, true)}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{row.recipientName}</div>
                                <div className="text-[11px] text-slate-500">
                                  {formatRecipientType(row.recipientType)}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                <div className="font-medium text-slate-800">{formatDistributionMethod(row.method)}</div>
                                {row.method !== 'CASH' && (row.destinationBank || row.destinationAccount) && (
                                  <div className="text-[11px] text-slate-500 tabular-nums">
                                    {[row.destinationBank, row.destinationAccount].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-600">{formatItemsCsv(row.itemsSummary)}</td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.amount)}
                              </td>
                              <td className="py-3 px-3 text-slate-600">{row.operatorName || '—'}</td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB 3: PENUNGGAK ───────────────────────────────────────────── */}
          {activeTab === 'PENUNGGAK' && arrearsData && (
            <>
              {arrearsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Tidak ada santri menunggak pada kriteria filter ini.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {arrearsData.items.map((row) => (
                      <div key={`m-a-${row.obligationId}`} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{row.santriName}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {row.santriNis} · {row.santriAsrama || '—'}
                              {row.santriKelas ? ` · ${row.santriKelas}` : ''}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-rose-700 tabular-nums">
                              {formatRupiah(row.remaining)}
                            </div>
                            <div className="text-[10px] text-slate-500">Sisa tunggakan</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span className="font-medium text-slate-800">{row.itemLabel}</span>
                          <span>{formatPeriodLabel(row.period)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                          <span>
                            Tagihan {formatRupiah(row.amountExpected)} · Bayar {formatRupiah(row.amountPaid)}
                          </span>
                          <span>{row.noWaOrtu || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">Santri</th>
                          <th className="py-3 px-3">Periode</th>
                          <th className="py-3 px-3">Pos Tagihan</th>
                          <th className="py-3 px-3 text-right">Kewajiban</th>
                          <th className="py-3 px-3 text-right">Keringanan</th>
                          <th className="py-3 px-3 text-right">Terbayar</th>
                          <th className="py-3 px-3 text-right text-rose-700">Sisa Tunggakan</th>
                          <th className="py-3 px-3">Kontak Wali</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {arrearsData.items.map((row, idx) => (
                          <tr key={row.obligationId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                              {(currentPage - 1) * pageSize + idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">{row.santriName}</div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {row.santriNis} · {row.santriAsrama || '—'} · {row.santriKelas || '—'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {formatPeriodLabel(row.period)}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-800">{row.itemLabel}</td>
                            <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                              {formatRupiah(row.amountExpected)}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                              {formatRupiah(row.amountExempted)}
                            </td>
                            <td className="py-3 px-3 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                              {formatRupiah(row.amountPaid)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums whitespace-nowrap">
                              {formatRupiah(row.remaining)}
                            </td>
                            <td className="py-3 px-3 text-slate-600 tabular-nums whitespace-nowrap">
                              {row.noWaOrtu || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB 4: SANTRI DIBEBASKAN ───────────────────────────────────── */}
          {activeTab === 'PEMBEBASAN' && exemptionsData && (
            <>
              {exemptionsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Tidak ada data pembebasan biaya pada kriteria ini.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {exemptionsData.items.map((row) => {
                      const st = formatExemptionStatus(row.status)
                      return (
                        <div key={`m-e-${row.id}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{row.santriName}</div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {row.santriNis} · {row.santriAsrama || '—'}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold text-emerald-700 tabular-nums">
                                {formatRupiah(row.totalExemptedAmount)}
                              </div>
                              <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${st.className}`}>
                                {st.label}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-700">
                            <span className="font-medium">{row.itemLabel}</span> — {row.reason}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {row.periodStart ? formatPeriodLabel(row.periodStart) : 'Awal'} s.d.{' '}
                              {row.periodEnd ? formatPeriodLabel(row.periodEnd) : 'Seterusnya'}
                            </span>
                            <span>Oleh: {row.createdByName || '—'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">Santri</th>
                          <th className="py-3 px-3">Pos Biaya</th>
                          <th className="py-3 px-3">Periode Berlaku</th>
                          <th className="py-3 px-3">Alasan Pembebasan</th>
                          <th className="py-3 px-3 text-right">Nominal Terbebas</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          <th className="py-3 px-3">Diberikan Oleh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exemptionsData.items.map((row, idx) => {
                          const st = formatExemptionStatus(row.status)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{row.santriName}</div>
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  {row.santriNis} · {row.santriAsrama || '—'}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-800">{row.itemLabel}</td>
                              <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                {row.periodStart ? formatPeriodLabel(row.periodStart) : 'Awal'} s.d.{' '}
                                {row.periodEnd ? formatPeriodLabel(row.periodEnd) : 'Seterusnya'}
                              </td>
                              <td className="py-3 px-3 text-slate-700">{row.reason}</td>
                              <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.totalExemptedAmount)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600">{row.createdByName || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB 5: DETAIL PER SANTRI ───────────────────────────────────── */}
          {activeTab === 'DETAIL_SANTRI' && (
            !studentDetailData?.student ? (
              <div className="py-12 px-4 text-center text-xs text-slate-500">
                Pilih santri di atas untuk melihat rincian tagihan, pembayaran, dan uang jajan.
              </div>
            ) : (
              <div className="p-4 sm:p-5 space-y-5">
                {/* Profil Santri */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{studentDetailData.student.nama}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                      NIS <strong className="text-slate-800">{studentDetailData.student.nis}</strong> · Asrama{' '}
                      <strong>{studentDetailData.student.asrama || '—'}</strong>
                      {studentDetailData.student.kamar ? ` / ${studentDetailData.student.kamar}` : ''} · Kelas{' '}
                      <strong>{studentDetailData.student.kelas || '—'}</strong>
                    </p>
                    {studentDetailData.student.fixedVa && (
                      <p className="mt-1 text-[11px] text-slate-500 font-mono">
                        Fixed BRIVA: {studentDetailData.student.fixedVa}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <div className="text-[11px] text-slate-500">Saldo Uang Jajan</div>
                    <div className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatRupiah(studentDetailData.student.walletBalance)}
                    </div>
                  </div>
                </div>

                {/* Sub-tabs Tagihan / Pembayaran / Mutasi */}
                <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {(
                    [
                      { key: 'OBLIGATIONS', label: `Tagihan (${studentDetailData.obligations.length})` },
                      { key: 'PAYMENTS', label: `Pembayaran (${studentDetailData.payments.length})` },
                      { key: 'WALLET', label: `Mutasi Uang Jajan (${studentDetailData.walletMutations.length})` },
                    ] as const
                  ).map((st) => {
                    const active = studentSubTab === st.key
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setStudentSubTab(st.key)}
                        className={`relative shrink-0 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                          active ? 'text-emerald-800' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {st.label}
                        {active && (
                          <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-t-full bg-emerald-600" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Sub-tab 1: Tagihan */}
                {studentSubTab === 'OBLIGATIONS' && (
                  studentDetailData.obligations.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">Belum ada data tagihan santri.</div>
                  ) : (
                    <>
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 md:hidden">
                        {studentDetailData.obligations.map((ob) => {
                          const st = formatObligationStatus(ob.status)
                          return (
                            <div key={`m-ob-${ob.id}`} className="p-3.5 space-y-1.5 text-xs">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-slate-900">{ob.itemLabel}</div>
                                  <div className="text-[11px] text-slate-500">{formatPeriodLabel(ob.period)}</div>
                                </div>
                                <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-600 tabular-nums">
                                <span>Tagihan {formatRupiah(ob.amountExpected)}</span>
                                <span>Terbayar {formatRupiah(ob.amountPaid)}</span>
                                <strong className={ob.remaining > 0 ? 'text-rose-700' : 'text-slate-900'}>
                                  Sisa {formatRupiah(ob.remaining)}
                                </strong>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Periode</th>
                              <th className="py-2.5 px-3">Pos Tagihan</th>
                              <th className="py-2.5 px-3 text-right">Tagihan</th>
                              <th className="py-2.5 px-3 text-right">Keringanan</th>
                              <th className="py-2.5 px-3 text-right">Terbayar</th>
                              <th className="py-2.5 px-3 text-right">Sisa</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {studentDetailData.obligations.map((ob) => {
                              const st = formatObligationStatus(ob.status)
                              return (
                                <tr key={ob.id} className="hover:bg-slate-50/70">
                                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                    {formatPeriodLabel(ob.period)}
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-slate-900">{ob.itemLabel}</td>
                                  <td className="py-2.5 px-3 text-right tabular-nums">{formatRupiah(ob.amountExpected)}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                                    {formatRupiah(ob.amountExempted)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-emerald-700 tabular-nums">
                                    {formatRupiah(ob.amountPaid)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                                    {formatRupiah(ob.remaining)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                      {st.label}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                )}

                {/* Sub-tab 2: Riwayat Pembayaran */}
                {studentSubTab === 'PAYMENTS' && (
                  studentDetailData.payments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">Belum ada riwayat pembayaran santri.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Waktu (WIB)</th>
                            <th className="py-2.5 px-3">No. Pembayaran</th>
                            <th className="py-2.5 px-3">Metode</th>
                            <th className="py-2.5 px-3">Alokasi</th>
                            <th className="py-2.5 px-3 text-right">Nominal</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentDetailData.payments.map((p) => {
                            const st = formatPaymentStatus(p.status)
                            const alloc = formatAllocationsSummary(p.allocationsSummary)
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                  {formatFinanceDate(p.paidAt, true)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                                  {p.paymentNumber}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                                  {formatPaymentMethod(p.method)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={alloc.full}>
                                  {alloc.display}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                  {formatRupiah(p.netAmount)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                    {st.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* Sub-tab 3: Mutasi Uang Jajan */}
                {studentSubTab === 'WALLET' && (
                  studentDetailData.walletMutations.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">Belum ada mutasi uang jajan santri.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Waktu (WIB)</th>
                            <th className="py-2.5 px-3">Jenis Mutasi</th>
                            <th className="py-2.5 px-3 text-right">Nominal</th>
                            <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                            <th className="py-2.5 px-3">Petugas</th>
                            <th className="py-2.5 px-3">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentDetailData.walletMutations.map((w) => {
                            const isIn = w.direction === 'IN'
                            return (
                              <tr key={w.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                  {formatFinanceDate(w.createdAt, true)}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                                  {formatWalletMovement(w.movementType)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                                    isIn ? 'text-emerald-700' : 'text-slate-900'
                                  }`}
                                >
                                  {isIn ? '+' : '-'} {formatRupiah(w.amount)}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                                  {formatRupiah(w.balanceAfter)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">{w.operatorName || '—'}</td>
                                <td className="py-2.5 px-3 text-slate-500">{w.notes || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )
          )}

          {/* ── TAB 6: UANG JAJAN ──────────────────────────────────────────── */}
          {activeTab === 'UANG_JAJAN' && walletData && (
            <>
              {walletData.mode === 'SUMMARY' && walletData.summaryItems && (
                walletData.summaryItems.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-slate-500">
                    Tidak ada data saldo santri pada kriteria filter ini.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100 md:hidden">
                      {walletData.summaryItems.map((row) => (
                        <div key={`m-ws-${row.santriId}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{row.santriName}</div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {row.santriNis} · {row.santriAsrama || '—'}
                                {row.santriKelas ? ` · ${row.santriKelas}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatRupiah(row.currentBalance)}
                              </div>
                              <div className="text-[10px] text-slate-500">Saldo saat ini</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                            <span>
                              Setor <strong className="text-emerald-700">{formatRupiah(row.totalIn)}</strong> · Tarik{' '}
                              <strong className="text-slate-700">{formatRupiah(row.totalOut)}</strong>
                            </span>
                            <span>Limit {formatRupiah(row.effectiveDailyLimit)}/hari</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3 text-center w-10">No</th>
                            <th className="py-3 px-3">Santri</th>
                            <th className="py-3 px-3 text-right">Total Setoran</th>
                            <th className="py-3 px-3 text-right">Total Pencairan</th>
                            <th className="py-3 px-3 text-right">Saldo Saat Ini</th>
                            <th className="py-3 px-3 text-right">Limit Harian Efektif</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {walletData.summaryItems.map((row, idx) => (
                            <tr key={row.santriId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{row.santriName}</div>
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  {row.santriNis} · {row.santriAsrama || '—'}
                                  {row.santriKelas ? ` · ${row.santriKelas}` : ''}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.totalIn)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.totalOut)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.currentBalance)}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                <div className="font-medium text-slate-700 tabular-nums">
                                  {formatRupiah(row.effectiveDailyLimit)}/hari
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {row.parentDailyLimit !== null ? 'Limit khusus wali' : 'Limit global pesantren'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              )}

              {walletData.mode === 'MUTATION' && walletData.mutationItems && (
                walletData.mutationItems.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-slate-500">
                    Tidak ada mutasi buku besar pada kriteria ini.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100 md:hidden">
                      {walletData.mutationItems.map((row) => {
                        const isIn = row.direction === 'IN'
                        return (
                          <div key={`m-wm-${row.id}`} className="p-4 space-y-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">{row.santriName}</div>
                                <div className="text-xs text-slate-600">
                                  {formatWalletMovement(row.movementType)}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div
                                  className={`text-sm font-bold tabular-nums ${
                                    isIn ? 'text-emerald-700' : 'text-slate-900'
                                  }`}
                                >
                                  {isIn ? '+' : '-'} {formatRupiah(row.amount)}
                                </div>
                                <div className="text-[10px] text-slate-500 tabular-nums">
                                  Saldo {formatRupiah(row.balanceAfter)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                              <span>{formatFinanceDate(row.createdAt, true)}</span>
                              <span>{row.operatorName || 'Sistem'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3 text-center w-10">No</th>
                            <th className="py-3 px-3">Waktu (WIB)</th>
                            <th className="py-3 px-3">Santri</th>
                            <th className="py-3 px-3">Jenis Mutasi</th>
                            <th className="py-3 px-3 text-right">Nominal</th>
                            <th className="py-3 px-3 text-right">Saldo Sesudah</th>
                            <th className="py-3 px-3">Petugas / Sesi</th>
                            <th className="py-3 px-3">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {walletData.mutationItems.map((row, idx) => {
                            const isIn = row.direction === 'IN'
                            return (
                              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                  {(currentPage - 1) * pageSize + idx + 1}
                                </td>
                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                  {formatFinanceDate(row.createdAt, true)}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-slate-900">{row.santriName}</div>
                                  <div className="text-[11px] text-slate-500 tabular-nums">{row.santriNis}</div>
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                                  {formatWalletMovement(row.movementType)}
                                </td>
                                <td
                                  className={`py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                                    isIn ? 'text-emerald-700' : 'text-slate-900'
                                  }`}
                                >
                                  {isIn ? '+' : '-'} {formatRupiah(row.amount)}
                                </td>
                                <td className="py-3 px-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                                  {formatRupiah(row.balanceAfter)}
                                </td>
                                <td className="py-3 px-3 text-slate-600">
                                  <div>{row.operatorName || '—'}</div>
                                  {row.cashSessionCode && (
                                    <div className="text-[10px] text-slate-400 font-mono">{row.cashSessionCode}</div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-slate-500">{row.notes || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              )}
            </>
          )}

          {/* ── TAB 7: TRANSAKSI LOKET ─────────────────────────────────────── */}
          {activeTab === 'TRANSAKSI_LOKET' && cashSessionsData && (
            <>
              {cashSessionsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Tidak ada data sesi kas loket pada kriteria filter ini.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {cashSessionsData.items.map((row) => {
                      const st = formatCashSessionStatus(row.status)
                      return (
                        <div key={`m-cs-${row.id}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-mono text-sm font-bold text-slate-900">{row.sessionCode}</div>
                              <div className="text-xs text-slate-600">{row.operatorName}</div>
                            </div>
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            Buka: {formatFinanceDate(row.openedAt, true)}
                            {row.closedAt ? ` · Tutup: ${formatFinanceDate(row.closedAt, true)}` : ''}
                          </div>
                          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-[11px] tabular-nums">
                            <div>
                              <span className="block text-slate-500">Masuk</span>
                              <strong className="text-emerald-700">{formatRupiah(row.totalCashIn)}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-500">Keluar</span>
                              <strong className="text-slate-900">{formatRupiah(row.totalCashOut)}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-500">Selisih</span>
                              <strong className={(row.difference || 0) === 0 ? 'text-slate-800' : 'text-rose-700'}>
                                {row.difference !== null ? formatRupiah(row.difference) : '—'}
                              </strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenSessionDetail(row.id)}
                            disabled={loadingSessionDetail}
                            className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            <span>Lihat Rincian Sesi</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">Kode Sesi</th>
                          <th className="py-3 px-3">Kasir</th>
                          <th className="py-3 px-3">Buka / Tutup (WIB)</th>
                          <th className="py-3 px-3 text-right">Saldo Awal</th>
                          <th className="py-3 px-3 text-right">Kas Masuk</th>
                          <th className="py-3 px-3 text-right">Kas Keluar</th>
                          <th className="py-3 px-3 text-right">Seharusnya</th>
                          <th className="py-3 px-3 text-right">Fisik</th>
                          <th className="py-3 px-3 text-right">Selisih</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          <th className="py-3 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cashSessionsData.items.map((row, idx) => {
                          const st = formatCashSessionStatus(row.status)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                {row.sessionCode}
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-900">{row.operatorName}</td>
                              <td className="py-3 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                <div>{formatFinanceDate(row.openedAt, true)}</div>
                                <div className="text-[10px] text-slate-400">
                                  {row.closedAt ? formatFinanceDate(row.closedAt, true) : 'Sedang terbuka'}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.openingBalance)}
                              </td>
                              <td className="py-3 px-3 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.totalCashIn)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-700 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.totalCashOut)}
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-slate-900 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.expectedClosingBalance)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-900 tabular-nums whitespace-nowrap">
                                {row.actualClosingBalance !== null ? formatRupiah(row.actualClosingBalance) : '—'}
                              </td>
                              <td
                                className={`py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                                  (row.difference || 0) === 0 ? 'text-slate-700' : 'text-rose-700'
                                }`}
                              >
                                {row.difference !== null ? formatRupiah(row.difference) : '—'}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSessionDetail(row.id)}
                                  disabled={loadingSessionDetail}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                                >
                                  <Eye className="h-3 w-3 text-slate-500" aria-hidden="true" />
                                  <span>Detail</span>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB 8: SETTLEMENT ──────────────────────────────────────────── */}
          {activeTab === 'SETTLEMENT' && settlementsData && (
            <>
              {settlementsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Belum ada batch settlement bank pada kriteria filter ini.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {settlementsData.items.map((row) => {
                      const st = formatSettlementStatus(row.status)
                      return (
                        <div key={`m-st-${row.id}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-mono text-sm font-bold text-slate-900">{row.settlementNumber}</div>
                              <div className="text-xs text-slate-600">
                                {row.destinationBank} · {row.destinationAccount}
                              </div>
                            </div>
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs tabular-nums">
                            <span className="text-slate-500">
                              {row.settlementDate} · {row.itemCount} trx
                            </span>
                            <strong className="text-emerald-700">{formatRupiah(row.netAmount)}</strong>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">No. Settlement</th>
                          <th className="py-3 px-3">Tanggal</th>
                          <th className="py-3 px-3">Rekening Bank</th>
                          <th className="py-3 px-3 text-center">Jml Trx</th>
                          <th className="py-3 px-3 text-right">Bruto</th>
                          <th className="py-3 px-3 text-right">Potongan</th>
                          <th className="py-3 px-3 text-right">Net Masuk</th>
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {settlementsData.items.map((row, idx) => {
                          const st = formatSettlementStatus(row.status)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                                {row.settlementNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                {row.settlementDate}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">
                                  {row.destinationBank} · {row.destinationAccount}
                                </div>
                                <div className="text-[11px] text-slate-500">{row.accountHolderName}</div>
                              </td>
                              <td className="py-3 px-3 text-center tabular-nums">{row.itemCount}</td>
                              <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                                {formatRupiah(row.grossAmount)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.totalFee)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                                {formatRupiah(row.netAmount)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB 9: REKONSILIASI ────────────────────────────────────────── */}
          {activeTab === 'REKONSILIASI' && reconciliationsData && (
            <>
              {reconciliationsData.items.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  Tidak ada catatan rekonsiliasi pada kriteria ini.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {reconciliationsData.items.map((row) => {
                      const st = formatMatchStatus(row.matchStatus)
                      return (
                        <div key={`m-rec-${row.id}`} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-semibold text-slate-900 truncate">
                                {row.externalReference || 'Tanpa Referensi'}
                              </div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {formatFinanceDate(row.createdAt, true)}
                              </div>
                            </div>
                            <span className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-[11px] tabular-nums">
                            <div>
                              <span className="block text-slate-500">Sistem</span>
                              <strong className="text-slate-900">{formatRupiah(row.internalAmount)}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-500">Bank</span>
                              <strong className="text-slate-900">{formatRupiah(row.externalAmount)}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-500">Selisih</span>
                              <strong className={row.discrepancyAmount !== 0 ? 'text-rose-700' : 'text-slate-700'}>
                                {formatRupiah(row.discrepancyAmount)}
                              </strong>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{formatResolutionAction(row.resolutionAction)}</span>
                            <span>{row.resolvedByName || '—'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3">Waktu (WIB)</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          <th className="py-3 px-3">Referensi Bank</th>
                          <th className="py-3 px-3 text-right">Sistem</th>
                          <th className="py-3 px-3 text-right">Rekening Bank</th>
                          <th className="py-3 px-3 text-right">Selisih</th>
                          <th className="py-3 px-3">Tindakan</th>
                          <th className="py-3 px-3">Penyelesai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reconciliationsData.items.map((row, idx) => {
                          const st = formatMatchStatus(row.matchStatus)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 tabular-nums">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                                {formatFinanceDate(row.createdAt, true)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-700">{row.externalReference || '—'}</td>
                              <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                                {formatRupiah(row.internalAmount)}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                                {formatRupiah(row.externalAmount)}
                              </td>
                              <td
                                className={`py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                                  row.discrepancyAmount !== 0 ? 'text-rose-700' : 'text-slate-700'
                                }`}
                              >
                                {formatRupiah(row.discrepancyAmount)}
                              </td>
                              <td className="py-3 px-3 text-slate-700">
                                {formatResolutionAction(row.resolutionAction)}
                              </td>
                              <td className="py-3 px-3 text-slate-600">{row.resolvedByName || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* 6. Inline Single-Fetch Pagination (disembunyikan pada tab Detail Santri) */}
          {activeTab !== 'DETAIL_SANTRI' && activePagination && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/40 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-slate-600 tabular-nums">
                <span>
                  Menampilkan <strong className="text-slate-900">{rangeStart}–{rangeEnd}</strong> dari{' '}
                  <strong className="text-slate-900">{totalRecords.toLocaleString('id-ID')}</strong> data
                </span>
                <SelectPicker
                  value={String(pageSize)}
                  options={PAGE_SIZE_OPTIONS}
                  onChange={(val) => {
                    const nextSize = Number(val)
                    setPageSize(nextSize)
                    setCurrentPage(1)
                    loadReportData(activeTab, 1, nextSize)
                  }}
                  ariaLabel="Jumlah baris per halaman"
                  placement="top"
                  align="left"
                  className="w-28"
                />
              </div>

              {totalPages > 1 && (
                <nav aria-label="Navigasi halaman laporan" className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Halaman pertama"
                    disabled={currentPage <= 1 || isPending}
                    onClick={() => {
                      setCurrentPage(1)
                      loadReportData(activeTab, 1, pageSize)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Halaman sebelumnya"
                    disabled={currentPage <= 1 || isPending}
                    onClick={() => {
                      const prev = currentPage - 1
                      setCurrentPage(prev)
                      loadReportData(activeTab, prev, pageSize)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {getPageRange(currentPage, totalPages).map((entry, idx) =>
                    entry === '...' ? (
                      <span key={`dots-${idx}`} className="px-1.5 text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={entry}
                        type="button"
                        aria-current={entry === currentPage ? 'page' : undefined}
                        disabled={isPending}
                        onClick={() => {
                          setCurrentPage(entry)
                          loadReportData(activeTab, entry, pageSize)
                        }}
                        className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                          entry === currentPage
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {entry}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    aria-label="Halaman berikutnya"
                    disabled={currentPage >= totalPages || isPending}
                    onClick={() => {
                      const next = currentPage + 1
                      setCurrentPage(next)
                      loadReportData(activeTab, next, pageSize)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Halaman terakhir"
                    disabled={currentPage >= totalPages || isPending}
                    onClick={() => {
                      setCurrentPage(totalPages)
                      loadReportData(activeTab, totalPages, pageSize)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </nav>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Print Preview Modals */}
      <ReportPrintModals
        activeTab={activeTab}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        asrama={asrama}
        kelas={kelas}
        period={period}
        startDate={startDate}
        endDate={endDate}
        itemType={itemType}
        exemptionStatus={exemptionStatus}
        receiptsData={receiptsData}
        distributionsData={distributionsData}
        arrearsData={arrearsData}
        exemptionsData={exemptionsData}
        studentDetailData={studentDetailData}
        walletData={walletData}
        cashSessionsData={cashSessionsData}
        settlementsData={settlementsData}
        reconciliationsData={reconciliationsData}
      />

      {/* Modal Detail Sesi Kasir (termasuk Mutasi Kas Bank ↔ Tunai) */}
      <CashSessionDetailModal
        key={selectedSessionDetail?.session.id ?? 'closed'}
        detail={selectedSessionDetail}
        onClose={() => setSelectedSessionDetail(null)}
      />
    </div>
  )
}
