// components/print/document-letterhead.tsx
// Komponen shared Kop Surat (Letterhead) untuk seluruh cetakan laporan, kuitansi, dan surat pesantren
// Desain: clean, profesional, printer-friendly (hitam/abu-abu netral), hemat tinta, dan ramah fotokopi.

'use client'

import React from 'react'
import {
  DEFAULT_LETTERHEAD_PROFILES,
  type LetterheadProfile,
  type LetterheadMode,
} from '@/lib/print/letterhead'

interface DocumentLetterheadProps {
  profile?: LetterheadProfile | null
  mode?: LetterheadMode
  className?: string
  overrideTitle?: string
}

export default function DocumentLetterhead({
  profile,
  mode = 'default',
  className = '',
  overrideTitle,
}: DocumentLetterheadProps) {
  // Bila mode disetel 'none', jangan render kop surat
  if (mode === 'none') {
    return null
  }

  const activeProfile = profile || DEFAULT_LETTERHEAD_PROFILES[0]
  if (!activeProfile) {
    return null
  }

  const institutionName = overrideTitle || activeProfile.institutionName || 'Pondok Pesantren Sukahideng'
  const isCenter = activeProfile.logoPosition === 'center'
  const showDivider = activeProfile.showDivider !== false

  return (
    <div
      className={`w-full pb-3 mb-5 select-none print:select-auto font-sans ${className} ${
        showDivider ? 'border-b-2 border-slate-900' : ''
      }`}
    >
      <div
        className={`flex ${
          isCenter ? 'flex-col items-center text-center' : 'items-center gap-4 text-center'
        }`}
      >
        {/* Logo Lembaga (hanya jika tersedia di konfigurasi) */}
        {activeProfile.logoUrl && (
          <div
            className={`shrink-0 ${
              isCenter ? 'mb-2' : 'w-16 h-16 flex items-center justify-center'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeProfile.logoUrl}
              alt={institutionName}
              className="max-h-16 max-w-16 object-contain filter grayscale contrast-125"
            />
          </div>
        )}

        {/* Identitas Teks Lembaga */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-wider text-slate-950 uppercase leading-tight font-serif sm:font-sans">
            {institutionName}
          </h1>

          {activeProfile.subheading && (
            <p className="text-xs font-semibold tracking-wide text-slate-800 uppercase mt-0.5">
              {activeProfile.subheading}
            </p>
          )}

          {activeProfile.address && (
            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
              {activeProfile.address}
            </p>
          )}

          {(activeProfile.contactLine || activeProfile.nspp) && (
            <p className="text-[10px] text-slate-500 mt-0.5 tracking-tight">
              {[activeProfile.nspp ? `NSPP: ${activeProfile.nspp}` : null, activeProfile.contactLine]
                .filter(Boolean)
                .join(' • ')}
            </p>
          )}
        </div>

        {/* Balancing spacer if logo on left and text centered */}
        {!isCenter && activeProfile.logoUrl && <div className="w-16 shrink-0 hidden sm:block" />}
      </div>
    </div>
  )
}
