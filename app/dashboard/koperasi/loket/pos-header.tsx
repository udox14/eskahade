'use client'

import React from 'react'
import {
  Clock,
  User,
  ShieldCheck,
  Lock,
  PlusCircle,
  Receipt,
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
}

export default function PosHeader({
  activeSession,
  summary,
  operator,
  isViewOnly,
  onOpenSessionClick,
  onCloseSessionClick,
  onOpenHistoryClick,
}: PosHeaderProps) {
  const formatRupiah = (val: number) => `Rp${Math.max(0, val).toLocaleString('id-ID')}`

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Sisi Kiri: Judul Loket & Status Operator */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Loket Kasir Koperasi
            </h1>
              {isViewOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  <ShieldCheck className="w-3 h-3" />
                  View Only
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {operator.name}
              </span>
              <span className="text-slate-300">•</span>
              <span>
                {operator.roles.includes('admin_koperasi')
                  ? 'Admin Koperasi'
                  : operator.roles.includes('petugas_koperasi')
                  ? 'Petugas Koperasi'
                  : operator.roles.includes('bendahara')
                  ? 'Bendahara'
                  : operator.roles.includes('admin')
                  ? 'Administrator'
                  : operator.roles[0]}
              </span>
            </div>
          </div>

        {/* Sisi Kanan: Status Sesi Kas & Aksi */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {activeSession ? (
            <>
              {/* Badge Sesi Kas Aktif & Saldo Kas Fisik */}
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                  </span>
                  <div className="text-left">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                      Sesi: {activeSession.session_code}
                    </p>
                    <p className="text-xs font-bold text-emerald-700">
                      Kas Laci: {formatRupiah(activeSession.expected_closing_balance)}
                    </p>
                  </div>
                </div>

                {/* Sub-metrik cepat */}
                <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200 text-[11px] text-slate-600">
                  <span title="Penerimaan tunai masuk">
                    Masuk: <strong className="text-slate-900">+{formatRupiah(activeSession.total_cash_in)}</strong>
                    {summary?.paymentsCount ? ` (${summary.paymentsCount} tx)` : ''}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span title="Pencairan uang jajan tunai">
                    Keluar: <strong className="text-slate-900">-{formatRupiah(activeSession.total_cash_out)}</strong>
                    {summary?.withdrawalsCount ? ` (${summary.withdrawalsCount} tx)` : ''}
                  </span>
                </div>
              </div>

              {/* Tombol Riwayat Sesi */}
              <button
                type="button"
                onClick={onOpenHistoryClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
                title="Lihat transaksi sesi ini dan sesi sebelumnya"
              >
                <Receipt className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Riwayat Sesi</span>
              </button>

              {/* Tombol Tutup Sesi */}
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={onCloseSessionClick}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors shadow-2xs"
                  title="Tutup sesi kas dan laporkan saldo kas fisik"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Tutup Sesi</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Status Belum Buka Sesi */}
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Belum ada sesi kas aktif</span>
              </div>

              {/* Tombol Riwayat Sesi */}
              <button
                type="button"
                onClick={onOpenHistoryClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Receipt className="w-3.5 h-3.5 text-slate-500" />
                <span>Riwayat Sesi</span>
              </button>

              {/* Tombol Buka Sesi Kas */}
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={onOpenSessionClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Buka Sesi Kas</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
