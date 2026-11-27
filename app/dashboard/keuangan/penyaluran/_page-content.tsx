'use client'

import React, { useEffect, useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  FileSpreadsheet,
  HandCoins,
  Printer,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { getPenyaluranPageData, type PenyaluranPageData } from './actions'
import type { FinanceDistributionRecipientType } from '@/lib/finance/distribution-types'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import { DEFAULT_FINANCE_PAGE_SIZE } from '@/lib/finance/constants'
import { formatFinanceDate } from '@/lib/finance/date-format'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import CatatPenyaluranModal from './catat-penyaluran-modal'
import RekeningModal from './rekening-modal'
import BuktiPenyaluranModal from './bukti-penyaluran-modal'
import ProviderDetailModal from './provider-detail-modal'
import RekeningImportModal from './rekening-import-modal'
import BendaharaItemDetailModal, {
  type BendaharaDetailTarget,
} from './bendahara-item-detail-modal'

interface PenyaluranContentProps {
  initialData: PenyaluranPageData
}

type PenyaluranTab = FinanceDistributionRecipientType | 'RIWAYAT'

const TABS: ReadonlyArray<{ id: PenyaluranTab; label: string }> = [
  { id: 'BENDAHARA', label: 'Bendahara Pesantren' },
  { id: 'KATERING', label: 'Katering (Makan)' },
  { id: 'LAUNDRY', label: 'Laundry (Cuci)' },
  { id: 'RIWAYAT', label: 'Riwayat Penyaluran' },
]

const PAGE_SIZE_OPTIONS: SelectPickerOption[] = [
  { value: '20', label: '20 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' },
]

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatPeriodLabel(period: string): string {
  if (period === 'LIFETIME') return 'Sepanjang Masa'
  const parts = period.split('-')
  if (parts.length === 1 && /^\d{4}$/.test(period)) return `Tahun ${period}`
  if (parts.length === 2) {
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${BULAN_NAMES[monthIdx]} ${year}`
    }
  }
  return period
}

function formatMethodLabel(method: string): { label: string; isBank: boolean } {
  switch (method) {
    case 'BRI_QLOLA':
      return { label: 'BRI QLola', isBank: true }
    case 'MANUAL_TRANSFER':
    case 'TRANSFER':
      return { label: 'Transfer Manual', isBank: true }
    case 'CASH':
      return { label: 'Tunai', isBank: false }
    default:
      return { label: method.replace(/_/g, ' '), isBank: false }
  }
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function PenyaluranContent({ initialData }: PenyaluranContentProps) {
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<PenyaluranPageData>(initialData)
  const [activeTab, setActiveTab] = useState<PenyaluranTab>(initialData.activeTab)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.selectedPeriod)
  const [historySearch, setHistorySearch] = useState<string>('')
  const [pageSize, setPageSize] = useState<number>(DEFAULT_FINANCE_PAGE_SIZE)

  // Modal states
  const [disburseModalTarget, setDisburseModalTarget] = useState<{
    recipientType: FinanceDistributionRecipientType
    recipientId?: string | null
    recipientName: string
    itemType: string
    itemLabel: string
    period: string
    periodLabel: string
    availableAmount: number
  } | null>(null)

  const [rekeningModalProvider, setRekeningModalProvider] = useState<{
    id: string
    name: string
    type: 'Makan' | 'Cuci'
  } | null>(null)

  const [receiptDistributionId, setReceiptDistributionId] = useState<string | null>(null)
  const [detailModalProviderId, setDetailModalProviderId] = useState<string | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false)
  const [bendaharaDetailTarget, setBendaharaDetailTarget] = useState<BendaharaDetailTarget | null>(null)

  const tabIdPrefix = useId()
  const historySearchId = useId()
  const tableRegionHeadingId = useId()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const canDisburse = data.userPermissions.canDisburse
  const canTransfer = data.userPermissions.canTransfer
  const canManageAccounts = data.userPermissions.canManageAccounts

  const refreshData = (
    tab = activeTab,
    period = selectedPeriod,
    search = historySearch,
    page = 1,
    size = pageSize
  ) => {
    startTransition(async () => {
      try {
        const next = await getPenyaluranPageData({
          tab,
          period,
          historySearch: search,
          historyPage: page,
          historyPageSize: size,
        })
        setData(next)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Data penyaluran belum dapat dimuat. Coba lagi.')
      }
    })
  }

  const handleTabChange = (tab: PenyaluranTab) => {
    setActiveTab(tab)
    tabRefs.current[tab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    refreshData(tab, selectedPeriod, historySearch, 1, pageSize)
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

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    refreshData(activeTab, period, historySearch, 1, pageSize)
  }

  const handleHistorySearchChange = (val: string) => {
    setHistorySearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      refreshData(activeTab, selectedPeriod, val, 1, pageSize)
    }, 350)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    refreshData(activeTab, selectedPeriod, historySearch, 1, pageSize)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    refreshData(activeTab, selectedPeriod, historySearch, 1, size)
  }

  const selectedPeriodLabel = formatPeriodLabel(selectedPeriod)
  const historyStart =
    data.history.totalItems === 0 ? 0 : (data.history.page - 1) * pageSize + 1
  const historyEnd = Math.min(data.history.page * pageSize, data.history.totalItems)

  const renderDisburseEmptyLabel = (totalDanaMasuk: number, sisaSiapSalur: number) => {
    if (totalDanaMasuk <= 0) {
      return <span className="text-xs text-slate-400 whitespace-nowrap">Belum Ada Dana</span>
    }
    if (sisaSiapSalur <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 whitespace-nowrap">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          Tersalurkan Penuh
        </span>
      )
    }
    return <span className="text-xs text-slate-400 whitespace-nowrap">Lihat Saja</span>
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 1. Header Halaman + SelectPicker Periode & Segarkan */}
      <DashboardPageHeader
        title="Penyaluran Dana"
        description="Pengelolaan dan penyaluran dana hak Bendahara Pesantren, Katering, dan Laundry."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SelectPicker
              value={selectedPeriod}
              options={data.periodOptions}
              onChange={handlePeriodChange}
              prefixLabel="Periode"
              icon={<Calendar className="h-4 w-4" />}
              ariaLabel="Pilih periode penyaluran dana"
              disabled={isPending}
              align="left"
              menuClassName="sm:right-0 sm:left-auto"
            />

            <button
              type="button"
              onClick={() => refreshData(activeTab, selectedPeriod, historySearch, data.history.page, pageSize)}
              disabled={isPending}
              aria-label="Segarkan data penyaluran"
              className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Segarkan</span>
            </button>
          </div>
        }
      />

      <div
        aria-busy={isPending}
        className={`space-y-6 transition-opacity duration-200 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {/* 2. KPI Summary Cards (Selaras dengan Dashboard Keuangan & Status Pembayaran) */}
        <section aria-label="Ringkasan penyaluran periode ini">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Dana Masuk Periode Ini</span>
                  <Coins className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.summary.totalDanaMasuk)}
                </div>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                {data.summary.totalSantriSudahBayar} santri telah membayar
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Siap Disalurkan</span>
                  <HandCoins className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.summary.totalSiapDisalurkan)}
                </div>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-emerald-700">
                Tersedia untuk disalurkan ke penerima
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Sudah Disalurkan</span>
                  <CheckCircle2 className="h-4 w-4 text-slate-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(data.summary.totalSudahDisalurkan)}
                </div>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                Akumulasi penyaluran tercatat
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Santri Terdaftar</span>
                  <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.summary.totalSantriTerdaftar}
                  </span>
                  <span className="text-xs font-medium text-slate-500">santri</span>
                </div>
              </div>
              <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-amber-800 tabular-nums">
                {data.summary.totalSantriBelumBayar} santri belum lunas
              </p>
            </div>
          </div>
        </section>

        {/* 3. Tabs Navigasi (Single-row horizontal scroll, accessible tablist) */}
        <div className="border-b border-slate-200">
          <div
            role="tablist"
            aria-label="Kategori penerima penyaluran dana"
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

        {/* 4. PANEL TAB AKTIF */}
        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-${activeTab}`}
        >
          {/* TAB 1: BENDAHARA PESANTREN */}
          {activeTab === 'BENDAHARA' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 id={tableRegionHeadingId} className="text-sm font-bold text-slate-900">
                  Pos Penyaluran ke Bendahara Pesantren
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Alokasi pembayaran SPP, USPP, EHB, Ekstrakurikuler, dan Kesehatan untuk periode {selectedPeriodLabel}.
                </p>
              </div>

              {/* Mobile Cards (md:hidden) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {data.bendaharaRows.map((row) => {
                  const periodLabel = formatPeriodLabel(row.period)
                  return (
                    <div key={`m-b-${row.itemType}`} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{row.itemLabel}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{periodLabel}</div>
                        </div>
                        <div className="shrink-0 text-right text-xs tabular-nums">
                          <button
                            type="button"
                            onClick={() =>
                              setBendaharaDetailTarget({
                                key: `item:${row.itemType}:${row.period}:sudah`,
                                itemType: row.itemType,
                                itemLabel: row.itemLabel,
                                period: row.period,
                                initialStatus: 'SUDAH_BAYAR',
                              })
                            }
                            className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                          >
                            {row.santriSudahBayar}
                          </button>
                          <span className="text-slate-400"> / </span>
                          <button
                            type="button"
                            onClick={() =>
                              setBendaharaDetailTarget({
                                key: `item:${row.itemType}:${row.period}:semua`,
                                itemType: row.itemType,
                                itemLabel: row.itemLabel,
                                period: row.period,
                                initialStatus: 'ALL',
                              })
                            }
                            className="text-slate-500 underline-offset-2 hover:underline"
                          >
                            {row.santriTerdaftar} santri
                          </button>
                          {row.santriBelumBayar > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setBendaharaDetailTarget({
                                  key: `item:${row.itemType}:${row.period}:belum`,
                                  itemType: row.itemType,
                                  itemLabel: row.itemLabel,
                                  period: row.period,
                                  initialStatus: 'BELUM_BAYAR',
                                })
                              }
                              className="block w-full text-right text-[11px] font-medium text-amber-800 hover:underline"
                            >
                              {row.santriBelumBayar} belum bayar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50/80 p-2.5 text-xs tabular-nums">
                        <div>
                          <span className="block text-[10px] font-medium uppercase text-slate-500">Masuk</span>
                          <span className="font-semibold text-slate-800">{formatRupiah(row.totalDanaMasuk)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-medium uppercase text-slate-500">Disalurkan</span>
                          <span className="font-medium text-slate-600">{formatRupiah(row.sudahDisalurkan)}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] font-medium uppercase text-slate-500">Siap Salur</span>
                          <span className={`font-bold ${row.sisaSiapSalur > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {formatRupiah(row.sisaSiapSalur)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {canDisburse && row.sisaSiapSalur > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDisburseModalTarget({
                                recipientType: 'BENDAHARA',
                                recipientId: null,
                                recipientName: 'Bendahara Pesantren',
                                itemType: row.itemType,
                                itemLabel: row.itemLabel,
                                period: row.period,
                                periodLabel,
                                availableAmount: row.sisaSiapSalur,
                              })
                            }
                            className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            <span>Catat Penyaluran</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          renderDisburseEmptyLabel(row.totalDanaMasuk, row.sisaSiapSalur)
                        )}
                      </div>
                    </div>
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
                      <th scope="col" className="py-3.5 pl-5 pr-4">Pos Finansial</th>
                      <th scope="col" className="px-4 py-3.5">Periode</th>
                      <th scope="col" className="px-4 py-3.5 text-center">Santri Bayar / Terdaftar</th>
                      <th scope="col" className="px-4 py-3.5 text-right">Dana Masuk</th>
                      <th scope="col" className="px-4 py-3.5 text-right">Sudah Disalurkan</th>
                      <th scope="col" className="px-4 py-3.5 text-right">Siap Salur</th>
                      <th scope="col" className="py-3.5 pl-4 pr-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.bendaharaRows.map((row) => {
                      const periodLabel = formatPeriodLabel(row.period)
                      return (
                        <tr key={row.itemType} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 pl-5 pr-4">
                            <span className="font-semibold text-slate-900">{row.itemLabel}</span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-600 whitespace-nowrap">
                            {periodLabel}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap tabular-nums">
                            <button
                              type="button"
                              onClick={() =>
                                setBendaharaDetailTarget({
                                  key: `item:${row.itemType}:${row.period}:sudah`,
                                  itemType: row.itemType,
                                  itemLabel: row.itemLabel,
                                  period: row.period,
                                  initialStatus: 'SUDAH_BAYAR',
                                })
                              }
                              className="font-bold text-slate-900 hover:text-emerald-700 hover:underline underline-offset-2 transition cursor-pointer"
                              title="Lihat santri yang sudah bayar"
                            >
                              {row.santriSudahBayar}
                            </button>
                            <span className="text-slate-400"> / </span>
                            <button
                              type="button"
                              onClick={() =>
                                setBendaharaDetailTarget({
                                  key: `item:${row.itemType}:${row.period}:semua`,
                                  itemType: row.itemType,
                                  itemLabel: row.itemLabel,
                                  period: row.period,
                                  initialStatus: 'ALL',
                                })
                              }
                              className="text-slate-500 hover:text-emerald-700 hover:underline underline-offset-2 transition cursor-pointer"
                              title="Lihat seluruh santri terdaftar"
                            >
                              {row.santriTerdaftar}
                            </button>
                            {row.santriBelumBayar > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setBendaharaDetailTarget({
                                    key: `item:${row.itemType}:${row.period}:belum`,
                                    itemType: row.itemType,
                                    itemLabel: row.itemLabel,
                                    period: row.period,
                                    initialStatus: 'BELUM_BAYAR',
                                  })
                                }
                                className="block w-full text-[11px] font-medium text-amber-800 hover:text-amber-900 hover:underline underline-offset-2 transition cursor-pointer"
                                title="Lihat daftar santri yang belum bayar"
                              >
                                {row.santriBelumBayar} belum bayar
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-800 whitespace-nowrap tabular-nums">
                            {formatRupiah(row.totalDanaMasuk)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-600 whitespace-nowrap tabular-nums">
                            {formatRupiah(row.sudahDisalurkan)}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap tabular-nums">
                            <span
                              className={`font-bold ${
                                row.sisaSiapSalur > 0 ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {formatRupiah(row.sisaSiapSalur)}
                            </span>
                          </td>
                          <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                            {canDisburse && row.sisaSiapSalur > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDisburseModalTarget({
                                    recipientType: 'BENDAHARA',
                                    recipientId: null,
                                    recipientName: 'Bendahara Pesantren',
                                    itemType: row.itemType,
                                    itemLabel: row.itemLabel,
                                    period: row.period,
                                    periodLabel,
                                    availableAmount: row.sisaSiapSalur,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                              >
                                <span>Salurkan</span>
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            ) : (
                              renderDisburseEmptyLabel(row.totalDanaMasuk, row.sisaSiapSalur)
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: KATERING & LAUNDRY */}
          {(activeTab === 'KATERING' || activeTab === 'LAUNDRY') && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id={tableRegionHeadingId} className="text-sm font-bold text-slate-900">
                    Daftar Penyedia {activeTab === 'KATERING' ? 'Katering (Makan)' : 'Laundry (Cuci)'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Hak penyaluran dihitung dari alokasi santri aktif pada periode {selectedPeriodLabel}.
                  </p>
                </div>

                {canManageAccounts && (
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    <span>Import Rekening Excel</span>
                  </button>
                )}
              </div>

              {data.providerRows.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {activeTab === 'LAUNDRY'
                      ? 'Belum ada santri terdaftar pada layanan laundry.'
                      : 'Belum ada penyedia katering terdaftar.'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Data penyedia untuk periode {selectedPeriodLabel} akan muncul di sini setelah terdaftar di master jasa.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards (md:hidden) */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {data.providerRows.map((p) => (
                      <div key={`m-p-${p.providerId}`} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setDetailModalProviderId(p.providerId)}
                              className="text-left text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline underline-offset-2"
                            >
                              {p.providerName}
                            </button>
                            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                              {p.santriTerdaftar} santri ·{' '}
                              <span className="font-semibold text-emerald-700">{p.santriSudahBayar} bayar</span> ·{' '}
                              <span className="font-medium text-amber-800">{p.santriBelumBayar} belum</span>
                            </div>
                          </div>
                          {p.sisaSiapSalur <= 0 && renderDisburseEmptyLabel(p.totalDanaMasuk, p.sisaSiapSalur)}
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50/80 p-2.5 text-xs tabular-nums">
                          <div>
                            <span className="block text-[10px] font-medium uppercase text-slate-500">Masuk</span>
                            <span className="font-semibold text-slate-800">{formatRupiah(p.totalDanaMasuk)}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-medium uppercase text-slate-500">Disalurkan</span>
                            <span className="font-medium text-slate-600">{formatRupiah(p.sudahDisalurkan)}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] font-medium uppercase text-slate-500">Siap Salur</span>
                            <span className={`font-bold ${p.sisaSiapSalur > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                              {formatRupiah(p.sisaSiapSalur)}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600">
                          {p.primaryAccount ? (
                            <span>
                              Rekening: <strong className="text-slate-800">{p.primaryAccount.bank_name}</strong>{' '}
                              {p.primaryAccount.account_number} (a.n {p.primaryAccount.account_holder})
                            </span>
                          ) : (
                            <span className="text-slate-400">Rekening utama belum diatur</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailModalProviderId(p.providerId)}
                            className="flex-1 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Rincian
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRekeningModalProvider({
                                id: p.providerId,
                                name: p.providerName,
                                type: p.providerType,
                              })
                            }
                            className="flex-1 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Rekening ({p.accountsCount})
                          </button>
                          {canDisburse && p.sisaSiapSalur > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDisburseModalTarget({
                                  recipientType: activeTab,
                                  recipientId: p.providerId,
                                  recipientName: p.providerName,
                                  itemType: activeTab === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI',
                                  itemLabel:
                                    activeTab === 'KATERING'
                                      ? 'Uang Makan (Katering)'
                                      : 'Uang Nyuci (Laundry)',
                                  period: selectedPeriod,
                                  periodLabel: selectedPeriodLabel,
                                  availableAmount: p.sisaSiapSalur,
                                })
                              }
                              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <span>Salurkan</span>
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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
                          <th scope="col" className="sticky left-0 z-20 bg-slate-50 py-3.5 pl-5 pr-4">
                            Nama Penyedia
                          </th>
                          <th scope="col" className="px-3.5 py-3.5 text-center">Santri</th>
                          <th scope="col" className="px-3.5 py-3.5 text-center">Bayar / Belum</th>
                          <th scope="col" className="px-3.5 py-3.5 text-right">Dana Masuk</th>
                          <th scope="col" className="px-3.5 py-3.5 text-right">Sudah Disalurkan</th>
                          <th scope="col" className="px-3.5 py-3.5 text-right">Siap Salur</th>
                          <th scope="col" className="px-3.5 py-3.5">Rekening Utama</th>
                          <th scope="col" className="py-3.5 pl-3.5 pr-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.providerRows.map((p) => (
                          <tr key={p.providerId} className="group hover:bg-slate-50/80 transition-colors">
                            <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3.5 pl-5 pr-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setDetailModalProviderId(p.providerId)}
                                className="text-left font-semibold text-slate-900 hover:text-emerald-700 hover:underline underline-offset-2 transition cursor-pointer"
                              >
                                {p.providerName}
                              </button>
                            </td>
                            <td className="px-3.5 py-3.5 text-center whitespace-nowrap tabular-nums">
                              <button
                                type="button"
                                onClick={() => setDetailModalProviderId(p.providerId)}
                                className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-emerald-700 transition cursor-pointer"
                                title="Lihat rincian operasional santri"
                              >
                                <span>{p.santriTerdaftar}</span>
                                <ArrowUpRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
                              </button>
                            </td>
                            <td className="px-3.5 py-3.5 text-center whitespace-nowrap tabular-nums">
                              <span className="font-semibold text-emerald-700">{p.santriSudahBayar}</span>
                              <span className="text-slate-400"> / </span>
                              <span className="font-medium text-amber-800">{p.santriBelumBayar}</span>
                            </td>
                            <td className="px-3.5 py-3.5 text-right font-medium text-slate-800 whitespace-nowrap tabular-nums">
                              {formatRupiah(p.totalDanaMasuk)}
                            </td>
                            <td className="px-3.5 py-3.5 text-right text-slate-600 whitespace-nowrap tabular-nums">
                              {formatRupiah(p.sudahDisalurkan)}
                            </td>
                            <td className="px-3.5 py-3.5 text-right whitespace-nowrap tabular-nums">
                              <span
                                className={`font-bold ${
                                  p.sisaSiapSalur > 0 ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {formatRupiah(p.sisaSiapSalur)}
                              </span>
                            </td>
                            <td className="px-3.5 py-3.5 whitespace-nowrap">
                              {p.primaryAccount ? (
                                <div>
                                  <span className="font-semibold text-slate-800 tabular-nums">
                                    {p.primaryAccount.bank_name} · {p.primaryAccount.account_number}
                                  </span>
                                  <span className="block text-[11px] text-slate-500">
                                    a.n {p.primaryAccount.account_holder}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Belum diatur</span>
                              )}
                            </td>
                            <td className="py-3.5 pl-3.5 pr-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDetailModalProviderId(p.providerId)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                  Rincian
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRekeningModalProvider({
                                      id: p.providerId,
                                      name: p.providerName,
                                      type: p.providerType,
                                    })
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                  Rekening ({p.accountsCount})
                                </button>
                                {canDisburse && p.sisaSiapSalur > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDisburseModalTarget({
                                        recipientType: activeTab,
                                        recipientId: p.providerId,
                                        recipientName: p.providerName,
                                        itemType: activeTab === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI',
                                        itemLabel:
                                          activeTab === 'KATERING'
                                            ? 'Uang Makan (Katering)'
                                            : 'Uang Nyuci (Laundry)',
                                        period: selectedPeriod,
                                        periodLabel: selectedPeriodLabel,
                                        availableAmount: p.sisaSiapSalur,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-2xs cursor-pointer"
                                  >
                                    <span>Salurkan</span>
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                ) : (
                                  p.totalDanaMasuk > 0 && p.sisaSiapSalur <= 0 && (
                                    renderDisburseEmptyLabel(p.totalDanaMasuk, p.sisaSiapSalur)
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: RIWAYAT PENYALURAN */}
          {activeTab === 'RIWAYAT' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id={tableRegionHeadingId} className="text-sm font-bold text-slate-900">
                    Riwayat Transaksi Penyaluran
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Seluruh histori penyaluran ke Bendahara, Katering, dan Laundry beserta kuitansi ({data.history.totalItems} transaksi).
                  </p>
                </div>

                {/* Search muncul di SEMUA ukuran layar (mobile & desktop) dengan auto-debounce */}
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
                  <label htmlFor={historySearchId} className="sr-only">
                    Cari nomor transaksi atau penerima penyaluran
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id={historySearchId}
                    type="text"
                    value={historySearch}
                    onChange={(e) => handleHistorySearchChange(e.target.value)}
                    placeholder="Cari transaksi atau penerima…"
                    className="min-h-[42px] sm:min-h-[36px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                  />
                  {historySearch && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian riwayat"
                      onClick={() => {
                        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                        setHistorySearch('')
                        refreshData(activeTab, selectedPeriod, '', 1, pageSize)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </form>
              </div>

              {data.history.items.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Belum ada riwayat penyaluran dana.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dana yang sudah disalurkan melalui tab Bendahara, Katering, atau Laundry akan tercatat di sini.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards (md:hidden) */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {data.history.items.map((row) => {
                      const methodInfo = formatMethodLabel(row.method)
                      return (
                        <div key={`m-h-${row.id}`} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {row.recipient_name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {FINANCE_ITEM_LABELS[row.item_type as FinanceItemType] || row.item_type} ·{' '}
                                {formatPeriodLabel(row.period)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatRupiah(row.total_amount)}
                              </div>
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {methodInfo.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                            <span>{formatFinanceDate(row.transferred_at, true)}</span>
                            <span className="font-mono text-slate-600">{row.distribution_number}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-500">Petugas: {row.operator_name}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setReceiptDistributionId(row.id)}
                                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Cetak</span>
                              </button>
                              {row.proof_attachment_url && (
                                <a
                                  href={row.proof_attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                >
                                  Bukti &rarr;
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
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
                          <th scope="col" className="py-3.5 pl-5 pr-4">No. Transaksi</th>
                          <th scope="col" className="px-4 py-3.5">Tanggal &amp; Waktu</th>
                          <th scope="col" className="px-4 py-3.5">Penerima</th>
                          <th scope="col" className="px-4 py-3.5">Pos &amp; Periode</th>
                          <th scope="col" className="px-4 py-3.5">Metode</th>
                          <th scope="col" className="px-4 py-3.5 text-right">Nominal</th>
                          <th scope="col" className="px-4 py-3.5">Petugas</th>
                          <th scope="col" className="py-3.5 pl-4 pr-5 text-right">Kuitansi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.history.items.map((row) => {
                          const methodInfo = formatMethodLabel(row.method)
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 pl-5 pr-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                {row.distribution_number}
                              </td>
                              <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap tabular-nums">
                                {formatFinanceDate(row.transferred_at, true)}
                              </td>
                              <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                {row.recipient_name}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="font-semibold text-slate-800">
                                  {FINANCE_ITEM_LABELS[row.item_type as FinanceItemType] || row.item_type}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {formatPeriodLabel(row.period)}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                    methodInfo.isBank
                                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20'
                                      : 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
                                  }`}
                                >
                                  {methodInfo.isBank ? (
                                    <Building2 className="h-3 w-3" aria-hidden="true" />
                                  ) : (
                                    <HandCoins className="h-3 w-3" aria-hidden="true" />
                                  )}
                                  {methodInfo.label}
                                </span>
                                {row.destination_bank && (
                                  <span className="mt-0.5 block text-[11px] text-slate-500 tabular-nums">
                                    {row.destination_bank} ({row.destination_account})
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                {formatRupiah(row.total_amount)}
                              </td>
                              <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                                {row.operator_name}
                              </td>
                              <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setReceiptDistributionId(row.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                  >
                                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Cetak</span>
                                  </button>
                                  {row.proof_attachment_url && (
                                    <a
                                      href={row.proof_attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                                      title="Lihat Bukti Transfer"
                                    >
                                      Bukti &rarr;
                                    </a>
                                  )}
                                </div>
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
                        {historyStart}–{historyEnd}
                      </strong>{' '}
                      dari{' '}
                      <strong className="font-semibold text-slate-700">
                        {data.history.totalItems}
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

                      {data.history.totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => refreshData(activeTab, selectedPeriod, historySearch, 1, pageSize)}
                            disabled={data.history.page === 1}
                            aria-label="Halaman pertama"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              refreshData(activeTab, selectedPeriod, historySearch, data.history.page - 1, pageSize)
                            }
                            disabled={data.history.page === 1}
                            aria-label="Halaman sebelumnya"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>

                          {getPageRange(data.history.page, data.history.totalPages).map((p, idx) =>
                            p === '...' ? (
                              <span key={`dots-${idx}`} className="px-1 text-xs text-slate-400">
                                …
                              </span>
                            ) : (
                              <button
                                key={p}
                                type="button"
                                onClick={() => refreshData(activeTab, selectedPeriod, historySearch, p, pageSize)}
                                aria-current={p === data.history.page ? 'page' : undefined}
                                className={`h-8 w-8 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                                  p === data.history.page
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
                            onClick={() =>
                              refreshData(activeTab, selectedPeriod, historySearch, data.history.page + 1, pageSize)
                            }
                            disabled={data.history.page === data.history.totalPages}
                            aria-label="Halaman berikutnya"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              refreshData(activeTab, selectedPeriod, historySearch, data.history.totalPages, pageSize)
                            }
                            disabled={data.history.page === data.history.totalPages}
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
          )}
        </div>
      </div>

      {/* Modals */}
      <CatatPenyaluranModal
        isOpen={!!disburseModalTarget}
        onClose={() => setDisburseModalTarget(null)}
        onSuccess={(newId) => {
          refreshData()
          if (newId) {
            setReceiptDistributionId(newId)
          }
        }}
        target={disburseModalTarget}
        canTransfer={canTransfer}
      />

      <RekeningModal
        isOpen={!!rekeningModalProvider}
        onClose={() => setRekeningModalProvider(null)}
        onUpdated={() => refreshData()}
        provider={rekeningModalProvider}
        canManage={canManageAccounts}
      />

      <BuktiPenyaluranModal
        isOpen={!!receiptDistributionId}
        onClose={() => setReceiptDistributionId(null)}
        distributionId={receiptDistributionId}
      />

      <ProviderDetailModal
        isOpen={!!detailModalProviderId}
        onClose={() => setDetailModalProviderId(null)}
        providerId={detailModalProviderId}
        period={selectedPeriod}
        serviceType={activeTab === 'LAUNDRY' ? 'Cuci' : 'Makan'}
      />

      <RekeningImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refreshData()}
        serviceType={activeTab === 'LAUNDRY' ? 'Cuci' : 'Makan'}
      />

      <BendaharaItemDetailModal
        key={bendaharaDetailTarget?.key ?? 'bendahara-detail'}
        isOpen={!!bendaharaDetailTarget}
        onClose={() => setBendaharaDetailTarget(null)}
        target={bendaharaDetailTarget}
      />
    </div>
  )
}
