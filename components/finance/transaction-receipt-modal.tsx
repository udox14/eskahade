'use client'

import React from 'react'
import { Printer, X, CheckCircle2 } from 'lucide-react'
import DocumentLetterhead from '@/components/print/document-letterhead'
import type { GlobalTransactionRow } from '@/lib/finance/history'
import type { getTransactionDetail } from '@/app/dashboard/keuangan/riwayat/actions'

interface TransactionReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: GlobalTransactionRow | null
  detailData: Awaited<ReturnType<typeof getTransactionDetail>> | null
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }) + ' WIB'
  } catch {
    return dateStr
  }
}

export function TransactionReceiptModal({
  isOpen,
  onClose,
  transaction,
  detailData,
}: TransactionReceiptModalProps) {
  if (!isOpen || !transaction) return null

  const handlePrint = () => {
    window.print()
  }

  const isIncoming = transaction.direction === 'IN'
  const isDistribution = transaction.category === 'DISTRIBUTION'
  const isWithdrawal = transaction.category === 'WITHDRAWAL'

  let docTitle = 'Kuitansi Pembayaran Sah'
  if (isDistribution) docTitle = 'Bukti Penyaluran Dana'
  else if (isWithdrawal) docTitle = 'Bukti Penarikan Uang Jajan'
  else if (transaction.category === 'TOPUP') docTitle = 'Bukti Pengisian Saldo Uang Jajan'
  else if (transaction.category === 'CORRECTION') docTitle = 'Bukti Koreksi Keuangan'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-white">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none">
        {/* Header Modal (Hidden on Print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-2 text-slate-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">{docTitle}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 overflow-y-auto space-y-5 flex-1 bg-white text-slate-800 text-xs font-sans print:p-6 print:overflow-visible">
          {/* Shared Kop Surat */}
          <div>
            <DocumentLetterhead />
            <div className="text-center -mt-2 mb-4 pb-2 border-b border-slate-200">
              <span className="inline-block px-3 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-widest">
                {docTitle}
              </span>
            </div>
          </div>

          {/* Nomor Transaksi & Waktu */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Nomor Referensi
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {transaction.transactionNumber}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Waktu Transaksi
              </span>
              <span className="font-medium text-slate-800">
                {formatDateDisplay(transaction.createdAt)}
              </span>
            </div>
          </div>

          {/* Data Santri / Penerima */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs bg-slate-50/40">
            {transaction.santriName ? (
              <>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-500 font-medium">Nama Santri</span>
                  <span className="font-bold text-slate-900">{transaction.santriName}</span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-500 font-medium">NIS</span>
                  <span className="font-mono text-slate-800">{transaction.santriNis || '-'}</span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-500 font-medium">Asrama / Kamar</span>
                  <span className="text-slate-800">
                    {[transaction.santriAsrama, transaction.santriKamar].filter(Boolean).join(' - ') || '-'}
                  </span>
                </div>
              </>
            ) : transaction.recipientInfo ? (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-500 font-medium">Pihak Penerima</span>
                <span className="font-bold text-purple-900">{transaction.recipientInfo}</span>
              </div>
            ) : null}

            <div className="px-4 py-2 flex justify-between">
              <span className="text-slate-500 font-medium">Kategori Transaksi</span>
              <span className="font-semibold text-slate-800">{transaction.categoryLabel}</span>
            </div>

            <div className="px-4 py-2 flex justify-between">
              <span className="text-slate-500 font-medium">Metode & Kanal</span>
              <span className="text-slate-800">
                {transaction.channel} {transaction.method && transaction.method !== transaction.channel ? `(${transaction.method})` : ''}
              </span>
            </div>
          </div>

          {/* Rincian Alokasi (Jika ada) */}
          {detailData?.allocations && detailData.allocations.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Rincian Pos Pembayaran
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {detailData.allocations.map((alloc) => (
                  <div key={alloc.id} className="px-4 py-2 flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-800">{alloc.itemLabel}</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(alloc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total Nominal */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Status Transaksi</span>
              <span className="font-bold text-emerald-700 uppercase">{transaction.status}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-700">Total Nominal</span>
              <span className="font-mono font-extrabold text-base text-slate-900">
                {isIncoming ? '+ ' : '- '}
                {formatRupiah(transaction.amount)}
              </span>
            </div>
          </div>

          {/* Audit Trail Singkat */}
          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500 pt-1">
            <div>
              <span>Petugas / Kasir: </span>
              <span className="font-semibold text-slate-700">{transaction.operatorName || 'Sistem'}</span>
            </div>
            {detailData?.auditTrail.cashSessionCode && (
              <div className="text-right">
                <span>Sesi Kasir: </span>
                <span className="font-mono text-slate-700">{detailData.auditTrail.cashSessionCode}</span>
              </div>
            )}
          </div>

          {/* Footer Dokumen */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
            <p>
              Dokumen dicetak melalui Sistem Administrasi & Keuangan Pondok Pesantren Sukahideng.
            </p>
            <p className="font-mono text-[9px] text-slate-400">
              No. Transaksi: {transaction.transactionNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
