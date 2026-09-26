'use client'

import React from 'react'
import { Printer } from 'lucide-react'
import type { CardPrintItem } from './actions'

interface CardPrintSheetProps {
  cards: CardPrintItem[]
  onClose: () => void
}

function getInitials(name: string) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

export function CardPrintSheet({ cards, onClose }: CardPrintSheetProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 print:p-0 print:bg-white print:static">
      {/* Screen Toolbar (Hidden on print) */}
      <div className="mx-auto max-w-5xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl p-4 shadow-lg print:hidden border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Pratinjau Cetak Kartu Santri ({cards.length} Kartu)
            </h2>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Desain Baru: QR Jumbo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Layout standar A4 (2 × 4 kartu per lembar) • Rasio CR80 (85.6mm × 54mm) • Logo Pesantren &amp; QR Code Scannable
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
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
              margin: 8mm 6mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: white !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
            .card-item {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}} />

        {/* Grid 2 Columns per A4 page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-x-[5mm] print:gap-y-[4.5mm] p-6 print:p-0">
          {cards.map((card) => {
            const tokenPreview = card.cardToken.slice(-8).toUpperCase()
            return (
              <div
                key={card.santriId}
                className="card-item relative overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm print:shadow-none print:border-slate-400 flex flex-col justify-between"
                style={{
                  width: '100%',
                  aspectRatio: '85.6 / 53.98',
                  height: '53.98mm',
                  maxHeight: '54mm',
                  padding: '2.5mm 3.5mm 2.2mm 3.5mm',
                  boxSizing: 'border-box',
                }}
              >
                {/* Decorative Top Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-[2.2mm] bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700" />

                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-1 mt-[1.2mm]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Logo Pesantren - Proporsional ("jangan gede-gede") */}
                    <div className="relative h-[7.2mm] w-[7.2mm] shrink-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/logo.png"
                        alt="Logo Pesantren"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col justify-center leading-none min-w-0">
                      <div className="text-[8.5px] font-black uppercase tracking-wider text-emerald-950 truncate">
                        Pondok Pesantren Sukahideng
                      </div>
                      <div className="text-[6.2px] font-semibold text-slate-500 uppercase tracking-tight mt-0.5 truncate">
                        Kartu Santri &amp; Uang Jajan
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 leading-none pl-1">
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[6.5px] font-extrabold text-emerald-800 border border-emerald-200/90">
                      ESKAHADE
                    </span>
                    <span className="text-[5.5px] font-mono font-medium text-slate-400 mt-0.5">
                      ID-1 CR80
                    </span>
                  </div>
                </div>

                {/* Card Main Body */}
                <div className="flex items-center justify-between gap-2.5 my-auto min-h-0">
                  {/* Left Column: Santri Identity */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div
                      className="text-[9.5px] font-black leading-tight text-slate-900 line-clamp-2"
                      title={card.namaLengkap}
                    >
                      {card.namaLengkap}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      {/* Santri Photo (3:4 standard ratio) */}
                      <div className="relative h-[21mm] w-[15.75mm] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100 shadow-2xs">
                        {card.fotoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={card.fotoUrl}
                            alt={card.namaLengkap}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 text-emerald-800">
                            <span className="text-[9.5px] font-black tracking-wider uppercase">
                              {getInitials(card.namaLengkap)}
                            </span>
                            <span className="text-[5.5px] font-semibold text-slate-400 uppercase tracking-tighter mt-0.5">
                              Santri
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info Details */}
                      <div className="min-w-0 flex-1 space-y-0.5 text-[7.5px] text-slate-600">
                        <div>
                          <span className="text-slate-400 text-[6.5px] uppercase font-bold tracking-tight block">NIS</span>
                          <span className="font-mono font-black text-slate-900 text-[8.5px] tracking-tight">{card.nis}</span>
                        </div>
                        <div className="pt-0.5 truncate">
                          <span className="text-slate-400 text-[6.5px] uppercase font-bold tracking-tight block">Asrama</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {card.asrama || '-'}
                            {card.kamar && <span className="text-slate-500 font-normal"> / Kmr {card.kamar}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: JUMBO QR CODE */}
                  <div className="shrink-0 flex flex-col items-center justify-center">
                    <div className="relative h-[31.5mm] w-[31.5mm] rounded-lg border-2 border-slate-800 bg-white p-0.5 shadow-2xs flex items-center justify-center">
                      <div
                        className="h-full w-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
                        dangerouslySetInnerHTML={{ __html: card.qrSvg }}
                      />
                    </div>
                    <span className="text-[6px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                      Scan Loket / POS
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-0.5 text-[6.5px] text-slate-500 leading-none">
                  <div className="flex items-center gap-1 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Valid: Loket, Koperasi &amp; Presensi</span>
                  </div>
                  <div className="font-mono font-bold text-slate-700 tracking-wider">
                    TOKEN: ••••{tokenPreview}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
