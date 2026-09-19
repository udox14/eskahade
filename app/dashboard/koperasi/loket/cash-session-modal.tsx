'use client'

import React, { useState } from 'react'
import {
  X,
  Lock,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import type { FinanceCashSession } from '@/lib/finance/cash-session'

interface CashSessionModalProps {
  mode: 'OPEN' | 'CLOSE'
  isOpen: boolean
  activeSession: FinanceCashSession | null
  onClose: () => void
  onOpenSessionSubmit: (openingBalance: number, notes?: string) => Promise<void>
  onCloseSessionSubmit: (sessionId: string, actualClosingBalance: number, notes?: string) => Promise<void>
}

const QUICK_OPENING_BALANCES = [50000, 100000, 200000, 500000]

export default function CashSessionModal({
  mode,
  isOpen,
  activeSession,
  onClose,
  onOpenSessionSubmit,
  onCloseSessionSubmit,
}: CashSessionModalProps) {
  const [openingBalance, setOpeningBalance] = useState<number>(100000)
  const [openingNotes, setOpeningNotes] = useState<string>('')

  const [actualClosingBalance, setActualClosingBalance] = useState<number>(
    activeSession ? activeSession.expected_closing_balance : 0
  )
  const [differenceNotes, setDifferenceNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const formatRupiah = (val: number) => `Rp${Math.max(0, val).toLocaleString('id-ID')}`

  // Kalkulasi selisih penutupan
  const expectedClosing = activeSession ? activeSession.expected_closing_balance : 0
  const difference = actualClosingBalance - expectedClosing
  const hasDifference = difference !== 0

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    if (openingBalance < 0) {
      setErrorMessage('Saldo awal kas fisik tidak boleh bernilai negatif.')
      return
    }

    try {
      setIsSubmitting(true)
      await onOpenSessionSubmit(openingBalance, openingNotes)
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    if (!activeSession) return

    if (actualClosingBalance < 0) {
      setErrorMessage('Saldo fisik akhir kas tidak boleh bernilai negatif.')
      return
    }

    if (hasDifference && !differenceNotes.trim()) {
      setErrorMessage('Terdapat selisih kas fisik. Catatan alasan selisih wajib diisi.')
      return
    }

    try {
      setIsSubmitting(true)
      await onCloseSessionSubmit(activeSession.id, actualClosingBalance, differenceNotes)
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                mode === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {mode === 'OPEN' ? <PlusCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'OPEN' ? 'Buka Sesi Kas Baru' : 'Tutup Sesi Kas Loket'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'OPEN'
                  ? 'Masukkan modal kas fisik awal di laci kasir'
                  : `Rekonsiliasi kas fisik sesi ${activeSession?.session_code || ''}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Form Modal */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'OPEN' ? (
            /* ─── FORM BUKA SESI KAS ─── */
            <form onSubmit={handleOpenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Saldo Kas Fisik Awal (Modal di Laci)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 font-semibold text-sm">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={openingBalance || ''}
                    onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all"
                  />
                </div>

                {/* Quick Chips Saldo Awal */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {QUICK_OPENING_BALANCES.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningBalance(amt)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        openingBalance === amt
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOpeningBalance(0)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      openingBalance === 0
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Rp0 (Nol)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Catatan Sesi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Contoh: Sesi pagi loket koperasi putra..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Membuka...' : 'Buka Sesi Sekarang'}
                </button>
              </div>
            </form>
          ) : (
            /* ─── FORM TUTUP SESI KAS & DISCREPANCY ─── */
            <form onSubmit={handleCloseSubmit} className="space-y-4">
              {activeSession && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Saldo Awal Kasir:</span>
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(activeSession.opening_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Kas Masuk (Penerimaan Tunai):</span>
                    <span className="font-semibold text-emerald-700">
                      +{formatRupiah(activeSession.total_cash_in)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Kas Keluar (Pencairan Uang Jajan):</span>
                    <span className="font-semibold text-rose-700">
                      -{formatRupiah(activeSession.total_cash_out)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>Saldo Kas Harapan Sistem:</span>
                    <span className="text-slate-900">{formatRupiah(expectedClosing)}</span>
                  </div>
                </div>
              )}

              {/* Input Saldo Kas Fisik Aktual */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Saldo Kas Fisik Riil (Hasil Hitungan Kasir di Laci)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 font-semibold text-sm">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={actualClosingBalance || ''}
                    onChange={(e) => setActualClosingBalance(Number(e.target.value) || 0)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* Status Selisih Fisik (Live Discrepancy Indicator) */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
                  difference === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : difference > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {difference === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    {difference === 0
                      ? 'Kas Fisik Impas (Sesuai perhitungan sistem)'
                      : difference > 0
                      ? 'Selisih Lebih Kas Fisik (Overage)'
                      : 'Selisih Kurang Kas Fisik (Shortage)'}
                  </span>
                </div>
                <strong className="text-sm">
                  {difference === 0
                    ? 'Rp0'
                    : difference > 0
                    ? `+${formatRupiah(difference)}`
                    : `-${formatRupiah(Math.abs(difference))}`}
                </strong>
              </div>

              {/* Input Catatan Selisih (Wajib jika difference !== 0) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Catatan Penutupan Sesi
                  {hasDifference ? (
                    <span className="text-rose-600 font-bold ml-1">*(Wajib diisi karena ada selisih)</span>
                  ) : (
                    <span className="text-slate-400 font-normal ml-1">(Opsional)</span>
                  )}
                </label>
                <textarea
                  rows={2}
                  required={hasDifference}
                  value={differenceNotes}
                  onChange={(e) => setDifferenceNotes(e.target.value)}
                  placeholder={
                    hasDifference
                      ? 'Jelaskan penyebab selisih fisik kasir di sini...'
                      : 'Catatan tambahan penutupan sesi...'
                  }
                  className={`w-full p-2.5 text-xs bg-white border rounded-xl text-slate-900 outline-hidden transition-all ${
                    hasDifference && !differenceNotes.trim()
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-rose-500'
                  }`}
                />
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Perhatian: Sesi kas yang telah ditutup tidak dapat dibuka kembali atau diubah historinya.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Menutup Sesi...' : 'Tutup Sesi & Simpan'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
