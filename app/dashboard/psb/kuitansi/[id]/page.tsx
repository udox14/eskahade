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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(value))
}

function ReceiptCopy({ receipt, items, label }: { receipt: any; items: any[]; label: string }) {
  return (
    <section className="receipt-copy">
      <div className="receipt-header">
        <div>
          <p className="receipt-kicker">Pondok Pesantren Sukahideng</p>
          <h1>Kuitansi Pembayaran PSB</h1>
        </div>
        <div className="receipt-meta">
          <p>{label}</p>
          <strong>{receipt.receipt_no}</strong>
        </div>
      </div>

      <div className="receipt-grid">
        <div>
          <span>Telah diterima dari</span>
          <strong>{receipt.nama_lengkap}</strong>
        </div>
        <div>
          <span>NIS</span>
          <strong>{receipt.nis}</strong>
        </div>
        <div>
          <span>Asrama / Kamar</span>
          <strong>{receipt.asrama || '-'} / {receipt.kamar || '-'}</strong>
        </div>
        <div>
          <span>Tanggal</span>
          <strong>{formatDate(receipt.created_at)}</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Rincian</th>
            <th>Tahun</th>
            <th className="right">Nominal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.jenis_biaya}-${index}`}>
              <td>{item.jenis_biaya}</td>
              <td>{item.tahun_tagihan || '-'}</td>
              <td className="right">{rupiah(item.nominal_bayar)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td className="right">{rupiah(receipt.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="terbilang">Terbilang: {terbilangRupiah(receipt.total)}</div>

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
      <div className="cut-line">Potong di sini</div>
      <ReceiptCopy receipt={receipt} items={items} label="Untuk Pembayar" />

      <style>{`
        .receipt-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 24px;
          color: #0f172a;
          font-family: Arial, sans-serif;
        }
        .print-actions {
          max-width: 794px;
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
          max-width: 794px;
          height: 490px;
          margin: 0 auto;
          background: white;
          border: 1px solid #cbd5e1;
          padding: 28px;
          box-sizing: border-box;
        }
        .receipt-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .receipt-kicker {
          margin: 0 0 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-weight: 700;
          color: #475569;
        }
        h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
        }
        .receipt-meta {
          text-align: right;
          font-size: 12px;
        }
        .receipt-meta p {
          margin: 0 0 4px;
          color: #64748b;
        }
        .receipt-grid {
          display: grid;
          grid-template-columns: 1.4fr .8fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        .receipt-grid div {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 9px;
        }
        .receipt-grid span {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .receipt-grid strong {
          font-size: 13px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
        }
        th {
          background: #f1f5f9;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          color: #475569;
        }
        tfoot td {
          font-weight: 800;
          background: #f8fafc;
        }
        .right {
          text-align: right;
        }
        .terbilang {
          margin-top: 12px;
          border: 1px dashed #94a3b8;
          border-radius: 6px;
          padding: 10px;
          font-size: 12px;
          font-weight: 700;
        }
        .signature-row {
          display: flex;
          justify-content: flex-end;
          gap: 80px;
          margin-top: 24px;
          text-align: center;
          font-size: 12px;
        }
        .signature-row p {
          margin: 0 0 34px;
          color: #475569;
        }
        .cut-line {
          max-width: 794px;
          margin: 8px auto;
          text-align: center;
          font-size: 10px;
          color: #64748b;
          border-top: 1px dashed #94a3b8;
          line-height: 0;
        }
        .cut-line::before {
          content: "";
          background: #f8fafc;
          padding: 0 8px;
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
            height: 132mm;
            margin: 0;
            page-break-inside: avoid;
          }
          .cut-line {
            max-width: none;
            margin: 2mm 0;
          }
        }
      `}</style>
    </main>
  )
}
