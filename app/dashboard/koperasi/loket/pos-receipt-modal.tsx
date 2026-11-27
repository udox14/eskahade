'use client'

import React, { useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { CheckCircle2, Printer, X, ArrowRight } from 'lucide-react'
import { formatFinanceDate } from '@/lib/finance/date-format'
import type { LoketWithdrawalReceipt, LoketPaymentReceipt } from './actions'

interface PosReceiptModalProps {
  receipt: LoketWithdrawalReceipt | LoketPaymentReceipt | null
  isOpen: boolean
  onClose: () => void
  onNewTransaction: () => void
}

const formatRupiah = (val: number) => `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`

export default function PosReceiptModal({
  receipt,
  isOpen,
  onClose,
  onNewTransaction,
}: PosReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: receipt ? `Struk-${receipt.receiptNumber}` : 'Struk-Loket',
  })

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !receipt) return null

  const isWithdrawal = receipt.type === 'WITHDRAWAL'
  const formattedTime = /^\d{4}-\d{2}-\d{2}/.test(receipt.timestamp)
    ? formatFinanceDate(receipt.timestamp, true)
    : receipt.timestamp

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h3 id="receipt-modal-title" className="text-sm font-bold text-slate-900">
              {isWithdrawal ? 'Penarikan Berhasil' : 'Pembayaran / Setoran Berhasil'}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Tutup struk"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Struk */}
        <div className="flex-1 overflow-y-auto p-5">
          <div
            ref={printRef}
            className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 font-mono text-xs text-slate-800 shadow-2xs tabular-nums"
          >
            <div className="border-b border-slate-200 pb-3 text-center space-y-0.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Koperasi Pondok Pesantren Sukahideng
              </h4>
              <p className="pt-1 text-[10px] font-bold text-slate-700">
                {isWithdrawal ? '*** BUKTI PENCAIRAN UANG JAJAN ***' : '*** BUKTI PENERIMAAN KAS ***'}
              </p>
            </div>

            <div className="space-y-1 border-b border-slate-200 pb-2 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">No. Bukti:</span>
                <span className="font-bold text-slate-900">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Waktu (WIB):</span>
                <span>{formattedTime}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Kasir:</span>
                <span>{receipt.operatorName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Kode Sesi:</span>
                <span>{receipt.sessionCode}</span>
              </div>
            </div>

            <div className="space-y-1 border-b border-slate-200 pb-2 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Santri:</span>
                <span className="font-bold text-slate-900">{receipt.santri.namaLengkap}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">NIS:</span>
                <span>{receipt.santri.nis}</span>
              </div>
              {receipt.santri.asrama && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Asrama:</span>
                  <span>
                    {receipt.santri.asrama}
                    {receipt.santri.kamar ? ` / Kamar ${receipt.santri.kamar}` : ''}
                  </span>
                </div>
              )}
            </div>

            {isWithdrawal ? (
              <div className="space-y-1.5 py-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Nominal Pencairan:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatRupiah((receipt as LoketWithdrawalReceipt).amount)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Saldo Sebelum:</span>
                  <span>{formatRupiah((receipt as LoketWithdrawalReceipt).balanceBefore)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 text-xs font-bold text-emerald-800">
                  <span>Saldo Tersisa:</span>
                  <span>{formatRupiah((receipt as LoketWithdrawalReceipt).balanceAfter)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Sisa Kuota Limit Hari Ini:</span>
                  <span>{formatRupiah((receipt as LoketWithdrawalReceipt).remainingDailyQuota)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 py-1 text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-500">Item Transaksi:</span>
                <div className="space-y-1">
                  {(receipt as LoketPaymentReceipt).items.map((it, idx) => (
                    <div key={idx} className="flex justify-between gap-2 text-[11px]">
                      <span>
                        {it.itemLabel} {it.period ? `(${it.period})` : ''}
                      </span>
                      <span className="font-bold whitespace-nowrap">{formatRupiah(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Diterima:</span>
                  <span>{formatRupiah((receipt as LoketPaymentReceipt).grossAmount)}</span>
                </div>
                {(receipt as LoketPaymentReceipt).walletBalanceAfter !== null &&
                  (receipt as LoketPaymentReceipt).walletBalanceAfter !== undefined && (
                    <div className="flex justify-between pt-1 text-[11px] font-semibold text-emerald-700">
                      <span>Saldo Uang Jajan Terkini:</span>
                      <span>{formatRupiah((receipt as LoketPaymentReceipt).walletBalanceAfter!)}</span>
                    </div>
                  )}
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400 space-y-0.5">
              <p>Terima kasih atas kerja samanya.</p>
              <p>Simpan tanda bukti ini sebagai bukti transaksi sah.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-4">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Cetak Struk</span>
          </button>

          <button
            type="button"
            onClick={onNewTransaction}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 cursor-pointer"
          >
            <span>Transaksi Baru</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
