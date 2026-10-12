'use client'

// app/dashboard/keuangan/laporan/_page-content.tsx
// Antarmuka Modul Laporan & Cetak Ekspor Keuangan (Fase 10: PRD Bab 34, 40, 42)

import React, { useState, useTransition, useId } from 'react'
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
  Filter,
  Eye,
  X,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import Pagination from '@/components/ui/pagination'
import ReportPrintableView from '@/components/finance/report-printable-view'
import { toast } from 'sonner'
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
  ExemptionItemRow,
  StudentDetailReportResponse,
  StudentDetailObligationRow,
  WalletReportResponse,
  WalletSummaryRow,
  WalletMutationRow,
  CashSessionsReportResponse,
  CashSessionItemRow,
  CashSessionDetailReportResponse,
  SettlementsReportResponse,
  SettlementItemRow,
  ReconciliationsReportResponse,
  ReconciliationReportRow,
} from '@/lib/finance/reports'

interface LaporanKeuanganContentProps {
  filterOptions: ReportFilterOptions
  initialReceipts: ReceiptsReportResponse
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

export default function LaporanKeuanganContent({
  filterOptions,
  initialReceipts,
}: LaporanKeuanganContentProps) {
  // ── 1. ACTIVE REPORT TAB STATE ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ReportType>('PENERIMAAN')
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  // ── 2. FILTER STATES ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [period, setPeriod] = useState('')
  const [asrama, setAsrama] = useState('ALL')
  const [kelas, setKelas] = useState('ALL')
  const [itemType, setItemType] = useState('ALL')
  const [academicYearId, setAcademicYearId] = useState<number | undefined>(undefined)
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    filterOptions.students[0]?.id || ''
  )
  const [walletMode, setWalletMode] = useState<'SUMMARY' | 'MUTATION'>('SUMMARY')
  const [operatorId, setOperatorId] = useState('ALL')
  const [recipientType, setRecipientType] = useState('ALL')
  const [providerId, setProviderId] = useState('ALL')
  const [exemptionStatus, setExemptionStatus] = useState<'ACTIVE' | 'REVOKED' | 'ALL'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ── 3. REPORT DATA STATES ───────────────────────────────────────────────────
  const [receiptsData, setReceiptsData] = useState<ReceiptsReportResponse>(initialReceipts)
  const [distributionsData, setDistributionsData] = useState<DistributionsReportResponse | null>(null)
  const [arrearsData, setArrearsData] = useState<ArrearsReportResponse | null>(null)
  const [exemptionsData, setExemptionsData] = useState<ExemptionsReportResponse | null>(null)
  const [studentDetailData, setStudentDetailData] = useState<StudentDetailReportResponse | null>(null)
  const [walletData, setWalletData] = useState<WalletReportResponse | null>(null)
  const [cashSessionsData, setCashSessionsData] = useState<CashSessionsReportResponse | null>(null)
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<CashSessionDetailReportResponse | null>(null)
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false)
  const [activeSessionTab, setActiveSessionTab] = useState<'PAYMENTS' | 'TOPUPS' | 'WITHDRAWALS' | 'REFUNDS'>('PAYMENTS')
  const [settlementsData, setSettlementsData] = useState<SettlementsReportResponse | null>(null)
  const [reconciliationsData, setReconciliationsData] = useState<ReconciliationsReportResponse | null>(null)

  const handleOpenSessionDetail = async (sessionId: string) => {
    setLoadingSessionDetail(true)
    try {
      const detail = await fetchCashSessionDetailReport(sessionId)
      setSelectedSessionDetail(detail)
      setActiveSessionTab('PAYMENTS')
    } catch (err) {
      console.error('Failed to load session detail', err)
    } finally {
      setLoadingSessionDetail(false)
    }
  }

  // ── 4. RELOAD DATA ACTION ───────────────────────────────────────────────────
  /**
   * Filter dasar yang dipakai bersama oleh tabel (server-side) dan ekspor Excel,
   * sehingga berkas yang diunduh selalu memakai kriteria yang sama dengan tampilan.
   */
  const buildBaseFilter = (page: number, size: number) => ({
    search,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    period: period || undefined,
    asrama: asrama !== 'ALL' ? asrama : undefined,
    kelas: kelas !== 'ALL' ? kelas : undefined,
    academicYearId,
    page,
    pageSize: size,
  })

  const loadReportData = (
    tab: ReportType = activeTab,
    page: number = currentPage,
    size: number = pageSize
  ) => {
    startTransition(async () => {
      const baseFilter = buildBaseFilter(page, size)

      if (tab === 'PENERIMAAN') {
        const res = await fetchReceiptsReport({
          ...baseFilter,
          itemType: itemType !== 'ALL' ? itemType : undefined,
        })
        setReceiptsData(res)
      } else if (tab === 'PENYALURAN') {
        const res = await fetchDistributionsReport({
          ...baseFilter,
          recipientType: recipientType !== 'ALL' ? (recipientType as 'BENDAHARA_PESANTREN' | 'KATERING' | 'LAUNDRY') : undefined,
          providerId: providerId !== 'ALL' ? providerId : undefined,
        })
        setDistributionsData(res)
      } else if (tab === 'PENUNGGAK') {
        const res = await fetchArrearsReport({
          ...baseFilter,
          itemType: itemType !== 'ALL' ? itemType : undefined,
        })
        setArrearsData(res)
      } else if (tab === 'PEMBEBASAN') {
        const res = await fetchExemptionsReport({
          ...baseFilter,
          status: exemptionStatus,
          itemType: itemType !== 'ALL' ? itemType : undefined,
        })
        setExemptionsData(res)
      } else if (tab === 'DETAIL_SANTRI') {
        const res = await fetchStudentDetailReport({
          santriId: selectedStudentId,
          academicYearId,
          period: period || undefined,
        })
        setStudentDetailData(res)
      } else if (tab === 'UANG_JAJAN') {
        const res = await fetchWalletReport({
          ...baseFilter,
          mode: walletMode,
        })
        setWalletData(res)
      } else if (tab === 'TRANSAKSI_LOKET') {
        const res = await fetchCashSessionsReport({
          ...baseFilter,
          operatorId: operatorId !== 'ALL' ? operatorId : undefined,
        })
        setCashSessionsData(res)
      } else if (tab === 'SETTLEMENT') {
        const res = await fetchSettlementsReport(baseFilter)
        setSettlementsData(res)
      } else if (tab === 'REKONSILIASI') {
        const res = await fetchReconciliationsReport(baseFilter)
        setReconciliationsData(res)
      }
    })
  }

  const handleTabChange = (newTab: ReportType) => {
    setActiveTab(newTab)
    setCurrentPage(1)
    loadReportData(newTab, 1, pageSize)
  }

  const handleResetFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPeriod('')
    setAsrama('ALL')
    setKelas('ALL')
    setItemType('ALL')
    setAcademicYearId(undefined)
    setOperatorId('ALL')
    setRecipientType('ALL')
    setProviderId('ALL')
    setExemptionStatus('ALL')
    setCurrentPage(1)
    startTransition(async () => {
      const defaultFilter = { page: 1, pageSize }
      if (activeTab === 'PENERIMAAN') setReceiptsData(await fetchReceiptsReport(defaultFilter))
      else if (activeTab === 'PENYALURAN') setDistributionsData(await fetchDistributionsReport(defaultFilter))
      else if (activeTab === 'PENUNGGAK') setArrearsData(await fetchArrearsReport(defaultFilter))
      else if (activeTab === 'PEMBEBASAN') setExemptionsData(await fetchExemptionsReport(defaultFilter))
      else if (activeTab === 'DETAIL_SANTRI') setStudentDetailData(await fetchStudentDetailReport({ santriId: filterOptions.students[0]?.id }))
      else if (activeTab === 'UANG_JAJAN') setWalletData(await fetchWalletReport({ ...defaultFilter, mode: walletMode }))
      else if (activeTab === 'TRANSAKSI_LOKET') setCashSessionsData(await fetchCashSessionsReport(defaultFilter))
      else if (activeTab === 'SETTLEMENT') setSettlementsData(await fetchSettlementsReport(defaultFilter))
      else if (activeTab === 'REKONSILIASI') setReconciliationsData(await fetchReconciliationsReport(defaultFilter))
    })
  }

  // ── 5. EXPORT EXCEL HANDLER ─────────────────────────────────────────────────
  /**
   * Ekspor Excel memuat SELURUH baris hasil filter (bukan hanya halaman aktif),
   * diambil bertahap dari server agar query tetap ringan (PRD Bab 34 & 41).
   */
  const handleExportExcel = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Menyiapkan data ekspor...')
    try {
      const filterSummary = `Asrama: ${asrama} | Kelas: ${kelas} | Periode: ${period || 'Semua'}`

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
            academicYearId,
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
          { mode: walletMode, summaryItems: walletMode === 'SUMMARY' ? (items as WalletSummaryRow[]) : [], mutationItems: walletMode === 'MUTATION' ? (items as WalletMutationRow[]) : [] },
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
        err instanceof Error
          ? `Ekspor Excel gagal: ${err.message}`
          : 'Ekspor Excel gagal. Coba lagi.',
        { id: toastId, duration: 8000 }
      )
    } finally {
      setIsExporting(false)
    }
  }

  // ── 6. RENDER TABS CONFIG ───────────────────────────────────────────────────
  const tabConfigs = [
    { id: 'PENERIMAAN' as ReportType, label: 'Penerimaan', icon: Receipt },
    { id: 'PENYALURAN' as ReportType, label: 'Penyaluran', icon: SendHorizontal },
    { id: 'PENUNGGAK' as ReportType, label: 'Penunggak', icon: AlertCircle },
    { id: 'PEMBEBASAN' as ReportType, label: 'Santri Dibebaskan', icon: Award },
    { id: 'DETAIL_SANTRI' as ReportType, label: 'Detail per Santri', icon: UserCheck },
    { id: 'UANG_JAJAN' as ReportType, label: 'Uang Jajan', icon: Wallet },
    { id: 'TRANSAKSI_LOKET' as ReportType, label: 'Transaksi Loket', icon: Coins },
    { id: 'SETTLEMENT' as ReportType, label: 'Settlement', icon: Landmark },
    { id: 'REKONSILIASI' as ReportType, label: 'Rekonsiliasi', icon: Scale },
  ]

  // Pastikan setiap tab memiliki lembar cetak siap pakai (Fase 10: PRD Bab 34).
  // Jika data tab belum termuat, tombol Cetak / PDF tetap memberi umpan balik (lihat fallback modal).
  const isPrintViewAvailable =
    activeTab === 'PENERIMAAN' ||
    (activeTab === 'PENUNGGAK' && Boolean(arrearsData)) ||
    (activeTab === 'PENYALURAN' && Boolean(distributionsData)) ||
    (activeTab === 'UANG_JAJAN' && Boolean(walletData)) ||
    (activeTab === 'PEMBEBASAN' && Boolean(exemptionsData)) ||
    (activeTab === 'DETAIL_SANTRI' && Boolean(studentDetailData)) ||
    (activeTab === 'TRANSAKSI_LOKET' && Boolean(cashSessionsData)) ||
    (activeTab === 'SETTLEMENT' && Boolean(settlementsData)) ||
    (activeTab === 'REKONSILIASI' && Boolean(reconciliationsData))

  const searchId = useId()
  const asramaId = useId()
  const kelasId = useId()
  const itemTypeId = useId()
  const periodId = useId()

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER HALAMAN ────────────────────────────────────────────────── */}
      <DashboardPageHeader
        title="Laporan & Ekspor Keuangan"
        description="Pusat pelaporan finansial terpadu, lembar rekap siap cetak, dan ekspor spreadsheet terformat untuk operasional pesantren."
        action={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-sm font-medium transition-colors shadow-2xs hover:border-slate-400"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Cetak / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor Excel'}</span>
            </button>
          </div>
        }
      />

      {/* ── SEGMENTED TAB SELECTOR ────────────────────────────────────────── */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {tabConfigs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── KPI SUMMARY CARDS (ADAPTIF PER REPORT) ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {activeTab === 'PENERIMAAN' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Penerimaan Bruto</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(receiptsData.kpi.totalGross)}</p>
              <p className="text-[11px] text-slate-400 mt-1">{receiptsData.kpi.totalTransactions} transaksi</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Fee Payment Gateway</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(receiptsData.kpi.totalFee)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Online BRI</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Penerimaan Bersih (Neto)</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatRupiah(receiptsData.kpi.totalNet)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Kas riil diterima</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Penerimaan Tunai Loket</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{formatRupiah(receiptsData.kpi.cashGross)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Online: {formatRupiah(receiptsData.kpi.onlineGross)}</p>
            </div>
          </>
        )}

        {activeTab === 'PENYALURAN' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Dana Disalurkan</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(distributionsData?.kpi.totalDisbursed || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">{distributionsData?.kpi.totalDistributionsCount || 0} batch</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Penyaluran ke Bendahara</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(distributionsData?.kpi.totalBendahara || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">SPP & Biaya Pesantren</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Penyaluran Katering</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(distributionsData?.kpi.totalKatering || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Uang Makan Santri</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Penyaluran Laundry</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(distributionsData?.kpi.totalLaundry || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Uang Nyuci Santri</p>
            </div>
          </>
        )}

        {activeTab === 'PENUNGGAK' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Piutang Tertunggak</p>
              <p className="text-xl font-bold text-rose-700 mt-1">{formatRupiah(arrearsData?.kpi.totalArrears || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Sisa tagihan berjalan</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Jumlah Santri Menunggak</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{arrearsData?.kpi.uniqueStudentsCount || 0} Santri</p>
              <p className="text-[11px] text-slate-400 mt-1">Unique santri aktif</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Tagihan Tertunggak</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{arrearsData?.kpi.totalObligations || 0} Item</p>
              <p className="text-[11px] text-slate-400 mt-1">Kewajiban belum lunas</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Rata-rata per Santri</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(arrearsData?.kpi.averageArrearsPerStudent || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Estimasi beban santri</p>
            </div>
          </>
        )}

        {activeTab === 'PEMBEBASAN' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Pembebasan Aktif</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{exemptionsData?.kpi.activeExemptionsCount || 0} Santri</p>
              <p className="text-[11px] text-slate-400 mt-1">Status ACTIVE</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Keringanan Diberikan</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(exemptionsData?.kpi.totalNominalExempted || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Subsidi pesantren</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Pembebasan Dicabut</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{exemptionsData?.kpi.revokedExemptionsCount || 0} Record</p>
              <p className="text-[11px] text-slate-400 mt-1">Status REVOKED</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Santri Tercover</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{exemptionsData?.kpi.uniqueStudentsCount || 0} Orang</p>
              <p className="text-[11px] text-slate-400 mt-1">Penerima beasiswa</p>
            </div>
          </>
        )}

        {activeTab === 'DETAIL_SANTRI' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Kewajiban Tagihan</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(studentDetailData?.summary.totalExpected || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Keringanan: {formatRupiah(studentDetailData?.summary.totalExempted || 0)}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Telah Terbayar</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatRupiah(studentDetailData?.summary.totalPaid || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Akumulasi pembayaran</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Sisa Tagihan Belum Lunas</p>
              <p className="text-xl font-bold text-rose-700 mt-1">{formatRupiah(studentDetailData?.summary.totalRemaining || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Sisa kewajiban santri</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Saldo Uang Jajan Santri</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{formatRupiah(studentDetailData?.summary.walletBalance || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Dana titipan murni</p>
            </div>
          </>
        )}

        {activeTab === 'UANG_JAJAN' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Saldo Titipan Santri</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{formatRupiah(walletData?.kpi.totalCurrentBalance || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Bukan pendapatan pondok</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Setoran Masuk (IN)</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatRupiah(walletData?.kpi.totalDepositIn || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Top-up online & loket</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Penarikan Keluar (OUT)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(walletData?.kpi.totalWithdrawalOut || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pencairan uang jajan</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Aktivitas Transaksi Mutasi</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{walletData?.kpi.totalMutationsCount || 0} Baris</p>
              <p className="text-[11px] text-slate-400 mt-1">Histori mutasi buku besar</p>
            </div>
          </>
        )}

        {activeTab === 'TRANSAKSI_LOKET' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Sesi Kasir Loket</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{cashSessionsData?.kpi.totalSessionsCount || 0} Sesi</p>
              <p className="text-[11px] text-slate-400 mt-1">Operator kasir koperasi</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Kas Masuk (In)</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatRupiah(cashSessionsData?.kpi.totalCashInAllSessions || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pembayaran + Top-up</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Kas Keluar (Out)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(cashSessionsData?.kpi.totalCashOutAllSessions || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pencairan uang fisik</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Selisih Kas Fisik</p>
              <p className={`text-xl font-bold mt-1 ${
                (cashSessionsData?.kpi.totalDifference || 0) === 0 ? 'text-slate-900' : 'text-rose-700'
              }`}>
                {formatRupiah(cashSessionsData?.kpi.totalDifference || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">{cashSessionsData?.kpi.discrepancySessionsCount || 0} sesi ada selisih</p>
            </div>
          </>
        )}

        {activeTab === 'SETTLEMENT' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Batch Settlement</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{settlementsData?.kpi.totalSettlementBatches || 0} Batch</p>
              <p className="text-[11px] text-slate-400 mt-1">Pencairan bank</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Gross Pencairan BRI</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(settlementsData?.kpi.totalGrossSettled || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Nominal bruto transaksi</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Fee Terpotong</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(settlementsData?.kpi.totalFeeDeducted || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Biaya transaksi gateway</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Net Masuk Rekening</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatRupiah(settlementsData?.kpi.totalNetReceived || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Saldo efektif bank</p>
            </div>
          </>
        )}

        {activeTab === 'REKONSILIASI' && (
          <>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Item Cocok (Matched)</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{reconciliationsData?.kpi.totalMatchedItems || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">Sistem ↔ Gateway ↔ Bank</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Diskrepansi / Selisih</p>
              <p className="text-xl font-bold text-rose-700 mt-1">{reconciliationsData?.kpi.totalDiscrepancyItems || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">Perlu pemeriksaan</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Nominal Selisih</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{formatRupiah(reconciliationsData?.kpi.totalDiscrepancyAmount || 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Unallocated / mismatch</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Terselesaikan (Resolved)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{reconciliationsData?.kpi.totalResolvedItems || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">Audit trail lengkap</p>
            </div>
          </>
        )}
      </div>

      {/* ── CONTEXTUAL FILTER BAR ─────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Filter Laporan {tabConfigs.find((t) => t.id === activeTab)?.label}</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 text-xs">
          {/* 1. Search Box */}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={searchId} className="font-semibold text-slate-700">Pencarian Teks</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id={searchId}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NIS, nama santri, no. bukti..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
              />
            </div>
          </div>

          {/* 2. Asrama Filter */}
          {activeTab !== 'SETTLEMENT' && activeTab !== 'TRANSAKSI_LOKET' && activeTab !== 'PENYALURAN' && (
            <div className="space-y-1">
              <label htmlFor={asramaId} className="font-semibold text-slate-700">Asrama</label>
              <select
                id={asramaId}
                value={asrama}
                onChange={(e) => setAsrama(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
              >
                <option value="ALL">Semua Asrama</option>
                {filterOptions.asramaList.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Kelas Filter */}
          {activeTab !== 'SETTLEMENT' && activeTab !== 'TRANSAKSI_LOKET' && activeTab !== 'PENYALURAN' && (
            <div className="space-y-1">
              <label htmlFor={kelasId} className="font-semibold text-slate-700">Kelas</label>
              <select
                id={kelasId}
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
              >
                <option value="ALL">Semua Kelas</option>
                {filterOptions.kelasList.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Pos / Item Biaya Filter */}
          {(activeTab === 'PENERIMAAN' || activeTab === 'PENUNGGAK' || activeTab === 'PEMBEBASAN') && (
            <div className="space-y-1">
              <label htmlFor={itemTypeId} className="font-semibold text-slate-700">Pos / Item Biaya</label>
              <select
                id={itemTypeId}
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
              >
                <option value="ALL">Semua Pos Biaya</option>
                {filterOptions.itemTypes.map((it) => (
                  <option key={it.code} value={it.code}>{it.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Periode Bulan (YYYY-MM) */}
          {(activeTab === 'PENERIMAAN' || activeTab === 'PENUNGGAK' || activeTab === 'DETAIL_SANTRI') && (
            <div className="space-y-1">
              <label htmlFor={periodId} className="font-semibold text-slate-700">Periode Bulan</label>
              <input
                id={periodId}
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
              />
            </div>
          )}

          {/* 6. Rentang Tanggal (Start & End) */}
          {(activeTab === 'PENERIMAAN' || activeTab === 'PENYALURAN' || activeTab === 'UANG_JAJAN' || activeTab === 'TRANSAKSI_LOKET' || activeTab === 'SETTLEMENT' || activeTab === 'REKONSILIASI') && (
            <>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Dari Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
                />
              </div>
            </>
          )}

          {/* 7. Selector Santri Khusus Detail Santri */}
          {activeTab === 'DETAIL_SANTRI' && (
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-slate-700">Pilih Santri</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs"
              >
                {filterOptions.students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nis} - {st.name} ({st.asrama || '-'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 8. Mode Uang Jajan */}
          {activeTab === 'UANG_JAJAN' && (
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Tampilan Data</label>
              <select
                value={walletMode}
                onChange={(e) => setWalletMode(e.target.value as 'SUMMARY' | 'MUTATION')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs font-semibold text-blue-700"
              >
                <option value="SUMMARY">Rekap Saldo per Santri</option>
                <option value="MUTATION">Buku Besar Mutasi (Jurnal)</option>
              </select>
            </div>
          )}

          {/* Tombol Terapkan */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => loadReportData(activeTab, 1, pageSize)}
              className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors shadow-2xs"
            >
              {isPending ? 'Memuat...' : 'Terapkan Filter'}
            </button>
          </div>
        </div>
      </div>

      {/* ── TABEL DATA UTAMA ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {/* TAB 1: PENERIMAAN */}
          {activeTab === 'PENERIMAAN' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">No. Pembayaran</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-4">Santri</th>
                  <th className="py-3 px-3 text-center">Saluran</th>
                  <th className="py-3 px-3">Alokasi Pos</th>
                  <th className="py-3 px-3 text-right">Nominal Bruto</th>
                  <th className="py-3 px-3 text-right">Fee</th>
                  <th className="py-3 px-3 text-right">Nominal Bersih</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receiptsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Tidak ada transaksi penerimaan pada kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  receiptsData.items.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">{row.paymentNumber}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{row.paidAt.slice(0, 16)}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.santriName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.santriNis} • {row.santriAsrama || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.channel === 'BRI' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {row.channel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{row.allocationsSummary}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">{formatRupiah(row.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatRupiah(row.gatewayFee)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(row.netAmount)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: PENYALURAN */}
          {activeTab === 'PENYALURAN' && distributionsData && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">No. Penyaluran</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3">Penerima</th>
                  <th className="py-3 px-3">Rekening / Kas</th>
                  <th className="py-3 px-3">Rincian Pos</th>
                  <th className="py-3 px-3 text-right">Nominal Disalurkan</th>
                  <th className="py-3 px-3 text-center">Ref Transfer</th>
                  <th className="py-3 px-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {distributionsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Tidak ada transaksi penyaluran pada kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  distributionsData.items.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">{row.distributionNumber}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{row.transferredAt.slice(0, 16)}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{row.recipientName}</div>
                        <div className="text-[10px] text-slate-500">{row.recipientType}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {row.method === 'TRANSFER' ? (
                          <div>
                            <span className="font-bold">{row.destinationBank}</span>: {row.destinationAccount}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">TUNAI (CASH)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{row.itemsSummary}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(row.amount)}</td>
                      <td className="py-3 px-3 text-center font-mono text-slate-500">{row.transferReference || '-'}</td>
                      <td className="py-3 px-3 text-slate-600">{row.operatorName || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: PENUNGGAK */}
          {activeTab === 'PENUNGGAK' && arrearsData && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-4">Santri</th>
                  <th className="py-3 px-3">Periode</th>
                  <th className="py-3 px-3">Pos Tagihan</th>
                  <th className="py-3 px-3 text-right">Kewajiban</th>
                  <th className="py-3 px-3 text-right">Keringanan</th>
                  <th className="py-3 px-3 text-right">Terbayar</th>
                  <th className="py-3 px-3 text-right font-bold text-rose-700">Sisa Tunggakan</th>
                  <th className="py-3 px-3 text-center">Kontak Ortu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {arrearsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Alhamdulillah, tidak ada santri menunggak pada kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  arrearsData.items.map((row, idx) => (
                    <tr key={row.obligationId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.santriName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.santriNis} • {row.santriAsrama || '-'} • {row.santriKelas || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono">{row.period}</td>
                      <td className="py-3 px-3 text-slate-800 font-medium">{row.itemLabel}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatRupiah(row.amountExpected)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatRupiah(row.amountExempted)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatRupiah(row.amountPaid)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">{formatRupiah(row.remaining)}</td>
                      <td className="py-3 px-3 text-center text-slate-600 font-mono">{row.noWaOrtu || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: SANTRI DIBEBASKAN */}
          {activeTab === 'PEMBEBASAN' && exemptionsData && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-4">Santri</th>
                  <th className="py-3 px-3">Pos Biaya</th>
                  <th className="py-3 px-3">Periode Berlaku</th>
                  <th className="py-3 px-3">Alasan Pembebasan</th>
                  <th className="py-3 px-3 text-right">Nominal Terbebas</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Diberikan Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exemptionsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada rekaman pembebasan biaya pada kriteria ini.
                    </td>
                  </tr>
                ) : (
                  exemptionsData.items.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.santriName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.santriNis} • {row.santriAsrama || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">{row.itemLabel}</td>
                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {row.periodStart || 'Awal'} s.d. {row.periodEnd || 'Seterusnya'}
                      </td>
                      <td className="py-3 px-3 text-slate-700">{row.reason}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                        {formatRupiah(row.totalExemptedAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{row.createdByName || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 5: DETAIL PER SANTRI */}
          {activeTab === 'DETAIL_SANTRI' && studentDetailData && studentDetailData.student && (
            <div className="p-5 space-y-6">
              {/* Info Header Santri */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{studentDetailData.student.nama}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    NIS: <span className="font-mono font-bold text-slate-700">{studentDetailData.student.nis}</span> • Asrama:{' '}
                    <span className="font-medium text-slate-700">{studentDetailData.student.asrama || '-'}</span> (Kamar {studentDetailData.student.kamar || '-'}) • Kelas:{' '}
                    <span className="font-medium text-slate-700">{studentDetailData.student.kelas || '-'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Saldo Uang Jajan Berjalan</p>
                  <p className="text-lg font-bold text-blue-700 font-mono">
                    {formatRupiah(studentDetailData.student.walletBalance)}
                  </p>
                </div>
              </div>

              {/* Rincian Tagihan */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Daftar Kewajiban Tagihan Santri
                </h4>
                <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
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
                    {studentDetailData.obligations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400">Belum ada data kewajiban.</td>
                      </tr>
                    ) : (
                      studentDetailData.obligations.map((ob) => (
                        <tr key={ob.id}>
                          <td className="py-2.5 px-3 font-mono">{ob.period}</td>
                          <td className="py-2.5 px-3 font-medium">{ob.itemLabel}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(ob.amountExpected)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatRupiah(ob.amountExempted)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatRupiah(ob.amountPaid)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(ob.remaining)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ob.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {ob.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: UANG JAJAN */}
          {activeTab === 'UANG_JAJAN' && walletData && (
            <>
              {walletData.mode === 'SUMMARY' && walletData.summaryItems && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">No</th>
                      <th className="py-3 px-4">Santri</th>
                      <th className="py-3 px-3 text-right">Total Setoran (IN)</th>
                      <th className="py-3 px-3 text-right">Total Tarik (OUT)</th>
                      <th className="py-3 px-3 text-right font-bold text-blue-700">Saldo Saat Ini</th>
                      <th className="py-3 px-3 text-center">Limit Harian</th>
                      <th className="py-3 px-3 text-center">Status Kartu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {walletData.summaryItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Tidak ada data saldo santri.
                        </td>
                      </tr>
                    ) : (
                      walletData.summaryItems.map((row, idx) => (
                        <tr key={row.santriId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{row.santriName}</div>
                            <div className="text-[11px] text-slate-500">
                              {row.santriNis} • {row.santriAsrama || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatRupiah(row.totalIn)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">{formatRupiah(row.totalOut)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">{formatRupiah(row.currentBalance)}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-600">
                            {formatRupiah(row.effectiveDailyLimit)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {row.activeCardStatus || 'NO CARD'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {walletData.mode === 'MUTATION' && walletData.mutationItems && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">No</th>
                      <th className="py-3 px-3">Waktu</th>
                      <th className="py-3 px-4">Santri</th>
                      <th className="py-3 px-3 text-center">Jenis Mutasi</th>
                      <th className="py-3 px-3 text-center">Arah</th>
                      <th className="py-3 px-3 text-right">Nominal</th>
                      <th className="py-3 px-3 text-right">Saldo Sesudah</th>
                      <th className="py-3 px-3">Petugas / Sesi</th>
                      <th className="py-3 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {walletData.mutationItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Tidak ada mutasi buku besar pada kriteria ini.
                        </td>
                      </tr>
                    ) : (
                      walletData.mutationItems.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">{row.createdAt.slice(0, 16)}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{row.santriName}</div>
                            <div className="text-[11px] text-slate-500">{row.santriNis}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-medium text-slate-800">{row.movementType}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {row.direction}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(row.amount)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">{formatRupiah(row.balanceAfter)}</td>
                          <td className="py-3 px-3 text-slate-600">
                            <div>{row.operatorName || '-'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{row.cashSessionCode || '-'}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{row.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* TAB 7: TRANSAKSI LOKET */}
          {activeTab === 'TRANSAKSI_LOKET' && cashSessionsData && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">Kode Sesi</th>
                  <th className="py-3 px-3">Kasir</th>
                  <th className="py-3 px-3">Waktu Buka / Tutup</th>
                  <th className="py-3 px-3 text-right">Saldo Awal</th>
                  <th className="py-3 px-3 text-right">Kas Masuk</th>
                  <th className="py-3 px-3 text-right">Kas Keluar</th>
                  <th className="py-3 px-3 text-right">Ekspektasi Sistem</th>
                  <th className="py-3 px-3 text-right">Fisik Riil</th>
                  <th className="py-3 px-3 text-right">Selisih</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashSessionsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      Tidak ada data sesi kas loket pada kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  cashSessionsData.items.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{row.sessionCode}</td>
                      <td className="py-3 px-3 font-medium text-slate-900">{row.operatorName}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        <div>{row.openedAt.slice(0, 16)}</div>
                        <div className="text-[10px] text-slate-400">{row.closedAt ? row.closedAt.slice(0, 16) : 'AKTIF'}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{formatRupiah(row.openingBalance)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatRupiah(row.totalCashIn)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">{formatRupiah(row.totalCashOut)}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-800">{formatRupiah(row.expectedClosingBalance)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900">
                        {row.actualClosingBalance !== null ? formatRupiah(row.actualClosingBalance) : '-'}
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${
                        (row.difference || 0) === 0 ? 'text-slate-800' : 'text-rose-700'
                      }`}>
                        {row.difference !== null ? formatRupiah(row.difference) : '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'OPEN' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenSessionDetail(row.id)}
                          disabled={loadingSessionDetail}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 8: SETTLEMENT */}
          {activeTab === 'SETTLEMENT' && settlementsData && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">No. Settlement</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3">Rekening Bank</th>
                  <th className="py-3 px-3 text-center">Jml Transaksi</th>
                  <th className="py-3 px-3 text-right">Bruto</th>
                  <th className="py-3 px-3 text-right">Total Fee</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-700">Net Masuk Rekening</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlementsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Tidak ada batch settlement pada kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  settlementsData.items.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">{row.settlementNumber}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{row.settlementDate}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{row.destinationBank} - {row.destinationAccount}</div>
                        <div className="text-[10px] text-slate-500">{row.accountHolderName}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{row.itemCount}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatRupiah(row.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatRupiah(row.totalFee)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{formatRupiah(row.netAmount)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 9: REKONSILIASI */}
          {activeTab === 'REKONSILIASI' && reconciliationsData && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">Waktu</th>
                  <th className="py-3 px-3 text-center">Status Kecocokan</th>
                  <th className="py-3 px-3">Ref Eksternal</th>
                  <th className="py-3 px-3 text-right">Nominal Sistem</th>
                  <th className="py-3 px-3 text-right">Nominal Eksternal</th>
                  <th className="py-3 px-3 text-right font-bold text-rose-700">Selisih</th>
                  <th className="py-3 px-3 text-center">Tindakan Resolusi</th>
                  <th className="py-3 px-3">Penyelesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliationsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Tidak ada rekaman rekonsiliasi pada kriteria ini.
                    </td>
                  </tr>
                ) : (
                  reconciliationsData.items.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">{row.createdAt.slice(0, 16)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.matchStatus === 'MATCHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {row.matchStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{row.externalReference || '-'}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatRupiah(row.internalAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatRupiah(row.externalAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">{formatRupiah(row.discrepancyAmount)}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-800">{row.resolutionAction}</td>
                      <td className="py-3 px-3 text-slate-600">{row.resolvedByName || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── PAGINATION CONTROLS ─────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Menampilkan data halaman <span className="font-semibold text-slate-800">{currentPage}</span>.
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={
              activeTab === 'PENERIMAAN'
                ? receiptsData.pagination.totalPages
                : activeTab === 'PENYALURAN'
                ? distributionsData?.pagination.totalPages || 1
                : activeTab === 'PENUNGGAK'
                ? arrearsData?.pagination.totalPages || 1
                : activeTab === 'PEMBEBASAN'
                ? exemptionsData?.pagination.totalPages || 1
                : activeTab === 'UANG_JAJAN'
                ? walletData?.pagination.totalPages || 1
                : activeTab === 'TRANSAKSI_LOKET'
                ? cashSessionsData?.pagination.totalPages || 1
                : activeTab === 'SETTLEMENT'
                ? settlementsData?.pagination.totalPages || 1
                : reconciliationsData?.pagination.totalPages || 1
            }
            pageSize={pageSize}
            total={
              activeTab === 'PENERIMAAN'
                ? receiptsData.pagination.totalRecords
                : activeTab === 'PENYALURAN'
                ? distributionsData?.pagination.totalRecords || 0
                : activeTab === 'PENUNGGAK'
                ? arrearsData?.pagination.totalRecords || 0
                : activeTab === 'PEMBEBASAN'
                ? exemptionsData?.pagination.totalRecords || 0
                : activeTab === 'UANG_JAJAN'
                ? walletData?.pagination.totalRecords || 0
                : activeTab === 'TRANSAKSI_LOKET'
                ? cashSessionsData?.pagination.totalRecords || 0
                : activeTab === 'SETTLEMENT'
                ? settlementsData?.pagination.totalRecords || 0
                : reconciliationsData?.pagination.totalRecords || 0
            }
            onPageChange={(p) => {
              setCurrentPage(p)
              loadReportData(activeTab, p, pageSize)
            }}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setCurrentPage(1)
              loadReportData(activeTab, 1, s)
            }}
          />
        </div>
      </div>

      {/* ── PRINT PREVIEW MODAL INTEGRATION ───────────────────────────────── */}
      {activeTab === 'PENERIMAAN' && (
        <ReportPrintableView
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN PENERIMAAN KAS & PEMBAYARAN"
          subtitle="Pondok Pesantren Eskahade — Rekap Penerimaan Online & Tunai"
          filterSummary={`Asrama: ${asrama} | Kelas: ${kelas} | Periode: ${period || 'Semua'}`}
          kpis={[
            { label: 'Total Bruto', value: formatRupiah(receiptsData.kpi.totalGross) },
            { label: 'Fee Gateway', value: formatRupiah(receiptsData.kpi.totalFee) },
            { label: 'Penerimaan Bersih', value: formatRupiah(receiptsData.kpi.totalNet) },
            { label: 'Total Transaksi', value: `${receiptsData.kpi.totalTransactions} item` },
          ]}
          columns={[
            { header: 'No. Bayar', accessor: (r) => r.paymentNumber, align: 'center' },
            { header: 'Tanggal', accessor: (r) => r.paidAt.slice(0, 16), align: 'center' },
            { header: 'Nama Santri', accessor: (r) => `${r.santriName} (${r.santriNis})` },
            { header: 'Saluran', accessor: (r) => r.channel, align: 'center' },
            { header: 'Alokasi Tagihan', accessor: (r) => r.allocationsSummary },
            { header: 'Bruto', accessor: (r) => formatRupiah(r.grossAmount), align: 'right' },
            { header: 'Bersih', accessor: (r) => formatRupiah(r.netAmount), align: 'right' },
          ]}
          data={receiptsData.items}
          footerTotals={[
            { label: 'Total Bruto', value: formatRupiah(receiptsData.kpi.totalGross), colSpan: 6 },
            { label: 'Total Bersih', value: formatRupiah(receiptsData.kpi.totalNet), colSpan: 2 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'PENUNGGAK' && arrearsData && (
        <ReportPrintableView
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN SANTRI MENUNGGAK & PIUTANG BIAYA"
          subtitle="Pondok Pesantren Eskahade — Monitoring Kewajiban Santri"
          filterSummary={`Asrama: ${asrama} | Kelas: ${kelas} | Periode: ${period || 'Semua'}`}
          kpis={[
            { label: 'Total Piutang', value: formatRupiah(arrearsData.kpi.totalArrears) },
            { label: 'Santri Menunggak', value: `${arrearsData.kpi.uniqueStudentsCount} santri` },
            { label: 'Total Tagihan', value: `${arrearsData.kpi.totalObligations} item` },
            { label: 'Rata-rata/Santri', value: formatRupiah(arrearsData.kpi.averageArrearsPerStudent) },
          ]}
          columns={[
            { header: 'NIS', accessor: (r) => r.santriNis, align: 'center' },
            { header: 'Nama Santri', accessor: (r) => r.santriName },
            { header: 'Asrama/Kelas', accessor: (r) => `${r.santriAsrama || '-'} / ${r.santriKelas || '-'}` },
            { header: 'Periode', accessor: (r) => r.period, align: 'center' },
            { header: 'Pos Biaya', accessor: (r) => r.itemLabel },
            { header: 'Kewajiban', accessor: (r) => formatRupiah(r.amountExpected), align: 'right' },
            { header: 'Terbayar', accessor: (r) => formatRupiah(r.amountPaid), align: 'right' },
            { header: 'Sisa Tunggakan', accessor: (r) => formatRupiah(r.remaining), align: 'right' },
          ]}
          data={arrearsData.items}
          footerTotals={[
            { label: 'Total Tunggakan', value: formatRupiah(arrearsData.kpi.totalArrears), colSpan: 9 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'PENYALURAN' && distributionsData && (
        <ReportPrintableView
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN PENYALURAN DANA KEPADA REKANAN & BENDAHARA"
          subtitle="Pondok Pesantren Eskahade — Penyaluran Dana Katering, Laundry, & Operasional"
          filterSummary={`Periode: ${startDate || 'Awal'} s.d. ${endDate || 'Akhir'}`}
          kpis={[
            { label: 'Total Disalurkan', value: formatRupiah(distributionsData.kpi.totalDisbursed) },
            { label: 'Bendahara', value: formatRupiah(distributionsData.kpi.totalBendahara) },
            { label: 'Katering', value: formatRupiah(distributionsData.kpi.totalKatering) },
            { label: 'Laundry', value: formatRupiah(distributionsData.kpi.totalLaundry) },
          ]}
          columns={[
            { header: 'No. Penyaluran', accessor: (r) => r.distributionNumber, align: 'center' },
            { header: 'Tanggal', accessor: (r) => r.transferredAt.slice(0, 16), align: 'center' },
            { header: 'Penerima', accessor: (r) => `${r.recipientName} (${r.recipientType})` },
            { header: 'Metode / Bank', accessor: (r) => r.method === 'TRANSFER' ? `${r.destinationBank}: ${r.destinationAccount}` : 'TUNAI' },
            { header: 'Item Pos', accessor: (r) => r.itemsSummary },
            { header: 'Nominal Salur', accessor: (r) => formatRupiah(r.amount), align: 'right' },
            { header: 'Petugas', accessor: (r) => r.operatorName || '-' },
          ]}
          data={distributionsData.items}
          footerTotals={[
            { label: 'Total Disalurkan', value: formatRupiah(distributionsData.kpi.totalDisbursed), colSpan: 8 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'UANG_JAJAN' && walletData && walletData.mode === 'SUMMARY' && (
        <ReportPrintableView<WalletSummaryRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN SALDO TITIPAN UANG JAJAN SANTRI"
          subtitle="Pondok Pesantren Eskahade — Rekapitulasi Buku Besar Dompet Santri"
          filterSummary={`Mode: Rekap Saldo | Asrama: ${asrama}`}
          kpis={[
            { label: 'Total Saldo Titipan', value: formatRupiah(walletData.kpi.totalCurrentBalance) },
            { label: 'Total Masuk (IN)', value: formatRupiah(walletData.kpi.totalDepositIn) },
            { label: 'Total Keluar (OUT)', value: formatRupiah(walletData.kpi.totalWithdrawalOut) },
            { label: 'Total Mutasi', value: `${walletData.kpi.totalMutationsCount} baris` },
          ]}
          columns={[
            { header: 'NIS', accessor: (r) => r.santriNis, align: 'center' },
            { header: 'Nama Santri', accessor: (r) => r.santriName },
            { header: 'Asrama', accessor: (r) => r.santriAsrama || '-', align: 'center' },
            { header: 'Total Setor (IN)', accessor: (r) => formatRupiah(r.totalIn), align: 'right' },
            { header: 'Total Tarik (OUT)', accessor: (r) => formatRupiah(r.totalOut), align: 'right' },
            { header: 'Saldo Berjalan', accessor: (r) => formatRupiah(r.currentBalance), align: 'right' },
            { header: 'Limit Harian', accessor: (r) => formatRupiah(r.effectiveDailyLimit), align: 'center' },
          ]}
          data={walletData.summaryItems || []}
          orientation="landscape"
        />
      )}

      {activeTab === 'UANG_JAJAN' && walletData && walletData.mode === 'MUTATION' && (
        <ReportPrintableView<WalletMutationRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="BUKU BESAR MUTASI UANG JAJAN (JURNAL)"
          subtitle="Pondok Pesantren Eskahade — Histori Mutasi Buku Besar"
          filterSummary={`Mode: Mutasi | Asrama: ${asrama}`}
          kpis={[
            { label: 'Total Saldo Titipan', value: formatRupiah(walletData.kpi.totalCurrentBalance) },
            { label: 'Total Masuk (IN)', value: formatRupiah(walletData.kpi.totalDepositIn) },
            { label: 'Total Keluar (OUT)', value: formatRupiah(walletData.kpi.totalWithdrawalOut) },
            { label: 'Total Mutasi', value: `${walletData.kpi.totalMutationsCount} baris` },
          ]}
          columns={[
            { header: 'Waktu', accessor: (r) => r.createdAt.slice(0, 16), align: 'center' },
            { header: 'Nama Santri', accessor: (r) => `${r.santriName} (${r.santriNis})` },
            { header: 'Jenis', accessor: (r) => r.movementType, align: 'center' },
            { header: 'Arah', accessor: (r) => r.direction, align: 'center' },
            { header: 'Nominal', accessor: (r) => formatRupiah(r.amount), align: 'right' },
            { header: 'Saldo Akhir', accessor: (r) => formatRupiah(r.balanceAfter), align: 'right' },
            { header: 'Operator', accessor: (r) => r.operatorName || '-' },
          ]}
          data={walletData.mutationItems || []}
          orientation="landscape"
        />
      )}

      {activeTab === 'PEMBEBASAN' && exemptionsData && (
        <ReportPrintableView<ExemptionItemRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN SANTRI DIBEBASKAN DARI BIAYA"
          subtitle="Pondok Pesantren Eskahade — Rekapitulasi Pembebasan Kewajiban Santri"
          filterSummary={`Asrama: ${asrama} | Kelas: ${kelas} | Pos: ${itemType} | Status: ${exemptionStatus}`}
          kpis={[
            { label: 'Total Nominal Bebas', value: formatRupiah(exemptionsData.kpi.totalNominalExempted) },
            { label: 'Pembebasan Aktif', value: `${exemptionsData.kpi.activeExemptionsCount} rekaman` },
            { label: 'Sudah Dicabut', value: `${exemptionsData.kpi.revokedExemptionsCount} rekaman` },
            { label: 'Santri Terdampak', value: `${exemptionsData.kpi.uniqueStudentsCount} santri` },
          ]}
          columns={[
            { header: 'NIS', accessor: (r) => r.santriNis, align: 'center' },
            { header: 'Nama Santri', accessor: (r) => r.santriName },
            { header: 'Asrama/Kelas', accessor: (r) => `${r.santriAsrama || '-'} / ${r.santriKelas || '-'}` },
            { header: 'Pos Biaya', accessor: (r) => r.itemLabel },
            {
              header: 'Periode Berlaku',
              accessor: (r) => `${r.periodStart || 'Awal'} s.d. ${r.periodEnd || 'Seterusnya'}`,
              align: 'center',
            },
            { header: 'Alasan', accessor: (r) => r.reason },
            { header: 'Nominal Terbebas', accessor: (r) => formatRupiah(r.totalExemptedAmount), align: 'right' },
            { header: 'Status', accessor: (r) => r.status, align: 'center' },
            { header: 'Diberikan Oleh', accessor: (r) => r.createdByName || '-' },
          ]}
          data={exemptionsData.items}
          footerTotals={[
            { label: 'Total Nominal Terbebas', value: formatRupiah(exemptionsData.kpi.totalNominalExempted), colSpan: 10 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'DETAIL_SANTRI' && studentDetailData && (
        <ReportPrintableView<StudentDetailObligationRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LEMBAR KEUANGAN SANTRI"
          subtitle={
            studentDetailData.student
              ? `${studentDetailData.student.nama} — NIS ${studentDetailData.student.nis}`
              : 'Data santri belum tersedia'
          }
          filterSummary={
            studentDetailData.student
              ? `Asrama: ${studentDetailData.student.asrama || '-'} (Kamar ${studentDetailData.student.kamar || '-'}) | Kelas: ${studentDetailData.student.kelas || '-'} | Saldo Uang Jajan: ${formatRupiah(studentDetailData.student.walletBalance)}`
              : 'Semua data'
          }
          kpis={[
            { label: 'Total Kewajiban', value: formatRupiah(studentDetailData.summary.totalExpected) },
            { label: 'Keringanan', value: formatRupiah(studentDetailData.summary.totalExempted) },
            { label: 'Sudah Terbayar', value: formatRupiah(studentDetailData.summary.totalPaid) },
            { label: 'Sisa Tanggungan', value: formatRupiah(studentDetailData.summary.totalRemaining) },
          ]}
          columns={[
            { header: 'Periode', accessor: (r) => r.period, align: 'center' },
            { header: 'Pos Tagihan', accessor: (r) => r.itemLabel },
            { header: 'Tagihan', accessor: (r) => formatRupiah(r.amountExpected), align: 'right' },
            { header: 'Keringanan', accessor: (r) => formatRupiah(r.amountExempted), align: 'right' },
            { header: 'Terbayar', accessor: (r) => formatRupiah(r.amountPaid), align: 'right' },
            { header: 'Sisa', accessor: (r) => formatRupiah(r.remaining), align: 'right' },
            { header: 'Status', accessor: (r) => r.status, align: 'center' },
          ]}
          data={studentDetailData.obligations}
          footerTotals={[
            { label: 'Total Sisa Tanggungan', value: formatRupiah(studentDetailData.summary.totalRemaining), colSpan: 8 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'TRANSAKSI_LOKET' && cashSessionsData && (
        <ReportPrintableView<CashSessionItemRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN SESI KAS & TRANSAKSI LOKET"
          subtitle="Pondok Pesantren Eskahade — Rekonsiliasi Kas Fisik Loket Koperasi"
          filterSummary={`Periode: ${startDate || 'Awal'} s.d. ${endDate || 'Akhir'}`}
          kpis={[
            { label: 'Total Sesi', value: `${cashSessionsData.kpi.totalSessionsCount} sesi` },
            { label: 'Total Kas Masuk', value: formatRupiah(cashSessionsData.kpi.totalCashInAllSessions) },
            { label: 'Total Kas Keluar', value: formatRupiah(cashSessionsData.kpi.totalCashOutAllSessions) },
            {
              label: 'Sesi Berselisih',
              value: `${cashSessionsData.kpi.discrepancySessionsCount} sesi (${formatRupiah(cashSessionsData.kpi.totalDifference)})`,
            },
          ]}
          columns={[
            { header: 'Kode Sesi', accessor: (r) => r.sessionCode, align: 'center' },
            { header: 'Petugas', accessor: (r) => r.operatorName },
            { header: 'Buka', accessor: (r) => r.openedAt.slice(0, 16), align: 'center' },
            { header: 'Tutup', accessor: (r) => (r.closedAt ? r.closedAt.slice(0, 16) : 'AKTIF'), align: 'center' },
            { header: 'Saldo Awal', accessor: (r) => formatRupiah(r.openingBalance), align: 'right' },
            { header: 'Kas Masuk', accessor: (r) => formatRupiah(r.totalCashIn), align: 'right' },
            { header: 'Kas Keluar', accessor: (r) => formatRupiah(r.totalCashOut), align: 'right' },
            { header: 'Saldo Seharusnya', accessor: (r) => formatRupiah(r.expectedClosingBalance), align: 'right' },
            {
              header: 'Saldo Fisik',
              accessor: (r) => (r.actualClosingBalance !== null ? formatRupiah(r.actualClosingBalance) : '-'),
              align: 'right',
            },
            { header: 'Selisih', accessor: (r) => (r.difference !== null ? formatRupiah(r.difference) : '-'), align: 'right' },
            { header: 'Status', accessor: (r) => r.status, align: 'center' },
          ]}
          data={cashSessionsData.items}
          orientation="landscape"
        />
      )}

      {activeTab === 'SETTLEMENT' && settlementsData && (
        <ReportPrintableView<SettlementItemRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN SETTLEMENT PAYMENT GATEWAY"
          subtitle="Pondok Pesantren Eskahade — Pencairan Dana Online BRI ke Rekening Pesantren"
          filterSummary={`Periode: ${startDate || 'Awal'} s.d. ${endDate || 'Akhir'}`}
          kpis={[
            { label: 'Total Bruto', value: formatRupiah(settlementsData.kpi.totalGrossSettled) },
            { label: 'Total Fee', value: formatRupiah(settlementsData.kpi.totalFeeDeducted) },
            { label: 'Net Diterima', value: formatRupiah(settlementsData.kpi.totalNetReceived) },
            { label: 'Jumlah Batch', value: `${settlementsData.kpi.totalSettlementBatches} batch` },
          ]}
          columns={[
            { header: 'No. Settlement', accessor: (r) => r.settlementNumber, align: 'center' },
            { header: 'Tanggal', accessor: (r) => r.settlementDate, align: 'center' },
            { header: 'Bank Tujuan', accessor: (r) => r.destinationBank },
            { header: 'No. Rekening', accessor: (r) => r.destinationAccount, align: 'center' },
            { header: 'Atas Nama', accessor: (r) => r.accountHolderName },
            { header: 'Jml Trx', accessor: (r) => r.itemCount, align: 'center' },
            { header: 'Bruto', accessor: (r) => formatRupiah(r.grossAmount), align: 'right' },
            { header: 'Total Fee', accessor: (r) => formatRupiah(r.totalFee), align: 'right' },
            { header: 'Net Masuk', accessor: (r) => formatRupiah(r.netAmount), align: 'right' },
            { header: 'Status', accessor: (r) => r.status, align: 'center' },
          ]}
          data={settlementsData.items}
          footerTotals={[
            { label: 'Total Net Diterima', value: formatRupiah(settlementsData.kpi.totalNetReceived), colSpan: 11 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'REKONSILIASI' && reconciliationsData && (
        <ReportPrintableView<ReconciliationReportRow>
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="LAPORAN AUDIT REKONSILIASI & RESOLUSI DISKREPANSI"
          subtitle="Pondok Pesantren Eskahade — Pencocokan Internal vs Gateway vs Rekening Bank"
          filterSummary={`Periode: ${startDate || 'Awal'} s.d. ${endDate || 'Akhir'}`}
          kpis={[
            { label: 'Cocok', value: `${reconciliationsData.kpi.totalMatchedItems} rekaman` },
            { label: 'Selisih', value: `${reconciliationsData.kpi.totalDiscrepancyItems} rekaman` },
            { label: 'Nilai Selisih', value: formatRupiah(reconciliationsData.kpi.totalDiscrepancyAmount) },
            { label: 'Sudah Diselesaikan', value: `${reconciliationsData.kpi.totalResolvedItems} rekaman` },
          ]}
          columns={[
            { header: 'Waktu', accessor: (r) => r.createdAt.slice(0, 16), align: 'center' },
            { header: 'Status', accessor: (r) => r.matchStatus, align: 'center' },
            { header: 'Ref Eksternal', accessor: (r) => r.externalReference || '-', align: 'center' },
            { header: 'No. Pembayaran', accessor: (r) => r.paymentNumber || '-', align: 'center' },
            { header: 'Santri', accessor: (r) => r.santriName || '-' },
            { header: 'Nominal Sistem', accessor: (r) => formatRupiah(r.internalAmount), align: 'right' },
            { header: 'Nominal Eksternal', accessor: (r) => formatRupiah(r.externalAmount), align: 'right' },
            { header: 'Selisih', accessor: (r) => formatRupiah(r.discrepancyAmount), align: 'right' },
            { header: 'Tindakan', accessor: (r) => r.resolutionAction, align: 'center' },
            { header: 'Penyelesai', accessor: (r) => r.resolvedByName || '-' },
          ]}
          data={reconciliationsData.items}
          orientation="landscape"
        />
      )}

      {/* Fallback: pastikan tombol Cetak / PDF selalu memberi respons walau data tab belum siap */}
      {isPrintModalOpen && !isPrintViewAvailable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">Data laporan belum siap dicetak</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tunggu hingga data laporan selesai dimuat, lalu tekan <strong>Cetak / PDF</strong> kembali.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: DETAIL SESI KASIR (REKONSTRUKSI OTORITATIF LOKET) */}
      {selectedSessionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Detail Kasir: {selectedSessionDetail.session.sessionCode}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedSessionDetail.session.status === 'OPEN'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {selectedSessionDetail.session.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kasir: <strong className="text-slate-700">{selectedSessionDetail.session.operatorName}</strong> &bull; Buka: {selectedSessionDetail.session.openedAt.slice(0, 16)} {selectedSessionDetail.session.closedAt ? `— Tutup: ${selectedSessionDetail.session.closedAt.slice(0, 16)}` : '(Sedang Aktif)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Authoritative Cash Reconciliation Summary */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Saldo Awal</span>
                <span className="text-sm font-bold font-mono text-slate-800">
                  {formatRupiah(selectedSessionDetail.authoritativeSummary.openingBalance)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-sm">
                <span className="text-[10px] text-emerald-700 font-medium uppercase tracking-wider block">Kas Masuk (In)</span>
                <span className="text-sm font-bold font-mono text-emerald-700">
                  +{formatRupiah(selectedSessionDetail.authoritativeSummary.totalCashIn)}
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Bayar: {formatRupiah(selectedSessionDetail.authoritativeSummary.cashPaymentsIn)} | Topup: {formatRupiah(selectedSessionDetail.authoritativeSummary.cashTopupsIn)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-rose-200 shadow-sm">
                <span className="text-[10px] text-rose-700 font-medium uppercase tracking-wider block">Kas Keluar (Out)</span>
                <span className="text-sm font-bold font-mono text-rose-700">
                  -{formatRupiah(selectedSessionDetail.authoritativeSummary.totalCashOut)}
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Tarik: {formatRupiah(selectedSessionDetail.authoritativeSummary.cashWithdrawalsOut)} | Refund: {formatRupiah(selectedSessionDetail.authoritativeSummary.cashRefundsOut)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-300 shadow-sm">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Ekspektasi Akhir</span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {formatRupiah(selectedSessionDetail.authoritativeSummary.expectedClosingBalance)}
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Fisik: {selectedSessionDetail.authoritativeSummary.actualClosingBalance !== null ? formatRupiah(selectedSessionDetail.authoritativeSummary.actualClosingBalance) : '-'} | Selisih: <strong className={(selectedSessionDetail.authoritativeSummary.difference || 0) === 0 ? 'text-slate-700' : 'text-rose-700'}>{selectedSessionDetail.authoritativeSummary.difference !== null ? formatRupiah(selectedSessionDetail.authoritativeSummary.difference) : '-'}</strong>
                </div>
              </div>
            </div>

            {/* Sub-tabs for Itemized Streams */}
            <div className="flex border-b border-slate-200 px-6 bg-white gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveSessionTab('PAYMENTS')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeSessionTab === 'PAYMENTS'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Pembayaran Tagihan ({selectedSessionDetail.cashPayments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSessionTab('TOPUPS')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeSessionTab === 'TOPUPS'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Topup Uang Jajan ({selectedSessionDetail.cashTopups.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSessionTab('WITHDRAWALS')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeSessionTab === 'WITHDRAWALS'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Penarikan Titipan ({selectedSessionDetail.cashWithdrawals.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSessionTab('REFUNDS')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeSessionTab === 'REFUNDS'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Koreksi / Refund Kas ({selectedSessionDetail.cashRefunds.length})
              </button>
            </div>

            {/* Table of Transactions in Selected Stream */}
            <div className="overflow-y-auto flex-1 p-6">
              {activeSessionTab === 'PAYMENTS' && (
                selectedSessionDetail.cashPayments.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Tidak ada pembayaran tagihan tunai pada sesi kasir ini.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">No. Pembayaran</th>
                        <th className="py-2.5 px-3">Santri</th>
                        <th className="py-2.5 px-3">Metode</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSessionDetail.cashPayments.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">{p.paidAt.slice(0, 16)}</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{p.paymentNumber}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{p.santriName}</div>
                            <div className="text-[10px] text-slate-400">{p.nis}</div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">{p.method}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatRupiah(p.grossAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeSessionTab === 'TOPUPS' && (
                selectedSessionDetail.cashTopups.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Tidak ada setoran top-up tunai pada sesi kasir ini.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Santri</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                        <th className="py-2.5 px-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSessionDetail.cashTopups.map((t, idx) => (
                        <tr key={t.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">{t.createdAt.slice(0, 16)}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{t.santriName}</div>
                            <div className="text-[10px] text-slate-400">{t.nis}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatRupiah(t.amount)}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{t.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeSessionTab === 'WITHDRAWALS' && (
                selectedSessionDetail.cashWithdrawals.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Tidak ada penarikan titipan tunai pada sesi kasir ini.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Santri</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                        <th className="py-2.5 px-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSessionDetail.cashWithdrawals.map((w, idx) => (
                        <tr key={w.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">{w.createdAt.slice(0, 16)}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{w.santriName}</div>
                            <div className="text-[10px] text-slate-400">{w.nis}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatRupiah(w.amount)}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{w.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeSessionTab === 'REFUNDS' && (
                selectedSessionDetail.cashRefunds.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Tidak ada koreksi/refund tunai pada sesi kasir ini.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">No. Koreksi</th>
                        <th className="py-2.5 px-3">Jenis Koreksi</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                        <th className="py-2.5 px-3">Alasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSessionDetail.cashRefunds.map((r, idx) => (
                        <tr key={r.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">{r.createdAt.slice(0, 16)}</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{r.correctionNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">{r.correctionType}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatRupiah(r.amount)}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
