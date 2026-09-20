// components/print/print-document-shell.tsx
// Shell dokumen cetak terpadu: membungkus kop surat, judul, parameter filter, tabel/konten,
// tanda tangan resmi, dan footer halaman.
// Reusable untuk seluruh modul keuangan, kuitansi, dan surat pesantren di masa depan.

'use client'

import React, { forwardRef } from 'react'
import DocumentLetterhead from './document-letterhead'
import type { LetterheadProfile, LetterheadMode } from '@/lib/print/letterhead'

export interface PrintDocumentShellProps {
  letterheadProfile?: LetterheadProfile | null
  letterheadMode?: LetterheadMode
  title: string
  subtitle?: string
  filterSummary?: string
  referenceNumber?: string
  printTimestamp?: string
  orientation?: 'portrait' | 'landscape'
  showSignatureBlock?: boolean
  signatoryTitleLeft?: string
  signatoryNameLeft?: string
  signatoryTitleRight?: string
  signatoryNameRight?: string
  signatoryLocation?: string
  footerNote?: string
  children: React.ReactNode
  className?: string
}

export const PrintDocumentShell = forwardRef<HTMLDivElement, PrintDocumentShellProps>(
  function PrintDocumentShell(
    {
      letterheadProfile,
      letterheadMode = 'default',
      title,
      subtitle,
      filterSummary,
      referenceNumber,
      printTimestamp,
      orientation = 'portrait',
      showSignatureBlock = false,
      signatoryTitleLeft = 'Mengetahui,\nBendahara Pesantren',
      signatoryNameLeft = '( Ust. Bendahara, M.Pd. )',
      signatoryTitleRight = 'Petugas Pembuat Laporan',
      signatoryNameRight = '( Petugas Administrasi )',
      signatoryLocation = 'Tasikmalaya',
      footerNote,
      children,
      className = '',
    },
    ref
  ) {
    const formattedTimestamp =
      printTimestamp ||
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'

    return (
      <div
        ref={ref}
        className={`bg-white p-8 rounded-sm shadow-md text-slate-900 font-sans print:shadow-none print:p-0 w-full ${
          orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
        } ${className}`}
        style={{ minHeight: '297mm' }}
      >
        {/* 1. Kop Dokumen Resmi (Reusable across modules) */}
        <DocumentLetterhead
          profile={letterheadProfile}
          mode={letterheadMode}
        />

        {/* 2. Judul Dokumen & Metadata */}
        <div className="mb-5 text-center">
          <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 underline underline-offset-4 font-serif sm:font-sans">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-600 mt-1">{subtitle}</p>}

          {(filterSummary || referenceNumber || formattedTimestamp) && (
            <div className="inline-flex flex-wrap items-center justify-center gap-3 mt-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 print:border-slate-300">
              {referenceNumber && (
                <span>
                  <strong>No. Bukti:</strong> <span className="font-mono">{referenceNumber}</span>
                </span>
              )}
              {referenceNumber && filterSummary && <span>•</span>}
              {filterSummary && (
                <span>
                  <strong>Parameter:</strong> {filterSummary}
                </span>
              )}
              {filterSummary && formattedTimestamp && <span>•</span>}
              {formattedTimestamp && (
                <span>
                  <strong>Waktu Cetak:</strong> {formattedTimestamp}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. Konten Utama Dokumen (Tabel / Rincian / Slip) */}
        <div className="w-full">{children}</div>

        {/* 4. Blok Pengesahan Tanda Tangan Resmi (Opsional) */}
        {showSignatureBlock && (
          <div className="mt-10 pt-4 grid grid-cols-2 text-center text-xs break-inside-avoid">
            <div className="space-y-1">
              {signatoryTitleLeft.split('\n').map((line, i) => (
                <p key={i} className={i === 0 ? 'text-slate-600' : 'font-bold text-slate-900'}>
                  {line}
                </p>
              ))}
              <div className="h-16" />
              <p className="font-semibold text-slate-900 underline underline-offset-2">
                {signatoryNameLeft}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-slate-600">
                {signatoryLocation}, {formattedTimestamp.slice(0, 15).trim()}
              </p>
              {signatoryTitleRight.split('\n').map((line, i) => (
                <p key={i} className="font-bold text-slate-900">
                  {line}
                </p>
              ))}
              <div className="h-16" />
              <p className="font-semibold text-slate-900 underline underline-offset-2">
                {signatoryNameRight}
              </p>
            </div>
          </div>
        )}

        {/* 5. Footer Cetak Halaman */}
        <div className="mt-8 pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400 flex justify-between items-center print:border-slate-400">
          <span>{footerNote || 'Sistem Informasi Pondok Pesantren Sukahideng'}</span>
          <span>{formattedTimestamp ? `Waktu Cetak: ${formattedTimestamp}` : ''}</span>
        </div>
      </div>
    )
  }
)

export default PrintDocumentShell
