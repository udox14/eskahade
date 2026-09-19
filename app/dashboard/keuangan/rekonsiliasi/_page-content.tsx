'use client'

// app/dashboard/keuangan/rekonsiliasi/_page-content.tsx
// Antarmuka Modul Rekonsiliasi & Koreksi Finansial (Fase 8)
// Memenuhi PRD Bab 32, UI/UX Guidelines Bab 22 ("Problem First & UI Tenang")

import React, { useState, useTransition } from 'react'
import {
  Bank,
  Wallet,
  ArrowsSplit,
  ArrowCounterClockwise,
  CheckCircle,
  PlusCircle,
  ArrowRight,
  ShieldWarning,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import InputSettlementModal from './input-settlement-modal'
import ManualAllocationModal from './manual-allocation-modal'
import RecordCorrectionModal from './record-correction-modal'
import RecoveryCaseModal from './recovery-case-modal'
import {
  getReconciliationPageData,
  findPaymentForCorrection,
  type ReconciliationPageData,
  type PeriodOption,
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

interface RekonsiliasiContentProps {
  initialData: ReconciliationPageData
}

export default function RekonsiliasiContent({ initialData }: RekonsiliasiContentProps) {
  const [data, setData] = useState<ReconciliationPageData>(initialData)
  const [activeTab, setActiveTab] = useState<ReconciliationPageData['activeTab']>(
    initialData.activeTab || 'SETTLEMENT'
  )
  const [selectedPeriod, setSelectedPeriod] = useState(initialData.selectedPeriod)
  const [, startTransition] = useTransition()

  // Modal States
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
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
  const [recoveryCaseItem, setRecoveryCaseItem] = useState<(FinanceCorrection & {
    payment_number: string
    santri_name: string
    nis: string
  }) | null>(null)

  // Filter State Riwayat Koreksi
  const [correctionTypeFilter, setCorrectionTypeFilter] = useState('ALL')

  const handleRefresh = (newTab?: ReconciliationPageData['activeTab'], newPeriod?: string) => {
    startTransition(async () => {
      const updated = await getReconciliationPageData({
        tab: newTab || activeTab,
        period: newPeriod || selectedPeriod,
        status: correctionTypeFilter,
      })
      setData(updated)
    })
  }

  const handleTabChange = (tab: ReconciliationPageData['activeTab']) => {
    setActiveTab(tab)
    handleRefresh(tab, selectedPeriod)
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    handleRefresh(activeTab, period)
  }

  const { kpi, userPermissions } = data

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            Rekonsiliasi & Koreksi
          </h1>
          <p className="text-xs text-slate-500">
            Pencocokan tiga arah Duitku ↔ Bank, rekonsiliasi kas loket, resolusi transfer ambigu, dan histori koreksi non-destruktif.
          </p>
        </div>

        {/* Period Picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Periode:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
          >
            {data.periodOptions.map((opt: PeriodOption) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Summary KPI Cards (Maksimal 4 Cards Operasional) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Belum Settlement */}
        <div className="rounded-2xl border border-amber-100 bg-linear-to-b from-amber-50/50 to-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Belum Settlement (Duitku)</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Bank size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-amber-900">
            Rp {kpi.totalPendingSettlementAmount.toLocaleString('id-ID')}
          </div>
          <p className="mt-0.5 text-[11px] text-amber-700">
            {kpi.pendingSettlementCount} pembayaran online siap dicairkan
          </p>
        </div>

        {/* Card 2: Dana Tak Bertuan (Unallocated) */}
        <div className="rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50/50 to-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-800">Perlu Alokasi Manual</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ArrowsSplit size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-blue-900">
            Rp {kpi.totalUnallocatedAmount.toLocaleString('id-ID')}
          </div>
          <p className="mt-0.5 text-[11px] text-blue-700">
            {kpi.unallocatedCount} transfer Fixed VA tanpa order aktif
          </p>
        </div>

        {/* Card 3: Selisih Kas Loket */}
        <div
          className={`rounded-2xl border p-4 shadow-2xs ${
            kpi.discrepancySessionsCount > 0
              ? 'border-rose-100 bg-linear-to-b from-rose-50/50 to-white'
              : 'border-emerald-100 bg-linear-to-b from-emerald-50/50 to-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium ${
                kpi.discrepancySessionsCount > 0 ? 'text-rose-800' : 'text-emerald-800'
              }`}
            >
              Selisih Kas Fisik Loket
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                kpi.discrepancySessionsCount > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <Wallet size={16} weight="bold" />
            </div>
          </div>
          <div
            className={`mt-2 text-lg font-bold ${
              kpi.discrepancySessionsCount > 0 ? 'text-rose-900' : 'text-emerald-900'
            }`}
          >
            Rp {kpi.totalCashDifference.toLocaleString('id-ID')}
          </div>
          <p
            className={`mt-0.5 text-[11px] ${
              kpi.discrepancySessionsCount > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {kpi.discrepancySessionsCount > 0
              ? `${kpi.discrepancySessionsCount} sesi kas mencatat selisih fisik`
              : 'Seluruh sesi kas seimbang pas'}
          </p>
        </div>

        {/* Card 4: Pemulihan Dana (Recovery Cases) */}
        <div className="rounded-2xl border border-indigo-100 bg-linear-to-b from-indigo-50/50 to-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-800">Klaim Pemulihan Vendor</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <ShieldWarning size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-indigo-900">
            Rp {kpi.totalRecoveryPendingAmount.toLocaleString('id-ID')}
          </div>
          <p className="mt-0.5 text-[11px] text-indigo-700">
            {kpi.recoveryPendingCount} kasus dana telanjur disalurkan
          </p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-medium" aria-label="Tabs">
          {[
            { id: 'SETTLEMENT' as const, label: 'Duitku & Settlement', icon: Bank },
            { id: 'KAS_LOKET' as const, label: 'Kas Loket & Fisik', icon: Wallet },
            {
              id: 'UNALLOCATED' as const,
              label: 'Perlu Resolusi',
              icon: ArrowsSplit,
              badge: kpi.unallocatedCount + kpi.recoveryPendingCount,
            },
            { id: 'KOREKSI' as const, label: 'Riwayat Koreksi', icon: ArrowCounterClockwise },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 border-b-2 py-3 transition-colors ${
                  isActive
                    ? 'border-emerald-600 text-emerald-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon size={16} weight={isActive ? 'bold' : 'regular'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 4. Tab Content Panels */}
      <div className="space-y-4">
        {/* ─── TAB 1: DUITKU & SETTLEMENT ─── */}
        {activeTab === 'SETTLEMENT' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Pencairan Dana Gateway ke Bank</h3>
                <p className="text-xs text-slate-500">
                  Pembayaran berstatus PAID belum otomatis di-settle sampai tercatat pada rekening koran bank pesantren.
                </p>
              </div>
              {userPermissions.canMutate && (
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(true)}
                  disabled={!data.settlementData?.candidates.length}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  <PlusCircle size={16} />
                  <span>Catat Batch Settlement ({data.settlementData?.candidates.length || 0})</span>
                </button>
              )}
            </div>

            {/* Riwayat Batch Settlement */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-700">Riwayat Batch Settlement Bank</span>
              </div>

              {!data.settlementData?.history.settlements.length ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada batch settlement bank yang tercatat pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">No. Settlement</th>
                        <th className="px-5 py-3">Tanggal</th>
                        <th className="px-5 py-3">Rekening Tujuan</th>
                        <th className="px-5 py-3 text-center">Jumlah Pembayaran</th>
                        <th className="px-5 py-3 text-right">Total Bruto</th>
                        <th className="px-5 py-3 text-right">Total Fee</th>
                        <th className="px-5 py-3 text-right">Net Dicairkan</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3">Diverifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.settlementData.history.settlements.map((s: FinanceSettlement & { verifier_name: string | null }) => (
                        <tr key={s.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-semibold text-slate-800">{s.settlement_number}</td>
                          <td className="px-5 py-3">{s.settlement_date}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{s.destination_bank}</div>
                            <div className="text-[10px] text-slate-400">{s.destination_account}</div>
                          </td>
                          <td className="px-5 py-3 text-center font-medium">{s.total_payments_count} trx</td>
                          <td className="px-5 py-3 text-right">Rp {s.total_gross_amount.toLocaleString('id-ID')}</td>
                          <td className="px-5 py-3 text-right text-slate-500">Rp {s.total_fee_amount.toLocaleString('id-ID')}</td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-700">
                            Rp {s.total_net_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                s.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {s.status === 'COMPLETED' ? 'Settled Bank' : 'Selisih Statement'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{s.verifier_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: KAS LOKET & FISIK ─── */}
        {activeTab === 'KAS_LOKET' && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="border-b border-slate-100 px-5 py-3.5 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700">Rekonsiliasi Sesi Kas Fisik Loket</span>
                <p className="text-[11px] text-slate-500">
                  Mencocokkan expected closing balance di laci loket dengan uang fisik riil saat tutup sesi.
                </p>
              </div>
            </div>

            {!data.cashData?.sessions.length ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Tidak ada data sesi kas loket pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Kode Sesi</th>
                      <th className="px-5 py-3">Kasir / Operator</th>
                      <th className="px-5 py-3">Waktu Buka / Tutup</th>
                      <th className="px-5 py-3 text-right">Kas Awal</th>
                      <th className="px-5 py-3 text-right">Kas Masuk</th>
                      <th className="px-5 py-3 text-right">Kas Keluar</th>
                      <th className="px-5 py-3 text-right">Expected Kas</th>
                      <th className="px-5 py-3 text-right">Kas Fisik</th>
                      <th className="px-5 py-3 text-right">Selisih</th>
                      <th className="px-5 py-3 text-center">Status Rekonsiliasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.cashData.sessions.map((s: CashSessionReconciliationSummary) => (
                      <tr key={s.sessionId} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-semibold text-slate-800">{s.sessionCode}</td>
                        <td className="px-5 py-3">{s.operatorName || '-'}</td>
                        <td className="px-5 py-3 text-[11px] text-slate-500">
                          <div>Buka: {s.openedAt.slice(0, 16).replace('T', ' ')}</div>
                          {s.closedAt && <div>Tutup: {s.closedAt.slice(0, 16).replace('T', ' ')}</div>}
                        </td>
                        <td className="px-5 py-3 text-right">Rp {s.openingBalance.toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3 text-right text-emerald-700">+Rp {s.totalCashIn.toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3 text-right text-rose-700">-Rp {s.totalCashOut.toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">
                          Rp {s.expectedClosingBalance.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {s.actualClosingBalance !== null ? `Rp ${s.actualClosingBalance.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          {s.difference === null || s.difference === 0 ? (
                            <span className="text-emerald-700">Rp 0</span>
                          ) : s.difference > 0 ? (
                            <span className="text-blue-700">+Rp {s.difference.toLocaleString('id-ID')}</span>
                          ) : (
                            <span className="text-rose-700">-Rp {Math.abs(s.difference).toLocaleString('id-ID')}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {s.reconciliationStatus === 'SEIMBANG' ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Seimbang
                            </span>
                          ) : s.reconciliationStatus === 'SELISIH' ? (
                            <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              Ada Selisih
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Sesi Terbuka
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
        )}

        {/* ─── TAB 3: PERLU RESOLUSI (PROBLEM FIRST) ─── */}
        {activeTab === 'UNALLOCATED' && (
          <div className="space-y-6">
            {/* Bagian A: Transaksi Unallocated */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="border-b border-slate-100 px-5 py-3.5 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    Transaksi Belum Dialokasikan (Transfer Tanpa Order Aktif)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Sesuai PRD Aturan Anti-Menebak Alokasi: Dana diamankan dan hanya dialokasikan setelah konfirmasi Bendahara.
                  </p>
                </div>
              </div>

              {!data.unallocatedData?.items.length ? (
                <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <CheckCircle size={32} className="text-emerald-500" />
                  <span className="font-semibold text-slate-700">Tidak ada transaksi yang perlu diperiksa.</span>
                  <span className="text-slate-400">Seluruh dana masuk telah dialokasikan dengan benar ke kewajiban santri.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Waktu Bayar</th>
                        <th className="px-5 py-3">Santri</th>
                        <th className="px-5 py-3">No. Pembayaran</th>
                        <th className="px-5 py-3">Metode</th>
                        <th className="px-5 py-3 text-right">Nominal Dana</th>
                        <th className="px-5 py-3">Status Masalah</th>
                        <th className="px-5 py-3">Catatan Audit</th>
                        <th className="px-5 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.unallocatedData.items.map((row: UnallocatedReconciliationRow) => (
                        <tr key={row.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 text-[11px] text-slate-500">
                            {row.paid_at.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-800">{row.santri_name}</div>
                            <div className="text-[10px] text-slate-400">NIS: {row.nis}</div>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-700">{row.payment_number}</td>
                          <td className="px-5 py-3">{row.method}</td>
                          <td className="px-5 py-3 text-right font-bold text-amber-800">
                            Rp {row.discrepancy_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              {row.match_status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[11px] text-slate-500 max-w-xs truncate">
                            {row.resolution_notes || '-'}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {row.resolution_action === 'NONE' && userPermissions.canMutate ? (
                              <button
                                type="button"
                                onClick={() => setManualAllocItem(row)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                              >
                                <span>Alokasi Manual</span>
                                <ArrowRight size={13} />
                              </button>
                            ) : (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {row.resolution_action}
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

            {/* Bagian B: Kasus Pemulihan Dana (Recovery Cases) */}
            {data.unallocatedData?.recoveryCases && data.unallocatedData.recoveryCases.length > 0 && (
              <div className="rounded-2xl border border-indigo-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-indigo-100 px-5 py-3.5 bg-indigo-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldWarning size={18} className="text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-900">
                      Kasus Pemulihan Dana Vendor (Recovery Cases)
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-indigo-100 bg-indigo-50/40 text-[11px] font-semibold text-indigo-800">
                      <tr>
                        <th className="px-5 py-3">No. Koreksi</th>
                        <th className="px-5 py-3">Santri</th>
                        <th className="px-5 py-3">Target Pembayaran</th>
                        <th className="px-5 py-3 text-right">Nominal Tertagih</th>
                        <th className="px-5 py-3">Keterangan / Investigasi</th>
                        <th className="px-5 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.unallocatedData.recoveryCases.map((rc: EnrichedCorrection) => (
                        <tr key={rc.id} className="hover:bg-indigo-50/30">
                          <td className="px-5 py-3 font-semibold text-slate-800">{rc.correction_number}</td>
                          <td className="px-5 py-3 font-medium">{rc.santri_name}</td>
                          <td className="px-5 py-3 text-slate-600">{rc.payment_number}</td>
                          <td className="px-5 py-3 text-right font-bold text-indigo-700">
                            Rp {rc.recovery_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3 text-[11px] text-slate-500 max-w-sm">
                            {rc.recovery_notes || rc.reason}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {userPermissions.canMutate && (
                              <button
                                type="button"
                                onClick={() => setRecoveryCaseItem(rc)}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {['ALL', 'VOID', 'REVERSAL', 'REFUND'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setCorrectionTypeFilter(t)
                      handleRefresh(activeTab, selectedPeriod)
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      correctionTypeFilter === t
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'ALL' ? 'Semua Koreksi' : t}
                  </button>
                ))}
              </div>

              {userPermissions.canMutate && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={paymentSearchInput}
                    onChange={(e) => setPaymentSearchInput(e.target.value)}
                    placeholder="No. Pembayaran (PAY-...)"
                    className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={!paymentSearchInput.trim() || isSearchingPayment}
                    onClick={async () => {
                      if (!paymentSearchInput.trim()) return
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
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-900 disabled:opacity-50"
                  >
                    <ArrowCounterClockwise size={14} className={isSearchingPayment ? 'animate-spin' : ''} />
                    <span>Koreksi Pembayaran</span>
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-700">Histori Transaksi Koreksi Non-Destruktif</span>
              </div>

              {!data.correctionData?.corrections.length ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada transaksi koreksi yang tercatat.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">No. Koreksi</th>
                        <th className="px-5 py-3">Waktu</th>
                        <th className="px-5 py-3">Jenis</th>
                        <th className="px-5 py-3">Santri</th>
                        <th className="px-5 py-3">Target Pembayaran</th>
                        <th className="px-5 py-3 text-right">Nominal</th>
                        <th className="px-5 py-3">Metode</th>
                        <th className="px-5 py-3">Alasan Koreksi</th>
                        <th className="px-5 py-3">Oleh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.correctionData.corrections.map((c: EnrichedCorrection) => (
                        <tr key={c.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-semibold text-slate-800">{c.correction_number}</td>
                          <td className="px-5 py-3 text-[11px] text-slate-500">
                            {c.created_at.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                c.correction_type === 'VOID'
                                  ? 'bg-slate-100 text-slate-800'
                                  : c.correction_type === 'REVERSAL'
                                  ? 'bg-blue-50 text-blue-800'
                                  : 'bg-rose-50 text-rose-800'
                              }`}
                            >
                              {c.correction_type}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-800">{c.santri_name}</div>
                            <div className="text-[10px] text-slate-400">NIS: {c.nis}</div>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-700">{c.payment_number}</td>
                          <td className="px-5 py-3 text-right font-bold text-rose-700">
                            Rp {c.total_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3 text-slate-600">{c.method || 'Internal/Buku'}</td>
                          <td className="px-5 py-3 text-[11px] text-slate-600 max-w-xs truncate">
                            {c.reason}
                          </td>
                          <td className="px-5 py-3 text-[11px] text-slate-500">{c.creator_name || '-'}</td>
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

      {/* 5. Modals */}
      {isSettlementModalOpen && (
        <InputSettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod)}
          candidates={data.settlementData?.candidates || []}
        />
      )}

      {manualAllocItem && (
        <ManualAllocationModal
          isOpen={!!manualAllocItem}
          onClose={() => setManualAllocItem(null)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod)}
          item={manualAllocItem}
        />
      )}

      {correctionPayment && (
        <RecordCorrectionModal
          isOpen={!!correctionPayment}
          onClose={() => setCorrectionPayment(null)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod)}
          payment={correctionPayment}
        />
      )}

      {recoveryCaseItem && (
        <RecoveryCaseModal
          isOpen={!!recoveryCaseItem}
          onClose={() => setRecoveryCaseItem(null)}
          onSuccess={() => handleRefresh(activeTab, selectedPeriod)}
          recoveryCase={recoveryCaseItem}
        />
      )}
    </div>
  )
}
