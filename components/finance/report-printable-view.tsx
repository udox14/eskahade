// components/finance/report-printable-view.tsx
// Komponen Preview & Cetak Laporan Keuangan Siap Cetak (Fase 10: PRD Bab 34 & UI/UX Guidelines #44)
// Menjamin:
// 1. Kop surat formal Pondok Pesantren Eskahade.
// 2. Tampilan preview bersih, printer-friendly (hitam/slate, tanpa background pekat).
// 3. Integrasi pencetakan langsung via react-to-print.
// 4. Pengesahan tanda tangan Bendahara dan Petugas Pembuat Laporan.

'use client'

import React, { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer, X } from 'lucide-react'

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
}

export default function ReportPrintableView<T>({
  isOpen,
  onClose,
  title,
  subtitle = 'Sistem Manajemen Keuangan Baru',
  filterSummary = 'Semua Data',
  kpis = [],
  columns,
  data,
  footerTotals = [],
  orientation = 'portrait',
}: ReportPrintableViewProps<T>) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: title.replace(/\s+/g, '-'),
  })

  if (!isOpen) return null

  const printTimestamp = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`relative w-full ${
          orientation === 'landscape' ? 'max-w-6xl' : 'max-w-4xl'
        } bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]`}
      >
        {/* Top Control Bar (Screen Only) */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Preview Cetak / PDF Dokumen</h2>
            <p className="text-xs text-slate-500">
              Dokumen siap dicetak atau disimpan sebagai PDF dengan layout standar pesantren.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint()}
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
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div
            ref={printRef}
            className={`bg-white p-8 rounded-sm shadow-md text-slate-900 font-sans print:shadow-none print:p-0 w-full ${
              orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
            }`}
            style={{ minHeight: '297mm' }}
          >
            {/* Kop Pesantren */}
            <div className="border-b-2 border-slate-900 pb-3 mb-5 text-center">
              <h1 className="text-xl font-bold tracking-wider text-slate-900 uppercase">
                PONDOK PESANTREN ESKAHADE
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Jl. Pesantren Sukahideng No. 01, Sukapada, Kec. Pagerageung, Kab. Tasikmalaya, Jawa Barat
              </p>
              <p className="text-[11px] text-slate-500">
                Sistem Informasi Keuangan Pesantren Terpadu • Website: eskahade.sch.id
              </p>
            </div>

            {/* Judul Laporan & Metadata */}
            <div className="mb-5 text-center">
              <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 underline underline-offset-4">
                {title}
              </h2>
              <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
              <div className="inline-flex items-center gap-4 mt-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
                <span>
                  <strong>Parameter Filter:</strong> {filterSummary}
                </span>
                <span>•</span>
                <span>
                  <strong>Waktu Cetak:</strong> {printTimestamp} WIB
                </span>
              </div>
            </div>

            {/* KPI Summary Block (Jika Ada) */}
            {kpis.length > 0 && (
              <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                {kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 border border-slate-200 rounded bg-slate-50/70 text-center"
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
                  <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
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

            {/* Blok Tanda Tangan Resmi */}
            <div className="mt-10 pt-4 grid grid-cols-2 text-center text-xs break-inside-avoid">
              <div className="space-y-1">
                <p className="text-slate-600">Mengetahui,</p>
                <p className="font-bold text-slate-900">Bendahara Pesantren Eskahade</p>
                <div className="h-16"></div>
                <p className="font-semibold text-slate-900 underline underline-offset-2">
                  ( Ust. Bendahara, M.Pd. )
                </p>
                <p className="text-[10px] text-slate-500">NIP: 19850612.201201.1.002</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-600">Tasikmalaya, {printTimestamp.slice(0, 15)}</p>
                <p className="font-bold text-slate-900">Petugas Pembuat Laporan</p>
                <div className="h-16"></div>
                <p className="font-semibold text-slate-900 underline underline-offset-2">
                  ( Petugas Administrasi Keuangan )
                </p>
                <p className="text-[10px] text-slate-500">Bagian Tata Usaha & Koperasi</p>
              </div>
            </div>

            {/* Footer Cetak */}
            <div className="mt-8 pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400 flex justify-between">
              <span>Dicetak otomatis oleh Sistem Keuangan Baru Eskahade</span>
              <span>Halaman 1 dari 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
