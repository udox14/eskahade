'use client'

// app/dashboard/keuangan/_page-content.tsx
// Antarmuka Dashboard Keuangan & KPI Eksekutif (Fase 9)
// Memenuhi PRD Bab 33 & UI/UX Guidelines:
// 1. Pemisahan mutlak Kas Pesantren vs Dana Titipan Santri (Uang Jajan)
// 2. Pemisahan Payment PAID vs SETTLED
// 3. Status Penyaluran (Siap / Sudah / Belum Disalurkan)
// 4. Breakdown Online vs Tunai
// 5. Mismatch Alert & Quick Actions
// 6. Visual Charts Informatif & Transaksi Terbaru

import React, { useState, useTransition, useId } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Landmark,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Coins,
  Send,
  Scale,
  Store,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getDashboardData, type UserDashboardPermissions } from './actions'
import type { FinanceDashboardData } from '@/lib/finance/dashboard'
import type { FinanceCashSession } from '@/lib/finance/cash-session'

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
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
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

export default function DashboardKeuanganContent({
  initialData,
  initialCashSession,
}: DashboardKeuanganContentProps) {
  const [data, setData] = useState<FinanceDashboardData>(initialData)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.selectedPeriod)
  const [cashSession, setCashSession] = useState<FinanceCashSession | null>(initialCashSession ?? null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const periodSelectId = useId()

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
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat data dashboard.')
      }
    })
  }

  const handleRefresh = () => {
    handlePeriodChange(selectedPeriod)
  }

  const { kpi, charts, recentTransactions } = data
  const { pesantren, uangJajan, kasir, mismatch } = kpi

  // Hitung nilai maksimum untuk scaling bar chart tren
  const maxTrendVal = Math.max(
    ...charts.trends.map((t) => Math.max(t.penerimaanPesantren, t.penyaluranDana)),
    1000000
  )

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Halaman — hanya judul & deskripsi agar tidak bertabrakan
          dengan kontrol periode/aksi cepat pada layar mobile. */}
      <DashboardPageHeader
        title="Dashboard Keuangan"
        description="Ikhtisar eksekutif penerimaan kas pesantren, dana titipan santri, status penyaluran, dan rekonsiliasi."
      />

      {/* Pesan Kesalahan jika ada */}
      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Shortcut Status Sesi Kasir + Kontrol Periode & Aksi Cepat (satu baris sejajar) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl ${cashSession ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  {cashSession ? 'Sesi Kasir Aktif' : 'Sesi Kasir Belum Dibuka'}
                </h3>
                {cashSession ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    {cashSession.session_code}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Non-aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {cashSession
                  ? `Dibuka ${formatDateIndo(cashSession.opened_at)} • Saldo laci saat ini: ${formatRupiah(cashSession.expected_closing_balance)}`
                  : 'Buka sesi kas di loket kasir untuk mulai melayani transaksi pembayaran tunai atau pencairan uang jajan.'}
              </p>
            </div>
          </div>

          {/* Kontrol periode, segarkan, riwayat, dan aksi sesi kas disatukan pada baris ini */}
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
              <label htmlFor={periodSelectId} className="text-xs font-medium text-slate-500">
                Periode:
              </label>
              <select
                id={periodSelectId}
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                disabled={isPending}
                className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-hidden"
              >
                {data.periodList.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              title="Segarkan Data"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>

            <Link
              href="/dashboard/keuangan/riwayat"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <Clock className="h-4 w-4" />
              <span>Riwayat Transaksi</span>
            </Link>

            <Link
              href="/dashboard/koperasi/loket"
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-2xs transition-colors ${
                cashSession
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <span>{cashSession ? 'Buka Loket Kasir' : 'Buka Sesi Kas'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Banner Peringatan Rekonsiliasi (Mismatch Alert) */}
      {mismatch.hasMismatch ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-amber-900">
                Peringatan: Ditemukan {mismatch.totalMismatchCount} Selisih / Kasus Rekonsiliasi
              </h2>
              <p className="mt-0.5 text-xs text-amber-700">
                {mismatch.unallocatedTransfersCount > 0 &&
                  `${mismatch.unallocatedTransfersCount} transfer unallocated (${formatRupiah(mismatch.unallocatedTransfersAmount)}). `}
                {mismatch.cashDiscrepanciesCount > 0 &&
                  `${mismatch.cashDiscrepanciesCount} sesi kas dengan selisih fisik. `}
                {mismatch.settlementDiscrepanciesCount > 0 &&
                  `${mismatch.settlementDiscrepanciesCount} settlement mismatch. `}
                {mismatch.pendingRecoveryCasesCount > 0 &&
                  `${mismatch.pendingRecoveryCasesCount} kasus recovery dana telanjur disalurkan. `}
                Diperlukan audit sebelum penutupan pembukuan.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/keuangan/rekonsiliasi"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
          >
            <span>Buka Modul Rekonsiliasi</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>
              <strong>Rekonsiliasi Seimbang:</strong> Tidak ada selisih transfer unallocated atau ketidaksesuaian sesi kas.
            </span>
          </div>
          <Link
            href="/dashboard/keuangan/rekonsiliasi"
            className="font-medium text-emerald-700 hover:text-emerald-800"
          >
            Lihat Rekonsiliasi &rarr;
          </Link>
        </div>
      )}

      {/* 3. Section Kas & Operasional Pesantren (4 Summary Cards) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Kas & Penerimaan Pesantren
            </h2>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Dana Operasional
            </span>
          </div>
          <span className="text-xs text-slate-500">Periode: {formatPeriodLabel(selectedPeriod)}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Penerimaan Pesantren */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wide">Penerimaan Pesantren</span>
              <Coins className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {formatRupiah(pesantren.totalPenerimaan)}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 text-xs">
              <span className="inline-flex items-center rounded-sm bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                Online: {formatRupiah(pesantren.onlinePenerimaan)}
              </span>
              <span className="inline-flex items-center rounded-sm bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                Tunai: {formatRupiah(pesantren.cashPenerimaan)}
              </span>
            </div>
          </div>

          {/* Card 2: Settlement Payment Gateway */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wide">Settlement Gateway</span>
              <Landmark className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {formatRupiah(pesantren.settledAmount)}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {pesantren.pendingSettlementAmount > 0 ? (
                <span className="font-medium text-amber-700">
                  Belum Cair: {formatRupiah(pesantren.pendingSettlementAmount)} ({pesantren.pendingSettlementCount} trx)
                </span>
              ) : (
                <span className="font-medium text-emerald-700">Seluruh penerimaan online telah settled</span>
              )}
            </div>
          </div>

          {/* Card 3: Penyaluran Dana (Vendor & Bendahara) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wide">Penyaluran Dana</span>
              <Send className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {formatRupiah(pesantren.totalDisbursed)}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="font-medium text-indigo-700">
                Siap Disalurkan: {formatRupiah(pesantren.readyToDisburse)}
              </span>
            </div>
          </div>

          {/* Card 4: Tunggakan Kewajiban */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wide">Total Tunggakan</span>
              <Scale className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {formatRupiah(pesantren.totalTunggakan)}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="font-medium text-rose-700">
                {pesantren.santriMenunggakCount} Santri Belum Lunas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Section Khusus: Dana Titipan Santri (Uang Jajan) — PEMISAHAN MUTLAK */}
      <div className="rounded-xl border-2 border-indigo-200/80 bg-linear-to-r from-indigo-50/50 via-white to-indigo-50/30 p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-indigo-600 p-2 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-indigo-950">
                  Dana Titipan Santri (Uang Jajan)
                </h2>
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                  Liabilitas Santri
                </span>
              </div>
              <p className="text-xs text-indigo-700">
                Bukan kas pesantren — saldo dipegang sebagai amanah titipan wali santri dan dapat dicairkan sewaktu-waktu.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/keuangan/uang-jajan"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            <span>Buku Besar Uang Jajan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-indigo-100/80 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-indigo-100 bg-white p-4">
            <span className="text-xs font-medium text-slate-500">Total Saldo Titipan Santri</span>
            <div className="mt-1 text-xl font-bold text-indigo-950">
              {formatRupiah(uangJajan.totalTitipanBalance)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {uangJajan.activeStudentsWithBalance} santri memiliki saldo
            </p>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-white p-4">
            <span className="text-xs font-medium text-slate-500">Top-Up Periode Ini</span>
            <div className="mt-1 text-xl font-bold text-emerald-700">
              {formatRupiah(uangJajan.topupPeriod)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Online: {formatRupiah(uangJajan.topupOnline)} · Tunai: {formatRupiah(uangJajan.topupCash)}
            </p>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-white p-4">
            <span className="text-xs font-medium text-slate-500">Penarikan Loket Periode Ini</span>
            <div className="mt-1 text-xl font-bold text-slate-800">
              {formatRupiah(uangJajan.withdrawalPeriod)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Pencairan tunai di loket koperasi</p>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-white p-4">
            <span className="text-xs font-medium text-slate-500">Aktivitas Loket Hari Ini</span>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {kasir.openSessionsCount} Sesi Terbuka
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Kas Masuk: {formatRupiah(kasir.todayCashIn)} · Kas Keluar: {formatRupiah(kasir.todayCashOut)}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Charts & Visual Graphs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart 1: Tren Bulanan (2 Cols) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tren Penerimaan vs Penyaluran Bulanan</h3>
              <p className="text-xs text-slate-500">Perbandingan arus kas masuk pesantren dan penyaluran ke vendor</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="inline-block h-3 w-3 rounded-xs bg-emerald-600" />
                Penerimaan
              </span>
              <span className="flex items-center gap-1.5 font-medium text-purple-700">
                <span className="inline-block h-3 w-3 rounded-xs bg-purple-500" />
                Penyaluran
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {charts.trends.map((t) => {
              const inWidth = Math.min(100, Math.round((t.penerimaanPesantren / maxTrendVal) * 100))
              const outWidth = Math.min(100, Math.round((t.penyaluranDana / maxTrendVal) * 100))

              return (
                <div key={t.month} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{t.monthLabel}</span>
                    <span className="text-slate-500">
                      Masuk: {formatRupiah(t.penerimaanPesantren)} · Salur: {formatRupiah(t.penyaluranDana)}
                    </span>
                  </div>

                  {/* Dual Bar */}
                  <div className="grid grid-cols-1 gap-1">
                    <div className="h-2.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2.5 rounded-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${Math.max(4, inWidth)}%` }}
                        title={`Penerimaan: ${formatRupiah(t.penerimaanPesantren)}`}
                      />
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2.5 rounded-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${Math.max(4, outWidth)}%` }}
                        title={`Penyaluran: ${formatRupiah(t.penyaluranDana)}`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chart 2: Komposisi Kanal & Pos Pembayaran (1 Col) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Komposisi Penerimaan Periode Ini
          </h3>

          {/* Kanal Breakdown */}
          <div className="mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kanal Pembayaran
            </span>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="bg-blue-600"
                style={{ width: `${charts.channelComposition.onlinePercentage}%` }}
                title={`Online: ${charts.channelComposition.onlinePercentage}%`}
              />
              <div
                className="bg-emerald-600"
                style={{ width: `${charts.channelComposition.cashPercentage}%` }}
                title={`Tunai: ${charts.channelComposition.cashPercentage}%`}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Online: {charts.channelComposition.onlinePercentage}% ({formatRupiah(charts.channelComposition.onlineAmount)})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Tunai: {charts.channelComposition.cashPercentage}% ({formatRupiah(charts.channelComposition.cashAmount)})
              </span>
            </div>
          </div>

          {/* Pos Biaya Breakdown */}
          <div className="mt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Distribusi Pos Tagihan
            </span>
            <div className="mt-3 space-y-2">
              {charts.itemComposition.length > 0 ? (
                charts.itemComposition.map((it) => (
                  <div key={it.itemType} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{it.itemLabel}</span>
                      <span className="text-slate-500">
                        {it.percentage}% ({formatRupiah(it.amount)})
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-slate-700"
                        style={{ width: `${Math.max(2, it.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Belum ada rincian pos tagihan terbayar pada periode ini.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Quick Actions (Aksi Cepat) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Aksi Cepat Operasional
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Pintasan langsung ke modul pencatatan, kasir loket, penyaluran, dan rekonsiliasi.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/dashboard/keuangan/status-pembayaran"
            className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-center hover:bg-emerald-50/60 hover:border-emerald-200 transition-colors"
          >
            <CreditCard className="h-5 w-5 text-emerald-700" />
            <span className="mt-2 text-xs font-semibold text-slate-800">Catat Bayar Tunai</span>
            <span className="text-[11px] text-slate-500">Modul Status Santri</span>
          </Link>

          <Link
            href="/dashboard/koperasi/loket"
            className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-center hover:bg-blue-50/60 hover:border-blue-200 transition-colors"
          >
            <Store className="h-5 w-5 text-blue-700" />
            <span className="mt-2 text-xs font-semibold text-slate-800">Loket Kasir POS</span>
            <span className="text-[11px] text-slate-500">Scan Kartu & Sesi Kas</span>
          </Link>

          <Link
            href="/dashboard/keuangan/penyaluran"
            className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-center hover:bg-purple-50/60 hover:border-purple-200 transition-colors"
          >
            <Send className="h-5 w-5 text-purple-700" />
            <span className="mt-2 text-xs font-semibold text-slate-800">Salurkan Dana</span>
            <span className="text-[11px] text-slate-500">Vendor Katering/Laundry</span>
          </Link>

          <Link
            href="/dashboard/keuangan/rekonsiliasi"
            className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-center hover:bg-amber-50/60 hover:border-amber-200 transition-colors"
          >
            <Scale className="h-5 w-5 text-amber-700" />
            <span className="mt-2 text-xs font-semibold text-slate-800">Rekonsiliasi Bank</span>
            <span className="text-[11px] text-slate-500">Settlement & Mismatch</span>
          </Link>
        </div>
      </div>

      {/* 7. Transaksi Terbaru (Recent Transactions Table) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Transaksi Finansial Terbaru</h3>
            <p className="text-xs text-slate-500">8 mutasi finansial paling mutakhir lintas seluruh kategori sistem</p>
          </div>

          <Link
            href="/dashboard/keuangan/riwayat"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <span>Buka Riwayat Lengkap</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Waktu</th>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Santri / Pihak Terkait</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const isIncoming = tx.direction === 'IN'

                  let badgeColor = 'bg-slate-100 text-slate-700'
                  if (tx.status === 'PAID' || tx.status === 'SETTLED' || tx.status === 'COMPLETED') {
                    badgeColor = 'bg-emerald-50 text-emerald-700'
                  } else if (tx.status === 'VOID' || tx.status === 'REFUND' || tx.status === 'REVERSAL') {
                    badgeColor = 'bg-rose-50 text-rose-700'
                  }

                  let catBadge = 'bg-slate-100 text-slate-700'
                  if (tx.category === 'PAYMENT') catBadge = 'bg-blue-50 text-blue-700'
                  if (tx.category === 'TOPUP') catBadge = 'bg-indigo-50 text-indigo-700'
                  if (tx.category === 'WITHDRAWAL') catBadge = 'bg-amber-50 text-amber-800'
                  if (tx.category === 'DISTRIBUTION') catBadge = 'bg-purple-50 text-purple-700'
                  if (tx.category === 'CORRECTION') catBadge = 'bg-rose-50 text-rose-700'

                  return (
                    <tr key={`${tx.category}-${tx.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {formatDateIndo(tx.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {tx.transactionNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold ${catBadge}`}>
                          {tx.categoryLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.santriName ? (
                          <div>
                            <span className="font-semibold text-slate-900">{tx.santriName}</span>
                            {tx.santriNis && (
                              <span className="ml-1 text-[11px] text-slate-400">({tx.santriNis})</span>
                            )}
                          </div>
                        ) : tx.recipientInfo ? (
                          <span className="font-medium text-purple-900">{tx.recipientInfo}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {tx.method}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isIncoming ? 'text-emerald-700' : 'text-slate-800'}>
                          {isIncoming ? '+ ' : '- '}
                          {formatRupiah(tx.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Belum ada transaksi tercatat pada sistem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
