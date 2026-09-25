// components/finance/report-printable-view.tsx
// Komponen Preview & Cetak Laporan Keuangan Siap Cetak
//
// Keputusan teknis (revisi robustness cetak mobile/Android):
// 1. Pencetakan memakai `window.print()` SINKRON di dalam gesture klik pengguna.
//    Pendekatan iframe asinkron rentan gagal senyap di sejumlah browser mobile
//    (dialog cetak tidak pernah muncul walau tombol ditekan).
// 2. Preview dirender lewat portal ke `document.body`, sehingga CSS cetak dapat
//    menyembunyikan seluruh isi aplikasi dan hanya menyisakan lembar laporan.
// 3. Seluruh chrome modal (control bar, scroll area, shadow, max-height) dinetralkan
//    saat mode cetak agar tabel dapat mengalir dan terpotong rapi antar halaman.
// 4. Tetap memakai Shared Print Infrastructure (PrintDocumentShell & DocumentLetterhead):
//    kop identitas resmi, layout printer-friendly, dan blok pengesahan bendahara.

'use client'

import React, { useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Printer, X } from 'lucide-react'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import {
  DEFAULT_LETTERHEAD_PROFILES,
  type LetterheadProfile,
  type LetterheadMode,
} from '@/lib/print/letterhead'

// Deteksi lingkungan browser tanpa setState di dalam effect (aman untuk SSR/hidrasi).
const subscribeNoop = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export interface PrintableColumn<T> {
  header: string
  accessor: (item: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  width?: string
}

export interface PrintableKpi {
  label: string
  value: string | number
}

interface ReportPrintableViewProps<T> {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  filterSummary?: string
  kpis?: PrintableKpi[]
  columns: PrintableColumn<T>[]
  data: T[]
  footerTotals?: Array<{ label: string; value: string; colSpan?: number }>
  orientation?: 'portrait' | 'landscape'
  letterheadProfile?: LetterheadProfile | null
  letterheadMode?: LetterheadMode
}

export default function ReportPrintableView<T>({
  isOpen,
  onClose,
  title,
  subtitle = 'Sistem Informasi Keuangan Pesantren Terpadu',
  filterSummary = 'Semua Data',
  kpis = [],
  columns,
  data,
  footerTotals = [],
  orientation = 'portrait',
  letterheadProfile,
  letterheadMode = 'default',
}: ReportPrintableViewProps<T>) {
  const printRef = useRef<HTMLDivElement>(null)
  const [printError, setPrintError] = useState<string | null>(null)

  // Portal hanya boleh dibuat di browser (bukan saat SSR): false di server, true setelah hidrasi.
  const isBrowser = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot)

  if (!isOpen || !isBrowser) return null

  // Fallback to Sukahideng default if not provided
  const activeProfile =
    letterheadProfile === undefined
      ? DEFAULT_LETTERHEAD_PROFILES[0]
      : letterheadProfile

  const handlePrint = () => {
    setPrintError(null)
    try {
      // Sinkron di dalam gesture klik → dialog cetak andal di desktop maupun mobile.
      window.print()
    } catch {
      setPrintError(
        'Browser menolak perintah cetak. Buka halaman ini di Google Chrome lalu coba lagi.'
      )
    }
  }

  const overlay = (
    <div className="report-print-portal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      {/* CSS khusus cetak: hanya lembar laporan yang tampil di kertas */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body > *:not(.report-print-portal) { display: none !important; }
              .report-print-portal {
                position: static !important;
                inset: auto !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
                backdrop-filter: none !important;
                overflow: visible !important;
              }
              .report-print-portal .report-print-window {
                display: block !important;
                width: 100% !important;
                max-width: none !important;
                max-height: none !important;
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                overflow: visible !important;
              }
              .report-print-portal .report-print-scroll {
                display: block !important;
                flex: none !important;
                overflow: visible !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              .report-print-controls { display: none !important; }
              .report-print-sheet { min-height: 0 !important; padding: 0 !important; }
              html, body {
                background: #ffffff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
                margin: 10mm;
              }
              tr, .report-print-avoid-break {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          `,
        }}
      />

      <div
        className={`report-print-window relative w-full ${
          orientation === 'landscape' ? 'max-w-6xl' : 'max-w-4xl'
        } bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]`}
      >
        {/* Top Control Bar (Screen Only) */}
        <div className="report-print-controls px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Preview Cetak / PDF Dokumen</h2>
            <p className="text-xs text-slate-500">
              Dokumen siap dicetak atau disimpan sebagai PDF dengan layout standar pesantren.
            </p>
            {printError ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {printError}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400 sm:hidden">
                Jika dialog cetak tidak muncul, buka halaman ini lewat Google Chrome.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="Tutup Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Sheet Preview */}
        <div className="report-print-scroll p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <PrintDocumentShell
            ref={printRef}
            className="report-print-sheet"
            letterheadProfile={activeProfile}
            letterheadMode={letterheadMode}
            title={title}
            subtitle={subtitle}
            filterSummary={filterSummary}
            orientation={orientation}
            showSignatureBlock={true}
            signatoryTitleLeft={'Mengetahui,\nBendahara Pesantren'}
            signatoryNameLeft={'( Ust. Bendahara, M.Pd. )'}
            signatoryTitleRight={'Petugas Pembuat Laporan'}
            signatoryNameRight={'( Petugas Administrasi Keuangan )'}
            signatoryLocation="Tasikmalaya"
            footerNote="Dicetak resmi oleh Sistem Informasi Keuangan Pesantren Sukahideng"
          >
            {/* KPI Summary Block (Jika Ada) */}
            {kpis.length > 0 && (
              <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                {kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 border border-slate-200 rounded bg-slate-50/70 text-center print:border-slate-300"
                  >
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">{kpi.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tabel Data Utama */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300 print:bg-slate-100">
                    <th className="py-2 px-2 border border-slate-300 text-center w-8">No</th>
                    {columns.map((col, idx) => (
                      <th
                        key={idx}
                        style={{ width: col.width }}
                        className={`py-2 px-2.5 border border-slate-300 ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="py-6 text-center text-slate-400 italic"
                      >
                        Tidak ada transaksi atau data finansial pada kriteria filter ini.
                      </td>
                    </tr>
                  ) : (
                    data.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50/50">
                        <td className="py-1.5 px-2 border border-slate-300 text-center text-slate-500 font-mono text-[11px]">
                          {rowIdx + 1}
                        </td>
                        {columns.map((col, colIdx) => (
                          <td
                            key={colIdx}
                            className={`py-1.5 px-2.5 border border-slate-300 text-[11px] ${
                              col.align === 'center'
                                ? 'text-center'
                                : col.align === 'right'
                                ? 'text-right font-mono'
                                : 'text-left'
                            }`}
                          >
                            {col.accessor(row, rowIdx)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Total Footer Row */}
                {footerTotals.length > 0 && data.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                      {footerTotals.map((tot, idx) => (
                        <td
                          key={idx}
                          colSpan={tot.colSpan || 1}
                          className="py-2 px-2.5 border border-slate-300 text-right text-xs font-mono"
                        >
                          {tot.label ? `${tot.label}: ` : ''}
                          {tot.value}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </PrintDocumentShell>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
