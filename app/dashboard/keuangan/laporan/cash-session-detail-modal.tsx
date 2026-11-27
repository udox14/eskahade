'use client'

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { formatFinanceDate } from '@/lib/finance/date-format'
import type { CashSessionDetailReportResponse } from '@/lib/finance/reports'
import {
  formatCashSessionStatus,
  formatCorrectionType,
  formatPaymentMethod,
  formatRupiah,
} from './report-formatters'

type SessionTabKey = 'PAYMENTS' | 'TOPUPS' | 'WITHDRAWALS' | 'KAS_BANK' | 'REFUNDS'

interface CashSessionDetailModalProps {
  detail: CashSessionDetailReportResponse | null
  onClose: () => void
}

export function CashSessionDetailModal({ detail, onClose }: CashSessionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<SessionTabKey>('PAYMENTS')

  useEffect(() => {
    if (!detail) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detail, onClose])

  if (!detail) return null

  const statusInfo = formatCashSessionStatus(detail.session.status)
  const summary = detail.authoritativeSummary
  const transfers = detail.cashTransfers || []

  const tabs: Array<{ key: SessionTabKey; label: string; count: number }> = [
    { key: 'PAYMENTS', label: 'Pembayaran Tagihan', count: detail.cashPayments.length },
    { key: 'TOPUPS', label: 'Setoran Uang Jajan', count: detail.cashTopups.length },
    { key: 'WITHDRAWALS', label: 'Penarikan Titipan', count: detail.cashWithdrawals.length },
    { key: 'KAS_BANK', label: 'Mutasi Kas Bank', count: transfers.length },
    { key: 'REFUNDS', label: 'Koreksi / Refund', count: detail.cashRefunds.length },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-session-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="cash-session-modal-title" className="text-base font-bold text-slate-900 font-mono">
                {detail.session.sessionCode}
              </h3>
              <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              Kasir: <strong className="text-slate-700">{detail.session.operatorName}</strong> · Buka:{' '}
              {formatFinanceDate(detail.session.openedAt, true)}
              {detail.session.closedAt
                ? ` — Tutup: ${formatFinanceDate(detail.session.closedAt, true)}`
                : ' (Sedang Terbuka)'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup rincian sesi kasir"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Ringkasan Kas Sesi */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium block">Saldo Awal</span>
            <span className="mt-1 block text-base font-bold text-slate-900 tabular-nums">
              {formatRupiah(summary.openingBalance)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium block">Total Kas Masuk</span>
            <span className="mt-1 block text-base font-bold text-emerald-700 tabular-nums">
              +{formatRupiah(summary.totalCashIn)}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
              Tagihan {formatRupiah(summary.cashPaymentsIn)} · Top-up {formatRupiah(summary.cashTopupsIn)}
              {summary.bankToCashIn > 0 && ` · Ambil Bank ${formatRupiah(summary.bankToCashIn)}`}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium block">Total Kas Keluar</span>
            <span className="mt-1 block text-base font-bold text-slate-900 tabular-nums">
              -{formatRupiah(summary.totalCashOut)}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
              Jajan {formatRupiah(summary.cashWithdrawalsOut)} · Refund {formatRupiah(summary.cashRefundsOut)}
              {summary.cashToBankOut > 0 && ` · Setor Bank ${formatRupiah(summary.cashToBankOut)}`}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium block">Saldo Seharusnya</span>
            <span className="mt-1 block text-base font-bold text-slate-900 tabular-nums">
              {formatRupiah(summary.expectedClosingBalance)}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
              Fisik: {summary.actualClosingBalance !== null ? formatRupiah(summary.actualClosingBalance) : '—'} · Selisih:{' '}
              <strong className={(summary.difference || 0) === 0 ? 'text-slate-700' : 'text-rose-700'}>
                {summary.difference !== null ? formatRupiah(summary.difference) : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div
          role="tablist"
          aria-label="Rincian arus kas sesi"
          className="flex border-b border-slate-200 px-4 sm:px-5 bg-white gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`relative shrink-0 whitespace-nowrap py-3 px-3 text-xs font-semibold transition-colors cursor-pointer ${
                  isActive ? 'text-emerald-800' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label} ({tab.count})
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-emerald-600" />
                )}
              </button>
            )
          })}
        </div>

        {/* Isi Tabel */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5">
          {activeTab === 'PAYMENTS' && (
            detail.cashPayments.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Tidak ada pembayaran tagihan tunai pada sesi kasir ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">No. Pembayaran</th>
                      <th className="py-2.5 px-3">Santri</th>
                      <th className="py-2.5 px-3">Metode</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.cashPayments.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                          {formatFinanceDate(p.paidAt, true)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{p.paymentNumber}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{p.santriName}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">{p.nis}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{formatPaymentMethod(p.method)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                          +{formatRupiah(p.grossAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'TOPUPS' && (
            detail.cashTopups.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Tidak ada setoran uang jajan tunai pada sesi kasir ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">Santri</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.cashTopups.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                          {formatFinanceDate(t.createdAt, true)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{t.santriName}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">{t.nis}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                          +{formatRupiah(t.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{t.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'WITHDRAWALS' && (
            detail.cashWithdrawals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Tidak ada penarikan titipan tunai pada sesi kasir ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">Santri</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.cashWithdrawals.map((w, idx) => {
                      const isReturn = w.amount < 0
                      return (
                        <tr key={w.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                            {formatFinanceDate(w.createdAt, true)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{w.santriName}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">{w.nis}</div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                              isReturn ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {isReturn ? `+${formatRupiah(Math.abs(w.amount))}` : `-${formatRupiah(w.amount)}`}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{w.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'KAS_BANK' && (
            transfers.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Tidak ada mutasi kas bank ↔ tunai pada sesi kasir ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Waktu Bank (WIB)</th>
                      <th className="py-2.5 px-3">No. Mutasi</th>
                      <th className="py-2.5 px-3">Jenis</th>
                      <th className="py-2.5 px-3">Pelaksana</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transfers.map((ct, idx) => {
                      const isBankToCash = ct.direction === 'BANK_TO_CASH'
                      return (
                        <tr key={ct.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                            {formatFinanceDate(ct.bankTransactedAt, true)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                            {ct.transferNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {isBankToCash ? 'Ambil dari Rekening' : 'Setor ke Rekening'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{ct.handledByName || '—'}</td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                              isBankToCash ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {isBankToCash ? `+${formatRupiah(ct.amount)}` : `-${formatRupiah(ct.amount)}`}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{ct.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'REFUNDS' && (
            detail.cashRefunds.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Tidak ada koreksi atau pengembalian tunai pada sesi kasir ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">No. Koreksi</th>
                      <th className="py-2.5 px-3">Jenis</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                      <th className="py-2.5 px-3">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.cashRefunds.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                          {formatFinanceDate(r.createdAt, true)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{r.correctionNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {formatCorrectionType(r.correctionType)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-700 tabular-nums whitespace-nowrap">
                          -{formatRupiah(r.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
