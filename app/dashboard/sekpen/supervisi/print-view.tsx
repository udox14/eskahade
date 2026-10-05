'use client'

import React, { forwardRef } from 'react'
import DocumentLetterhead from '@/components/print/document-letterhead'
import type { LetterheadProfile, LetterheadMode } from '@/lib/print/letterhead'
import type { Interview } from '@/lib/supervisi/types'
import { contextTime, contextBooks } from '@/lib/supervisi/context'
import { SECTIONS, SCALE, summarize } from '@/lib/supervisi/instrument'

export const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 12mm 14mm 14mm 14mm;
}

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    color: #0f172a !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
  }
  .supervisi-print {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .print-page-break {
    page-break-before: always;
    break-before: page;
  }
  .print-avoid-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}

.supervisi-print {
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 9pt;
  line-height: 1.45;
  background: white;
}

.supervisi-print h1 {
  font-size: 13pt;
  font-weight: 700;
  text-align: center;
  margin: 8pt 0 2pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.supervisi-print .doc-subtitle {
  text-align: center;
  font-size: 8.5pt;
  color: #475569;
  margin-bottom: 10pt;
}

.supervisi-print .draft-badge {
  text-align: center;
  font-size: 8pt;
  font-weight: 700;
  color: #b45309;
  background-color: #fef3c7;
  border: 1px solid #fde68a;
  padding: 2pt 8pt;
  display: inline-block;
  border-radius: 3pt;
  margin: 0 auto 8pt;
  letter-spacing: 1px;
}

.supervisi-print .meta-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12pt;
  font-size: 8.5pt;
}

.supervisi-print .meta-table td {
  padding: 3pt 6pt;
  vertical-align: top;
  border: 1px solid #e2e8f0;
}

.supervisi-print .meta-table .meta-label {
  width: 22%;
  font-weight: 600;
  background-color: #f8fafc;
  color: #334155;
}

.supervisi-print .meta-table .meta-val {
  width: 28%;
  color: #0f172a;
}

.supervisi-print .section-title {
  font-size: 9.5pt;
  font-weight: 700;
  color: #0f172a;
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 4pt 7pt;
  margin-top: 10pt;
  margin-bottom: 4pt;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  break-after: avoid;
}

.supervisi-print .data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10pt;
  font-size: 8.5pt;
}

.supervisi-print .data-table th {
  background-color: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 4pt 6pt;
  font-weight: 700;
  text-align: left;
  color: #334155;
  font-size: 8pt;
}

.supervisi-print .data-table td {
  border: 1px solid #e2e8f0;
  padding: 4pt 6pt;
  vertical-align: top;
}

.supervisi-print .text-question-card {
  border: 1px solid #e2e8f0;
  border-left: 3px solid #64748b;
  padding: 5pt 7pt;
  margin-bottom: 6pt;
  background-color: #fafaf9;
  break-inside: avoid;
}

.supervisi-print .text-question-label {
  font-weight: 600;
  font-size: 8.5pt;
  color: #334155;
  margin-bottom: 2pt;
}

.supervisi-print .text-question-body {
  font-size: 8.5pt;
  color: #0f172a;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.supervisi-print .signature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20pt;
  margin-top: 18pt;
  text-align: center;
  font-size: 8.5pt;
  break-inside: avoid;
}

