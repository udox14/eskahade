// app/dashboard/keuangan/kredensial/pin-slip-print-sheet.tsx
// Lembar Cetak Slip PIN Awal Santri (Patch C2)
// Menampilkan slip PIN cuttable (dapat dipotong per santri) secara terpisah dari kartu fisik.
// Plaintext PIN hanya ada di memori saat modal aktif dan tidak tersimpan di database.

'use client'

import React from 'react'
import { Printer, ShieldAlert, Scissors } from 'lucide-react'


export interface PinSlipItem {
  santriId: string
  namaLengkap: string
  nis: string
  asrama: string | null
  kamar: string | null
  initialPin: string
}

interface PinSlipPrintSheetProps {
  slips: PinSlipItem[]
  onClose: () => void
}

export function PinSlipPrintSheet({ slips, onClose }: PinSlipPrintSheetProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 print:p-0 print:bg-white print:static">
      {/* Screen Toolbar (Hidden on print) */}
      <div className="mx-auto max-w-4xl mb-4 flex items-center justify-between bg-white rounded-xl p-4 shadow-lg print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Cetak Lembar Slip PIN Awal ({slips.length} Santri)
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              Rahasia • One-Time View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Layout A4 (6 slip per lembar dengan garis potong gunting). Cetak dan bagikan secara tertutup ke wali santri / santri.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Printer className="h-4 w-4" />
            Cetak Sekarang (Ctrl+P)
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="mx-auto max-w-[210mm] bg-white shadow-2xl print:shadow-none print:max-w-none print:m-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 10mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: white !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .slip-item {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}} />

        {/* Grid 2 Columns x 3 Rows per A4 page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-4 p-6 print:p-0">
          {slips.map((slip) => (
            <div
              key={slip.santriId}
              className="slip-item relative rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 flex flex-col justify-between"
              style={{ minHeight: '85mm' }}
            >
              {/* Cut Scissors Indicator */}
              <div className="absolute -top-2.5 right-4 bg-white px-1 text-slate-400 flex items-center gap-0.5 text-[9px] font-mono">
                <Scissors className="w-3 h-3" />
                <span>Gunting di sini</span>
              </div>

              {/* Slip Header */}
              <div className="border-b border-slate-200 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-wider text-slate-800 uppercase">
                    Pondok Pesantren Sukahideng
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Dokumen Rahasia
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 font-medium">
                  Slip Aktivasi PIN Awal Uang Jajan &amp; Kartu Santri
                </div>
              </div>

              {/* Student Identity */}
              <div className="my-2 space-y-1">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {slip.namaLengkap}
                </div>
                <div className="text-[10px] text-slate-600 font-mono space-y-0.5">
                  <div>NIS: <span className="font-bold text-slate-900">{slip.nis}</span></div>
                  <div>Asrama: <span className="text-slate-800">{slip.asrama || '-'}</span> {slip.kamar ? `• Kamar ${slip.kamar}` : ''}</div>
                </div>
              </div>

              {/* Initial PIN Box */}
              <div className="my-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                  PIN Awal (6 Digit)
                </div>
                <div className="text-2xl font-mono font-black tracking-[0.3em] text-slate-900">
                  {slip.initialPin}
                </div>
              </div>

              {/* Instruction Footer */}
              <div className="border-t border-slate-200 pt-2 text-[8px] text-slate-500 leading-relaxed space-y-1">
                <p>
                  <span className="font-bold text-slate-700">PENTING:</span> PIN ini diterbitkan secara acak dan hanya dicetak satu kali. Segera ganti PIN ini melalui <span className="font-semibold text-slate-700">Portal Orang Tua</span> atau di <span className="font-semibold text-slate-700">Loket Koperasi</span> demi keamanan saldo santri.
                </p>
                <div className="flex justify-between text-[7.5px] text-slate-400 font-mono pt-1">
                  <span>Waktu Terbit: {new Date().toLocaleDateString('id-ID')}</span>
                  <span>Sistem Keuangan Sukahideng</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
