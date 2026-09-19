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
      <div className="mx-auto max-w-5xl mb-4 flex items-center justify-between bg-white rounded-xl p-4 shadow-lg print:hidden">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Pratinjau Cetak Kartu ATM Santri ({cards.length} Kartu)
          </h2>
          <p className="text-xs text-slate-500">
            Layout standar A4 (2 × 4 kartu per lembar) • Rasio CR80 (85.6mm × 54mm)
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
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
              margin: 10mm 8mm;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-[6mm] p-6 print:p-0">
          {cards.map((card) => {
            const tokenPreview = card.cardToken.slice(-8).toUpperCase()
            return (
              <div
                key={card.santriId}
                className={`card-item relative overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-br from-white via-slate-50 to-emerald-50/20 shadow-sm print:shadow-none print:border-slate-300 flex flex-col justify-between`}
                style={{
                  width: '100%',
                  aspectRatio: '85.6 / 53.98',
                  maxHeight: '54mm',
                  padding: '3.5mm 4mm',
                }}
              >
                {/* Decorative Top Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-[2.5mm] bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600" />

                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-1 mt-[1mm]">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-emerald-800">
                      Pondok Pesantren Sukahideng
                    </div>
                    <div className="text-[7.5px] font-semibold text-slate-500 uppercase tracking-tight">
                      Kartu Santri &amp; Uang Jajan
                    </div>
                  </div>
                  <div className="text-[7px] font-mono font-bold text-slate-400">
                    ID-1 CR80
                  </div>
                </div>

                {/* Card Main Body */}
                <div className="flex items-center gap-2.5 my-auto">
                  {/* Santri Photo */}
                  <div className="relative h-[22mm] w-[16.5mm] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100">
                    {card.fotoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={card.fotoUrl}
                        alt={card.namaLengkap}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                        {getInitials(card.namaLengkap)}
                      </div>
                    )}
                  </div>

                  {/* Student Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-extrabold leading-tight text-slate-900 truncate">
                      {card.namaLengkap}
                    </div>
                    <div className="mt-1 text-[8.5px] font-medium text-slate-600 space-y-0.5">
                      <div>
                        NIS: <span className="font-mono font-bold text-slate-900">{card.nis}</span>
                      </div>
                      <div className="truncate">
                        Asrama: <span className="font-semibold text-slate-800">{card.asrama || '-'}</span>
                        {card.kamar && <> / Kamar {card.kamar}</>}
                      </div>
                    </div>
                  </div>

                  {/* QR Code SVG */}
                  <div className="h-[20mm] w-[20mm] shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
                    <div
                      className="h-full w-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: card.qrSvg }}
                    />
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-1 text-[7px] text-slate-500">
                  <span className="font-medium">Valid for Loket &amp; POS</span>
                  <span className="font-mono font-semibold tracking-wider text-slate-600">
                    TOKEN: ••••{tokenPreview}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
