'use client'

// app/dashboard/keuangan/_page-content.tsx
// Antarmuka Dashboard Keuangan & KPI Eksekutif
// Memenuhi PRD Bab 33, BRI PRD, & UI/UX Guidelines:
// 1. Pemisahan mutlak Kas Pesantren vs Dana Titipan Santri (Uang Jajan)
// 2. Pemisahan Payment PAID vs SETTLED
// 3. Indikator Perlu Perhatian (Verifikasi Transfer, Pencairan Kolektif, Rekonsiliasi, Sesi Kasir)
// 4. KPI Clickable untuk drill-down langsung & Aksi Cepat sesuai alur operasional terbaru
// 5. Grafik Tren sinkron periode & Transaksi Terbaru ramah operasional dengan Detail Drawer

import React, { useState, useTransition, useId } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Landmark,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  Calendar,
  Coins,
  Send,
  Scale,
  Store,
  FileCheck2,
  Users,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SelectPicker } from '@/components/ui/select-picker'
import { TransactionDetailDrawer } from './riwayat/transaction-detail-drawer'
import { getDashboardData, type UserDashboardPermissions } from './actions'
import type { FinanceDashboardData, RecentTransactionItem } from '@/lib/finance/dashboard'
import type { FinanceCashSession } from '@/lib/finance/cash-session'
import type { GlobalTransactionRow } from '@/lib/finance/history'
import { formatFinanceDate } from '@/lib/finance/date-format'

interface DashboardKeuanganContentProps {
  initialData: FinanceDashboardData
  userPermissions: UserDashboardPermissions
  initialCashSession?: FinanceCashSession | null
}

/**
 * Format nominal integer Rupiah sesuai UI_UX_GUIDELINES:
 * "Rp150.000" (tanpa spasi setelah Rp, tanpa desimal ,00)
 */
function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateIndo(dateStr: string): string {
  return formatFinanceDate(dateStr, true)
}

function toWibDateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value.trim())
    ? `${value.trim().replace(' ', 'T')}Z`
    : value
  const d = new Date(normalized)
  if (!Number.isFinite(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(d)
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatPeriodLabel(period: string): string {
  const parts = period.split('-')
  if (parts.length === 2) {
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${BULAN_NAMES[monthIdx]} ${year}`
    }
  }
  return period
}

function formatMethodLabel(method: string): string {
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
    case 'SYSTEM':
      return 'Sistem'
    default:
      return method.replace(/_/g, ' ')
  }
}

function formatStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'SETTLED':
      return {
        label: 'Settled Bank',
        className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
      }
    case 'PAID':
      return {
        label: 'Diterima',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
      }
    case 'COMPLETED':
      return {
        label: 'Selesai',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
      }
    case 'VOID':
      return {
        label: 'Dibatalkan',
        className: 'bg-rose-50 text-rose-700 border border-rose-200/70',
      }
    case 'REVERSAL':
      return {
        label: 'Koreksi',
        className: 'bg-rose-50 text-rose-700 border border-rose-200/70',
      }
    case 'REFUND':
      return {
        label: 'Pengembalian',
        className: 'bg-amber-50 text-amber-800 border border-amber-200/70',
      }
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
      }
  }
}

/**
 * Mengubah UUID mentah atau key internal (seperti LOKET_DEPOSIT:<uuid>:PAY-...)
 * menjadi referensi pendek yang enak dipindai di tabel; nilai penuh tetap tersedia di tooltip & drawer.
 */
function formatReferenceDisplay(rawRef: string, category: RecentTransactionItem['category']): string {
  if (!rawRef) return '-'
  const trimmed = rawRef.trim()

  if (trimmed.startsWith('LOKET_DEPOSIT:')) {
    const parts = trimmed.split(':')
    const shortId = (parts[1] || '').replace(/-/g, '').slice(0, 6).toUpperCase()
    return shortId ? `LOKET-${shortId}` : 'LOKET-SETOR'
  }

  // UUID v4 atau string hex panjang
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    const prefix = category === 'WITHDRAWAL' ? 'WDR' : category === 'TOPUP' ? 'TOP' : 'REF'
    return `${prefix}-${trimmed.slice(0, 8).toUpperCase()}`
  }

  if (trimmed.length > 24) {
    return `${trimmed.slice(0, 21)}…`
  }

  return trimmed
}

function toGlobalTransactionRow(tx: RecentTransactionItem): GlobalTransactionRow {
  return {
    id: tx.id,
    sourceTable: tx.sourceTable,
    transactionNumber: tx.transactionNumber,
    category: tx.category,
    categoryLabel: tx.categoryLabel,
    fundType: tx.fundType,
    direction: tx.direction,
    amount: tx.amount,
    grossAmount: tx.amount,
    gatewayFee: 0,
    netAmount: tx.amount,
    channel: tx.channel,
    method: tx.method,
    status: tx.status,
    itemType: tx.itemType,
    itemLabel: tx.itemLabel,
    santriId: null,
    santriName: tx.santriName,
    santriNis: tx.santriNis,
    santriAsrama: tx.santriAsrama,
    santriKamar: tx.santriKamar,
    recipientInfo: tx.recipientInfo,
    operatorName: tx.operatorName,
    externalReference: tx.externalReference,
    notes: tx.notes,
    createdAt: tx.createdAt,
  }
}

export default function DashboardKeuanganContent({
  initialData,
  initialCashSession,
}: DashboardKeuanganContentProps) {
  const [data, setData] = useState<FinanceDashboardData>(initialData)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.selectedPeriod)
  const [cashSession, setCashSession] = useState<FinanceCashSession | null>(initialCashSession ?? null)
  const [selectedTx, setSelectedTx] = useState<GlobalTransactionRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recentTxHeadingId = useId()

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod)
    startTransition(async () => {
      try {
        setErrorMessage(null)
        const res = await getDashboardData(newPeriod)
        setData(res.data)
        if (res.activeCashSession !== undefined) {
          setCashSession(res.activeCashSession)
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Data dashboard belum dapat dimuat. Coba lagi.')
      }
    })
  }

  const handleRefresh = () => {
    handlePeriodChange(selectedPeriod)
  }

  const { kpi, charts, recentTransactions } = data
  const { pesantren, uangJajan, kasir, mismatch, operations } = kpi

  const todayWib = toWibDateKey(data.generatedAt)
  const sessionOpenedWib = cashSession ? toWibDateKey(cashSession.opened_at) : null
  const isCashSessionStale = Boolean(cashSession && todayWib && sessionOpenedWib && sessionOpenedWib < todayWib)

  // Susun rincian penyebab selisih rekonsiliasi secara lengkap (termasuk amountMismatchCount)
  const mismatchDetails: string[] = []
  if (mismatch.unallocatedTransfersCount > 0) {
    mismatchDetails.push(
      `${mismatch.unallocatedTransfersCount} dana belum teralokasi (${formatRupiah(mismatch.unallocatedTransfersAmount)})`
    )
  }
  if (mismatch.amountMismatchCount > 0) {
    mismatchDetails.push(`${mismatch.amountMismatchCount} transaksi selisih nominal / belum cocok`)
  }
  if (mismatch.cashDiscrepanciesCount > 0) {
    mismatchDetails.push(`${mismatch.cashDiscrepanciesCount} sesi kas dengan selisih fisik`)
  }
  if (mismatch.settlementDiscrepanciesCount > 0) {
    mismatchDetails.push(`${mismatch.settlementDiscrepanciesCount} selisih settlement bank`)
  }
  if (mismatch.pendingRecoveryCasesCount > 0) {
    mismatchDetails.push(`${mismatch.pendingRecoveryCasesCount} kasus pemulihan dana tersalurkan`)
  }

  // Hitung nilai maksimum untuk scaling bar chart tren
  const maxTrendVal = Math.max(
    ...charts.trends.map((t) => Math.max(t.penerimaanPesantren, t.penyaluranDana)),
    1
  )

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 1. Header Halaman + Kontrol Periode Ramping */}
      <DashboardPageHeader
        title="Dashboard Keuangan"
        description="Ikhtisar penerimaan kas pesantren, dana titipan santri, penyaluran, dan status rekonsiliasi."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SelectPicker
              value={selectedPeriod}
              options={data.periodList}
              onChange={handlePeriodChange}
              prefixLabel="Periode"
              icon={<Calendar className="h-4 w-4" />}
              ariaLabel="Pilih periode dashboard keuangan"
              disabled={isPending}
              align="left"
              menuClassName="sm:right-0 sm:left-auto"
            />

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              aria-label="Segarkan data dashboard keuangan"
              className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Segarkan</span>
            </button>
          </div>
        }
      />

      {/* Pesan Kesalahan jika ada */}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      )}

      <div
        aria-busy={isPending}
        className={`space-y-6 transition-opacity duration-200 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {/* 2. Panel Ringkas: Status Sesi Kasir & Perlu Perhatian */}
        <section
          aria-label="Status operasional dan hal yang perlu perhatian"
          className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs overflow-hidden"
        >
          {/* Baris A: Status Sesi Kasir */}
          <div className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${isCashSessionStale ? 'bg-amber-50/40' : ''}`}>
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`mt-0.5 shrink-0 rounded-lg p-2 ${
                  isCashSessionStale
                    ? 'bg-amber-100 text-amber-800'
                    : cashSession
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Store className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {isCashSessionStale
                      ? 'Sesi Kasir Belum Ditutup'
                      : cashSession
                        ? 'Sesi Kasir Aktif'
                        : 'Sesi Kasir Belum Dibuka'}
                  </h2>
                  {cashSession ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                        isCashSessionStale
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isCashSessionStale ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}
                      />
                      {cashSession.session_code}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                      Non-aktif
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-600 text-pretty">
                  {cashSession ? (
                    <>
                      Dibuka {formatDateIndo(cashSession.opened_at)}
                      {' · '}Saldo laci:{' '}
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {formatRupiah(cashSession.expected_closing_balance)}
                      </span>
                      {kasir.openSessionsCount > 1 && (
                        <> · Total {kasir.openSessionsCount} sesi terbuka di sistem</>
                      )}
                      {isCashSessionStale && ' — sebaiknya segera diperiksa dan ditutup.'}
                    </>
                  ) : (
                    <>
                      Buka sesi kas di loket sebelum melayani setoran tunai atau pencairan uang jajan.
                      {kasir.openSessionsCount > 0 && ` (${kasir.openSessionsCount} sesi petugas lain sedang aktif)`}
                    </>
                  )}
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/koperasi/loket"
              className={`inline-flex min-h-[40px] sm:min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                isCashSessionStale
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : cashSession
                    ? 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <span>
                {isCashSessionStale
                  ? 'Periksa / Tutup Sesi'
                  : cashSession
                    ? 'Buka Loket Kasir'
                    : 'Buka Sesi Kas'}
              </span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {/* Baris B: Antrean Verifikasi Transfer Manual (jika ada) */}
          {operations.pendingTransferVerificationsCount > 0 && (
            <div className="flex flex-col gap-3 bg-emerald-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0 rounded-lg bg-emerald-100 p-1.5 text-emerald-800">
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {operations.pendingTransferVerificationsCount} Bukti Transfer Menunggu Verifikasi
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
                    Total nominal pengajuan: {formatRupiah(operations.pendingTransferVerificationsAmount)}. Periksa mutasi rekening sebelum menyetujui.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/keuangan/verifikasi-transfer"
                className="inline-flex min-h-[40px] sm:min-h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <span>Verifikasi Transfer</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {/* Baris C: Batch Pencairan Kolektif Berstatus DIBAWA (jika ada) */}
          {operations.activeCollectiveBatchesCount > 0 && (
            <div className="flex flex-col gap-3 bg-indigo-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0 rounded-lg bg-indigo-100 p-1.5 text-indigo-800">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {operations.activeCollectiveBatchesCount} Batch Pencairan Kolektif Masih Dibawa Perwakilan
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
                    Total dana beredar: {formatRupiah(operations.activeCollectiveBatchesAmount)}. Selesaikan laporan terima/batal sebelum menutup sesi kasir.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/koperasi/pencairan-uang-jajan"
                className="inline-flex min-h-[40px] sm:min-h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 transition-colors"
              >
                <span>Selesaikan Batch</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {/* Baris D: Status Rekonsiliasi & Selisih */}
          {mismatch.hasMismatch ? (
            <div className="flex flex-col gap-3 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0 rounded-lg bg-amber-100 p-1.5 text-amber-800">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-950">
                    Ditemukan {mismatch.totalMismatchCount} Selisih / Kasus Rekonsiliasi
                  </p>
                  <p className="mt-0.5 text-xs text-amber-900/90 text-pretty">
                    {mismatchDetails.length > 0
                      ? `${mismatchDetails.join(' · ')}. Perlu diperiksa sebelum tutup buku.`
                      : 'Diperlukan audit selisih sebelum penutupan pembukuan.'}
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/keuangan/rekonsiliasi"
                className="inline-flex min-h-[40px] sm:min-h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                <span>Buka Rekonsiliasi</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  <strong className="text-slate-800">Rekonsiliasi seimbang</strong> — tidak ada selisih mutasi atau kas terbuka.
                </span>
              </div>
              <Link
                href="/dashboard/keuangan/rekonsiliasi"
                className="shrink-0 font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Lihat &rarr;
              </Link>
            </div>
          )}
        </section>

        {/* 3. Kas & Penerimaan Pesantren (4 KPI Clickable) */}
        <section aria-label="Kas dan penerimaan operasional pesantren">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 text-balance">
                Kas &amp; Penerimaan Pesantren
              </h2>
              <span className="rounded-md bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Dana Operasional
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Periode: {formatPeriodLabel(selectedPeriod)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Penerimaan Pesantren */}
            <Link
              href="/dashboard/keuangan/riwayat"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Penerimaan Pesantren</span>
                  <Coins className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(pesantren.totalPenerimaan)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600 tabular-nums">
                <span className="truncate">
                  Online {formatRupiah(pesantren.onlinePenerimaan)} · Tunai {formatRupiah(pesantren.cashPenerimaan)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>

            {/* Card 2: Settlement Bank (BRI) */}
            <Link
              href="/dashboard/keuangan/rekonsiliasi"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Settlement Bank (BRI)</span>
                  <Landmark className="h-4 w-4 text-slate-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(pesantren.settledAmount)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs tabular-nums">
                {pesantren.pendingSettlementAmount > 0 ? (
                  <span className="font-medium text-amber-800 truncate">
                    Menunggu rekonsiliasi: {formatRupiah(pesantren.pendingSettlementAmount)} ({pesantren.pendingSettlementCount} trx)
                  </span>
                ) : (
                  <span className="font-medium text-emerald-700 truncate">
                    Seluruh penerimaan bank sudah settled
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>

            {/* Card 3: Penyaluran Dana */}
            <Link
              href="/dashboard/keuangan/penyaluran"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Penyaluran Dana</span>
                  <Send className="h-4 w-4 text-slate-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(pesantren.totalDisbursed)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs tabular-nums">
                <span className="font-medium text-emerald-800 truncate">
                  Siap disalurkan: {formatRupiah(pesantren.readyToDisburse)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>

            {/* Card 4: Total Tunggakan */}
            <Link
              href="/dashboard/keuangan/status-pembayaran?tab=TUNGGAKAN"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-rose-300 hover:bg-rose-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Tunggakan</span>
                  <Scale className="h-4 w-4 text-rose-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(pesantren.totalTunggakan)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs tabular-nums">
                <span className="font-medium text-rose-700 truncate">
                  {pesantren.santriMenunggakCount} santri belum lunas
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-rose-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>
          </div>
        </section>

        {/* 4. Dana Titipan Santri (Uang Jajan) — Selaras dengan Section Atas, Tetap Terpisah Secara Konsep */}
        <section aria-label="Dana titipan santri uang jajan">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 text-balance">
                  Dana Titipan Santri (Uang Jajan)
                </h2>
                <span className="rounded-md bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                  Liabilitas Santri
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 text-pretty">
                Terpisah dari kas pesantren — amanah titipan wali santri yang dapat dicairkan sewaktu-waktu.
              </p>
            </div>

            <Link
              href="/dashboard/keuangan/uang-jajan"
              className="inline-flex min-h-[32px] shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              <span>Buku Besar Uang Jajan</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {/* Card 1: Total Saldo Titipan */}
            <Link
              href="/dashboard/keuangan/uang-jajan"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Saldo Titipan</span>
                  <Wallet className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(uangJajan.totalTitipanBalance)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 tabular-nums">
                <span className="truncate">
                  {uangJajan.activeStudentsWithBalance} santri memiliki saldo
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>

            {/* Card 2: Top-Up Periode Ini */}
            <Link
              href="/dashboard/keuangan/uang-jajan"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Top-Up Periode Ini</span>
                  <ArrowDownLeft className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(uangJajan.topupPeriod)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 tabular-nums">
                <span className="truncate">
                  Online {formatRupiah(uangJajan.topupOnline)} · Tunai {formatRupiah(uangJajan.topupCash)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>

            {/* Card 3: Pencairan Periode Ini */}
            <Link
              href="/dashboard/koperasi/pencairan-uang-jajan"
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wide">Pencairan Periode Ini</span>
                  <ArrowUpRight className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatRupiah(uangJajan.withdrawalPeriod)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <span className="truncate">
                  Pencairan kolektif asrama &amp; loket
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-700 transition-colors" aria-hidden="true" />
              </div>
            </Link>
          </div>
        </section>

        {/* 5. Aksi Cepat Operasional (Dipromosikan ke atas grafik & diperbarui sesuai alur terbaru) */}
        <section aria-label="Aksi cepat operasional">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Aksi Cepat Operasional
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <Link
              href="/dashboard/keuangan/status-pembayaran"
              className="group flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
            >
              <div className="shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900">Catat Pembayaran</div>
                <div className="text-[11px] text-slate-500 truncate">Status &amp; bayar tunai</div>
              </div>
            </Link>

            <Link
              href="/dashboard/keuangan/verifikasi-transfer"
              className="group flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
            >
              <div className="shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 truncate">Verifikasi Transfer</span>
                  {operations.pendingTransferVerificationsCount > 0 && (
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                      {operations.pendingTransferVerificationsCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">Bukti transfer wali</div>
              </div>
            </Link>

            <Link
              href="/dashboard/koperasi/pencairan-uang-jajan"
              className="group flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
            >
              <div className="shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-700">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 truncate">Pencairan Kolektif</span>
                  {operations.activeCollectiveBatchesCount > 0 && (
                    <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                      {operations.activeCollectiveBatchesCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">Uang jajan per asrama</div>
              </div>
            </Link>

            <Link
              href="/dashboard/keuangan/penyaluran"
              className="group flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
            >
              <div className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-700">
                <Send className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900">Salurkan Dana</div>
                <div className="text-[11px] text-slate-500 truncate">Pesantren, Katering, Laundry</div>
              </div>
            </Link>

            <Link
              href="/dashboard/keuangan/rekonsiliasi"
              className="group col-span-2 sm:col-span-1 flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
            >
              <div className="shrink-0 rounded-lg bg-amber-50 p-2 text-amber-800">
                <Scale className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 truncate">Rekonsiliasi Bank</span>
                  {mismatch.totalMismatchCount > 0 && (
                    <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                      {mismatch.totalMismatchCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">Settlement &amp; selisih</div>
              </div>
            </Link>
          </div>
        </section>

        {/* 6. Insight & Tren Bulanan */}
        <section aria-label="Tren dan komposisi penerimaan" className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Chart 1: Tren Bulanan (2 Cols) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 text-balance">
                  Tren Penerimaan vs Penyaluran
                </h3>
                <p className="text-xs text-slate-500">
                  6 bulan berakhir pada {formatPeriodLabel(selectedPeriod)}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                  Penerimaan
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-500" />
                  Penyaluran
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {charts.trends.map((t) => {
                const inWidth =
                  t.penerimaanPesantren > 0
                    ? Math.max(3, Math.min(100, Math.round((t.penerimaanPesantren / maxTrendVal) * 100)))
                    : 0
                const outWidth =
                  t.penyaluranDana > 0
                    ? Math.max(3, Math.min(100, Math.round((t.penyaluranDana / maxTrendVal) * 100)))
                    : 0
                const isSelectedMonth = t.month === selectedPeriod

                return (
                  <div
                    key={t.month}
                    className={`rounded-lg px-2.5 py-2 transition-colors ${
                      isSelectedMonth ? 'bg-slate-50/90' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className={isSelectedMonth ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}>
                        {t.monthLabel}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        Masuk: <strong className="font-semibold text-slate-800">{formatRupiah(t.penerimaanPesantren)}</strong>
                        {' · '}
                        Salur: <strong className="font-semibold text-slate-700">{formatRupiah(t.penyaluranDana)}</strong>
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        {inWidth > 0 && (
                          <div
                            className="h-2 rounded-full bg-emerald-600 transition-all duration-300"
                            style={{ width: `${inWidth}%` }}
                            title={`Penerimaan ${t.monthLabel}: ${formatRupiah(t.penerimaanPesantren)}`}
                          />
                        )}
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        {outWidth > 0 && (
                          <div
                            className="h-2 rounded-full bg-slate-500 transition-all duration-300"
                            style={{ width: `${outWidth}%` }}
                            title={`Penyaluran ${t.monthLabel}: ${formatRupiah(t.penyaluranDana)}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chart 2: Komposisi Kanal & Pos Tagihan (1 Col) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h3 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900 text-balance">
              Komposisi Penerimaan Periode Ini
            </h3>

            {/* Kanal Pembayaran */}
            <div className="mt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Kanal Pembayaran
              </span>
              {charts.channelComposition.total > 0 ? (
                <>
                  <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    {charts.channelComposition.onlinePercentage > 0 && (
                      <div
                        className="bg-emerald-600"
                        style={{ width: `${charts.channelComposition.onlinePercentage}%` }}
                        title={`Online: ${charts.channelComposition.onlinePercentage}%`}
                      />
                    )}
                    {charts.channelComposition.cashPercentage > 0 && (
                      <div
                        className="bg-slate-400"
                        style={{ width: `${charts.channelComposition.cashPercentage}%` }}
                        title={`Tunai: ${charts.channelComposition.cashPercentage}%`}
                      />
                    )}
                  </div>
                  <div className="mt-2.5 space-y-1 text-xs text-slate-600 tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        Online (BRIVA / Transfer)
                      </span>
                      <span className="font-semibold text-slate-800">
                        {charts.channelComposition.onlinePercentage}% ({formatRupiah(charts.channelComposition.onlineAmount)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        Tunai Loket
                      </span>
                      <span className="font-semibold text-slate-800">
                        {charts.channelComposition.cashPercentage}% ({formatRupiah(charts.channelComposition.cashAmount)})
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Belum ada penerimaan kas pesantren pada {formatPeriodLabel(selectedPeriod)}.
                </p>
              )}
            </div>

            {/* Pos Tagihan */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Distribusi Pos Tagihan
              </span>
              <div className="mt-3 space-y-2.5">
                {charts.itemComposition.length > 0 ? (
                  charts.itemComposition.map((it) => (
                    <div key={it.itemType} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800 truncate">{it.itemLabel}</span>
                        <span className="shrink-0 text-slate-600 tabular-nums">
                          {it.percentage}% · {formatRupiah(it.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full bg-emerald-700/80"
                          style={{ width: `${Math.max(2, it.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    Belum ada rincian pos tagihan terbayar pada periode ini.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Transaksi Finansial Terbaru (Bersih, Interaktif Drawer, & Responsif Mobile) */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
            <div>
              <h3 id={recentTxHeadingId} className="text-sm font-bold text-slate-900">
                Transaksi Finansial Terbaru
              </h3>
              <p className="text-xs text-slate-500">
                8 mutasi terbaru lintas kategori — klik baris untuk melihat rincian
              </p>
            </div>

            <Link
              href="/dashboard/keuangan/riwayat"
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <span>Buka Riwayat Lengkap</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {recentTransactions.length > 0 ? (
            <>
              {/* Tampilan Mobile: Stacked List (tanpa scroll horizontal) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {recentTransactions.map((tx) => {
                  const isIncoming = tx.direction === 'IN'
                  const statusInfo = formatStatusBadge(tx.status)
                  const refDisplay = formatReferenceDisplay(tx.transactionNumber, tx.category)
                  const partyName = tx.santriName || tx.recipientInfo || '-'

                  return (
                    <button
                      key={`m-${tx.category}-${tx.id}`}
                      type="button"
                      onClick={() => setSelectedTx(toGlobalTransactionRow(tx))}
                      className="w-full min-h-[44px] px-4 py-3.5 text-left hover:bg-slate-50/80 active:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {partyName}
                            {tx.santriNis && (
                              <span className="ml-1 text-xs font-normal text-slate-500">
                                ({tx.santriNis})
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">{tx.categoryLabel}</span>
                            <span>·</span>
                            <span>{formatMethodLabel(tx.method)}</span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className={`text-sm font-bold tabular-nums ${isIncoming ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {isIncoming ? '+' : '-'} {formatRupiah(tx.amount)}
                          </div>
                          <span className={`mt-1 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{formatDateIndo(tx.createdAt)}</span>
                        <span className="font-mono text-slate-600" title={tx.transactionNumber}>
                          {refDisplay}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Tampilan Desktop/Tablet: Tabel Semantik dengan Keyboard Scroll Region & Sticky Header */}
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={recentTxHeadingId}
                className="hidden md:block overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3">Waktu</th>
                      <th scope="col" className="px-4 py-3">Referensi</th>
                      <th scope="col" className="px-4 py-3">Santri / Pihak Terkait</th>
                      <th scope="col" className="px-4 py-3">Jenis &amp; Metode</th>
                      <th scope="col" className="px-4 py-3 text-right">Nominal</th>
                      <th scope="col" className="px-5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentTransactions.map((tx) => {
                      const isIncoming = tx.direction === 'IN'
                      const statusInfo = formatStatusBadge(tx.status)
                      const refDisplay = formatReferenceDisplay(tx.transactionNumber, tx.category)

                      return (
                        <tr
                          key={`${tx.category}-${tx.id}`}
                          onClick={() => setSelectedTx(toGlobalTransactionRow(tx))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedTx(toGlobalTransactionRow(tx))
                            }
                          }}
                          tabIndex={0}
                          className="cursor-pointer hover:bg-slate-50/90 focus-visible:bg-emerald-50/40 transition-colors"
                        >
                          <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap tabular-nums">
                            {formatDateIndo(tx.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className="font-mono text-xs font-medium text-slate-800"
                              title={tx.transactionNumber}
                            >
                              {refDisplay}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {tx.santriName ? (
                              <div>
                                <span className="font-semibold text-slate-900">{tx.santriName}</span>
                                {tx.santriNis && (
                                  <span className="ml-1.5 text-[11px] text-slate-500">({tx.santriNis})</span>
                                )}
                              </div>
                            ) : tx.recipientInfo ? (
                              <span className="font-semibold text-slate-900">{tx.recipientInfo}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-medium text-slate-800">{tx.categoryLabel}</div>
                            <div className="text-[11px] text-slate-500">{formatMethodLabel(tx.method)}</div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap tabular-nums">
                            <span className={isIncoming ? 'text-emerald-700' : 'text-slate-900'}>
                              {isIncoming ? '+' : '-'} {formatRupiah(tx.amount)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">Belum ada transaksi tercatat.</p>
              <p className="mt-1 text-xs text-slate-500">
                Pembayaran tagihan, top-up uang jajan, dan penyaluran terbaru akan muncul di sini.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Drawer Rincian Transaksi (Reuse pola Riwayat Transaksi sesuai UI_UX_GUIDELINES Bab 4.4) */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  )
}
