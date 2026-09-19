'use client'

import React, { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  CheckCircle2,
  Printer,
  X,
  ArrowRight,
} from 'lucide-react'
import type { LoketWithdrawalReceipt, LoketPaymentReceipt } from './actions'

interface PosReceiptModalProps {
  receipt: LoketWithdrawalReceipt | LoketPaymentReceipt | null
  isOpen: boolean
  onClose: () => void
  onNewTransaction: () => void
}

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

  if (!isOpen || !receipt) return null

  const formatRupiah = (val: number) => `Rp${Math.max(0, val).toLocaleString('id-ID')}`
  const isWithdrawal = receipt.type === 'WITHDRAWAL'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal Status */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {isWithdrawal ? 'Penarikan Berhasil' : 'Pembayaran / Setoran Berhasil'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Print Area Preview */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            ref={printRef}
            className="bg-white p-5 rounded-2xl border border-dashed border-slate-300 font-mono text-xs space-y-3 text-slate-800 shadow-2xs"
          >
            {/* Header Struk */}
            <div className="text-center space-y-1 pb-3 border-b border-slate-200">
              <h4 className="font-bold text-sm tracking-wider text-slate-900 uppercase">
                KOPERASI PESANTREN ESKAHADE
              </h4>
              <p className="text-[10px] text-slate-500">Layanan Loket & Uang Jajan Santri</p>
              <p className="text-[10px] font-bold text-slate-700 mt-1">
                {isWithdrawal ? '*** BUKTI PENCAIRAN UANG JAJAN ***' : '*** BUKTI PENERIMAAN KAS ***'}
              </p>
            </div>

            {/* Meta Transaksi */}
            <div className="space-y-1 text-[11px] pb-2 border-b border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Bukti:</span>
                <span className="font-bold text-slate-900">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Waktu:</span>
                <span>{receipt.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir:</span>
                <span>{receipt.operatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kode Sesi:</span>
                <span>{receipt.sessionCode}</span>
              </div>
            </div>

            {/* Identitas Santri */}
            <div className="space-y-1 text-[11px] pb-2 border-b border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Santri:</span>
                <span className="font-bold text-slate-900">{receipt.santri.namaLengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIS:</span>
                <span>{receipt.santri.nis}</span>
              </div>
              {receipt.santri.asrama && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Asrama:</span>
                  <span>
                    {receipt.santri.asrama}
                    {receipt.santri.kamar ? ` / Kamar ${receipt.santri.kamar}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Rincian Finansial Transaksi */}
            {isWithdrawal ? (
              <div className="space-y-1.5 text-xs py-1">
                <div className="flex justify-between text-slate-600">
                  <span>Nominal Pencairan:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatRupiah((receipt as LoketWithdrawalReceipt).amount)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Saldo Sebelum:</span>
                  <span>{formatRupiah((receipt as LoketWithdrawalReceipt).balanceBefore)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-800 pt-1 border-t border-slate-100">
                  <span>Saldo Tersisa:</span>
                  <span>{formatRupiah((receipt as LoketWithdrawalReceipt).balanceAfter)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Sisa Kuota Limit Hari Ini:</span>
                  <span>{formatRupiah((receipt as LoketWithdrawalReceipt).remainingDailyQuota)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs py-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Item Transaksi:</span>
                <div className="space-y-1">
                  {(receipt as LoketPaymentReceipt).items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>
                        {it.itemLabel} {it.period ? `(${it.period})` : ''}
                      </span>
                      <span className="font-bold">{formatRupiah(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Diterima:</span>
                  <span>{formatRupiah((receipt as LoketPaymentReceipt).grossAmount)}</span>
                </div>
                {(receipt as LoketPaymentReceipt).walletBalanceAfter !== null &&
                  (receipt as LoketPaymentReceipt).walletBalanceAfter !== undefined && (
                    <div className="flex justify-between text-[11px] text-emerald-700 font-semibold pt-1">
                      <span>Saldo Uang Jajan Terkini:</span>
                      <span>{formatRupiah((receipt as LoketPaymentReceipt).walletBalanceAfter!)}</span>
                    </div>
                  )}
              </div>
            )}

            {/* Footer Struk */}
            <div className="text-center pt-3 border-t border-slate-200 text-[10px] text-slate-400 space-y-0.5">
              <p>Terima kasih atas kerja samanya.</p>
              <p>Simpan tanda bukti ini sebagai bukti transaksi sah.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Struk</span>
          </button>

          <button
            type="button"
            onClick={onNewTransaction}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs"
          >
            <span>Transaksi Baru</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
