'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'
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

export default function SessionHistoryDrawer({
  isOpen,
  activeSessionId,
  onClose,
}: SessionHistoryDrawerProps) {
  const [tab, setTab] = useState<'CURRENT' | 'PAST'>('CURRENT')
  const [currentTransactions, setCurrentTransactions] = useState<LoketSessionTransactionItem[]>([])
  const [pastSessions, setPastSessions] = useState<FinanceCashSession[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const formatRupiah = (val: number) => `Rp${Math.max(0, val).toLocaleString('id-ID')}`

  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        if (activeSessionId) {
          const items = await getLoketCurrentSessionTransactions(activeSessionId)
          setCurrentTransactions(items)
        }
        const historyRes = await getPastCashSessions({ page: 1, pageSize: 20 })
        setPastSessions(historyRes.items)
      } catch (err) {
        console.error('Gagal memuat riwayat sesi kas:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isOpen, activeSessionId, tab])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Riwayat & Mutasi Loket</h3>
                <p className="text-xs text-slate-500">Histori operasional kasir & sesi kas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selection */}
          <div className="p-3 border-b border-slate-200 bg-white flex gap-2">
            <button
              type="button"
              onClick={() => setTab('CURRENT')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
                tab === 'CURRENT'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Mutasi Sesi Berjalan
            </button>
            <button
              type="button"
              onClick={() => setTab('PAST')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
                tab === 'PAST'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Daftar Sesi Kas
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs">Memuat data...</span>
              </div>
            ) : tab === 'CURRENT' ? (
              /* Tab Mutasi Sesi Ini */
              !activeSessionId ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada sesi kas yang sedang aktif.
                </div>
              ) : currentTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada transaksi pada sesi kas ini.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Total {currentTransactions.length} Transaksi Sesi Ini
                  </p>
                  {currentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {tx.type === 'WITHDRAWAL' ? (
                            <span className="p-1 rounded-md bg-rose-50 text-rose-600">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-800">{tx.typeLabel}</span>
                        </div>
                        <strong
                          className={`text-xs font-bold ${
                            tx.type === 'WITHDRAWAL' ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {tx.type === 'WITHDRAWAL' ? '-' : '+'}
                          {formatRupiah(tx.amount)}
                        </strong>
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>
                          {tx.santriNama} ({tx.santriNis})
                        </span>
                        <span>{tx.createdAt.slice(11, 16)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Tab Daftar Sesi Kas Lampau */
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Histori Seluruh Sesi Kas
                </p>
                {pastSessions.map((ses) => {
                  const isClosed = ses.status === 'CLOSED'
                  const diff = ses.difference ?? 0

                  return (
                    <div
                      key={ses.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isClosed ? 'bg-slate-400' : 'bg-emerald-500'
                            }`}
                          />
                          <strong className="text-xs font-bold text-slate-900 font-mono">
                            {ses.session_code}
                          </strong>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isClosed
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isClosed ? 'Ditutup' : 'Aktif'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Saldo Awal:</span>
                          <span className="font-semibold">{formatRupiah(ses.opening_balance)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Kas Masuk:</span>
                          <span className="font-semibold text-emerald-700">
                            +{formatRupiah(ses.total_cash_in)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Kas Keluar:</span>
                          <span className="font-semibold text-rose-700">
                            -{formatRupiah(ses.total_cash_out)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Expected Akhir:</span>
                          <span className="font-semibold">{formatRupiah(ses.expected_closing_balance)}</span>
                        </div>
                      </div>

                      {isClosed && (
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 text-[11px]">Hitungan Fisik Kasir:</span>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 block">
                              {formatRupiah(ses.actual_closing_balance ?? 0)}
                            </span>
                            {diff !== 0 && (
                              <span
                                className={`text-[10px] font-bold ${
                                  diff > 0 ? 'text-blue-600' : 'text-rose-600'
                                }`}
                              >
                                {diff > 0 ? `+${formatRupiah(diff)} (Lebih)` : `-${formatRupiah(Math.abs(diff))} (Kurang)`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {ses.difference_notes && (
                        <p className="text-[10px] text-slate-600 bg-amber-50 p-2 rounded border border-amber-200">
                          Catatan: {ses.difference_notes}
                        </p>
                      )}

                      <div className="text-[10px] text-slate-400 pt-1">
                        Kasir: {ses.operator_name || ses.operator_id} • {ses.opened_at.slice(0, 16)}
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
