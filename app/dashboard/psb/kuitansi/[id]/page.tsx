import { notFound } from 'next/navigation'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getPsbReceipt } from '../../actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function terbilangRupiah(value: number): string {
  const angka = Math.floor(Math.abs(Number(value || 0)))
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  const baca = (n: number): string => {
    if (n < 12) return satuan[n]
    if (n < 20) return `${baca(n - 10)} Belas`
    if (n < 100) return `${baca(Math.floor(n / 10))} Puluh ${baca(n % 10)}`.trim()
    if (n < 200) return `Seratus ${baca(n - 100)}`.trim()
    if (n < 1000) return `${baca(Math.floor(n / 100))} Ratus ${baca(n % 100)}`.trim()
    if (n < 2000) return `Seribu ${baca(n - 1000)}`.trim()
    if (n < 1000000) return `${baca(Math.floor(n / 1000))} Ribu ${baca(n % 1000)}`.trim()
    if (n < 1000000000) return `${baca(Math.floor(n / 1000000))} Juta ${baca(n % 1000000)}`.trim()
    return `${baca(Math.floor(n / 1000000000))} Miliar ${baca(n % 1000000000)}`.trim()
  }
  return `${baca(angka).replace(/\s+/g, ' ')} Rupiah`
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    BANGUNAN: 'Dana Bangunan',
    KESEHATAN: 'Biaya Kesehatan',
    EHB: 'Biaya EHB',
    EKSKUL: 'Biaya Ekstrakurikuler',
  }
  return labels[value] ?? value
}

