'use client'

import React, { useEffect, useState } from 'react'
import { X, Lock, PlusCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { FinanceCashSession } from '@/lib/finance/cash-session'

interface CashSessionModalProps {
  mode: 'OPEN' | 'CLOSE'
  isOpen: boolean
  activeSession: FinanceCashSession | null
  onClose: () => void
  onOpenSessionSubmit: (openingBalance: number, notes?: string) => Promise<void>
  onCloseSessionSubmit: (sessionId: string, actualClosingBalance: number, notes?: string) => Promise<void>
  /** Sisa fisik sesi terakhir operator: acuan kas awal (beda → catatan wajib). */
  lastClosedSession?: { sessionCode: string; actualClosingBalance: number } | null
}

const QUICK_OPENING_BALANCES = [50000, 100000, 200000, 500000]
const formatRupiah = (val: number) => `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`

export default function CashSessionModal({
  mode,
  isOpen,
  activeSession,
  onClose,
  onOpenSessionSubmit,
  onCloseSessionSubmit,
  lastClosedSession,
}: CashSessionModalProps) {
  const [openingInput, setOpeningInput] = useState<string>(
    String(lastClosedSession?.actualClosingBalance ?? 100000)
  )
  const [openingNotes, setOpeningNotes] = useState<string>('')

  const [closingInput, setClosingInput] = useState<string>(
    String(activeSession ? activeSession.expected_closing_balance : 0)
  )
  const [differenceNotes, setDifferenceNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const openingBalance = parseInt(openingInput.replace(/\D/g, ''), 10) || 0
  const actualClosingBalance = parseInt(closingInput.replace(/\D/g, ''), 10) || 0

  const expectedClosing = activeSession ? activeSession.expected_closing_balance : 0
  const difference = actualClosingBalance - expectedClosing
  const hasDifference = difference !== 0
  const openingGap = !!lastClosedSession && openingBalance !== lastClosedSession.actualClosingBalance

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    if (openingInput.trim() === '') {
      setErrorMessage('Masukkan saldo awal kas fisik (isi 0 jika laci kosong).')
      return
    }
    if (openingGap && openingNotes.trim().length < 5) {
      setErrorMessage(
        'Kas awal berbeda dari sisa fisik sesi terakhir. Isi catatan asal/selisih uang (minimal 5 huruf). Uang dari rekening dicatat lewat tombol "Kas Bank" setelah sesi dibuka.'
      )
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

    if (closingInput.trim() === '') {
      setErrorMessage('Masukkan hasil hitungan saldo fisik akhir (isi 0 jika laci kosong).')
      return
    }
    if (hasDifference && !differenceNotes.trim()) {
      setErrorMessage('Terdapat selisih kas fisik. Catatan penyebab selisih wajib diisi.')
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-session-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                mode === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {mode === 'OPEN' ? (
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Lock className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="cash-session-dialog-title" className="text-base font-bold text-slate-900">
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
            aria-label="Tutup modal"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'OPEN' ? (
            <form onSubmit={handleOpenSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Saldo Kas Fisik Awal (Modal di Laci)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={openingInput === '' ? '' : openingBalance.toLocaleString('id-ID')}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '')
                      setOpeningInput(clean)
                    }}
                    placeholder="0"
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-base font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                {lastClosedSession && (
                  <p className="mt-2 text-[11px] text-slate-600 tabular-nums">
                    Sisa fisik sesi terakhir ({lastClosedSession.sessionCode}):{' '}
                    <strong>{formatRupiah(lastClosedSession.actualClosingBalance)}</strong>.
                    {openingGap
                      ? ' Kas awal berbeda — catatan wajib diisi.'
                      : ' Kas awal sama dengan sisa sesi terakhir.'}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_OPENING_BALANCES.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningInput(String(amt))}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        openingInput !== '' && openingBalance === amt
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOpeningInput('0')}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      openingInput !== '' && openingBalance === 0
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Rp0 (Kosong)
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  {openingGap ? 'Catatan Asal / Selisih Kas Awal (Wajib)' : 'Catatan Sesi (Opsional)'}
                </label>
                <textarea
                  rows={2}
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Contoh: Sesi pagi loket koperasi…"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[38px] rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Membuka…' : 'Buka Sesi Sekarang'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCloseSubmit} className="space-y-4">
              {activeSession && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs tabular-nums">
                  <div className="flex justify-between text-slate-600">
                    <span>Saldo Awal Kasir</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(activeSession.opening_balance)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Kas Masuk (tunai &amp; ambil dari rekening)</span>
                    <span className="font-semibold text-emerald-700">+{formatRupiah(activeSession.total_cash_in)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Kas Keluar (pencairan, setor rekening, dll.)</span>
                    <span className="font-semibold text-rose-700">-{formatRupiah(activeSession.total_cash_out)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                    <span>Saldo Seharusnya di Laci</span>
                    <span>{formatRupiah(expectedClosing)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Saldo Kas Fisik Riil (Hasil Hitungan Laci)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={closingInput === '' ? '' : actualClosingBalance.toLocaleString('id-ID')}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '')
                      setClosingInput(clean)
                    }}
                    placeholder="0"
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-base font-bold text-slate-900 tabular-nums focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/15"
                  />
                </div>
              </div>

              <div
                className={`flex items-center justify-between rounded-xl border p-3 text-xs font-semibold ${
                  difference === 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : difference > 0
                      ? 'border-sky-200 bg-sky-50 text-sky-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {difference === 0 ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {difference === 0
                      ? 'Kas Fisik Seimbang Pas'
                      : difference > 0
                        ? 'Selisih Lebih Kas Fisik'
                        : 'Selisih Kurang Kas Fisik'}
                  </span>
                </div>
                <strong className="text-sm tabular-nums">
                  {difference === 0
                    ? 'Rp0'
                    : difference > 0
                      ? `+${formatRupiah(difference)}`
                      : `-${formatRupiah(Math.abs(difference))}`}
                </strong>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Catatan Penutupan Sesi
                  {hasDifference ? (
                    <span className="ml-1 font-bold text-rose-600">* (Wajib diisi karena ada selisih)</span>
                  ) : (
                    <span className="ml-1 font-normal text-slate-400">(Opsional)</span>
                  )}
                </label>
                <textarea
                  rows={2}
                  required={hasDifference}
                  value={differenceNotes}
                  onChange={(e) => setDifferenceNotes(e.target.value)}
                  placeholder={
                    hasDifference ? 'Jelaskan penyebab selisih kas fisik di sini…' : 'Catatan penutupan sesi…'
                  }
                  className={`w-full rounded-xl border bg-white p-2.5 text-xs text-slate-900 focus:outline-none ${
                    hasDifference && !differenceNotes.trim()
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-300 focus:border-rose-500'
                  }`}
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>Sesi kas yang sudah ditutup tidak dapat dibuka kembali atau diubah riwayatnya.</span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[38px] rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menutup Sesi…' : 'Tutup Sesi & Simpan'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
