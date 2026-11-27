'use client'

// app/dashboard/keuangan/rekonsiliasi/_page-content.tsx
// Antarmuka Modul Rekonsiliasi & Koreksi Finansial
// Memenuhi PRD Bab 32, BRI PRD, & UI/UX Guidelines Bab 22 ("Problem First & Bahasa Operasional")

import React, { useId, useRef, useState, useTransition } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Info,
  Landmark,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SelectPicker } from '@/components/ui/select-picker'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import { formatFinanceDate } from '@/lib/finance/date-format'
import BriWorkbench from './bri-workbench'
import CashTransferPanel from './cash-transfer-panel'
import ManualAllocationModal from './manual-allocation-modal'
import RecordCorrectionModal from './record-correction-modal'
import RecoveryCaseModal from './recovery-case-modal'
import {
  getReconciliationPageData,
  findPaymentForCorrection,
  executeLegacyBackfillAction,
  type ReconciliationPageData,
} from './actions'
import type {
  UnallocatedReconciliationRow,
  FinanceCorrection,
  FinanceSettlement,
  CashSessionReconciliationSummary,
} from '@/lib/finance/reconciliation-types'

type EnrichedCorrection = FinanceCorrection & {
  creator_name: string | null
  payment_number: string
  santri_name: string
  nis: string
}

type ReconTab = ReconciliationPageData['activeTab']

