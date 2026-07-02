import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { guardPage } from '@/lib/auth/guard'
import { getNonSppReceipt } from '../../actions'

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
    BANGUNAN: 'USPP',
    KESEHATAN: 'Biaya Kesehatan',
    EHB: 'Biaya EHB',
    EKSKUL: 'Biaya Ekstrakurikuler',
  }
  return labels[value] ?? value
}

function receiptNumber(receipt: any) {
  return receipt.receipt_no || `NSP-${String(receipt.id || '').slice(0, 8).toUpperCase()}`
}

function ReceiptCopy({ receipt, items, printedAt, sisa = 0 }: { receipt: any; items: any[]; printedAt: string; sisa?: number }) {
  const total = Number(receipt.nominal_bayar || 0)
  const isLunas = total > 0
  const payerName = receipt.nama_lengkap || '________________'
  const officerName = receipt.penerima_nama || 'Bendahara'

  return (
    <section className="receipt-copy">
      {isLunas ? <div className="paid-stamp">LUNAS</div> : null}

      <header className="receipt-header">
        <Image src="/logohitam.png" width={78} height={78} alt="Logo Pesantren Sukahideng" priority />
        <div className="school-heading">
          <h1>KUITANSI PEMBAYARAN</h1>
          <h2>PONDOK PESANTREN SUKAHIDENG</h2>
          <p>Desa Sukarapih Kec. Sukarame Kabupaten Tasikmalaya Jawa Barat 46461</p>
        </div>
      </header>

      <div className="header-rule" />

      <section className="intro-grid">
        <div className="student-info">
          <InfoRow label="Nama Santri" value={payerName} strong />
          <InfoRow label="N I S" value={receipt.nis || '-'} />
          <InfoRow label="Madrasah" value={receipt.sekolah || '-'} />
          <InfoRow label="Asrama / Kamar" value={`${receipt.asrama || '-'} / ${receipt.kamar || '-'}`} />
        </div>

        <div className="payment-title">
          <h3>BUKTI PEMBAYARAN</h3>
          <p>Non-SPP - {receipt.tahun_ajaran_nama || `Tahun Tagihan ${receipt.tahun_tagihan || '-'}`}</p>
        </div>

        <div className="receipt-info">
          <InfoRow label="Nomor Kuitansi" value={receiptNumber(receipt)} strong />
          <InfoRow label="Tanggal Dibayar" value={formatLongDate(receipt.tanggal_bayar)} />
          <InfoRow label="Cara Pembayaran" value="Tunai" />
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
            <td>Non-SPP</td>
            <td className="amount-col due-zero">{rupiah(sisa)}</td>
          </tr>
          <tr className="total-arrears">
            <td>Total Sisa Tunggakan</td>
            <td className="amount-col due-zero">{rupiah(sisa)}</td>
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
          <p>Tasikmalaya, {formatLongDate(receipt.tanggal_bayar)}<br />Bendahara</p>
          <div className="signature-line" />
          <strong>( {officerName} )</strong>
        </div>
      </section>

      <footer className="receipt-footer">
        <span>Dicetak: {formatPrintedAt(printedAt)}</span>
        <span>Dokumen ini sah tanpa tanda tangan basah jika dicetak dari sistem</span>
        <span>NON-SPP</span>
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

export default async function NonSppReceiptPage({ params }: Props) {
  await guardPage('/dashboard/keuangan/non-spp')
  const { id } = await params
  const data = await getNonSppReceipt(id)
  if ('error' in data) return notFound()
  if (data.receipt.psb_receipt_id) redirect(`/dashboard/psb/kuitansi/${data.receipt.psb_receipt_id}`)

  const receipt = data.receipt
  const items = [{ jenis_biaya: receipt.jenis_biaya, nominal_bayar: receipt.nominal_bayar }]
  const printedAt = new Date().toISOString()
  const sisa = data.sisa ?? 0

  return (
    <main className="receipt-page">
      <div className="print-actions">
        <span>Gunakan Ctrl+P untuk mencetak</span>
      </div>
      <ReceiptCopy receipt={receipt} items={items} printedAt={printedAt} sisa={sisa} />
      <script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("load",function(){Promise.all(Array.prototype.map.call(document.images,function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})})).then(function(){setTimeout(function(){window.focus();window.print();},150);});});' }} />
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
          width: 21cm;
          height: 11cm;
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          padding: 3mm 10mm 5.5mm;
          overflow: hidden;
        }
        .receipt-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 14mm;
          text-align: left;
        }
        .receipt-header img {
          width: 13mm;
          height: 13mm;
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
          font-size: 12px;
          font-weight: 700;
          line-height: 1.05;
        }
        .school-heading h2 {
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.1;
        }
        .school-heading p {
          margin-top: 1px;
          font-family: Arial, sans-serif;
          font-size: 7.8px;
          line-height: 1.15;
        }
        .header-rule {
          height: 0;
          margin: 1mm 0 1.5mm;
          border-top: 2px solid #111;
        }
        .intro-grid {
          display: grid;
          grid-template-columns: 42% 1fr 32%;
          column-gap: 7px;
          align-items: start;
          margin-bottom: 2mm;
        }
        .student-info,
        .receipt-info {
          padding-top: 0;
        }
        .info-row {
          display: grid;
          grid-template-columns: 25mm 4px 1fr;
          column-gap: 2px;
          min-height: 3.2mm;
          align-items: baseline;
          font-size: 8px;
          line-height: 1.12;
        }
        .receipt-info .info-row {
          grid-template-columns: 17mm 4px 1fr;
        }
        .info-row span,
        .info-row b {
          font-weight: 400;
          color: #555;
        }
        .info-row strong {
          font-style: normal;
          font-weight: 700;
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
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .08em;
          line-height: 1;
        }
        .payment-title p {
          margin: 3px 0 0;
          color: #777;
          font-size: 7px;
        }
        .terbilang {
          display: flex;
          align-items: center;
          gap: 5px;
          min-height: 4.8mm;
          border: 1px solid #9a9a9a;
          padding: 1px 5px;
          box-sizing: border-box;
          font-size: 7.8px;
          color: #555;
        }
        .terbilang strong {
          color: #111;
          font-size: 7.8px;
          font-style: italic;
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .main-table {
          margin-top: 1.6mm;
          font-size: 7.8px;
        }
        .main-table th {
          background: #111;
          color: #fff;
          padding: 1.5px 4px;
          border-right: 1px solid #555;
          text-align: left;
          font-weight: 700;
        }
        .main-table th:last-child {
          border-right: 0;
        }
        .main-table td {
          padding: 1.5px 4px;
          border-bottom: 1px solid #ddd;
        }
        .main-table tfoot td {
          border-top: 2px solid #111;
          border-bottom: 0;
          background: #f1f1f1;
          font-weight: 700;
          text-align: center;
        }
        .no-col {
          width: 8mm;
          text-align: center !important;
        }
        .amount-col {
          width: 32mm;
          text-align: right !important;
          font-family: "Courier New", monospace;
          font-weight: 700;
        }
        .arrears-caption {
          margin: 2mm 0 .8mm;
          font-size: 7.2px;
          font-style: italic;
          color: #666;
        }
        .arrears-table {
          font-size: 7.2px;
          color: #111;
        }
        .arrears-table th {
          padding: 1.4px 4px;
          border: 1px solid #ddd;
          background: #f3f3f3;
          text-align: left;
          font-weight: 700;
        }
        .arrears-table td {
          padding: 1.4px 4px;
          border: 1px solid #eee;
        }
        .total-arrears td {
          background: #fff1f1;
          font-weight: 700;
        }
        .due-zero {
          color: #c00;
        }
        .summary-block {
          display: grid;
          grid-template-columns: 1fr 44mm;
          margin-top: 1.7mm;
          font-size: 7.8px;
        }
        .summary-block table td {
          padding: .5px 0;
          border: 0;
        }
        .summary-block table td:nth-child(1) {
          width: 18mm;
        }
        .summary-block table td:nth-child(2) {
          width: 3mm;
          text-align: center;
        }
        .summary-block table td:nth-child(3) {
          font-family: "Courier New", monospace;
          font-weight: 700;
          text-align: right;
        }
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14mm;
          margin-top: 2mm;
          padding: 0 12mm;
          text-align: center;
          font-size: 7.7px;
        }
        .signature-box p {
          height: 8.5mm;
          margin: 0;
          line-height: 1.25;
        }
        .signature-line {
          border-top: 1px solid #111;
          height: 0;
          margin: 0 auto 1mm;
        }
        .signature-box strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 7.4px;
          font-weight: 700;
        }
        .receipt-footer {
          position: absolute;
          left: 10mm;
          right: 10mm;
          bottom: 2mm;
          display: grid;
          grid-template-columns: 1fr 1.4fr 1fr;
          gap: 4mm;
          border-top: 1px solid #ddd;
          padding-top: .7mm;
          font-size: 6.4px;
          color: #999;
        }
        .receipt-footer span:nth-child(2) {
          text-align: center;
        }
        .receipt-footer span:nth-child(3) {
          text-align: right;
        }
        .paid-stamp {
          position: absolute;
          right: 34mm;
          bottom: 40mm;
          z-index: 0;
          transform: rotate(-13deg);
          border: 3px double rgba(10, 120, 56, .16);
          border-radius: 7px;
          padding: 4px 16px;
          color: rgba(10, 120, 56, .14);
          font-family: Arial, sans-serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: .10em;
          pointer-events: none;
        }
        @page {
          size: 21cm 11cm;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-page {
            background: #fff !important;
            padding: 0 !important;
            min-height: 0 !important;
          }
          .print-actions {
            display: none !important;
          }
          .receipt-copy {
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </main>
  )
}
