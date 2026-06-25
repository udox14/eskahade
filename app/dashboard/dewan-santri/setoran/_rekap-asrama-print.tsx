'use client'

import React, { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useReactToPrint } from '@/lib/pdf/client'
import type { RekapAsramaPayload } from './actions'

export type RekapOrientation = 'portrait' | 'landscape'

const PAGE_MARGIN_MM = 10
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

// Bagi daftar kamar jadi 2 grup (Kmr|Jml)(Kmr|Jml) berdampingan, supaya ringkas.
function buildKamarRows(rooms: { nomor_kamar: string; jumlah: number }[]) {
  const colCount = 2
  const rowsPerCol = Math.ceil(rooms.length / colCount) || 0
  const rows: (typeof rooms[number] | null)[][] = []
  for (let r = 0; r < rowsPerCol; r++) {
    const row: (typeof rooms[number] | null)[] = []
    for (let c = 0; c < colCount; c++) row.push(rooms[c * rowsPerCol + r] ?? null)
    rows.push(row)
  }
  return rows
}

type MiddleEntry =
  | { type: 'data'; no: number; nama: string; kamar: string | null; ket: string }
  | { type: 'section' }
  | { type: 'subheader' }

function buildMiddleStream(
  digratiskan: RekapAsramaPayload['digratiskan'],
  mutasi: RekapAsramaPayload['mutasi']
): MiddleEntry[] {
  const stream: MiddleEntry[] = []
  digratiskan.forEach((d, i) => stream.push({ type: 'data', no: i + 1, nama: d.nama, kamar: d.kamar, ket: d.ket }))
  stream.push({ type: 'section' })
  stream.push({ type: 'subheader' })
  mutasi.forEach((m, i) => stream.push({ type: 'data', no: i + 1, nama: m.nama, kamar: m.kamar, ket: m.ket }))
  return stream
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
  const ref = useRef<HTMLDivElement>(null)
  const dims = PAGE_DIMS[orientation]

  const title = payload
    ? `Rekap_Setoran_SPP_${payload.meta.nama_asrama}_${payload.meta.nama_bulan}_${payload.meta.tahun}`
    : 'Rekap_Setoran_SPP'

  const handlePrint = useReactToPrint({
    contentRef: ref,
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

  useEffect(() => {
    if (!payload) return
    const t = window.setTimeout(() => { void handlePrint() }, 80)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  if (!payload) return null

  return (
    <div className="absolute left-[-99999px] top-0">
      <RekapAsramaSheet ref={ref} payload={payload} />
    </div>
  )
}

const RekapAsramaSheet = React.forwardRef<HTMLDivElement, { payload: RekapAsramaPayload }>(
  ({ payload }, ref) => {
    const { meta, penduduk_kamar, digratiskan, penunggak, mutasi, ringkasan } = payload

    const kamarRows = buildKamarRows(penduduk_kamar)
    const middle = buildMiddleStream(digratiskan, mutasi)
    const bodyLen = Math.max(kamarRows.length, middle.length, penunggak.length, 1)

    return (
      <div ref={ref} className="rekap-asrama-print bg-white text-black">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .rekap-asrama-print { width: 100%; color: #000; background: #fff; font-family: "Arial","Helvetica",sans-serif; }
              .rekap-asrama-print * { box-sizing: border-box; }
              .rekap-asrama-print .doc-title { text-align: center; font-weight: 800; }
              .rekap-asrama-print .doc-title .t1 { font-size: 13px; text-transform: uppercase; }
              .rekap-asrama-print .doc-title .t2 { font-size: 11px; text-transform: uppercase; margin-top: 1px; }
              .rekap-asrama-print .asrama-line { font-size: 12px; font-weight: 800; margin: 8px 2px 6px; }
              .rekap-asrama-print table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              .rekap-asrama-print th, .rekap-asrama-print td { border: 1px solid #000; padding: 1px 4px; font-size: 10px; line-height: 1.25; vertical-align: middle; }
              .rekap-asrama-print thead th { font-weight: 800; text-align: center; text-transform: uppercase; background: #fff; }
              .rekap-asrama-print td.c { text-align: center; }
              .rekap-asrama-print td.l { text-align: left; }
              .rekap-asrama-print td.nm { text-align: left; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .rekap-asrama-print td.vert { text-align: center; padding: 2px; }
              .rekap-asrama-print td.vert span { writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 800; text-transform: uppercase; white-space: nowrap; letter-spacing: .05em; }
              .rekap-asrama-print td.midsection { text-align: center; font-weight: 800; text-transform: uppercase; }
              .rekap-asrama-print td.subh { text-align: center; font-weight: 800; text-transform: uppercase; }
              .rekap-asrama-print .rincian-stor { text-align: center; font-weight: 800; text-transform: uppercase; font-size: 12px; }
              .rekap-asrama-print .sum-label { font-weight: 800; text-transform: uppercase; }
              .rekap-asrama-print .ttd-wrap { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-top: 14px; }
              .rekap-asrama-print .ttd-wrap .role { font-size: 11px; font-weight: 800; text-transform: uppercase; }
              .rekap-asrama-print .ttd-wrap .gap { height: 64px; }
              .rekap-asrama-print .ttd-wrap .nm { font-size: 11px; }
              .rekap-asrama-print .notes { margin-top: 14px; font-size: 9px; font-style: italic; }
              .rekap-asrama-print .notes b { font-style: italic; }
            `,
          }}
        />

        <div className="doc-title">
          <div className="t1">Rekap Setoran Keuangan SPP Asrama</div>
          <div className="t2">
            Lembaga Pendidikan Pondok Pesantren Sukahideng Tahun Pelajaran {meta.tahun_ajaran_nama ?? '-'}
          </div>
        </div>

        <div className="asrama-line">Asrama : {meta.nama_asrama}</div>

        {/* ===== TABEL UTAMA (header berulang tiap halaman via thead) ===== */}
        <table>
          <colgroup>
            <col style={{ width: '3.5%' }} />{/* BULAN */}
            <col style={{ width: '3.5%' }} />{/* LABEL */}
            <col style={{ width: '4%' }} />{/* Kmr1 */}
            <col style={{ width: '4%' }} />{/* Jml1 */}
            <col style={{ width: '4%' }} />{/* Kmr2 */}
            <col style={{ width: '4%' }} />{/* Jml2 */}
            <col style={{ width: '22%' }} />{/* mid NAMA */}
            <col style={{ width: '4%' }} />{/* mid KMR */}
            <col style={{ width: '7%' }} />{/* mid KET */}
            <col style={{ width: '3.5%' }} />{/* pen No */}
            <col style={{ width: '22%' }} />{/* pen NAMA */}
            <col style={{ width: '4%' }} />{/* pen KMR */}
            <col style={{ width: '7%' }} />{/* pen Tunggakan */}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>Bulan</th>
              <th rowSpan={2} colSpan={5}>Rincian</th>
              <th colSpan={3}>Daftar Santri yang Digratiskan</th>
              <th colSpan={4}>Daftar Penunggak</th>
            </tr>
            <tr>
              <th>Nama</th>
              <th>Kmr</th>
              <th>Ket</th>
              <th colSpan={2}>Nama</th>
              <th>Kmr</th>
              <th>Tunggakan</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: bodyLen }).map((_, r) => {
              const kRow = kamarRows[r]
              const mid = middle[r]
              const pen = penunggak[r]
              return (
                <tr key={r}>
                  {r === 0 && (
                    <>
                      <td className="vert" rowSpan={bodyLen}><span>{meta.nama_bulan.toUpperCase()}</span></td>
                      <td className="vert" rowSpan={bodyLen}><span>Jumlah Penduduk Kamar</span></td>
                    </>
                  )}

                  {/* Kamar: 2 grup (Kmr|Jml) */}
                  <td className="c">{kRow?.[0]?.nomor_kamar ?? ''}</td>
                  <td className="c">{kRow?.[0] ? formatNumber(kRow[0]!.jumlah) : ''}</td>
                  <td className="c">{kRow?.[1]?.nomor_kamar ?? ''}</td>
                  <td className="c">{kRow?.[1] ? formatNumber(kRow[1]!.jumlah) : ''}</td>

                  {/* Tengah: Digratiskan / Mutasi */}
                  {!mid ? (
                    <><td></td><td></td><td></td></>
                  ) : mid.type === 'section' ? (
                    <td className="midsection" colSpan={3}>Mutasi Santri</td>
                  ) : mid.type === 'subheader' ? (
                    <><td className="subh">Nama</td><td className="subh">Kmr</td><td className="subh">Ket</td></>
                  ) : (
                    <>
                      <td className="nm">{mid.no}. {mid.nama}</td>
                      <td className="c">{mid.kamar ?? '-'}</td>
                      <td className="c">{mid.ket}</td>
                    </>
                  )}

                  {/* Penunggak */}
                  <td className="c">{pen ? r + 1 : ''}</td>
                  <td className="nm">{pen?.nama ?? ''}</td>
                  <td className="c">{pen?.kamar ?? (pen ? '-' : '')}</td>
                  <td className="c">{pen?.tunggakan_label ?? ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ===== RINGKASAN ===== */}
        <table style={{ marginTop: '-1px' }}>
          <colgroup>
            <col style={{ width: '26%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '33%' }} />
            <col style={{ width: '33%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="sum-label">Jumlah Penduduk</td>
              <td className="c">{formatNumber(ringkasan.jumlah_penduduk)}</td>
              <td className="rincian-stor" colSpan={2} rowSpan={2}>Rincian Setor</td>
            </tr>
            <tr>
              <td className="sum-label">Jml Wajib Bayar</td>
              <td className="c">{formatNumber(ringkasan.jml_wajib_bayar)}</td>
            </tr>
            <tr>
              <td className="sum-label">Jml yg Digratiskan</td>
              <td className="c">{formatNumber(ringkasan.jml_gratis)}</td>
              <td className="c" style={{ fontWeight: 800 }}>{formatNumber(ringkasan.jml_bayar)} × {formatNumber(ringkasan.tarif)}</td>
              <td className="c" style={{ fontWeight: 800 }}>= {formatCurrency(ringkasan.total)}</td>
            </tr>
            <tr>
              <td className="sum-label">Jml Penunggak</td>
              <td className="c">{formatNumber(ringkasan.jml_penunggak)}</td>
              <td className="sum-label">Hari / Tanggal Setor</td>
              <td className="c">{safeDate(ringkasan.tanggal_stor)}</td>
            </tr>
            <tr>
              <td className="sum-label">Jml Bayar Tunggakan Bln Lalu</td>
              <td className="c">{formatNumber(ringkasan.bayar_tunggakan_bln_lalu)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        {/* ===== TANDA TANGAN ===== */}
        <div className="ttd-wrap">
          <div>
            <div className="role">Rois / Roisah</div>
            <div className="gap"></div>
            <div className="nm">.................................</div>
          </div>
          <div>
            <div className="role">Bendahara Dewan Santri</div>
            <div className="gap"></div>
            <div className="nm">.................................</div>
          </div>
          <div>
            <div className="role">Bendahara Asrama</div>
            <div className="gap"></div>
            <div className="nm">{ringkasan.nama_penyetor || '.................................'}</div>
          </div>
        </div>

        <div className="notes">
          <div>*Mohon isi dengan lengkap</div>
          <div>*Rincian Setor = (Jumlah Santri yang Bayar Bulan ini + Jumlah Santri yang Bayar Tunggakan Bulan lalu) × {formatCurrency(ringkasan.tarif)} = Total Setoran</div>
        </div>
      </div>
    )
  }
)

RekapAsramaSheet.displayName = 'RekapAsramaSheet'