interface RekonsiliasiContentProps {
  initialData: ReconciliationPageData
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatMethodLabel(method?: string | null): string {
  if (!method) return 'Internal / Buku'
  switch (method) {
    case 'BRI_VA':
    case 'BRI':
      return 'BRIVA'
    case 'MANUAL_TRANSFER':
    case 'TRANSFER':
      return 'Transfer Manual'
    case 'CASH':
      return 'Tunai'
    case 'BRI_QLOLA':
      return 'BRI QLola'
    default:
      return method.replace(/_/g, ' ')
  }
}

function formatMatchStatusLabel(status: string): string {
  switch (status) {
    case 'UNALLOCATED_TRANSFER':
      return 'Transfer belum teralokasi'
    case 'AMOUNT_MISMATCH':
      return 'Selisih nominal'
    case 'UNMATCHED_INTERNAL':
      return 'Belum cocok di bank'
    case 'UNMATCHED_EXTERNAL':
      return 'Belum ada di sistem'
    default:
      return status.replace(/_/g, ' ')
  }
}

function formatResolutionLabel(action: string): string {
  switch (action) {
    case 'MANUAL_ALLOCATED':
      return 'Dialokasikan Manual'
    case 'REFUNDED':
      return 'Dikembalikan'
    case 'RESOLVED':
      return 'Selesai'
    case 'NONE':
      return 'Menunggu Tindakan'
    default:
      return action.replace(/_/g, ' ')
  }
}

function formatItemTypeLabel(itemType: string): string {
  return FINANCE_ITEM_LABELS[itemType as FinanceItemType] || itemType.replace(/_/g, ' ')
}

function formatCorrectionTypeLabel(type: string): string {
  switch (type) {
    case 'VOID':
      return 'Void (Batal)'
    case 'REVERSAL':
      return 'Reversal (Balik Buku)'
    case 'REFUND':
      return 'Refund (Pengembalian)'
    default:
      return type
  }
}

export default function RekonsiliasiContent({ initialData }: RekonsiliasiContentProps) {
  const [data, setData] = useState<ReconciliationPageData>(initialData)
  const [activeTab, setActiveTab] = useState<ReconTab>(initialData.activeTab || 'SETTLEMENT')
  const [selectedPeriod, setSelectedPeriod] = useState(initialData.selectedPeriod)
  const [isPending, startTransition] = useTransition()

  // Modal States
  const [manualAllocItem, setManualAllocItem] = useState<UnallocatedReconciliationRow | null>(null)
  const [correctionPayment, setCorrectionPayment] = useState<{
    id: string
    payment_number: string
    gross_amount: number
    channel: string
    santri_name: string
    cash_session_id?: string | null
  } | null>(null)
  const [paymentSearchInput, setPaymentSearchInput] = useState('')
  const [isSearchingPayment, setIsSearchingPayment] = useState(false)
  const [recoveryCaseItem, setRecoveryCaseItem] = useState<
    | (FinanceCorrection & {
        payment_number: string
        santri_name: string
        nis: string
      })
    | null
  >(null)

  // Filter State Riwayat Koreksi
  const [correctionTypeFilter, setCorrectionTypeFilter] = useState('ALL')

  // State Sinkronisasi Modul Lama
  const [isSyncingLegacy, setIsSyncingLegacy] = useState(false)

  const tabIdPrefix = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const handleRefresh = (
    newTab: ReconTab = activeTab,
    newPeriod: string = selectedPeriod,
    newCorrectionStatus: string = correctionTypeFilter
  ) => {
    startTransition(async () => {
      try {
        const updated = await getReconciliationPageData({
          tab: newTab,
          period: newPeriod,
          status: newCorrectionStatus,
        })
        setData(updated)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Data rekonsiliasi belum dapat dimuat.')
      }
    })
  }

  const handleTabChange = (tab: ReconTab) => {
    setActiveTab(tab)
    tabRefs.current[tab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    handleRefresh(tab, selectedPeriod, correctionTypeFilter)
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    handleRefresh(activeTab, period, correctionTypeFilter)
  }

  const handleCorrectionFilterChange = (nextStatus: string) => {
    setCorrectionTypeFilter(nextStatus)
    handleRefresh(activeTab, selectedPeriod, nextStatus)
  }

  const handleRunLegacySync = async () => {
    if (isSyncingLegacy) return
    setIsSyncingLegacy(true)
    const toastId = toast.loading('Menyinkronkan pembayaran modul lama…')
    try {
      const res = await executeLegacyBackfillAction({ limit: 500 })
      if (!res.success) {
        toast.error(res.error || 'Gagal menyinkronkan data.', { id: toastId })
      } else {
        const r = res.report!
        toast.success(
          `Sinkronisasi selesai: ${r.synced} data baru disinkronkan, ${r.alreadySynced} sudah sinkron, ${r.excluded} dikecualikan.`,
          { id: toastId }
        )
        handleRefresh('LEGACY_BRIDGE', selectedPeriod, correctionTypeFilter)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan saat sinkronisasi.', {
        id: toastId,
      })
    } finally {
      setIsSyncingLegacy(false)
    }
  }

  const { kpi, userPermissions } = data

  const tabs: Array<{
    id: ReconTab
    label: string
    badge?: number
  }> = [
    { id: 'SETTLEMENT', label: 'Rekonsiliasi Bank' },
    { id: 'KAS_LOKET', label: 'Kas Loket & Fisik' },
    {
      id: 'UNALLOCATED',
      label: 'Perlu Resolusi',
      badge: kpi.unallocatedCount + kpi.recoveryPendingCount,
    },
    { id: 'KOREKSI', label: 'Riwayat Koreksi' },
    {
      id: 'LEGACY_BRIDGE',
      label: 'Sinkronisasi Modul Lama',
      badge:
        data.legacyBridgeData?.preview?.toSyncCount && data.legacyBridgeData.preview.toSyncCount > 0
          ? data.legacyBridgeData.preview.toSyncCount
          : undefined,
    },
  ]

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null
    if (event.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIdx = 0
    else if (event.key === 'End') nextIdx = tabs.length - 1

    if (nextIdx !== null) {
      event.preventDefault()
      const nextTab = tabs[nextIdx]
      const el = tabRefs.current[nextTab.id]
      el?.focus()
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 1. Header & SelectPicker Periode + Segarkan */}
      <DashboardPageHeader
        title="Rekonsiliasi & Koreksi"
        description="Pencocokan pembayaran online dengan rekening koran, rekonsiliasi kas loket, resolusi dana belum teralokasi, dan riwayat koreksi."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SelectPicker
              value={selectedPeriod}
              options={data.periodOptions}
              onChange={handlePeriodChange}
              prefixLabel="Periode"
              icon={<Calendar className="h-4 w-4" />}
              ariaLabel="Pilih periode rekonsiliasi"
              disabled={isPending}
              align="left"
              menuClassName="sm:right-0 sm:left-auto"
            />

            <button
              type="button"
              onClick={() => handleRefresh(activeTab, selectedPeriod, correctionTypeFilter)}
              disabled={isPending}
              aria-label="Segarkan data rekonsiliasi"
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
        {/* 2. Summary KPI Cards (4 Kartu Clickable, Gaya Tenang Seragam) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Belum Settlement */}
          <button
            type="button"
            onClick={() => handleTabChange('SETTLEMENT')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xs hover:border-amber-300 hover:bg-amber-50/20 transition-colors cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Belum Settlement Bank</span>
                <Landmark className="h-4 w-4 text-amber-700" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(kpi.totalPendingSettlementAmount)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs tabular-nums">
              <span className={kpi.pendingSettlementCount > 0 ? 'font-medium text-amber-800 truncate' : 'text-emerald-700 font-medium truncate'}>
                {kpi.pendingSettlementCount > 0
                  ? `${kpi.pendingSettlementCount} pembayaran menunggu rekonsiliasi`
                  : 'Semua pembayaran online settled'}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-amber-700" aria-hidden="true" />
            </div>
          </button>

          {/* Card 2: Perlu Alokasi Manual */}
          <button
            type="button"
            onClick={() => handleTabChange('UNALLOCATED')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20 transition-colors cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Perlu Alokasi Manual</span>
                <GitBranch className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(kpi.totalUnallocatedAmount)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs tabular-nums">
              <span className={kpi.unallocatedCount > 0 ? 'font-medium text-amber-800 truncate' : 'text-slate-500 truncate'}>
                {kpi.unallocatedCount} transfer belum teralokasi
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700" aria-hidden="true" />
            </div>
          </button>

          {/* Card 3: Selisih Kas Loket */}
          <button
            type="button"
            onClick={() => handleTabChange('KAS_LOKET')}
            className={`group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xs transition-colors cursor-pointer ${
              kpi.discrepancySessionsCount > 0
                ? 'hover:border-rose-300 hover:bg-rose-50/20'
                : 'hover:border-emerald-300 hover:bg-emerald-50/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Selisih Kas Fisik Loket</span>
                <Wallet
                  className={`h-4 w-4 ${kpi.discrepancySessionsCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(kpi.totalCashDifference)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs tabular-nums">
              <span
                className={
                  kpi.discrepancySessionsCount > 0
                    ? 'font-medium text-rose-700 truncate'
                    : 'font-medium text-emerald-700 truncate'
                }
              >
                {kpi.discrepancySessionsCount > 0
                  ? `${kpi.discrepancySessionsCount} sesi kas ada selisih fisik`
                  : 'Seluruh sesi kas seimbang pas'}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
            </div>
          </button>

          {/* Card 4: Klaim Pemulihan Vendor */}
          <button
            type="button"
            onClick={() => handleTabChange('UNALLOCATED')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wide">Klaim Pemulihan Vendor</span>
                <ShieldAlert className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatRupiah(kpi.totalRecoveryPendingAmount)}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs tabular-nums">
              <span className={kpi.recoveryPendingCount > 0 ? 'font-medium text-indigo-800 truncate' : 'text-slate-500 truncate'}>
                {kpi.recoveryPendingCount} kasus dana telanjur disalurkan
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-700" aria-hidden="true" />
            </div>
          </button>
        </div>

        {/* 3. Navigation Tabs (Single-row horizontal scroll, accessible tablist) */}
        <div className="border-b border-slate-200">
          <div
            role="tablist"
            aria-label="Bagian rekonsiliasi dan koreksi"
            className="flex gap-1 overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab, idx) => {
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
                  className="relative inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer aria-[selected=true]:text-emerald-800 aria-[selected=true]:after:content-[''] aria-[selected=true]:after:absolute aria-[selected=true]:after:inset-x-0 aria-[selected=true]:after:bottom-0 aria-[selected=true]:after:border-b-2 aria-[selected=true]:after:border-emerald-600"
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900 tabular-nums">
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 4. Tab Content Panels */}
        <div role="tabpanel" aria-labelledby={`${tabIdPrefix}-${activeTab}`} className="space-y-5">
          {/* ─── TAB 1: REKONSILIASI BANK ─── */}
          {activeTab === 'SETTLEMENT' && (
            <div className="space-y-5">
              <BriWorkbench canMutate={data.userPermissions.canMutate} />
              <CashTransferPanel canMutate={data.userPermissions.canMutate} />

              {/* Penjelasan Operasional Settlement (tanpa jargon developer) */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="text-xs text-slate-600 leading-relaxed text-pretty">
                  <strong className="text-slate-800">Ketentuan settlement bank:</strong> Pembayaran online yang diterima tetap berstatus <em>Menunggu Rekonsiliasi</em> sampai dicocokkan dengan bukti rekening koran. Biaya admin Koperasi dan dana titipan uang jajan dicatat terpisah dari hak penyaluran Pesantren, Katering, dan Laundry.
                </div>
              </div>

              {/* Riwayat Batch Settlement */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
                  <span className="text-sm font-bold text-slate-900">Riwayat Batch Settlement Bank</span>
                </div>

                {!data.settlementData?.history.settlements.length ? (
                  <div className="px-5 py-10 text-center text-xs text-slate-500">
                    Belum ada batch settlement bank yang tercatat pada periode ini.
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards */}
                    <div className="divide-y divide-slate-100 md:hidden">
                      {data.settlementData.history.settlements.map(
                        (s: FinanceSettlement & { verifier_name: string | null }) => (
                          <div key={`m-set-${s.id}`} className="p-4 space-y-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-mono font-semibold text-slate-900">{s.settlement_number}</div>
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  {formatFinanceDate(s.settlement_date, false)} · {s.total_payments_count} trx
                                </div>
                              </div>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  s.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {s.status === 'COMPLETED' ? 'Settled Bank' : 'Selisih Statement'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 tabular-nums">
                              <span>
                                {s.destination_bank} ({s.destination_account})
                              </span>
                              <span className="font-bold text-slate-900">{formatRupiah(s.total_net_amount)}</span>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-5 py-3">No. Settlement</th>
                            <th className="px-4 py-3">Tanggal</th>
                            <th className="px-4 py-3">Rekening Tujuan</th>
                            <th className="px-4 py-3 text-center">Transaksi</th>
                            <th className="px-4 py-3 text-right">Bruto</th>
                            <th className="px-4 py-3 text-right">Potongan</th>
                            <th className="px-4 py-3 text-right">Net Diterima</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-5 py-3">Diverifikasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.settlementData.history.settlements.map(
                            (s: FinanceSettlement & { verifier_name: string | null }) => (
                              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-5 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                  {s.settlement_number}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                  {formatFinanceDate(s.settlement_date, false)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="font-medium text-slate-800">{s.destination_bank}</div>
                                  <div className="text-[11px] text-slate-500 tabular-nums">{s.destination_account}</div>
                                </td>
                                <td className="px-4 py-3 text-center font-medium whitespace-nowrap tabular-nums">
                                  {s.total_payments_count} trx
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                                  {formatRupiah(s.total_gross_amount)}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap tabular-nums">
                                  {formatRupiah(s.total_fee_amount)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                                  {formatRupiah(s.total_net_amount)}
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                      s.status === 'COMPLETED'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-800'
                                    }`}
                                  >
                                    {s.status === 'COMPLETED' ? 'Settled Bank' : 'Selisih Statement'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                                  {s.verifier_name || '—'}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB 2: KAS LOKET & FISIK ─── */}
          {activeTab === 'KAS_LOKET' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Rekonsiliasi Sesi Kas Fisik Loket</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Perbandingan saldo seharusnya di laci loket dengan uang fisik yang dihitung saat tutup sesi.
                </p>
              </div>

              {!data.cashData?.sessions.length ? (
                <div className="px-5 py-12 text-center text-xs text-slate-500">
                  Tidak ada data sesi kas loket pada periode ini.
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {data.cashData.sessions.map((s: CashSessionReconciliationSummary) => (
                      <div key={`m-cs-${s.sessionId}`} className="p-4 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-mono font-semibold text-slate-900">{s.sessionCode}</div>
                            <div className="text-[11px] text-slate-500">
                              {s.operatorName || '—'} · Buka {formatFinanceDate(s.openedAt, true)}
                            </div>
                          </div>
                          {s.reconciliationStatus === 'SEIMBANG' ? (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Seimbang
                            </span>
                          ) : s.reconciliationStatus === 'SELISIH' ? (
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              Ada Selisih
                            </span>
                          ) : (
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Sesi Terbuka
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50/80 p-2.5 tabular-nums">
                          <div>
                            <span className="block text-[10px] uppercase text-slate-500">Saldo Sistem</span>
                            <span className="font-semibold text-slate-800">{formatRupiah(s.expectedClosingBalance)}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-slate-500">Kas Fisik</span>
                            <span className="font-semibold text-slate-900">
                              {s.actualClosingBalance !== null ? formatRupiah(s.actualClosingBalance) : '—'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] uppercase text-slate-500">Selisih</span>
                            <span
                              className={`font-bold ${
                                s.difference === null || s.difference === 0
                                  ? 'text-emerald-700'
                                  : s.difference > 0
                                    ? 'text-sky-700'
                                    : 'text-rose-700'
                              }`}
                            >
                              {s.difference === null || s.difference === 0
                                ? 'Rp0'
                                : s.difference > 0
                                  ? `+${formatRupiah(s.difference)}`
                                  : `-${formatRupiah(Math.abs(s.difference))}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Kode Sesi</th>
                          <th className="px-4 py-3">Petugas</th>
                          <th className="px-4 py-3">Waktu Buka / Tutup</th>
                          <th className="px-4 py-3 text-right">Kas Awal</th>
                          <th className="px-4 py-3 text-right">Masuk / Keluar</th>
                          <th className="px-4 py-3 text-right">Saldo Sistem</th>
                          <th className="px-4 py-3 text-right">Kas Fisik</th>
                          <th className="px-4 py-3 text-right">Selisih</th>
                          <th className="px-5 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.cashData.sessions.map((s: CashSessionReconciliationSummary) => (
                          <tr key={s.sessionId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {s.sessionCode}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{s.operatorName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                              <div>Buka: {formatFinanceDate(s.openedAt, true)}</div>
                              {s.closedAt && <div>Tutup: {formatFinanceDate(s.closedAt, true)}</div>}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                              {formatRupiah(s.openingBalance)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                              <div className="text-emerald-700">+{formatRupiah(s.totalCashIn)}</div>
                              <div className="text-rose-700">-{formatRupiah(s.totalCashOut)}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap tabular-nums">
                              {formatRupiah(s.expectedClosingBalance)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                              {s.actualClosingBalance !== null ? formatRupiah(s.actualClosingBalance) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums">
                              {s.difference === null || s.difference === 0 ? (
                                <span className="text-emerald-700">Rp0</span>
                              ) : s.difference > 0 ? (
                                <span className="text-sky-700">+{formatRupiah(s.difference)}</span>
                              ) : (
                                <span className="text-rose-700">-{formatRupiah(Math.abs(s.difference))}</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              {s.reconciliationStatus === 'SEIMBANG' ? (
                                <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  Seimbang
                                </span>
                              ) : s.reconciliationStatus === 'SELISIH' ? (
                                <span className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                  Ada Selisih
                                </span>
                              ) : (
                                <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  Sesi Terbuka
                                </span>
                              )}
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

          {/* ─── TAB 3: PERLU RESOLUSI (PROBLEM FIRST) ─── */}
          {activeTab === 'UNALLOCATED' && (
            <div className="space-y-5">
              {/* Bagian A: Transaksi Belum Teralokasi */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    Dana Belum Teralokasi
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Dana transfer tanpa order aktif atau nominal berbeda diamankan di sini sampai Bendahara menentukan alokasinya secara manual.
                  </p>
                </div>

                {!data.unallocatedData?.items.length ? (
                  <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      Tidak ada transaksi yang perlu diperiksa
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-slate-500">
                      Seluruh dana masuk sudah dialokasikan dengan benar ke kewajiban santri.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards */}
                    <div className="divide-y divide-slate-100 md:hidden">
                      {data.unallocatedData.items.map((row: UnallocatedReconciliationRow) => (
                        <div key={`m-ua-${row.id}`} className="p-4 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{row.santri_name}</div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                NIS {row.nis} · {formatMethodLabel(row.method)}
                              </div>
                            </div>
                            <div className="text-sm font-bold text-amber-800 tabular-nums">
                              {formatRupiah(row.discrepancy_amount)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                              {formatMatchStatusLabel(row.match_status)}
                            </span>
                            <span className="tabular-nums">{formatFinanceDate(row.paid_at, true)}</span>
                          </div>
                          {row.resolution_notes && (
                            <p className="text-xs text-slate-600">{row.resolution_notes}</p>
                          )}
                          <div className="pt-1">
                            {row.resolution_action === 'NONE' && userPermissions.canMutate ? (
                              <button
                                type="button"
                                onClick={() => setManualAllocItem(row)}
                                className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                <span>Alokasi Manual</span>
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            ) : (
                              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {formatResolutionLabel(row.resolution_action)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-5 py-3">Waktu Bayar</th>
                            <th className="px-4 py-3">Santri</th>
                            <th className="px-4 py-3">No. Pembayaran</th>
                            <th className="px-4 py-3">Metode</th>
                            <th className="px-4 py-3 text-right">Nominal Dana</th>
                            <th className="px-4 py-3">Status Masalah</th>
                            <th className="px-4 py-3">Catatan</th>
                            <th className="px-5 py-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.unallocatedData.items.map((row: UnallocatedReconciliationRow) => (
                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-5 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                                {formatFinanceDate(row.paid_at, true)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-semibold text-slate-900">{row.santri_name}</div>
                                <div className="text-[11px] text-slate-500 tabular-nums">NIS {row.nis}</div>
                              </td>
                              <td className="px-4 py-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                                {row.payment_number}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{formatMethodLabel(row.method)}</td>
                              <td className="px-4 py-3 text-right font-bold text-amber-800 whitespace-nowrap tabular-nums">
                                {formatRupiah(row.discrepancy_amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  {formatMatchStatusLabel(row.match_status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                                {row.resolution_notes || '—'}
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                {row.resolution_action === 'NONE' && userPermissions.canMutate ? (
                                  <button
                                    type="button"
                                    onClick={() => setManualAllocItem(row)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                  >
                                    <span>Alokasi Manual</span>
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                ) : (
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    {formatResolutionLabel(row.resolution_action)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Bagian B: Kasus Pemulihan Dana Vendor */}
              {data.unallocatedData?.recoveryCases && data.unallocatedData.recoveryCases.length > 0 && (
                <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50/40 px-5 py-3.5">
                    <ShieldAlert className="h-4 w-4 text-indigo-700" aria-hidden="true" />
                    <span className="text-sm font-bold text-slate-900">
                      Kasus Pemulihan Dana Vendor
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="border-b border-indigo-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3">No. Koreksi</th>
                          <th className="px-4 py-3">Santri</th>
                          <th className="px-4 py-3">Target Pembayaran</th>
                          <th className="px-4 py-3 text-right">Nominal Tertagih</th>
                          <th className="px-4 py-3">Keterangan</th>
                          <th className="px-5 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.unallocatedData.recoveryCases.map((rc: EnrichedCorrection) => (
                          <tr key={rc.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {rc.correction_number}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                              {rc.santri_name}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                              {rc.payment_number}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-indigo-800 whitespace-nowrap tabular-nums">
                              {formatRupiah(rc.recovery_amount)}
                            </td>
                            <td className="px-4 py-3 text-slate-500 max-w-sm">
                              {rc.recovery_notes || rc.reason}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              {userPermissions.canMutate && (
                                <button
                                  type="button"
                                  onClick={() => setRecoveryCaseItem(rc)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                >
                                  Selesaikan Kasus
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 4: RIWAYAT KOREKSI (VOID / REVERSAL / REFUND) ─── */}
          {activeTab === 'KOREKSI' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'VOID', 'REVERSAL', 'REFUND'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleCorrectionFilterChange(t)}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        correctionTypeFilter === t
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'ALL' ? 'Semua Koreksi' : formatCorrectionTypeLabel(t)}
                    </button>
                  ))}
                </div>

                {userPermissions.canMutate && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!paymentSearchInput.trim() || isSearchingPayment) return
                      setIsSearchingPayment(true)
                      try {
                        const res = await findPaymentForCorrection(paymentSearchInput.trim())
                        if (!res.success || !res.payment) {
                          toast.error(res.error || 'Pembayaran tidak ditemukan.')
                        } else {
                          setCorrectionPayment(res.payment)
                          setPaymentSearchInput('')
                        }
                      } catch {
                        toast.error('Gagal mencari pembayaran.')
                      } finally {
                        setIsSearchingPayment(false)
                      }
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="text"
                      value={paymentSearchInput}
                      onChange={(e) => setPaymentSearchInput(e.target.value)}
                      placeholder="No. Pembayaran (PAY-…)"
                      className="min-h-[38px] flex-1 sm:w-52 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!paymentSearchInput.trim() || isSearchingPayment}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${isSearchingPayment ? 'animate-spin' : ''}`} aria-hidden="true" />
                      <span>Koreksi Pembayaran</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
                  <span className="text-sm font-bold text-slate-900">
                    Histori Koreksi Transaksi
                  </span>
                </div>

                {!data.correctionData?.corrections.length ? (
                  <div className="px-5 py-12 text-center text-xs text-slate-500">
                    Belum ada transaksi koreksi yang tercatat.
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards */}
                    <div className="divide-y divide-slate-100 md:hidden">
                      {data.correctionData.corrections.map((c: EnrichedCorrection) => (
                        <div key={`m-cor-${c.id}`} className="p-4 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{c.santri_name}</div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {c.correction_number} · {c.payment_number}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-rose-700 tabular-nums">
                                {formatRupiah(c.total_amount)}
                              </div>
                              <span className="mt-0.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {formatCorrectionTypeLabel(c.correction_type)}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-600">{c.reason}</p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                            <span>{formatFinanceDate(c.created_at, true)}</span>
                            <span>Oleh: {c.creator_name || '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-5 py-3">No. Koreksi</th>
                            <th className="px-4 py-3">Waktu</th>
                            <th className="px-4 py-3">Jenis</th>
                            <th className="px-4 py-3">Santri</th>
                            <th className="px-4 py-3">Target Pembayaran</th>
                            <th className="px-4 py-3 text-right">Nominal</th>
                            <th className="px-4 py-3">Metode</th>
                            <th className="px-4 py-3">Alasan</th>
                            <th className="px-5 py-3">Oleh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.correctionData.corrections.map((c: EnrichedCorrection) => (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-5 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {c.correction_number}
                              </td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                                {formatFinanceDate(c.created_at, true)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                    c.correction_type === 'VOID'
                                      ? 'bg-slate-100 text-slate-800'
                                      : c.correction_type === 'REVERSAL'
                                        ? 'bg-sky-50 text-sky-800'
                                        : 'bg-rose-50 text-rose-800'
                                  }`}
                                >
                                  {formatCorrectionTypeLabel(c.correction_type)}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-semibold text-slate-900">{c.santri_name}</div>
                                <div className="text-[11px] text-slate-500 tabular-nums">NIS {c.nis}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                                {c.payment_number}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-700 whitespace-nowrap tabular-nums">
                                {formatRupiah(c.total_amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{formatMethodLabel(c.method)}</td>
                              <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{c.reason}</td>
                              <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                                {c.creator_name || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB 5: SINKRONISASI MODUL LAMA ─── */}
          {activeTab === 'LEGACY_BRIDGE' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Sinkronisasi Pembayaran Modul Lama</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Menjembatani pembayaran dari modul lama agar tercatat aman di Sistem Keuangan Baru tanpa duplikasi.
                  </p>
                </div>
                {userPermissions.canMutate && (
                  <button
                    type="button"
                    onClick={handleRunLegacySync}
                    disabled={isSyncingLegacy || !data.legacyBridgeData?.preview?.toSyncCount}
                    className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncingLegacy ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>
                      {isSyncingLegacy
                        ? 'Menyinkronkan…'
                        : `Sinkronkan Data (${data.legacyBridgeData?.preview?.toSyncCount || 0})`}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <p className="text-pretty">
                  <strong className="text-slate-900">Pemisahan Pengelolaan Dana (Pra-Koperasi):</strong> Seluruh pembayaran dari modul lama ditandai permanen sebagai dana Pra-Koperasi—kewajiban santri lunas, namun tidak dihitung ke dalam kas laci fisik loket Koperasi.
                </p>
              </div>

              {data.legacyBridgeData?.preview && (
                <>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-xs font-medium text-slate-500">Total Transaksi Lama</span>
                      <div className="mt-1.5 text-lg font-bold text-slate-900 tabular-nums">
                        {formatRupiah(data.legacyBridgeData.preview.totalLegacyAmount)}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {data.legacyBridgeData.preview.totalLegacyRecords} data terdeteksi
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-xs font-medium text-slate-500">Sudah Tersinkronkan</span>
                      <div className="mt-1.5 text-lg font-bold text-slate-900 tabular-nums">
                        {formatRupiah(data.legacyBridgeData.preview.alreadySyncedAmount)}
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-emerald-700 tabular-nums">
                        {data.legacyBridgeData.preview.alreadySyncedCount} pembayaran diakui
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-xs font-medium text-slate-500">Belum Tersinkronkan</span>
                      <div className="mt-1.5 text-lg font-bold text-slate-900 tabular-nums">
                        {formatRupiah(data.legacyBridgeData.preview.toSyncAmount)}
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-amber-800 tabular-nums">
                        {data.legacyBridgeData.preview.toSyncCount} pembayaran siap diproses
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-xs font-medium text-slate-500">Dikecualikan (Batal/Nol)</span>
                      <div className="mt-1.5 text-lg font-bold text-slate-900 tabular-nums">
                        {formatRupiah(data.legacyBridgeData.preview.excludedAmount)}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {data.legacyBridgeData.preview.excludedCount} data diabaikan
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Rincian Berdasarkan Pos Tagihan
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {Object.entries(data.legacyBridgeData.preview.byItemType).map(([key, item]) => (
                        <div key={key} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3">
                          <div className="text-xs font-bold text-slate-900">{formatItemTypeLabel(key)}</div>
                          <div className="mt-1 text-xs text-slate-500 tabular-nums">{item.count} data</div>
                          <div className="text-xs font-semibold text-slate-900 tabular-nums">
                            {formatRupiah(item.amount)}
                          </div>
                          {item.toSyncCount > 0 && (
                            <div className="mt-1 text-[11px] font-medium text-amber-800 tabular-nums">
                              {item.toSyncCount} belum sinkron
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
                  <span className="text-sm font-bold text-slate-900">Sampel Transaksi Modul Lama</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {data.legacyBridgeData?.preview?.sampleCandidates.length || 0} sampel
                  </span>
                </div>

                {!data.legacyBridgeData?.preview?.sampleCandidates.length ? (
                  <div className="px-5 py-10 text-center text-xs text-slate-500">
                    Tidak ada data modul lama yang perlu ditampilkan.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Sumber &amp; ID</th>
                          <th className="px-4 py-3">Santri</th>
                          <th className="px-4 py-3">Pos Tagihan</th>
                          <th className="px-4 py-3">Periode</th>
                          <th className="px-4 py-3 text-right">Nominal</th>
                          <th className="px-4 py-3">Tanggal Bayar</th>
                          <th className="px-5 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.legacyBridgeData.preview.sampleCandidates.map((c, idx) => (
                          <tr key={`${c.source}-${c.sourceId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-800">{c.source}</div>
                              <div className="font-mono text-[11px] text-slate-500">#{c.sourceId}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">{c.santriName || '—'}</div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                NIS {c.santriNis || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                              {formatItemTypeLabel(c.itemType)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.period}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                              {formatRupiah(c.amount)}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                              {formatFinanceDate(c.paidAt, true)}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              {c.isAlreadySynced ? (
                                <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  Sudah Sinkron
                                </span>
                              ) : c.isExcluded ? (
                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  Dikecualikan
                                </span>
                              ) : (
                                <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  Belum Sinkron
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Modals */}
      {manualAllocItem && (
        <ManualAllocationModal
          isOpen={!!manualAllocItem}
          onClose={() => setManualAllocItem(null)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod, correctionTypeFilter)}
          item={manualAllocItem}
        />
      )}

      {correctionPayment && (
        <RecordCorrectionModal
          isOpen={!!correctionPayment}
          onClose={() => setCorrectionPayment(null)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod, correctionTypeFilter)}
          payment={correctionPayment}
        />
      )}

      {recoveryCaseItem && (
        <RecoveryCaseModal
          isOpen={!!recoveryCaseItem}
          onClose={() => setRecoveryCaseItem(null)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod, correctionTypeFilter)}
          recoveryCase={recoveryCaseItem}
        />
      )}
    </div>
  )
}
