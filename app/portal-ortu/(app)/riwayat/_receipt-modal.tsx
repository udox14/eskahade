'use client'

import { useRef } from 'react'
import { Printer, X, CheckCircle2 } from 'lucide-react'
import type { PortalTransactionHistoryItem } from '@/lib/portal/finance'
import DocumentLetterhead from '@/components/print/document-letterhead'

interface ReceiptModalProps {
  item: PortalTransactionHistoryItem
  santri: {
    nama: string
    nis: string
    asrama?: string | null
    kamar?: string | null
  }
  onClose: () => void
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ReceiptModal({ item, santri, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const dateFormatted = new Date(item.createdAt).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:max-w-none">
        {/* Action Header (Hidden saat print) */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{item.type === 'TOPUP' ? 'Bukti Top-up Uang Jajan' : 'Kuitansi Pembayaran Resmi'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Isi Dokumen Kuitansi Resmi */}
        <div ref={printRef} className="p-6 text-slate-800 text-xs space-y-4 print:p-8">
          {/* Header Pesantren */}
          <div>
            <DocumentLetterhead />
            <div className="text-center -mt-2 mb-3">
              <span className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                {item.type === 'TOPUP' ? 'Bukti Pengisian Saldo Uang Jajan' : 'Tanda Terima Pembayaran Sah'}
              </span>
            </div>
          </div>

          {/* Meta Kuitansi */}
          <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-100 pb-3">
            <div>
              <p className="text-slate-400 font-medium">Nomor Bukti</p>
              <p className="font-mono font-bold text-slate-900">{item.referenceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-medium">Tanggal / Waktu</p>
              <p className="font-semibold text-slate-900">{dateFormatted} WIB</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Nama Santri</p>
              <p className="font-bold text-slate-900">{santri.nama}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-medium">NIS & Asrama</p>
              <p className="font-semibold text-slate-900">
                {santri.nis} {santri.asrama ? `· ${santri.asrama}` : ''}
              </p>
            </div>
          </div>

          {/* Rincian Pos Pembayaran */}
          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
              Rincian Pembayaran
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-200/80">
              {item.items && item.items.length > 0 ? (
                item.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5">
                    <div>
                      <p className="font-bold text-slate-900">{it.itemLabel}</p>
                      {it.period && <p className="text-[10px] text-slate-500">{it.period}</p>}
                    </div>
                    <span className="font-bold text-slate-900">{formatRupiah(it.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-2.5">
                  <span className="font-bold text-slate-900">{item.title}</span>
                  <span className="font-bold text-slate-900">{formatRupiah(item.amount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rekap Total */}
          <div className="space-y-1.5 border-t border-slate-200 pt-3 text-[11px]">
            {item.grossAmount !== undefined && item.gatewayFee !== undefined && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal Tagihan</span>
                  <span>{formatRupiah(item.grossAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Biaya Transaksi Payment Gateway</span>
                  <span>{formatRupiah(item.gatewayFee)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-black text-sm text-slate-950 pt-1 border-t border-slate-100">
              <span>Total Dibayar</span>
              <span>{formatRupiah(item.amount)}</span>
            </div>
            <div className="flex justify-between text-slate-500 pt-1">
              <span>Metode Pembayaran</span>
              <span className="font-semibold text-slate-700">
                {item.channel || 'ONLINE'} {item.method ? `(${item.method})` : ''}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Status Transaksi</span>
              <span className="font-bold text-emerald-700 uppercase">BERHASIL / LUNAS</span>
            </div>
          </div>

          {/* Footer Dokumen */}
          <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-400 text-center space-y-0.5">
            <p>
              Tanda terima ini diunduh melalui Portal Orang Tua Pesantren Sukahideng.
            </p>
            <p className="font-mono text-[9px] text-slate-400">
              No. Transaksi: {item.referenceNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
