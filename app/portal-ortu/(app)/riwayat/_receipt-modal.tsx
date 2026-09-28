'use client'

import { useRef } from 'react'
import { Printer, CheckCircle2 } from 'lucide-react'
import type { PortalTransactionHistoryItem } from '@/lib/portal/finance'
import { formatRupiah } from '@/lib/portal/format'
import DocumentLetterhead from '@/components/print/document-letterhead'
import { BottomSheet } from '../../_components/bottom-sheet'

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
    <BottomSheet
      open={true}
      onClose={onClose}
      title={item.type === 'TOPUP' ? 'Bukti Top-up Uang Jajan' : 'Kuitansi Pembayaran Resmi'}
      subtitle={`No. Bukti: ${item.referenceNumber}`}
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
      headerClassName="print:hidden"
      footerClassName="print:hidden"
      contentRef={printRef}
      contentClassName="p-6 text-slate-800 text-xs space-y-4 print:p-8 print:overflow-visible"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] px-4 py-2.5 text-xs font-bold text-[#bef264] shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Kuitansi</span>
          </button>
        </>
      }
    >
      {/* Header Pesantren */}
      <div>
        <DocumentLetterhead />
        <div className="text-center -mt-2 mb-3">
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-50 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200/80">
            {item.type === 'TOPUP' ? 'Bukti Pengisian Saldo Uang Jajan' : 'Tanda Terima Pembayaran Sah'}
          </span>
        </div>
      </div>

      {/* Meta Kuitansi */}
      <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-100 pb-3">
        <div>
          <p className="text-slate-600 font-medium">Nomor Bukti</p>
          <p className="font-mono font-bold text-slate-900">{item.referenceNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-600 font-medium">Tanggal / Waktu</p>
          <p className="font-semibold text-slate-900">{dateFormatted} WIB</p>
        </div>
        <div>
          <p className="text-slate-600 font-medium">Nama Santri</p>
          <p className="font-bold text-slate-900">{santri.nama}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-600 font-medium">NIS & Asrama</p>
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
                <span className="font-bold text-slate-900 font-mono">{formatRupiah(it.amount)}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between p-2.5">
              <span className="font-bold text-slate-900">{item.title}</span>
              <span className="font-bold text-slate-900 font-mono">{formatRupiah(item.amount)}</span>
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
              <span className="font-mono">{formatRupiah(item.grossAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Biaya Transaksi Payment Gateway</span>
              <span className="font-mono">{formatRupiah(item.gatewayFee)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-black text-sm text-slate-950 pt-1 border-t border-slate-100">
          <span>Total Dibayar</span>
          <span className="font-mono">{formatRupiah(item.amount)}</span>
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
      <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-600 text-center space-y-0.5">
        <p>
          Tanda terima ini diunduh melalui Portal Orang Tua Pesantren Sukahideng.
        </p>
        <p className="font-mono text-[9px] text-slate-600">
          No. Transaksi: {item.referenceNumber}
        </p>
      </div>
    </BottomSheet>
  )
}
