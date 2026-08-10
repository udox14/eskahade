'use client'

import type { CSSProperties } from 'react'
import {
  formatDorm,
  formatSchool,
  paddedStudentRows,
  teacherDisplayName,
} from './_document-model'
import type { AdministrasiPage } from './types'

const MONTHS_ODD = ['AGU', 'SEP', 'OKT', 'NOV', 'DES', 'JML']
const MONTHS_EVEN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JML']
const SCORE_LABELS = ['UH', 'AKH', 'UTS', 'RERATA']

function ClassMeta({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  return (
    <div className="adm-form-meta">
      <span>KELAS: <b>{page.kelas.nama_kelas}</b></span>
      <span>MARHALAH: <b>{page.kelas.marhalah_nama || '-'}</b></span>
      {page.chunkCount > 1 ? <span>LANJUTAN {page.chunkIndex + 1}/{page.chunkCount}</span> : null}
    </div>
  )
}

function FormTitle({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  const year = page.bundle.tahunAjaran.nama
  if (page.kind === 'hafalan') {
    return (
      <div className="adm-form-heading adm-form-heading-plain">
        <span>CATATAN HAFALAN ______________________________</span>
        <ClassMeta page={page} />
      </div>
    )
  }
  const title = page.kind === 'absensi'
    ? `REKAP ABSENSI PENGAJIAN TAHUN ${year}`
    : `PENILAIAN KEGIATAN BELAJAR TAHUN ${year}`
  return (
    <div className="adm-form-heading">
      <div className="adm-title-band">{title}</div>
      <ClassMeta page={page} />
    </div>
  )
}

function IdentityCols() {
  return (
    <>
      <col style={{ width: '7mm' }} />
      <col style={{ width: '54mm' }} />
      <col style={{ width: '22mm' }} />
      <col style={{ width: '24mm' }} />
    </>
  )
}

function IdentityHeaders({ rows = 3 }: { rows?: number }) {
  return (
    <>
      <th rowSpan={rows}>NO</th>
      <th rowSpan={rows} className="adm-name-header">N A M A</th>
      <th rowSpan={rows}>ASRAMA /<br />KAMAR</th>
      <th rowSpan={rows}>SEKOLAH /<br />KELAS</th>
    </>
  )
}

function StudentCells({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  return paddedStudentRows(page).map(({ student, number }, slot) => {
    const nameIsLong = (student?.nama_lengkap.length ?? 0) > 42
    const dormIsLong = formatDorm(student).length > 27
    const schoolIsLong = formatSchool(student).length > 27

    return <tr key={student?.id || `blank-${slot}`}>
      <td className="adm-center">{number ?? ''}</td>
      <td className={`adm-student-name${nameIsLong ? ' adm-extra-compact' : ''}`}>{student?.nama_lengkap || ''}</td>
      <td className={`adm-center adm-identity-small${dormIsLong ? ' adm-extra-compact' : ''}`}>{formatDorm(student)}</td>
      <td className={`adm-center adm-identity-small${schoolIsLong ? ' adm-extra-compact' : ''}`}>{formatSchool(student)}</td>
      {page.kind === 'absensi'
        ? Array.from({ length: 26 }, (_, index) => <td key={index} />)
        : page.kind === 'hafalan'
          ? Array.from({ length: 34 }, (_, index) => <td key={index} />)
          : Array.from({ length: 32 }, (_, index) => <td key={index} />)}
    </tr>
  })
}

function AbsensiTable({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  return (
    <table className="adm-table adm-form-table">
      <colgroup>
        <IdentityCols />
        {Array.from({ length: 26 }, (_, index) => <col key={index} />)}
      </colgroup>
      <thead>
        <tr>
          <IdentityHeaders rows={3} />
          <th colSpan={12}>GANJIL</th>
          <th colSpan={14}>GENAP</th>
        </tr>
        <tr>
          {MONTHS_ODD.map(month => <th key={`odd-${month}`} colSpan={2}>{month}</th>)}
          {MONTHS_EVEN.map(month => <th key={`even-${month}`} colSpan={2}>{month}</th>)}
        </tr>
        <tr>
          {Array.from({ length: 13 }, (_, index) => (
            <th key={`sa-${index}`} colSpan={2} className="adm-pair-cell"><span>S</span><span>A</span></th>
          ))}
        </tr>
      </thead>
      <tbody><StudentCells page={page} /></tbody>
    </table>
  )
}

function HafalanTable({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  return (
    <table className="adm-table adm-form-table">
      <colgroup>
        <IdentityCols />
        {Array.from({ length: 34 }, (_, index) => <col key={index} />)}
      </colgroup>
      <thead>
        <tr>
          <IdentityHeaders rows={2} />
          <th colSpan={34}>HAFALAN ............................................................</th>
        </tr>
        <tr>{Array.from({ length: 34 }, (_, index) => <th key={index}>&nbsp;</th>)}</tr>
      </thead>
      <tbody><StudentCells page={page} /></tbody>
    </table>
  )
}

function NilaiTable({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  return (
    <table className="adm-table adm-form-table">
      <colgroup>
        <IdentityCols />
        {Array.from({ length: 32 }, (_, index) => <col key={index} />)}
      </colgroup>
      <thead>
        <tr>
          <IdentityHeaders rows={3} />
          <th colSpan={32}>MATA PELAJARAN</th>
        </tr>
        <tr>{Array.from({ length: 8 }, (_, index) => <th key={index} colSpan={4}>&nbsp;</th>)}</tr>
        <tr>
          {Array.from({ length: 8 }, (_, group) => SCORE_LABELS.map(label => (
            <th key={`${group}-${label}`} className="adm-score-label">{label}</th>
          )))}
        </tr>
      </thead>
      <tbody><StudentCells page={page} /></tbody>
    </table>
  )
}

function CoverPage({ page }: { page: Extract<AdministrasiPage, { type: 'cover' }> }) {
  return (
    <section className="administrasi-page adm-cover-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Logo Pondok Pesantren Sukahideng" className="adm-cover-logo" />
      <div className="adm-cover-kicker">PONDOK PESANTREN SUKAHIDENG</div>
      <h2>ADMINISTRASI PENGAJAR</h2>
      <div className="adm-cover-rule" />
      <div className="adm-cover-year">TAHUN AJARAN {page.bundle.tahunAjaran.nama}</div>
      <div className="adm-cover-card">
        <div><span>NAMA GURU</span><b>{teacherDisplayName(page.bundle)}</b></div>
        <div><span>KELAS YANG DIAJAR</span><b>{page.bundle.kelas.map(kelas => kelas.nama_kelas).join(', ')}</b></div>
      </div>
    </section>
  )
}

function SeparatorPage({ page }: { page: Extract<AdministrasiPage, { type: 'separator' }> }) {
  return (
    <section className="administrasi-page adm-separator-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="adm-separator-logo" />
      <div className="adm-separator-label">ADMINISTRASI KELAS</div>
      <h2>{page.kelas.nama_kelas}</h2>
      <div className="adm-separator-rule" />
      <p>{page.kelas.marhalah_nama || 'MARHALAH BELUM DIISI'}</p>
      <div className="adm-separator-footer">
        <span>{teacherDisplayName(page.bundle)}</span>
        <span>TAHUN AJARAN {page.bundle.tahunAjaran.nama}</span>
      </div>
    </section>
  )
}

function FormPage({ page }: { page: Extract<AdministrasiPage, { type: 'form' }> }) {
  return (
    <section className="administrasi-page adm-form-page">
      <FormTitle page={page} />
      {page.kind === 'absensi' ? <AbsensiTable page={page} /> : null}
      {page.kind === 'hafalan' ? <HafalanTable page={page} /> : null}
      {page.kind === 'nilai' ? <NilaiTable page={page} /> : null}
    </section>
  )
}

export function AdministrasiPrintDocument({ pages, style }: { pages: AdministrasiPage[]; style?: CSSProperties }) {
  return (
    <div className="administrasi-document" style={style}>
      {pages.map((page, index) => {
        if (page.type === 'cover') return <CoverPage key={`cover-${index}`} page={page} />
        if (page.type === 'separator') return <SeparatorPage key={`separator-${page.kelas.id}-${index}`} page={page} />
        return <FormPage key={`${page.kelas.id}-${page.kind}-${page.copyIndex}-${page.chunkIndex}-${index}`} page={page} />
      })}
    </div>
  )
}

export const ADMINISTRASI_PRINT_CSS = `
  @page { size: 330mm 215mm; margin: 0; }
  .administrasi-document, .administrasi-document * { box-sizing: border-box; font-family: "Arial Narrow", Arial, sans-serif !important; }
  .administrasi-document { color: #000; background: #e2e8f0; }
  .administrasi-page { position: relative; width: 330mm; height: 215mm; overflow: hidden; padding: 7mm 7mm 7mm 15mm; background: #fff; break-after: page; page-break-after: always; }
  .administrasi-page:last-child { break-after: auto; page-break-after: auto; }
  .adm-cover-page, .adm-separator-page { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .adm-cover-logo { width: 31mm; height: 31mm; object-fit: contain; margin-bottom: 5mm; }
  .adm-cover-kicker { font-size: 13pt; font-weight: 700; letter-spacing: 1.6pt; }
  .adm-cover-page h2 { margin: 2mm 0 0; font-size: 31pt; line-height: 1; font-weight: 900; letter-spacing: 1.4pt; }
  .adm-cover-rule { width: 180mm; border-top: 1.2mm solid #000; margin: 5mm 0 4mm; }
  .adm-cover-year { font-size: 16pt; font-weight: 700; }
  .adm-cover-card { width: 205mm; margin-top: 12mm; border: .6mm solid #000; padding: 7mm 10mm; text-align: left; }
  .adm-cover-card > div { display: grid; grid-template-columns: 42mm 1fr; gap: 6mm; padding: 2mm 0; font-size: 13pt; }
  .adm-cover-card span { font-weight: 700; }
  .adm-cover-card b { font-size: 15pt; }
  .adm-separator-logo { width: 22mm; height: 22mm; object-fit: contain; margin-bottom: 6mm; }
  .adm-separator-label { font-size: 13pt; font-weight: 700; letter-spacing: 2pt; }
  .adm-separator-page h2 { margin: 3mm 0; font-size: 39pt; line-height: 1; font-weight: 900; text-transform: uppercase; }
  .adm-separator-rule { width: 145mm; border-top: 1mm solid #000; margin: 3mm 0; }
  .adm-separator-page p { margin: 2mm 0; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .adm-separator-footer { position: absolute; bottom: 13mm; left: 15mm; right: 7mm; display: flex; justify-content: space-between; border-top: .35mm solid #000; padding-top: 3mm; font-size: 10pt; font-weight: 700; text-transform: uppercase; }
  .adm-form-page { display: flex; flex-direction: column; }
  .adm-form-heading { display: grid; grid-template-columns: minmax(115mm, 1fr) auto; align-items: stretch; min-height: 9mm; margin-bottom: 1.4mm; }
  .adm-title-band { display: flex; align-items: center; padding: 1mm 3mm; background: #000; color: #fff; font-size: 12pt; font-weight: 900; }
  .adm-form-heading-plain { border-bottom: .55mm solid #000; font-size: 12pt; font-weight: 900; }
  .adm-form-heading-plain > span { display: flex; align-items: center; padding-left: 1mm; }
  .adm-form-meta { display: flex; align-items: center; gap: 6mm; padding: 0 2mm 0 5mm; font-size: 9pt; white-space: nowrap; }
  .adm-table { width: 100%; border-collapse: collapse; table-layout: fixed; color: #000; }
  .adm-table th, .adm-table td { border: .24mm solid #000; padding: 0 .45mm; vertical-align: middle; line-height: 1; }
  .adm-table thead th { height: 4.4mm; background: #f2f2f2; text-align: center; font-size: 7pt; font-weight: 900; }
  .adm-table thead tr:first-child th { border-top-width: .55mm; }
  .adm-table thead th:first-child, .adm-table tbody td:first-child { border-left-width: .55mm; }
  .adm-table thead th:last-child, .adm-table tbody td:last-child { border-right-width: .55mm; }
  .adm-table tbody tr:last-child td { border-bottom-width: .55mm; }
  .adm-table tbody tr { height: 3.45mm; }
  .adm-table tbody td { height: 3.45mm; max-height: 3.45mm; font-size: 6.1pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adm-center { text-align: center; }
  .adm-student-name { padding-left: 1.1mm !important; font-size: 6.7pt !important; }
  .adm-identity-small { font-size: 5.6pt !important; }
  .adm-student-name.adm-extra-compact { font-size: 5.2pt !important; letter-spacing: -.08pt; }
  .adm-identity-small.adm-extra-compact { font-size: 4.7pt !important; letter-spacing: -.08pt; }
  .adm-name-header { letter-spacing: 2.5pt; }
  .adm-pair-cell { padding: 0 !important; }
  .adm-pair-cell > span { display: inline-flex; width: 50%; height: 100%; align-items: center; justify-content: center; }
  .adm-pair-cell > span + span { border-left: .24mm solid #000; }
  .adm-score-label { padding: 0 !important; font-size: 5.7pt !important; overflow-wrap: anywhere; }
  @media screen {
    .administrasi-page { margin: 0 auto 8mm; box-shadow: 0 8px 30px rgba(15,23,42,.18); }
  }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    .administrasi-document { background: #fff !important; }
    .administrasi-page { margin: 0 !important; box-shadow: none !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`