function ReceiptCopy({ receipt, items, label }: { receipt: any; items: any[]; label: string }) {
  const isLunas = Number(receipt.total || 0) > 0

  return (
    <section className="receipt-copy">
      {isLunas ? <div className="paid-stamp">LUNAS</div> : null}

      <div className="receipt-topline">
        <span>{label}</span>
        <span>No. {receipt.receipt_no}</span>
      </div>

      <div className="receipt-header">
        <div className="brand-mark">PS</div>
        <div className="brand-copy">
          <p className="receipt-kicker">Pondok Pesantren Sukahideng</p>
          <h1>Kuitansi Pembayaran</h1>
          <p className="receipt-subtitle">Penerimaan pembayaran PSB santri baru</p>
        </div>
        <div className="receipt-meta">
          <p>Tanggal</p>
          <strong>{formatShortDate(receipt.created_at)}</strong>
        </div>
      </div>

      <div className="receipt-body">
        <div className="identity-panel">
          <div className="identity-row">
            <span>Telah diterima dari</span>
            <strong>{receipt.nama_lengkap}</strong>
          </div>
          <div className="identity-grid">
            <div>
              <span>NIS</span>
              <strong>{receipt.nis || '-'}</strong>
            </div>
            <div>
              <span>Sekolah</span>
              <strong>{receipt.sekolah || '-'}</strong>
            </div>
            <div>
              <span>Asrama / Kamar</span>
              <strong>{receipt.asrama || '-'} / {receipt.kamar || '-'}</strong>
            </div>
            <div>
              <span>Tahun Tagihan</span>
              <strong>{receipt.tahun_tagihan || '-'}</strong>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th className="number-col">No.</th>
              <th>Rincian Pembayaran</th>
              <th>Tahun</th>
              <th className="right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.jenis_biaya}-${index}`}>
                <td className="number-col">{index + 1}</td>
                <td>
                  <strong>{paymentLabel(item.jenis_biaya)}</strong>
                  {item.keterangan ? <small>{item.keterangan}</small> : null}
                </td>
                <td>{item.tahun_tagihan || '-'}</td>
                <td className="right">{rupiah(item.nominal_bayar)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Jumlah Diterima</td>
              <td className="right">{rupiah(receipt.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="terbilang">Terbilang: {terbilangRupiah(receipt.total)}</div>

      <div className="receipt-footer">
        <div className="receipt-note">
          <span>Catatan</span>
          <p>Kuitansi ini sah sebagai bukti pembayaran setelah ditandatangani petugas penerima.</p>
        </div>
        <div className="signature-row">
          <div>
            <p>Pembayar</p>
            <strong>__________________</strong>
          </div>
          <div>
            <p>Penerima</p>
            <strong>{receipt.penerima_nama || '__________________'}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default async function PsbReceiptPage({ params }: Props) {
  const { id } = await params
  const data = await getPsbReceipt(id)
  if ('error' in data) return notFound()

  const { receipt, items } = data
  return (
    <main className="receipt-page">
      <div className="print-actions">
        <span>Gunakan Ctrl+P untuk mencetak</span>
      </div>
      <ReceiptCopy receipt={receipt} items={items} label="Untuk Panitia" />
      <div className="copy-divider" />
      <ReceiptCopy receipt={receipt} items={items} label="Untuk Pembayar" />

      <style>{`
        .receipt-page {
          min-height: 100vh;
          background: #eef2f7;
          padding: 24px;
          color: #111827;
          font-family: "Times New Roman", Georgia, serif;
        }
        .print-actions {
          max-width: 820px;
          margin: 0 auto 12px;
          text-align: right;
        }
        .print-actions span {
          display: inline-block;
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }
        .receipt-copy {
          position: relative;
          max-width: 820px;
          min-height: 126mm;
          margin: 0 auto;
          background: white;
          border: 1px solid #1f2937;
          padding: 18px 22px 16px;
          box-sizing: border-box;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 23, 42, .10);
        }
        .receipt-copy::before {
          content: "";
          position: absolute;
          inset: 6px;
          border: 1px solid #d1d5db;
          pointer-events: none;
        }
        .receipt-topline {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #475569;
        }
        .receipt-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 3px double #111827;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .brand-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border: 2px solid #111827;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: .03em;
        }
        .brand-copy {
          flex: 1;
          min-width: 0;
        }
        .receipt-kicker {
          margin: 0 0 2px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-weight: 700;
          color: #1f2937;
        }
        h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1.1;
          text-transform: uppercase;
          letter-spacing: .02em;
        }
        .receipt-subtitle {
          margin: 3px 0 0;
          font-size: 11px;
          color: #64748b;
        }
        .receipt-meta {
          min-width: 92px;
          text-align: right;
          font-size: 12px;
        }
        .receipt-meta p {
          margin: 0 0 4px;
          color: #64748b;
        }
        .receipt-body {
          position: relative;
          z-index: 1;
        }
        .identity-panel {
          border: 1px solid #cbd5e1;
          margin-bottom: 10px;
        }
        .identity-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          border-bottom: 1px solid #cbd5e1;
          min-height: 36px;
        }
        .identity-row span,
        .identity-grid span {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border-right: 1px solid #cbd5e1;
          padding: 7px 9px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #475569;
        }
        .identity-row strong {
          display: flex;
          align-items: center;
          padding: 7px 10px;
          font-size: 14px;
          text-transform: uppercase;
        }
        .identity-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .identity-grid div {
          display: grid;
          grid-template-columns: 116px 1fr;
          min-height: 32px;
          border-top: 1px solid #e2e8f0;
        }
        .identity-grid div:nth-child(1),
        .identity-grid div:nth-child(2) {
          border-top: 0;
        }
        .identity-grid div:nth-child(odd) {
          border-right: 1px solid #e2e8f0;
        }
        .identity-grid strong {
          display: flex;
          align-items: center;
          min-width: 0;
          padding: 7px 9px;
          font-size: 12px;
        }
        table {
          position: relative;
          z-index: 1;
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #94a3b8;
          padding: 7px 9px;
        }
        th {
          background: #e5e7eb;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          color: #1f2937;
          letter-spacing: .04em;
        }
        td strong {
          display: block;
          font-size: 12px;
        }
        td small {
          display: block;
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
          font-family: Arial, sans-serif;
        }
        tfoot td {
          font-weight: 800;
          background: #f1f5f9;
          font-size: 13px;
        }
        .number-col {
          width: 42px;
          text-align: center;
        }
        .right {
          text-align: right;
        }
        .terbilang {
          position: relative;
          z-index: 1;
          margin-top: 9px;
          border: 1px solid #94a3b8;
          background: #f8fafc;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          font-style: italic;
        }
        .receipt-footer {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 330px;
          gap: 22px;
          align-items: end;
          margin-top: 12px;
        }
        .receipt-note {
          border-left: 3px solid #111827;
          padding-left: 10px;
          font-family: Arial, sans-serif;
        }
        .receipt-note span {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: #475569;
        }
        .receipt-note p {
          margin: 3px 0 0;
          font-size: 10px;
          line-height: 1.35;
          color: #475569;
        }
        .signature-row {
          display: flex;
          justify-content: space-between;
          gap: 32px;
          text-align: center;
          font-size: 12px;
        }
        .signature-row p {
          margin: 0 0 30px;
          color: #475569;
        }
        .signature-row strong {
          display: block;
          min-width: 130px;
          font-size: 12px;
        }
        .paid-stamp {
          position: absolute;
          right: 76px;
          bottom: 70px;
          z-index: 0;
          transform: rotate(-16deg);
          border: 5px double rgba(22, 101, 52, .26);
          border-radius: 12px;
          padding: 10px 24px;
          color: rgba(22, 101, 52, .24);
          font-family: Arial, sans-serif;
          font-size: 42px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .copy-divider {
          max-width: 820px;
          height: 0;
          margin: 7mm auto;
          border-top: 1px dashed #94a3b8;
        }
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          .receipt-page {
            background: white;
            padding: 0;
          }
          .print-actions {
            display: none;
          }
          .receipt-copy {
            max-width: none;
            min-height: 126mm;
            margin: 0;
            box-shadow: none;
            page-break-inside: avoid;
          }
          .copy-divider {
            max-width: none;
            margin: 6mm 0;
          }
        }
      `}</style>
    </main>
  )
}
