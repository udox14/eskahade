'use client'

import React, { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Printer } from 'lucide-react'
import { useReactToPrint } from '@/lib/pdf/client'

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

type AsramaRow = {
  unit_setor: string
  total_santri: number
  bebas_spp: number
  tidak_ada_tagihan: number
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  penunggak: number
  total_nominal: number
  nominal_bulan_ini: number
  nominal_tunggakan_lalu: number
  persentase: number
  tanggal_setor: string | null
  nama_penyetor: string | null
  jumlah_aktual: number | null
  belum_ada_tagihan?: boolean
  is_sadesa?: boolean
}

type PrintMode = 'NON_SADESA' | 'SADESA'

export default function MonitoringPrintControls({
  hasLoaded,
  data,
  bulan,
  tahun,
  nominal,
  tahunAjaran,
}: {
  hasLoaded: boolean
  data: AsramaRow[]
  bulan: number
  tahun: number
  nominal: number
  tahunAjaran: string
}) {
  const [printMode, setPrintMode] = useState<PrintMode>('NON_SADESA')
  const printRef = useRef<HTMLDivElement>(null)

  const printRows = useMemo(() => {
    const filtered = data.filter(row => printMode === 'SADESA' ? row.is_sadesa : !row.is_sadesa)
    return filtered
      .slice()
      .sort((a, b) => {
        if (b.persentase !== a.persentase) return b.persentase - a.persentase
        if (b.bayar_bulan_ini !== a.bayar_bulan_ini) return b.bayar_bulan_ini - a.bayar_bulan_ini
        return a.unit_setor.localeCompare(b.unit_setor)
      })
      .map((row, index) => ({ ...row, rank: index + 1 }))
  }, [data, printMode])

  const printTotals = useMemo(() => {
    return printRows.reduce((acc, row) => {
      acc.total_santri += row.total_santri
      acc.bebas_spp += row.bebas_spp
      acc.tidak_ada_tagihan += row.tidak_ada_tagihan
      acc.wajib_bayar += row.wajib_bayar
      acc.bayar_bulan_ini += row.bayar_bulan_ini
      acc.penunggak += row.penunggak
      acc.bayar_tunggakan_lalu += row.bayar_tunggakan_lalu
      acc.jumlah_bayar += row.bayar_bulan_ini + row.bayar_tunggakan_lalu
      acc.total_nominal += row.total_nominal
      acc.nominal_bulan_ini += row.nominal_bulan_ini
      acc.nominal_tunggakan_lalu += row.nominal_tunggakan_lalu
      if (row.tanggal_setor) acc.tersetor += 1
      return acc
    }, {
      total_santri: 0,
      bebas_spp: 0,
      tidak_ada_tagihan: 0,
      wajib_bayar: 0,
      bayar_bulan_ini: 0,
      penunggak: 0,
      bayar_tunggakan_lalu: 0,
      jumlah_bayar: 0,
      total_nominal: 0,
      nominal_bulan_ini: 0,
      nominal_tunggakan_lalu: 0,
      tersetor: 0,
    })
  }, [printRows])

  const printPct = printTotals.wajib_bayar > 0 ? Math.round((printTotals.bayar_bulan_ini / printTotals.wajib_bayar) * 100) : 0
  const canPrint = hasLoaded && printRows.length > 0

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Rekap_Setoran_SPP_${printMode}_${bulan}_${tahun}`,
    pageStyle: `
      @page { size: 330mm 210mm; margin: 10mm; }
      @media print {
        html, body {
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  })

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Cetak Laporan Penerimaan SPP</p>
          <p className="mt-1 text-xs text-slate-500">Format F4 landscape dengan pilihan laporan reguler atau unit SADESA.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[15rem_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Jenis Laporan</label>
            <select
              value={printMode}
              onChange={e => setPrintMode(e.target.value as PrintMode)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NON_SADESA">Santri Asrama</option>
              <option value="SADESA">SADESA</option>
            </select>
          </div>
          <button
            onClick={() => handlePrint()}
            disabled={!canPrint}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      <div className="absolute left-[-99999px] top-0">
        <MonitoringPrintSheet
          ref={printRef}
          bulan={bulan}
          tahun={tahun}
          tahunAjaran={tahunAjaran}
          nominal={nominal}
          mode={printMode}
          rows={printRows}
          totals={printTotals}
          totalPersentase={printPct}
        />
      </div>
    </>
  )
}

const MonitoringPrintSheet = React.forwardRef<HTMLDivElement, {
  bulan: number
  tahun: number
  tahunAjaran: string
  nominal: number
  mode: PrintMode
  rows: Array<AsramaRow & { rank: number }>
  totals: {
    total_santri: number
    bebas_spp: number
    tidak_ada_tagihan: number
    wajib_bayar: number
    bayar_bulan_ini: number
    penunggak: number
    bayar_tunggakan_lalu: number
    jumlah_bayar: number
    total_nominal: number
    nominal_bulan_ini: number
    nominal_tunggakan_lalu: number
    tersetor: number
  }
  totalPersentase: number
}>(({ bulan, tahun, tahunAjaran, nominal, mode, rows, totals, totalPersentase }, ref) => {
  const title = mode === 'SADESA' ? 'REKAP SETORAN SPP SADESA' : 'REKAP SETORAN SPP SANTRI'
  const subtitle = mode === 'SADESA' ? 'LAPORAN PENERIMAAN UNIT SADESA' : 'LAPORAN PENERIMAAN SANTRI ASRAMA'
  const bulanNama = BULAN_NAMA[bulan].toUpperCase()
  const printedAt = format(new Date(), 'dd MMMM yyyy', { locale: idLocale })

  return (
    <div ref={ref} className="print-area bg-white text-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .monitoring-print-sheet {
              width: 310mm;
              min-height: 190mm;
              padding: 10mm 12mm;
              color: #111827;
              background: #ffffff;
              font-family: "Arial", "Helvetica", sans-serif;
            }
            .monitoring-print-sheet * { box-sizing: border-box; }
            .monitoring-print-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .monitoring-print-sheet th,
            .monitoring-print-sheet td { border: 1px solid #0f172a; padding: 5px 6px; vertical-align: middle; }
            .monitoring-print-sheet .currency { width: 30px; text-align: center; }
            .monitoring-print-sheet .text-left { text-align: left; }
            .monitoring-print-sheet .text-center { text-align: center; }
            .monitoring-print-sheet .text-right { text-align: right; }
            .monitoring-print-sheet .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
            .monitoring-print-sheet .summary-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 10px; background: #f8fafc; }
            .monitoring-print-sheet .summary-card-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
            .monitoring-print-sheet .summary-card-value { margin-top: 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
            .monitoring-print-sheet .main-head th { background: #e2e8f0; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .monitoring-print-sheet .sub-head th { background: #f8fafc; font-size: 9px; font-weight: 700; }
            .monitoring-print-sheet tbody td { font-size: 10px; }
            .monitoring-print-sheet .highlight { background: #fef3c7; font-weight: 700; }
            .monitoring-print-sheet .money-highlight { background: #fff7ed; font-weight: 700; }
            .monitoring-print-sheet .total-row td { background: #dbeafe; font-weight: 800; }
            .monitoring-print-sheet .total-row td.total-amount { background: #fee2e2; }
            .monitoring-print-sheet .footer-note { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px; gap: 12px; }
            .monitoring-print-sheet .signature { width: 220px; text-align: center; }
            @media print {
              .monitoring-print-sheet { width: 100%; min-height: auto; padding: 0; }
            }
          `,
        }}
      />

      <div className="monitoring-print-sheet">
        <div className="mb-4 text-center">
          <div className="text-[24px] font-black uppercase tracking-wide">{title}</div>
          <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.2em] text-slate-600">{subtitle}</div>
          <div className="mt-1 text-[14px] font-bold uppercase">Tahun Ajaran {tahunAjaran}</div>
        </div>

        <div className="mb-3 flex items-start justify-between gap-6">
          <div className="min-w-[16rem] space-y-1 text-[11px] font-semibold">
            <div className="flex gap-2"><span className="w-16">Bulan</span><span>:</span><span>{bulanNama} {tahun}</span></div>
            <div className="flex gap-2"><span className="w-16">Tarif</span><span>:</span><span>{formatCurrency(nominal)}</span></div>
          </div>
          <div className="text-right text-[10px] text-slate-600">
            <div>Dicetak pada {printedAt}</div>
            <div>{mode === 'SADESA' ? 'Kategori laporan: SADESA' : 'Kategori laporan: Santri Asrama'}</div>
          </div>
        </div>

        <div className="summary-grid">
          <PrintSummaryCard label="Jumlah Penduduk" value={formatNumber(totals.total_santri)} />
          <PrintSummaryCard label="Tidak Ada Tagihan" value={formatNumber(totals.tidak_ada_tagihan)} />
          <PrintSummaryCard label="Wajib Bayar" value={formatNumber(totals.wajib_bayar)} />
          <PrintSummaryCard label="Jumlah Bayar" value={formatNumber(totals.jumlah_bayar)} />
          <PrintSummaryCard label="Uang Tercatat" value={formatCurrency(totals.total_nominal)} />
        </div>

        <table>
          <thead>
            <tr className="main-head">
              <th rowSpan={2} style={{ width: '34px' }}>No</th>
              <th rowSpan={2} style={{ width: mode === 'SADESA' ? '100px' : '140px' }}>Asrama</th>
              <th rowSpan={2} style={{ width: '78px' }}>Jumlah Penduduk</th>
              <th rowSpan={2} style={{ width: '72px' }}>Digratiskan</th>
              <th rowSpan={2} style={{ width: '82px' }}>Tidak Ada Tagihan</th>
              <th rowSpan={2} style={{ width: '74px' }}>Wajib Bayar</th>
              <th rowSpan={2} style={{ width: '82px' }}>Jumlah Bayar Bulan Ini</th>
              <th rowSpan={2} style={{ width: '72px' }}>Penunggak</th>
              <th rowSpan={2} style={{ width: '88px' }}>Bayar Tunggakan</th>
              <th rowSpan={2} style={{ width: '72px' }}>Jumlah Bayar</th>
              <th colSpan={2} style={{ width: '92px' }}>Biaya</th>
              <th colSpan={2} style={{ width: '126px' }}>Uang Tercatat</th>
              <th colSpan={2} style={{ width: '126px' }}>Rincian</th>
              <th rowSpan={2} style={{ width: '48px' }}>%</th>
              <th rowSpan={2} style={{ width: '62px' }}>Tgl Stor</th>
              <th rowSpan={2} style={{ width: '48px' }}>Rank</th>
            </tr>
            <tr className="sub-head">
              <th className="currency">Rp</th>
              <th>Nominal</th>
              <th className="currency">Rp</th>
              <th>Nominal</th>
              <th>Bulan Ini</th>
              <th>Tunggakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const jumlahBayar = row.bayar_bulan_ini + row.bayar_tunggakan_lalu
              return (
                <tr key={`${row.unit_setor}-${index}`}>
                  <td className="text-center">{index + 1}</td>
                  <td className="text-left font-bold">{row.unit_setor}</td>
                  <td className="text-center">{formatNumber(row.total_santri)}</td>
                  <td className="text-center">{formatNumber(row.bebas_spp)}</td>
                  <td className="text-center">{formatNumber(row.tidak_ada_tagihan)}</td>
                  <td className="highlight text-center">{formatNumber(row.wajib_bayar)}</td>
                  <td className="text-center">{formatNumber(row.bayar_bulan_ini)}</td>
                  <td className="text-center">{formatNumber(row.penunggak)}</td>
                  <td className="text-center">{formatNumber(row.bayar_tunggakan_lalu)}</td>
                  <td className="highlight text-center">{formatNumber(jumlahBayar)}</td>
                  <td className="currency">Rp</td>
                  <td className="text-right">{formatNumber(nominal)}</td>
                  <td className="currency money-highlight">Rp</td>
                  <td className="money-highlight text-right">{formatNumber(row.total_nominal)}</td>
                  <td className="text-right">{formatNumber(row.nominal_bulan_ini)}</td>
                  <td className="text-right">{formatNumber(row.nominal_tunggakan_lalu)}</td>
                  <td className="highlight text-center">{row.persentase}</td>
                  <td className="text-center">{safeFormatShortDate(row.tanggal_setor)}</td>
                  <td className="text-center">{row.rank}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td colSpan={2} className="text-center">Jumlah Total</td>
              <td className="text-center">{formatNumber(totals.total_santri)}</td>
              <td className="text-center">{formatNumber(totals.bebas_spp)}</td>
              <td className="text-center">{formatNumber(totals.tidak_ada_tagihan)}</td>
              <td className="text-center">{formatNumber(totals.wajib_bayar)}</td>
              <td className="text-center">{formatNumber(totals.bayar_bulan_ini)}</td>
              <td className="text-center">{formatNumber(totals.penunggak)}</td>
              <td className="text-center">{formatNumber(totals.bayar_tunggakan_lalu)}</td>
              <td className="text-center">{formatNumber(totals.jumlah_bayar)}</td>
              <td className="currency total-amount"></td>
              <td className="total-amount text-right">{formatNumber(nominal)}</td>
              <td className="currency total-amount">Rp</td>
              <td className="total-amount text-right">{formatNumber(totals.total_nominal)}</td>
              <td className="total-amount text-right">{formatNumber(totals.nominal_bulan_ini)}</td>
              <td className="total-amount text-right">{formatNumber(totals.nominal_tunggakan_lalu)}</td>
              <td className="text-center">{totalPersentase}</td>
              <td className="text-center">{totals.tersetor > 0 ? 'Ada' : '-'}</td>
              <td className="text-center">-</td>
            </tr>
          </tbody>
        </table>

        <div className="footer-note">
          <div className="text-[10px] text-slate-600">
            <div>Keterangan:</div>
            <div>Kolom uang tercatat adalah akumulasi SPP bulan berjalan dan pelunasan tunggakan yang tercatat pada periode laporan.</div>
          </div>
          <div className="signature">
            <div className="text-[11px]">Tasikmalaya, {printedAt}</div>
            <div className="mt-1 text-[11px] font-bold">Petugas Monitoring SPP</div>
            <div className="mt-14 border-t border-slate-800 pt-1 text-[11px] font-semibold">........................................</div>
          </div>
        </div>
      </div>
    </div>
  )
})

MonitoringPrintSheet.displayName = 'MonitoringPrintSheet'

function PrintSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-value">{value}</div>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value)
}

function formatCurrency(value: number) {
  return `Rp ${formatNumber(value)}`
}

function safeFormatShortDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return format(date, 'dd/MM')
}
