'use client'

import React from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { OperasionalLedgerData, OperasionalPrintPreference } from '@/lib/operasional'

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const OperasionalPrintSheet = React.forwardRef<HTMLDivElement, {
  ledger: OperasionalLedgerData
  preferences: OperasionalPrintPreference
  bulan: number
  tahun: number
  subtitle: string
  preview?: boolean
}>(({ ledger, preferences, bulan, tahun, subtitle, preview = false }, ref) => {
  const printedAt = format(new Date(), 'dd MMMM yyyy', { locale: idLocale })
  const bulanLabel = `${BULAN_NAMA[bulan]} ${tahun}`

  return (
    <div ref={ref} className={`bg-white text-black ${preview ? 'operasional-print-preview' : ''}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .operasional-print-sheet {
              width: 190mm;
              min-height: 277mm;
              padding: 10mm 12mm;
              color: #111827;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
            }
            .operasional-print-sheet * { box-sizing: border-box; }
            .operasional-print-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .operasional-print-sheet th,
            .operasional-print-sheet td { border: 1px solid #0f172a; padding: 5px 6px; vertical-align: top; }
            .operasional-print-sheet th { background: #e2e8f0; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .operasional-print-sheet td { font-size: 10px; }
            .operasional-print-sheet .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0 14px; }
            .operasional-print-sheet .summary-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 10px; background: #f8fafc; }
            .operasional-print-sheet .summary-card-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; }
            .operasional-print-sheet .summary-card-value { margin-top: 4px; font-size: 17px; font-weight: 700; }
            .operasional-print-sheet .signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
            .operasional-print-sheet .signature-box { text-align: center; font-size: 11px; }
            .operasional-print-sheet .signature-space { height: 64px; }
            .operasional-print-sheet .muted { color: #64748b; }
            .operasional-print-preview {
              width: 100%;
              min-width: 760px;
            }
            .operasional-print-preview .operasional-print-sheet {
              width: 100%;
              min-width: 760px;
              min-height: auto;
              padding: 10mm;
              margin: 0 auto;
            }
            @page { size: F4 portrait; margin: 10mm; }
            @media print {
              html, body { background: white !important; }
              .operasional-print-sheet { width: 100%; min-height: auto; padding: 0; }
            }
          `,
        }}
      />
      <div className="operasional-print-sheet">
        <div className="text-center">
          <div className="text-[22px] font-bold uppercase tracking-wide">Laporan Kas Operasional</div>
          <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-600">{subtitle}</div>
          <div className="mt-2 text-[14px] font-semibold uppercase">{ledger.unit.name}</div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-6">
          <div className="space-y-1 text-[11px] font-semibold">
            <div className="flex gap-2"><span className="w-20">Periode</span><span>:</span><span>{bulanLabel}</span></div>
            <div className="flex gap-2"><span className="w-20">Unit</span><span>:</span><span>{ledger.unit.name}</span></div>
          </div>
          <div className="text-right text-[10px] text-slate-600">
            <div>Dicetak pada {printedAt}</div>
          </div>
        </div>

        <div className="summary-grid">
          <PrintSummaryCard label="Saldo Awal" value={formatCurrency(ledger.saldoAwal)} />
          <PrintSummaryCard label="Total Pemasukan" value={formatCurrency(ledger.totals.alokasi_bendahara + ledger.totals.pemasukan_lain + Math.max(0, ledger.totals.penyesuaian))} />
          <PrintSummaryCard label="Total Pengeluaran" value={formatCurrency(ledger.totals.pengeluaran + Math.abs(Math.min(0, ledger.totals.penyesuaian)))} />
          <PrintSummaryCard label="Saldo Akhir" value={formatCurrency(ledger.saldoAkhir)} />
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '30px' }}>No</th>
              <th style={{ width: '70px' }}>Tanggal</th>
              <th style={{ width: '74px' }}>Tipe</th>
              <th style={{ width: '80px' }}>Kategori</th>
              <th>Uraian</th>
              <th style={{ width: '54px' }}>Qty</th>
              <th style={{ width: '88px' }}>Harga</th>
              <th style={{ width: '102px' }}>Nominal</th>
            </tr>
          </thead>
          <tbody>
            {ledger.transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center muted">Belum ada transaksi pada periode ini.</td>
              </tr>
            ) : ledger.transactions.map((row, index) => (
              <tr key={row.id}>
                <td className="text-center">{index + 1}</td>
                <td>{formatShortDate(row.tanggal)}</td>
                <td>{row.tipe}</td>
                <td>{row.kategori || (row.sumber_pemasukan === 'ALOKASI_BENDAHARA' ? 'Alokasi Bendahara' : '-')}</td>
                <td>
                  <div className="font-medium">{row.uraian}</div>
                  {row.partner_name ? <div className="muted">{row.partner_name}</div> : null}
                  {row.catatan ? <div className="muted">{row.catatan}</div> : null}
                </td>
                <td className="text-center">{formatNumber(row.qty)}</td>
                <td className="text-right">{formatCurrency(row.harga_satuan)}</td>
                <td className="text-right">{formatCurrency(row.nominal)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={7} className="text-right font-bold">Saldo Awal</td>
              <td className="text-right font-bold">{formatCurrency(ledger.saldoAwal)}</td>
            </tr>
            <tr>
              <td colSpan={7} className="text-right font-bold">Saldo Akhir</td>
              <td className="text-right font-bold">{formatCurrency(ledger.saldoAkhir)}</td>
            </tr>
          </tbody>
        </table>

        <div className="signature-grid">
          <SignatureBox
            label={preferences.slot1_label}
            nama={preferences.slot1_nama}
            jabatan={preferences.slot1_jabatan}
          />
          <SignatureBox
            label={preferences.slot2_label}
            nama={preferences.slot2_nama}
            jabatan={preferences.slot2_jabatan}
          />
          <SignatureBox
            label={preferences.slot3_label}
            nama={preferences.slot3_nama}
            jabatan={preferences.slot3_jabatan}
          />
        </div>
      </div>
    </div>
  )
})

OperasionalPrintSheet.displayName = 'OperasionalPrintSheet'

function PrintSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-value">{value}</div>
    </div>
  )
}

function SignatureBox({ label, nama, jabatan }: { label: string; nama: string; jabatan: string }) {
  return (
    <div className="signature-box">
      <div>{label || '....................'}</div>
      <div className="signature-space" />
      <div className="font-medium">{nama || '........................................'}</div>
      <div className="muted">{jabatan || '........................................'}</div>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

function formatCurrency(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'dd/MM/yyyy')
}