.supervisi-print .scale-guide {
  font-size: 7.5pt;
  color: #64748b;
  border: 1px dashed #cbd5e1;
  padding: 4pt 8pt;
  margin-bottom: 10pt;
  border-radius: 2pt;
  background-color: #fcfcfc;
}
`

function getPredicate(avg: number | null): { label: string; textClass: string } {
  if (avg === null) return { label: '-', textClass: 'text-slate-400' }
  if (avg >= 3.5) return { label: 'Sangat Baik', textClass: 'text-emerald-700 font-bold' }
  if (avg >= 3.0) return { label: 'Baik', textClass: 'text-slate-800 font-semibold' }
  if (avg >= 2.0) return { label: 'Cukup', textClass: 'text-amber-700 font-semibold' }
  return { label: 'Perlu Pembinaan', textClass: 'text-rose-700 font-bold' }
}

export default forwardRef<
  HTMLDivElement,
  {
    interview: Interview
    profile: LetterheadProfile | null
    mode: LetterheadMode
  }
>(function PrintView({ interview: i, profile, mode }, ref) {
  // Hitung ringkasan rata-rata skor seksi 1-8
  const sectionSummary = summarize([i.answers])
  const scoredSections = sectionSummary.filter((s) => s.rated > 0)
  const totalRated = scoredSections.reduce((acc, s) => acc + s.rated, 0)
  const totalScore = scoredSections.reduce(
    (acc, s) => acc + s.indicators.reduce((sum, ind) => sum + ind.sum, 0),
    0
  )
  const grandAverage = totalRated > 0 ? totalScore / totalRated : null
  const grandPredicate = getPredicate(grandAverage)

  return (
    <div ref={ref} className="supervisi-print w-full bg-white text-slate-900">
      <style>{PRINT_CSS}</style>

      {/* ── 1. KOP SURAT RESMI ── */}
      <DocumentLetterhead profile={profile} mode={mode} />

      {/* ── 2. JUDUL DOKUMEN LAPORAN ── */}
      <div className="text-center">
        <h1>Laporan Hasil Supervisi Pengajaran Santri</h1>
        <p className="doc-subtitle">
          Instrumen Evaluasi Mutu Pembelajaran dan Pembinaan Pengajar Pondok Pesantren
        </p>
        {i.status === 'draft' && (
          <div className="text-center">
            <span className="draft-badge">DRAFT WAWANCARA — BELUM DIKUNCI</span>
          </div>
        )}
      </div>

      {/* ── 3. TABEL IDENTITAS SUPERVISI ── */}
      <table className="meta-table">
        <tbody>
          <tr>
            <td className="meta-label">Nama Pengajar</td>
            <td className="meta-val font-bold">{i.identity.guru_nama}</td>
            <td className="meta-label">Kelas Diniyah</td>
            <td className="meta-val font-semibold">{i.identity.kelas_nama}</td>
          </tr>
          <tr>
            <td className="meta-label">Kitab / Pelajaran</td>
            <td className="meta-val">{contextBooks(i.identity)}</td>
            <td className="meta-label">Waktu Pengajian</td>
            <td className="meta-val">{contextTime(i.identity)}</td>
          </tr>
          <tr>
            <td className="meta-label">Kegiatan Supervisi</td>
            <td className="meta-val">{i.identity.kegiatan_nama}</td>
            <td className="meta-label">Tahun Ajaran</td>
            <td className="meta-val">{i.identity.tahun_nama}</td>
          </tr>
          <tr>
            <td className="meta-label">Petugas Pewawancara</td>
            <td className="meta-val font-semibold">{i.identity.pewawancara}</td>
            <td className="meta-label">Tanggal Pelaksanaan</td>
            <td className="meta-val">
              {i.tanggal
                ? new Date(i.tanggal).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 4. REKAPITULASI HASIL PENILAIAN (RINGKASAN EKSEKUTIF) ── */}
      <div className="print-avoid-break mb-3">
        <div className="section-title">Rekapitulasi Skor Penilaian Pengajaran</div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '5%', textAlign: 'center' }}>No</th>
              <th style={{ width: '45%' }}>Aspek / Bagian Supervisi</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Butir Dinilai</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Rata-rata Skor</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Kategori / Predikat</th>
            </tr>
          </thead>
          <tbody>
            {sectionSummary.map((sec, idx) => {
              const pred = getPredicate(sec.average)
              return (
                <tr key={sec.title}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td className="font-medium">{sec.title}</td>
                  <td style={{ textAlign: 'center' }}>{sec.rated} butir</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {sec.average !== null ? sec.average.toFixed(2) : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }} className={pred.textClass}>
                    {pred.label}
                  </td>
                </tr>
              )
            })}
            {/* Baris Total / Skor Akhir */}
            <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: '10pt' }}>
                SKOR RATA-RATA KOMPREHENSIF (SKALA 1 — 4):
              </td>
              <td style={{ textAlign: 'center' }}>{totalRated} butir</td>
              <td style={{ textAlign: 'center', fontSize: '9.5pt', color: '#0f172a' }}>
                {grandAverage !== null ? grandAverage.toFixed(2) : '-'}
              </td>
              <td style={{ textAlign: 'center' }} className={grandPredicate.textClass}>
                {grandPredicate.label}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Panduan Skala */}
        <div className="scale-guide">
          <strong>Keterangan Skala:</strong> 1 = {SCALE[0]} | 2 = {SCALE[1]} | 3 = {SCALE[2]} | 4 ={' '}
          {SCALE[3]}. Item &ldquo;Tidak diketahui&rdquo; tidak dihitung ke dalam pembagi rata-rata.
        </div>
      </div>

      {/* ── 5. RINCIAN BUTIR EVALUASI PER SEKSI (SEKSI 1 — 8) ── */}
      {SECTIONS.slice(0, 8).map((sec, sIdx) => {
        const scoreItems = sec.items.filter((it) => it.kind === 'score')
        const textItems = sec.items.filter((it) => it.kind === 'text')

        return (
          <div key={sec.title} className="print-avoid-break mb-3">
            <div className="section-title">
              Bagian {sIdx + 1}. {sec.title}
            </div>

            {/* Tabel Butir Skala */}
            {scoreItems.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '6%', textAlign: 'center' }}>No</th>
                    <th style={{ width: '64%' }}>Indikator Pengajaran</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Skor</th>
                    <th style={{ width: '20%' }}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreItems.map((item, itIdx) => {
                    const ans = i.answers[item.id]
                    return (
                      <tr key={item.id}>
                        <td style={{ textAlign: 'center' }}>{itIdx + 1}</td>
                        <td>{item.label}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {ans?.unknown ? (
                            <span style={{ color: '#64748b', fontSize: '7.5pt' }}>N/A</span>
                          ) : ans?.score ? (
                            ans.score
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={{ fontSize: '8pt', color: '#475569' }}>
                          {ans?.unknown ? (
                            <span>
                              Tidak diketahui
                              {ans.note ? `: ${ans.note}` : ''}
                            </span>
                          ) : ans?.score ? (
                            SCALE[ans.score - 1]
                          ) : (
                            <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                              Belum diisi
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Butir Uraian / Teks Tambahan Seksi */}
            {textItems.length > 0 && (
              <div className="space-y-1 mt-1 mb-2">
                {textItems.map((it) => {
                  const ans = i.answers[it.id]
                  return (
                    <div key={it.id} className="text-question-card">
                      <div className="text-question-label">{it.label}</div>
                      <div className="text-question-body">
                        {ans?.text ? (
                          ans.text
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                            (Tidak ada catatan uraian)
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* ── 6. SEKSI REFLEKTIF & CATATAN PEWAWANCARA (SEKSI 9 & 10) ── */}
      {SECTIONS.slice(8).map((sec) => (
        <div key={sec.title} className="print-avoid-break mb-3">
          <div className="section-title">{sec.title}</div>
          <div className="space-y-1.5">
            {sec.items.map((it) => {
              const ans = i.answers[it.id]
              return (
                <div key={it.id} className="text-question-card">
                  <div className="text-question-label">{it.label}</div>
                  <div className="text-question-body">
                    {ans?.text ? (
                      ans.text
                    ) : (
                      <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                        (Belum ada uraian jawaban)
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── 7. LEMBAR PENGESAHAN & TANDA TANGAN RESMI ── */}
      <div className="signature-grid">
        <div>
          <p style={{ color: '#475569' }}>Mengetahui,</p>
          <p style={{ fontWeight: 'bold', color: '#0f172a' }}>
            Kepala Seksi Pendidikan / Koordinator
          </p>
          <div style={{ height: '45pt' }} />
          <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
            ( .................................................... )
          </p>
          <p style={{ fontSize: '7.5pt', color: '#64748b' }}>Pondok Pesantren Sukahideng</p>
        </div>

        <div>
          <p style={{ color: '#475569' }}>
            Tasikmalaya,{' '}
            {i.tanggal
              ? new Date(i.tanggal).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : new Date().toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
          </p>
          <p style={{ fontWeight: 'bold', color: '#0f172a' }}>Petugas Pewawancara</p>
          <div style={{ height: '45pt' }} />
          <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
            ( {i.identity.pewawancara || '....................................................'} )
          </p>
          <p style={{ fontSize: '7.5pt', color: '#64748b' }}>Petugas Pelaksana Supervisi</p>
        </div>
      </div>

      {/* ── 8. FOOTER KERAHASIAAN DOKUMEN ── */}
      <div
        style={{
          marginTop: '16pt',
          paddingTop: '6pt',
          borderTop: '1px dashed #cbd5e1',
          fontSize: '7.5pt',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          * Identitas santri dirahasiakan. Laporan ini sah dan dipergunakan internal untuk pembinaan
          mutu pengajaran.
        </span>
        <span>Dokumen Sistem Supervisi Sekpen</span>
      </div>
    </div>
  )
})
