'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useReactToPrint } from '@/lib/pdf/client'
import type { RekapAsramaPayload } from './actions'

export type RekapOrientation = 'portrait' | 'landscape'

const MM_TO_PX = 96 / 25.4
const PAGE_MARGIN_MM = 8
// Kertas F4 215mm x 330mm
const PAGE_DIMS: Record<RekapOrientation, { w: number; h: number }> = {
  landscape: { w: 330, h: 215 },
  portrait: { w: 215, h: 330 },
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value)
}

function formatCurrency(value: number) {
  return `Rp ${formatNumber(value)}`
}

function safeDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return format(d, 'EEEE, d MMMM yyyy', { locale: idLocale })
}

export default function RekapAsramaDownload({
  payload,
  orientation,
  onDone,
}: {
  payload: RekapAsramaPayload | null
  orientation: RekapOrientation
  onDone: () => void
}) {
  const pageRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [ready, setReady] = useState(false)

  const dims = PAGE_DIMS[orientation]
  const availW = dims.w - PAGE_MARGIN_MM * 2
  const availH = dims.h - PAGE_MARGIN_MM * 2

  const title = payload
    ? `Rekap_Setoran_SPP_${payload.meta.nama_asrama}_${payload.meta.nama_bulan}_${payload.meta.tahun}`
    : 'Rekap_Setoran_SPP'

  const handlePrint = useReactToPrint({
    contentRef: pageRef,
    documentTitle: title,
    onAfterPrint: onDone,
    onPrintError: onDone,
    pageStyle: `
      @page { size: ${dims.w}mm ${dims.h}mm; margin: ${PAGE_MARGIN_MM}mm; }
      @media print {
        html, body {
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  })

  // Ukur tinggi natural (lebar = area cetak), hitung skala agar muat 1 halaman.
  useLayoutEffect(() => {
    if (!payload) { setReady(false); setScale(1); return }
    setReady(false)
    setScale(1)
    const raf = requestAnimationFrame(() => {
      const natH = innerRef.current?.scrollHeight ?? 0
      const availHpx = availH * MM_TO_PX
      const s = natH > 0 ? Math.min(1, availHpx / natH) : 1
      setScale(s)
      setReady(true)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, orientation])

  useEffect(() => {
    if (!payload || !ready) return
    const t = window.setTimeout(() => { void handlePrint() }, 80)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, ready])

  if (!payload) return null

  // Saat menyusut, lebar dasar diperlebar (availW/scale) supaya setelah di-scale
  // konten tetap memenuhi lebar halaman penuh (tidak ada ruang kosong kanan).
  const baseWidth = ready && scale < 1 ? availW / scale : availW

  return (
    <div className="absolute left-[-99999px] top-0">
      <div
        ref={pageRef}
        style={{ width: `${availW}mm`, height: `${availH}mm`, overflow: 'hidden', background: '#fff' }}
      >
        <div
          ref={innerRef}
          style={{
            width: `${baseWidth}mm`,
            transformOrigin: 'top left',
            transform: ready ? `scale(${scale})` : 'none',
          }}
        >
          <RekapAsramaSheet payload={payload} />
        </div>
      </div>
    </div>
  )
}

function buildKamarColumns(rooms: { nomor_kamar: string; jumlah: number }[]) {
  const colCount = rooms.length > 36 ? 3 : rooms.length > 16 ? 2 : 1
  const rowsPerCol = Math.ceil(rooms.length / colCount) || 1
  const rows: (typeof rooms[number] | null)[][] = []
  for (let r = 0; r < rowsPerCol; r++) {
    const row: (typeof rooms[number] | null)[] = []
    for (let c = 0; c < colCount; c++) row.push(rooms[c * rowsPerCol + r] ?? null)
    rows.push(row)
  }
  return { colCount, rows }
}

const RekapAsramaSheet = React.forwardRef<HTMLDivElement, { payload: RekapAsramaPayload }>(
  ({ payload }, ref) => {
    const { meta, penduduk_kamar, digratiskan, penunggak, mutasi, ringkasan } = payload
    const kamar = buildKamarColumns(penduduk_kamar)

    return (
      <div ref={ref} className="rekap-asrama-print bg-white text-black">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .rekap-asrama-print { width: 100%; padding: 0; color: #111827; background: #fff; font-family: "Arial","Helvetica",sans-serif; }
              .rekap-asrama-print * { box-sizing: border-box; }
              .rekap-asrama-print .title { text-align: center; }
              .rekap-asrama-print .title h1 { font-size: 17px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: .04em; }
              .rekap-asrama-print .title .sub { font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
              .rekap-asrama-print .ident { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin: 6px 2px 8px; }
              .rekap-asrama-print .cols { display: grid; grid-template-columns: auto 1.5fr 1.5fr; gap: 8px; align-items: start; }
              .rekap-asrama-print .block-title { font-size: 10px; font-weight: 800; text-transform: uppercase; background: #e2e8f0; border: 1px solid #0f172a; border-bottom: none; padding: 3px 5px; text-align: center; }
              .rekap-asrama-print table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              .rekap-asrama-print th, .rekap-asrama-print td { border: 1px solid #0f172a; padding: 1px 4px; font-size: 9px; vertical-align: middle; line-height: 1.25; }
              .rekap-asrama-print thead th { background: #f1f5f9; font-weight: 700; text-align: center; }
              .rekap-asrama-print td.c { text-align: center; }
              .rekap-asrama-print td.l { text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .rekap-asrama-print .section + .section { margin-top: 8px; }
              .rekap-asrama-print .bottom { display: grid; grid-template-columns: 0.95fr 1.6fr; gap: 14px; margin-top: 10px; align-items: stretch; }
              .rekap-asrama-print .rincian { border: 1px solid #0f172a; align-self: start; }
              .rekap-asrama-print .rincian .rh { background: #e2e8f0; font-weight: 800; text-transform: uppercase; font-size: 10px; text-align: center; padding: 3px; border-bottom: 1px solid #0f172a; }
              .rekap-asrama-print .rincian .rrow { display: flex; justify-content: space-between; gap: 10px; font-size: 10px; padding: 3px 8px; border-bottom: 1px solid #cbd5e1; }
              .rekap-asrama-print .rincian .rrow:last-child { border-bottom: none; }
              .rekap-asrama-print .rincian .rrow span:last-child { font-weight: 700; white-space: nowrap; }
              .rekap-asrama-print .rincian .rtot { background: #fff7ed; }
              .rekap-asrama-print .rincian .rtot span { font-weight: 800; }
              .rekap-asrama-print .ttd { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; text-align: center; padding-top: 2px; }
              .rekap-asrama-print .ttd .role { font-size: 10px; font-weight: 600; }
              .rekap-asrama-print .ttd .gap { height: 46px; }
              .rekap-asrama-print .ttd .nm { border-top: 1px solid #0f172a; padding-top: 2px; font-size: 10px; font-weight: 700; }
              .rekap-asrama-print .note { font-size: 8px; color: #475569; margin-top: 10px; padding: 0 2px; }
            `,
          }}
        />

        <div className="title">
          <h1>Rekap Setoran Keuangan SPP Asrama</h1>
          <div className="sub">
            Lembaga Pendidikan Pondok Pesantren Sukahideng
            {meta.tahun_ajaran_nama ? ` — Tahun Pelajaran ${meta.tahun_ajaran_nama}` : ''}
          </div>
        </div>

        <div className="ident">
          <span>Asrama : {meta.nama_asrama}</span>
          <span>Bulan : {meta.nama_bulan.toUpperCase()} {meta.tahun}</span>
        </div>

        <div className="cols">
          {/* Kolom 1: Jumlah Penduduk per Kamar (multi-kolom agar ringkas) */}
          <div>
            <div className="block-title">Jumlah Penduduk Kamar</div>
            <table>
              <thead>
                <tr>
                  {Array.from({ length: kamar.colCount }).map((_, c) => (
                    <React.Fragment key={c}>
                      <th style={{ width: '26px' }}>Kmr</th>
                      <th style={{ width: '26px' }}>Jml</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kamar.rows.length === 0 ? (
                  <tr><td className="c" colSpan={kamar.colCount * 2}>-</td></tr>
                ) : (
                  kamar.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <React.Fragment key={c}>
                          <td className="c">{cell?.nomor_kamar ?? ''}</td>
                          <td className="c">{cell ? formatNumber(cell.jumlah) : ''}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))
                )}
                <tr>
                  <td className="c" style={{ fontWeight: 800, background: '#dbeafe' }} colSpan={kamar.colCount * 2 - 1}>Total Penduduk</td>
                  <td className="c" style={{ fontWeight: 800, background: '#dbeafe' }}>{formatNumber(ringkasan.jumlah_penduduk)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kolom 2: Digratiskan + Mutasi */}
          <div>
            <div className="section">
              <div className="block-title">Daftar Santri yang Digratiskan</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '22px' }}>No</th>
                    <th>Nama</th>
                    <th style={{ width: '26px' }}>Kmr</th>
                    <th style={{ width: '58px' }}>Ket.</th>
                  </tr>
                </thead>
                <tbody>
                  {digratiskan.length === 0 ? (
                    <tr><td className="c" colSpan={4}>-</td></tr>
                  ) : (
                    digratiskan.map((d, i) => (
                      <tr key={i}>
                        <td className="c">{i + 1}</td>
                        <td className="l">{d.nama}</td>
                        <td className="c">{d.kamar ?? '-'}</td>
                        <td className="c">{d.ket}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="section">
              <div className="block-title">Mutasi Santri</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '22px' }}>No</th>
                    <th>Nama</th>
                    <th style={{ width: '26px' }}>Kmr</th>
                    <th style={{ width: '58px' }}>Ket.</th>
                  </tr>
                </thead>
                <tbody>
                  {mutasi.length === 0 ? (
                    <tr><td className="c" colSpan={4}>-</td></tr>
                  ) : (
                    mutasi.map((m, i) => (
                      <tr key={i}>
                        <td className="c">{i + 1}</td>
                        <td className="l">{m.nama}</td>
                        <td className="c">{m.kamar ?? '-'}</td>
                        <td className="c">{m.ket}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kolom 3: Penunggak */}
          <div>
            <div className="block-title">Daftar Penunggak</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '22px' }}>No</th>
                  <th>Nama</th>
                  <th style={{ width: '26px' }}>Kmr</th>
                  <th style={{ width: '74px' }}>Tunggakan</th>
                </tr>
              </thead>
              <tbody>
                {penunggak.length === 0 ? (
                  <tr><td className="c" colSpan={4}>-</td></tr>
                ) : (
                  penunggak.map((p, i) => (
                    <tr key={i}>
                      <td className="c">{i + 1}</td>
                      <td className="l">{p.nama}</td>
                      <td className="c">{p.kamar ?? '-'}</td>
                      <td className="c" style={{ whiteSpace: 'nowrap' }}>{p.tunggakan_label}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bottom">
          <div className="rincian">
            <div className="rh">Rincian Setor</div>
            <div className="rrow"><span>Jumlah Penduduk</span><span>{formatNumber(ringkasan.jumlah_penduduk)}</span></div>
            <div className="rrow"><span>Jumlah yang Digratiskan</span><span>{formatNumber(ringkasan.jml_gratis)}</span></div>
            <div className="rrow"><span>Jumlah Wajib Bayar</span><span>{formatNumber(ringkasan.jml_wajib_bayar)}</span></div>
            <div className="rrow"><span>Jumlah Penunggak</span><span>{formatNumber(ringkasan.jml_penunggak)}</span></div>
            <div className="rrow"><span>Bayar Tunggakan Bln Lalu</span><span>{formatNumber(ringkasan.bayar_tunggakan_bln_lalu)}</span></div>
            <div className="rrow rtot"><span>{formatNumber(ringkasan.jml_bayar)} × {formatCurrency(ringkasan.tarif)}</span><span>{formatCurrency(ringkasan.total)}</span></div>
            <div className="rrow"><span>Hari / Tanggal Setor</span><span>{safeDate(ringkasan.tanggal_stor)}</span></div>
          </div>

          <div className="ttd">
            <div className="slot">
              <div className="role">Rois / Roisah</div>
              <div className="gap"></div>
              <div className="nm">.................................</div>
            </div>
            <div className="slot">
              <div className="role">Bendahara Dewan Santri</div>
              <div className="gap"></div>
              <div className="nm">.................................</div>
            </div>
            <div className="slot">
              <div className="role">Bendahara Asrama</div>
              <div className="gap"></div>
              <div className="nm">{ringkasan.nama_penyetor || '.................................'}</div>
            </div>
          </div>
        </div>

        <div className="note">
          *Rincian Setor = (Jumlah Santri yang Bayar Bulan ini + Jumlah Santri yang Bayar Tunggakan Bulan lalu) × {formatCurrency(ringkasan.tarif)} = Total Setoran
        </div>
      </div>
    )
  }
)

RekapAsramaSheet.displayName = 'RekapAsramaSheet'
