import Image from 'next/image'
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

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function formatPrintedAt(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

function ReceiptCopy({ receipt, items, label, printedAt }: { receipt: any; items: any[]; label: string; printedAt: string }) {
  const total = Number(receipt.total || 0)
  const isLunas = total > 0
  const payerName = receipt.nama_lengkap || '________________'
  const officerName = receipt.penerima_nama || 'Bendahara'

  return (
    <section className="receipt-copy">
      {isLunas ? <div className="paid-stamp">LUNAS</div> : null}

      <header className="receipt-header">
        <Image src="/logo.png" width={78} height={78} alt="Logo Pesantren Sukahideng" priority />
        <div className="school-heading">
          <h1>KUITANSI PEMBAYARAN</h1>
          <h2>PONDOK PESANTREN SUKAHIDENG</h2>
          <p>Desa Sukarapih Kec. Sukarame Kabupaten Tasikmalaya Jawa Barat 46461</p>
        </div>
      </header>

      <div className="header-rule" />

      <div className="copy-label">{label}</div>

      <section className="intro-grid">
        <div className="student-info">
          <InfoRow label="Nama Santri" value={payerName} strong />
          <InfoRow label="NIS" value={receipt.nis || '-'} />
          <InfoRow label="Kelas" value={receipt.sekolah || '-'} />
          <InfoRow label="Asrama" value={`${receipt.asrama || '-'} / ${receipt.kamar || '-'}`} />
        </div>

        <div className="payment-title">
          <h3>BUKTI PEMBAYARAN</h3>
          <p>Pembayaran PSB - Tahun Tagihan {receipt.tahun_tagihan || '-'}</p>
        </div>

        <div className="receipt-info">
          <InfoRow label="No. Bukti" value={receipt.receipt_no} strong />
          <InfoRow label="Tanggal" value={formatLongDate(receipt.created_at)} />
          <InfoRow label="Metode" value="Tunai" />
          <InfoRow label="Petugas" value={officerName} />
        </div>
      </section>

      <div className="terbilang">
        <span>Terbilang:</span>
        <strong>{terbilangRupiah(total)}</strong>
      </div>

      <table className="main-table">
        <thead>
          <tr>
            <th className="no-col">No.</th>
            <th>Uraian Pembayaran</th>
            <th className="amount-col">Jumlah (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.jenis_biaya}-${index}`}>
              <td className="no-col">{index + 1}</td>
              <td>{paymentLabel(item.jenis_biaya)}</td>
              <td className="amount-col">{rupiah(item.nominal_bayar)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>TOTAL PEMBAYARAN INI</td>
            <td className="amount-col">{rupiah(total)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="arrears-caption">Catatan - sisa tagihan yang belum terbayar:</p>
      <table className="arrears-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="amount-col">Sisa (Rp)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>PSB</td>
            <td className="amount-col due-zero">Rp 0</td>
          </tr>
          <tr className="total-arrears">
            <td>Total Sisa Tunggakan</td>
            <td className="amount-col due-zero">Rp 0</td>
          </tr>
        </tbody>
      </table>

      <div className="summary-block">
        <div />
        <table>
          <tbody>
            <tr>
              <td>JUMLAH</td>
              <td>:</td>
              <td>{rupiah(total)}</td>
            </tr>
            <tr>
              <td>PEMBAYARAN</td>
              <td>:</td>
              <td>{rupiah(total)}</td>
            </tr>
            <tr>
              <td>KEMBALI</td>
              <td>:</td>
              <td>Rp 0</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="signature-section">
        <div className="signature-box">
          <p>Penyetor / Santri</p>
          <div className="signature-line" />
          <strong>( {payerName} )</strong>
        </div>
        <div className="signature-box">
          <p>Tasikmalaya, {formatLongDate(receipt.created_at)}<br />Bendahara</p>
          <div className="signature-line" />
          <strong>( {officerName} )</strong>
        </div>
      </section>

      <footer className="receipt-footer">
        <span>Dicetak: {formatPrintedAt(printedAt)}</span>
        <span>Dokumen ini sah tanpa tanda tangan basah jika dicetak dari sistem</span>
        <span>PSB</span>
      </footer>
    </section>
  )
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <b>:</b>
      {strong ? <strong>{value}</strong> : <em>{value}</em>}
    </div>
  )
}

export default async function PsbReceiptPage({ params }: Props) {
  const { id } = await params
  const data = await getPsbReceipt(id)
  if ('error' in data) return notFound()

  const { receipt, items } = data
  const printedAt = new Date().toISOString()

  return (
    <main className="receipt-page">
      <div className="print-actions">
        <span>Gunakan Ctrl+P untuk mencetak</span>
      </div>
      <ReceiptCopy receipt={receipt} items={items} label="Lembar Pembayar" printedAt={printedAt} />
      <div className="copy-divider" />
      <ReceiptCopy receipt={receipt} items={items} label="Arsip Pondok" printedAt={printedAt} />

      <style>{`
        .receipt-page {
          min-height: 100vh;
          background: #f5f5f5;
          padding: 14px 0;
          color: #111;
          font-family: "Times New Roman", Times, serif;
        }
        .print-actions {
          width: 210mm;
          margin: 0 auto 8px;
          text-align: right;
          font-family: Arial, sans-serif;
        }
        .print-actions span {
          display: inline-block;
          border: 1px solid #bbb;
          border-radius: 4px;
          background: white;
          padding: 5px 9px;
          font-size: 11px;
          color: #444;
        }
        .receipt-copy {
          position: relative;
          width: 210mm;
          height: 139mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          padding: 4mm 17mm 0;
          overflow: hidden;
        }
        .receipt-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          height: 20mm;
          text-align: left;
        }
        .receipt-header img {
          width: 19mm;
          height: 19mm;
          object-fit: contain;
        }
        .school-heading {
          min-width: 0;
        }
        .school-heading h1,
        .school-heading h2,
        .school-heading p {
          margin: 0;
        }
        .school-heading h1 {
          font-family: Arial, sans-serif;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.05;
        }
        .school-heading h2 {
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-weight: 900;
          line-height: 1.1;
        }
        .school-heading p {
          margin-top: 2px;
          font-family: Arial, sans-serif;
          font-size: 9px;
          line-height: 1.25;
        }
        .header-rule {
          height: 0;
          margin: 1mm 0 4mm;
          border-top: 2.4px solid #111;
        }
        .copy-label {
          display: inline-block;
          margin-left: 1mm;
          margin-bottom: 7mm;
          border: 1px solid #b7b7b7;
          border-radius: 999px;
          padding: 2px 10px;
          font-size: 8px;
          color: #777;
          background: #fff;
        }
        .intro-grid {
          display: grid;
          grid-template-columns: 43% 1fr 32%;
          column-gap: 10px;
          align-items: start;
          margin-bottom: 8mm;
        }
        .student-info,
        .receipt-info {
          padding-top: 2px;
        }
        .info-row {
          display: grid;
          grid-template-columns: 29mm 5px 1fr;
          column-gap: 3px;
          min-height: 4mm;
          align-items: baseline;
          font-size: 9px;
          line-height: 1.2;
        }
        .receipt-info .info-row {
          grid-template-columns: 20mm 5px 1fr;
        }
        .info-row span,
        .info-row b {
          font-weight: 400;
          color: #555;
        }
        .info-row strong {
          font-style: normal;
          font-weight: 800;
          color: #111;
          text-transform: uppercase;
        }
        .info-row em {
          font-style: normal;
          color: #111;
        }
        .payment-title {
          text-align: center;
          padding-top: 0;
        }
        .payment-title h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: .08em;
          line-height: 1;
        }
        .payment-title p {
          margin: 5px 0 0;
          color: #777;
          font-size: 8px;
        }
        .terbilang {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 6.8mm;
          border: 1px solid #9a9a9a;
          padding: 0 7px;
          box-sizing: border-box;
          font-size: 9px;
          color: #555;
        }
        .terbilang strong {
          color: #111;
          font-size: 9px;
          font-style: italic;
          font-weight: 800;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .main-table {
          margin-top: 3mm;
          font-size: 8.8px;
        }
        .main-table th {
          background: #111;
          color: #fff;
          padding: 2px 5px;
          border-right: 1px solid #555;
          text-align: left;
          font-weight: 800;
        }
        .main-table th:last-child {
          border-right: 0;
        }
        .main-table td {
          padding: 2px 5px;
          border-bottom: 1px solid #ddd;
        }
        .main-table tfoot td {
          border-top: 2px solid #111;
          border-bottom: 0;
          background: #f1f1f1;
          font-weight: 900;
          text-align: center;
        }
        .no-col {
          width: 10mm;
          text-align: center !important;
        }
        .amount-col {
          width: 36mm;
          text-align: right !important;
          font-family: "Courier New", monospace;
          font-weight: 700;
        }
        .arrears-caption {
          margin: 6mm 0 1mm;
          font-size: 8px;
          font-style: italic;
          color: #666;
        }
        .arrears-table {
          font-size: 8px;
          color: #111;
        }
        .arrears-table th {
          padding: 2px 5px;
          border: 1px solid #ddd;
          background: #f3f3f3;
          text-align: left;
          font-weight: 800;
        }
        .arrears-table td {
          padding: 2px 5px;
          border: 1px solid #eee;
        }
        .total-arrears td {
          background: #fff1f1;
          font-weight: 800;
        }
        .due-zero {
          color: #c00;
        }
        .summary-block {
          display: grid;
          grid-template-columns: 1fr 48mm;
          margin-top: 4mm;
          font-size: 9px;
        }
        .summary-block table td {
          padding: 1px 0;
          border: 0;
        }
        .summary-block table td:nth-child(1) {
          width: 20mm;
        }
        .summary-block table td:nth-child(2) {
          width: 4mm;
          text-align: center;
        }
        .summary-block table td:nth-child(3) {
          font-family: "Courier New", monospace;
          font-weight: 800;
          text-align: right;
        }
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18mm;
          margin-top: 5mm;
          padding: 0 8mm;
          text-align: center;
          font-size: 8.7px;
        }
        .signature-box p {
          height: 15mm;
          margin: 0;
          line-height: 1.25;
        }
        .signature-line {
          border-top: 1px solid #111;
          height: 0;
          margin: 0 auto 2mm;
        }
        .signature-box strong {
          font-size: 8.5px;
          font-weight: 800;
        }
        .receipt-footer {
          position: absolute;
          left: 17mm;
          right: 17mm;
          bottom: 3mm;
          display: grid;
          grid-template-columns: 1fr 1.4fr 1fr;
          gap: 6mm;
          border-top: 1px solid #ddd;
          padding-top: 1mm;
          font-size: 7px;
          color: #999;
        }
        .receipt-footer span:nth-child(2) {
          text-align: center;
        }
        .receipt-footer span:nth-child(3) {
          text-align: right;
        }
        .copy-divider {
          width: 210mm;
          height: 0;
          margin: 0 auto;
          border-top: 1px dashed #9b9b9b;
        }
        .paid-stamp {
          position: absolute;
          right: 43mm;
          bottom: 43mm;
          z-index: 0;
          transform: rotate(-13deg);
          border: 4px double rgba(10, 120, 56, .20);
          border-radius: 7px;
          padding: 5px 18px;
          color: rgba(10, 120, 56, .18);
          font-family: Arial, sans-serif;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: .10em;
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          .receipt-page {
            background: #fff;
            padding: 0;
          }
          .print-actions {
            display: none;
          }
          .receipt-copy {
            margin: 0;
          }
          .copy-divider {
            margin: 0;
          }
        }
      `}</style>
    </main>
  )
}
