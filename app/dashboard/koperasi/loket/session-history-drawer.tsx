'use client'

import React, { useEffect, useState } from 'react'
import { X, Receipt, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  getLoketCurrentSessionTransactions,
  getPastCashSessions,
  type LoketSessionTransactionItem,
} from './actions'
import type { FinanceCashSession } from '@/lib/finance/cash-session'

interface SessionHistoryDrawerProps {
  isOpen: boolean
  activeSessionId?: string | null
  onClose: () => void
}

const formatRupiah = (val: number) => `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`

export default function SessionHistoryDrawer({
  isOpen,
  activeSessionId,
  onClose,
}: SessionHistoryDrawerProps) {
  const [tab, setTab] = useState<'CURRENT' | 'PAST'>(activeSessionId ? 'CURRENT' : 'PAST')
  const [currentTransactions, setCurrentTransactions] = useState<LoketSessionTransactionItem[]>([])
  const [pastSessions, setPastSessions] = useState<FinanceCashSession[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Muat sekali saat drawer dibuka (tidak fetch ulang saat ganti tab)
  useEffect(() => {
    if (!isOpen) return
    let active = true

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [items, historyRes] = await Promise.all([
          activeSessionId ? getLoketCurrentSessionTransactions(activeSessionId) : Promise.resolve([]),
          getPastCashSessions({ page: 1, pageSize: 20 }),
        ])
        if (active) {
          setCurrentTransactions(items)
          setPastSessions(historyRes.items)
        }
      } catch (err) {
        console.error('Gagal memuat riwayat sesi kas:', err)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [isOpen, activeSessionId])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-history-title"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-2xs"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="flex w-screen max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Receipt className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="session-history-title" className="text-sm font-bold text-slate-900">
                  Riwayat &amp; Mutasi Loket
                </h3>
                <p className="text-xs text-slate-500">Histori transaksi kasir &amp; sesi kas</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Tutup panel riwayat"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1.5 border-b border-slate-200 bg-white px-4 py-2.5">
            <button
              type="button"
              onClick={() => setTab('CURRENT')}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'CURRENT'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Sesi Berjalan ({currentTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('PAST')}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'PAST'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Daftar Sesi ({pastSessions.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-700" aria-hidden="true" />
                <span className="text-xs">Memuat data…</span>
              </div>
            ) : tab === 'CURRENT' ? (
              !activeSessionId ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Belum ada sesi kas yang sedang aktif.
                </div>
              ) : currentTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Belum ada transaksi pada sesi kas ini.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentTransactions.map((tx) => {
                    const isOut = tx.type === 'WITHDRAWAL' || tx.type === 'CASH_TO_BANK'
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`rounded-md p-1 ${
                                isOut ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isOut ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </span>
                            <span className="truncate text-xs font-semibold text-slate-900">{tx.typeLabel}</span>
                          </div>
                          <strong
                            className={`shrink-0 text-xs font-bold tabular-nums ${
                              isOut ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {isOut ? '-' : '+'}
                            {formatRupiah(tx.amount)}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="truncate">
                            {tx.santriNis
                              ? `${tx.santriNama} (${tx.santriNis})`
                              : `${tx.santriNama}${tx.referenceId ? ` · ${tx.referenceId}` : ''}`}
                          </span>
                          <span className="shrink-0 tabular-nums">{formatFinanceDate(tx.createdAt, true)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : pastSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">Belum ada riwayat sesi kas.</div>
            ) : (
              <div className="space-y-3">
                {pastSessions.map((ses) => {
                  const isClosed = ses.status === 'CLOSED'
                  const diff = ses.difference ?? 0

                  return (
                    <div
                      key={ses.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${isClosed ? 'bg-slate-400' : 'bg-emerald-500'}`}
                          />
                          <strong className="font-mono text-xs font-bold text-slate-900">
                            {ses.session_code}
                          </strong>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isClosed ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isClosed ? 'Ditutup' : 'Terbuka'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[11px] tabular-nums">
                        <div>
                          <span className="block text-[10px] text-slate-500">Saldo Awal</span>
                          <span className="font-semibold text-slate-800">{formatRupiah(ses.opening_balance)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">Kas Masuk</span>
                          <span className="font-semibold text-emerald-700">+{formatRupiah(ses.total_cash_in)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">Kas Keluar</span>
                          <span className="font-semibold text-rose-700">-{formatRupiah(ses.total_cash_out)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">Seharusnya</span>
                          <span className="font-semibold text-slate-900">
                            {formatRupiah(ses.expected_closing_balance)}
                          </span>
                        </div>
                      </div>

                      {isClosed && (
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs tabular-nums">
                          <span className="text-[11px] text-slate-500">Hitungan Fisik</span>
                          <div className="text-right">
                            <span className="block font-bold text-slate-900">
                              {formatRupiah(ses.actual_closing_balance ?? 0)}
                            </span>
                            {diff !== 0 && (
                              <span
                                className={`text-[10px] font-semibold ${
                                  diff > 0 ? 'text-sky-700' : 'text-rose-700'
                                }`}
                              >
                                {diff > 0
                                  ? `+${formatRupiah(diff)} (Lebih)`
                                  : `-${formatRupiah(Math.abs(diff))} (Kurang)`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {ses.difference_notes && (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                          Catatan: {ses.difference_notes}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-500 tabular-nums">
                        Kasir: {ses.operator_name || ses.operator_id} · {formatFinanceDate(ses.opened_at, true)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
