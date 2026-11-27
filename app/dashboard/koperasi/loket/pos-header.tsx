'use client'

import React from 'react'
import {
  Clock,
  User,
  ShieldCheck,
  Lock,
  PlusCircle,
  Receipt,
  Landmark,
} from 'lucide-react'
import type { FinanceCashSession, CashSessionTransactionSummary } from '@/lib/finance/cash-session'

interface PosHeaderProps {
  activeSession: FinanceCashSession | null
  summary: CashSessionTransactionSummary | null
  operator: { id: string; name: string; roles: string[] }
  isViewOnly: boolean
  onOpenSessionClick: () => void
  onCloseSessionClick: () => void
  onOpenHistoryClick: () => void
  onCashTransferClick: () => void
}

const formatRupiah = (val: number) => `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`

export default function PosHeader({
  activeSession,
  summary,
  operator,
  isViewOnly,
  onOpenSessionClick,
  onCloseSessionClick,
  onOpenHistoryClick,
  onCashTransferClick,
}: PosHeaderProps) {
  const roleLabel = operator.roles.includes('admin_koperasi')
    ? 'Admin Koperasi'
    : operator.roles.includes('petugas_koperasi')
      ? 'Petugas Koperasi'
      : operator.roles.includes('bendahara')
        ? 'Bendahara'
        : operator.roles.includes('admin')
          ? 'Administrator'
          : operator.roles[0]

  const reservedBalance = activeSession?.reserved_cash_out ?? 0

  return (
    <div className="space-y-4">
      {/* Baris 1: Judul Halaman + Cluster Tombol Aksi */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem] text-balance">
              Loket Kasir Koperasi
            </h1>
            {isViewOnly && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Lihat Saja
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {operator.name}
            </span>
            <span className="text-slate-300">·</span>
            <span>{roleLabel}</span>
          </div>
        </div>

        {/* Cluster Aksi Sejajar & Rapi */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenHistoryClick}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            title="Lihat transaksi sesi ini dan sesi sebelumnya"
          >
            <Receipt className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Riwayat</span>
          </button>

          {activeSession ? (
            <>
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={onCashTransferClick}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 shadow-2xs hover:bg-sky-100 transition-colors cursor-pointer"
                  title="Catat uang diambil dari atau disetor ke rekening Koperasi"
                >
                  <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Kas Bank</span>
                </button>
              )}

              {!isViewOnly && (
                <button
                  type="button"
                  onClick={onCloseSessionClick}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 transition-colors cursor-pointer"
                  title="Tutup sesi kas dan hitung kas fisik"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tutup Sesi</span>
                </button>
              )}
            </>
          ) : (
            !isViewOnly && (
              <button
                type="button"
                onClick={onOpenSessionClick}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>Buka Sesi Kas</span>
              </button>
            )
          )}
        </div>
      </header>

      {/* Baris 2: Kartu Status Sesi Kas Aktif (Hierarki Jelas) */}
      {activeSession ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Kiri: Sesi & Kas Laci */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Kas Laci</span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                    {activeSession.session_code}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {formatRupiah(activeSession.expected_closing_balance)}
                  </span>
                  {reservedBalance > 0 && (
                    <span className="text-[11px] font-medium text-amber-700 tabular-nums">
                      (Dicadangkan kolektif {formatRupiah(reservedBalance)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Kanan: Ringkasan Masuk / Keluar */}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5 sm:flex sm:items-center sm:gap-5 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0 text-xs tabular-nums">
              <div>
                <span className="block text-[11px] text-slate-500">
                  Kas Masuk{summary?.paymentsCount ? ` (${summary.paymentsCount} tx)` : ''}
                </span>
                <strong className="text-sm font-bold text-emerald-700">
                  +{formatRupiah(activeSession.total_cash_in)}
                </strong>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">
                  Kas Keluar{summary?.withdrawalsCount ? ` (${summary.withdrawalsCount} tx)` : ''}
                </span>
                <strong className="text-sm font-bold text-slate-900">
                  -{formatRupiah(activeSession.total_cash_out)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Belum ada sesi kas aktif.</strong> Buka sesi kas dengan saldo fisik
              awal sebelum melayani transaksi.
            </span>
          </div>
          {!isViewOnly && (
            <button
              type="button"
              onClick={onOpenSessionClick}
              className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-950 cursor-pointer"
            >
              Buka Sesi
            </button>
          )}
        </div>
      )}
    </div>
  )
}
