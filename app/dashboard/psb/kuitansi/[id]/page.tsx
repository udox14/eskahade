import Image from 'next/image'
import { notFound } from 'next/navigation'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getPsbReceipt } from '../../actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

import { PsbReceiptCopy } from '../../psb-receipt-copy'

export default async function PsbReceiptPage({ params }: Props) {
  const { id } = await params
  const data = await getPsbReceipt(id)
  if ('error' in data) return notFound()

  const { receipt, items, sisa } = data
  const printedAt = new Date().toISOString()

  return (
    <main className="receipt-page">
      <div className="print-actions">
        <span>Gunakan Ctrl+P untuk mencetak</span>
      </div>
      <PsbReceiptCopy receipt={receipt} items={items} printedAt={printedAt} sisa={sisa} />
      <script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("load",function(){Promise.all(Array.prototype.map.call(document.images,function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})})).then(function(){setTimeout(function(){window.focus();window.print();},150);});});' }} />
      <style>{`
        .receipt-page {
          min-height: 100vh;
          background: #fff;
          padding: 14px 0;
          color: #000;
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
          border: 1px solid #000;
          border-radius: 4px;
          background: #fff;
          padding: 5px 9px;
          font-size: 11px;
          color: #000;
        }
        .receipt-copy {
          position: relative;
          width: 24cm;
          height: 13.7cm;
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          padding: 3mm 10mm 4mm;
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
          font-size: 14px;
          font-weight: 700;
          line-height: 1.05;
        }
        .school-heading h2 {
          font-family: Arial, sans-serif;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.1;
        }
        .school-heading p {
          margin-top: 1px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.15;
        }
        .header-rule {
          height: 0;
          margin: .6mm 0 1mm;
          border-top: 2px solid #000;
        }
        .intro-grid {
          display: grid;
          grid-template-columns: 42% 1fr 32%;
          column-gap: 7px;
          align-items: start;
          margin-bottom: .8mm;
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
          font-size: 11.5px;
          line-height: 1.12;
        }
        .receipt-info .info-row {
          grid-template-columns: 17mm 4px 1fr;
        }
        .info-row span,
        .info-row b {
          font-weight: 400;
          color: #000;
        }
        .info-row strong {
          font-style: normal;
          font-weight: 700;
          color: #000;
          text-transform: uppercase;
        }
        .info-row em {
          font-style: normal;
          color: #000;
        }
        .payment-title {
          text-align: center;
          padding-top: 0;
        }
        .payment-title h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: .08em;
          line-height: 1;
        }
        .payment-title p {
          margin: 3px 0 0;
          color: #000;
          font-size: 10px;
        }
        .terbilang {
          display: flex;
          align-items: center;
          gap: 5px;
          min-height: 3.2mm;
          border: 1px solid #000;
          padding: 1px 5px;
          box-sizing: border-box;
          font-size: 11px;
          color: #000;
        }
        .terbilang strong {
          color: #000;
          font-size: 11px;
          font-style: italic;
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .main-table {
          margin-top: .6mm;
          font-size: 11px;
        }
        .main-table th {
          background: #000;
          color: #fff;
          padding: 1px 4px;
          border-right: 1px solid #fff;
          text-align: left;
          font-weight: 700;
        }
        .main-table th:last-child {
          border-right: 0;
        }
        .main-table td {
          padding: 1px 4px;
          border-bottom: 1px dashed #000;
        }
        .main-table tfoot td {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          background: transparent;
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
          margin: .8mm 0 .4mm;
          font-size: 10.2px;
          font-style: italic;
          color: #000;
        }
        .arrears-table {
          font-size: 10.2px;
          color: #000;
        }
        .arrears-table th {
          padding: 1px 4px;
          border: 1px solid #000;
          background: transparent;
          text-align: left;
          font-weight: 700;
        }
        .arrears-table td {
          padding: 1px 4px;
          border: 1px solid #000;
        }
        .total-arrears td {
          background: transparent;
          font-weight: 700;
        }
        .due-zero {
          color: #000;
        }
        .summary-block {
          display: grid;
          grid-template-columns: 1fr 44mm;
          margin-top: .5mm;
          font-size: 11px;
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
          margin-top: .3mm;
          padding: 0 12mm;
          text-align: center;
          font-size: 11px;
        }
        .signature-box p {
          height: 4.5mm;
          margin: 0;
          line-height: 1.25;
        }
        .signature-line {
          width: 32mm;
          border-top: 1px solid #000;
          height: 0;
          margin: 0 auto 1mm;
        }
        .signature-box strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10.5px;
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
          border-top: 1px dashed #000;
          padding-top: .7mm;
          font-size: 8px;
          color: #000;
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
          border: 3px double #000;
          border-radius: 7px;
          padding: 4px 16px;
          color: #000;
          font-family: Arial, sans-serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: .10em;
          pointer-events: none;
          opacity: 0.15;
        }
        @page {
          size: 24cm 13.7cm landscape;
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
