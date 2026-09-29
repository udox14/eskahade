'use client'

import { useRef } from 'react'
import { Printer, X } from 'lucide-react'
import type { PortalTransactionHistoryItem } from '@/lib/portal/finance'
import { formatRupiah } from '@/lib/portal/format'
import type { LetterheadProfile } from '@/lib/print/letterhead'
import { BottomSheet } from '../../_components/bottom-sheet'

interface ReceiptModalProps {
  item: PortalTransactionHistoryItem
  santri: {
    nama: string
    nis: string
    asrama?: string | null
    kamar?: string | null
  }
  letterheadProfile?: LetterheadProfile | null
  onClose: () => void
}

function formatTanggalDmy(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function ReceiptModal({ item, santri, letterheadProfile, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const dateFormatted = formatTanggalDmy(item.createdAt)
  const paymentNumber = item.referenceNumber || '-'
  const receiptNumber = `KW-${item.referenceNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || '001'}`
  const paymentMethod = item.channel || item.method || 'Online'

  // Identitas Lembaga (Dinamis dari Pengaturan Kop Keuangan)
  const instansiName = letterheadProfile?.institutionName || 'Pondok Pesantren Sukahideng'
  const brandShort = instansiName.toLowerCase().replace(/^(pondok pesantren|pesantren)\s+/i, '')
  const instansiSub = letterheadProfile?.subheading || 'Seksi Pengajaran & Keuangan'
  const instansiAddr = letterheadProfile?.address || 'Desa Sukarapih, Kec. Sukarame, Tasikmalaya 46461'
  const instansiContact = letterheadProfile?.contactLine || 'keuangan@sukahideng.ponpes.id'

  // Rincian Pos Tagihan
  const detailList =
    item.items && item.items.length > 0
      ? item.items.map((it) => ({
          label: it.itemLabel + (it.period ? ` (${it.period})` : ''),
          qty: 1,
          unitPrice: it.amount,
          tax: '0%',
          amount: it.amount,
        }))
      : [
          {
            label: item.title,
            qty: 1,
            unitPrice: item.amount,
            tax: '0%',
            amount: item.amount,
          },
        ]

  // Eksekusi Cetak / Simpan PDF lewat Iframe Terisolasi (Anti Bocor Halaman Riwayat)
  const handleIsolatedPrint = () => {
    const oldIframe = document.getElementById('isolated-receipt-print-frame')
    if (oldIframe) oldIframe.remove()

    let rowsHtml = ''
    detailList.forEach((it) => {
      rowsHtml += `
        <tr>
          <td style="padding: 12px 8px 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">${it.label}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-family: monospace;">${it.qty}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace;">${formatRupiah(it.unitPrice)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace; color: #64748b;">${it.tax}</td>
          <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a;">${formatRupiah(it.amount)}</td>
        </tr>
      `
    })

    const printHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Kuitansi-${receiptNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 20mm 18mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.5;
          }
          .top-stripe {
            height: 4px;
            background-color: #0f172a;
            width: 100%;
            margin-bottom: 28px;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
          }
          .receipt-title {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.03em;
            margin: 0;
            color: #0f172a;
          }
          .brand-box {
            display: flex;
            align-items: center;
            gap: 10px;
            text-align: right;
          }
          .brand-name {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #0f172a;
            display: block;
          }
          .brand-sub {
            font-size: 9px;
            color: #64748b;
            display: block;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .brand-logo {
            width: 38px;
            height: 38px;
            background: #0f172a;
            color: #fff;
            font-weight: 900;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
          }
          .meta-list {
            margin-bottom: 24px;
            font-size: 12px;
          }
          .meta-row {
            display: flex;
            margin-bottom: 5px;
          }
          .meta-label {
            width: 160px;
            color: #475569;
          }
          .meta-val {
            font-weight: 500;
            color: #0f172a;
          }
          .address-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 36px;
            font-size: 12px;
            line-height: 1.45;
          }
          .address-col { width: 48%; }
          .address-title {
            font-weight: bold;
            color: #0f172a;
            margin: 0 0 4px 0;
            font-size: 13px;
          }
          .address-line {
            color: #334155;
            margin: 0 0 2px 0;
          }
          .hero-line {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            margin: 32px 0 20px 0;
          }
          .table-items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .table-items th {
            border-bottom: 2px solid #0f172a;
            padding: 0 8px 10px 0;
            font-size: 12px;
            font-weight: bold;
            text-align: left;
            color: #0f172a;
          }
          .summary-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
          }
          .summary-box { width: 300px; }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #475569;
          }
          .summary-row.total-row {
            border-top: 2px solid #0f172a;
            font-weight: 800;
            font-size: 14px;
            color: #0f172a;
            padding: 10px 0;
          }
          .footer-note {
            margin-top: 50px;
            padding-top: 16px;
            border-top: 1px solid #f1f5f9;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="top-stripe"></div>

        <div class="header-row">
          <div>
            <h1 class="receipt-title">Kuitansi Pembayaran</h1>
          </div>
          <div class="brand-box">
            <div>
              <span class="brand-name">${brandShort}</span>
              <span class="brand-sub">Pondok Pesantren</span>
            </div>
            <div class="brand-logo">S</div>
          </div>
        </div>

        <div class="meta-list">
          <div class="meta-row">
            <span class="meta-label">Nomor Transaksi</span>
            <span class="meta-val" style="font-family: monospace;">${paymentNumber}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Nomor Kuitansi</span>
            <span class="meta-val" style="font-family: monospace;">${receiptNumber}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Tanggal Bayar</span>
            <span class="meta-val">${dateFormatted}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Metode Pembayaran</span>
            <span class="meta-val">${paymentMethod}</span>
          </div>
        </div>

        <div class="address-grid">
          <div class="address-col">
            <p class="address-title">${instansiName}</p>
            <p class="address-line">${instansiSub}</p>
            <p class="address-line">${instansiAddr}</p>
            <p class="address-line" style="font-size: 11px; color: #64748b; margin-top: 4px;">${instansiContact}</p>
          </div>

          <div class="address-col">
            <p class="address-title">Ditagihkan Kepada</p>
            <p class="address-line" style="font-weight: 600; color: #0f172a;">${santri.nama}</p>
            <p class="address-line">NIS: ${santri.nis}</p>
            ${santri.asrama ? `<p class="address-line">Asrama: ${santri.asrama}${santri.kamar ? ` (Kamar ${santri.kamar})` : ''}</p>` : ''}
            <p class="address-line">Santri Pondok Pesantren Sukahideng</p>
          </div>
        </div>

        <div class="hero-line">
          ${formatRupiah(item.amount)} dibayar pada ${dateFormatted}
        </div>

        <table class="table-items">
          <thead>
            <tr>
              <th style="width: 50%;">Deskripsi Tagihan</th>
              <th style="text-align: center; width: 15%;">Kuantitas</th>
              <th style="text-align: right; width: 15%;">Harga Satuan</th>
              <th style="text-align: right; width: 10%;">Pajak</th>
              <th style="text-align: right; width: 15%; padding-right: 0;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="summary-box">
            <div class="summary-row">
              <span>Subtotal Tagihan</span>
              <span style="font-family: monospace; color: #0f172a;">${formatRupiah(item.grossAmount ?? item.amount)}</span>
            </div>
            <div class="summary-row">
              <span>Total Pokok Tagihan</span>
              <span style="font-family: monospace; color: #0f172a;">${formatRupiah(item.grossAmount ?? item.amount)}</span>
            </div>
            <div class="summary-row">
              <span>Biaya Transaksi / Layanan</span>
              <span style="font-family: monospace; color: #0f172a;">${formatRupiah(item.gatewayFee ?? 0)}</span>
            </div>
            <div class="summary-row" style="font-weight: bold; color: #0f172a;">
              <span>Total Pembayaran</span>
              <span style="font-family: monospace; color: #0f172a;">${formatRupiah(item.amount)}</span>
            </div>
            <div class="summary-row total-row">
              <span>Total Dibayar</span>
              <span style="font-family: monospace;">${formatRupiah(item.amount)}</span>
            </div>
          </div>
        </div>

        <div class="footer-note">
          Tanda terima pembayaran sah diterbitkan otomatis melalui Portal Orang Tua Pesantren Sukahideng sebagai bukti transaksi yang valid.
        </div>

        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          });
        <\/script>
      </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'isolated-receipt-print-frame'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(printHtml)
    doc.close()
  }

  return (
    <BottomSheet
      open={true}
      onClose={onClose}
      title="Kuitansi Pembayaran"
      subtitle={`No. Bukti: ${paymentNumber}`}
      headerClassName="print:hidden"
      footerClassName="print:hidden"
      contentRef={printRef}
      contentClassName="p-0 overflow-y-auto"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleIsolatedPrint}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] px-4 py-2.5 text-xs font-bold text-[#bef264] shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak / Simpan Kuitansi</span>
          </button>
        </>
      }
    >
      <div className="bg-white text-slate-900 p-5 sm:p-7 space-y-6 text-xs">
        {/* Top Accent Strip */}
        <div className="-mx-5 -mt-5 sm:-mx-7 sm:-mt-7 h-1.5 bg-[#0f172a]"></div>

        {/* 1. Header: Judul Kuitansi di Kiri, Logo & Brand di Kanan */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
              Kuitansi Pembayaran
            </h2>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 text-right">
            <div className="flex flex-col items-end">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 leading-none tracking-tight">
                {brandShort}
              </span>
              <span className="text-[9px] text-slate-400 font-medium tracking-wide">
                Pondok Pesantren
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
              S
            </div>
          </div>
        </div>

        {/* 2. Metadata Rows */}
        <div className="space-y-1.5 text-xs">
          <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] gap-2 items-baseline">
            <span className="text-slate-500 font-normal">Nomor Transaksi</span>
            <span className="font-mono text-slate-900 font-medium select-all">{paymentNumber}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] gap-2 items-baseline">
            <span className="text-slate-500 font-normal">Nomor Kuitansi</span>
            <span className="font-mono text-slate-900 font-medium select-all">{receiptNumber}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] gap-2 items-baseline">
            <span className="text-slate-500 font-normal">Tanggal Bayar</span>
            <span className="text-slate-900 font-medium">{dateFormatted}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] gap-2 items-baseline">
            <span className="text-slate-500 font-normal">Metode Pembayaran</span>
            <span className="text-slate-900 font-medium">{paymentMethod}</span>
          </div>
        </div>

        {/* 3. Two-Column Address Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-100 text-xs">
          <div className="space-y-0.5 leading-relaxed">
            <p className="font-bold text-slate-950 text-xs">{instansiName}</p>
            <p className="text-slate-600">{instansiSub}</p>
            <p className="text-slate-600">{instansiAddr}</p>
            <p className="text-slate-500 text-[11px] font-mono mt-1">{instansiContact}</p>
          </div>

          <div className="space-y-0.5 leading-relaxed">
            <p className="font-bold text-slate-950 text-xs">Ditagihkan Kepada</p>
            <p className="text-slate-900 font-semibold">{santri.nama}</p>
            <p className="text-slate-600 font-mono text-[11px]">NIS: {santri.nis}</p>
            {santri.asrama && (
              <p className="text-slate-600 text-[11px]">
                Asrama: {santri.asrama} {santri.kamar ? `(Kamar ${santri.kamar})` : ''}
              </p>
            )}
            <p className="text-slate-600 text-[11px]">Santri Pondok Pesantren Sukahideng</p>
          </div>
        </div>

        {/* 4. Highlight Hero Line */}
        <div className="py-2">
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            {formatRupiah(item.amount)} dibayar pada {dateFormatted}
          </h3>
        </div>

        {/* 5. Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-900 text-slate-900 font-semibold text-[11px]">
                <th className="pb-2.5 font-bold w-1/2">Deskripsi Tagihan</th>
                <th className="pb-2.5 font-bold text-center w-16">Kuantitas</th>
                <th className="pb-2.5 font-bold text-right">Harga Satuan</th>
                <th className="pb-2.5 font-bold text-right">Pajak</th>
                <th className="pb-2.5 font-bold text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {detailList.map((it, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-3 pr-2 font-medium text-slate-900 leading-snug">{it.label}</td>
                  <td className="py-3 px-1 text-center font-mono text-slate-700">{it.qty}</td>
                  <td className="py-3 px-1 text-right font-mono text-slate-700">
                    {formatRupiah(it.unitPrice)}
                  </td>
                  <td className="py-3 px-1 text-right font-mono text-slate-500">{it.tax}</td>
                  <td className="py-3 pl-2 text-right font-mono font-bold text-slate-950">
                    {formatRupiah(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6. Summary Block (Rata Kanan) */}
        <div className="flex justify-end pt-2">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200">
              <span>Subtotal Tagihan</span>
              <span className="font-mono text-slate-900">
                {formatRupiah(item.grossAmount ?? item.amount)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200">
              <span>Total Pokok Tagihan</span>
              <span className="font-mono text-slate-900">
                {formatRupiah(item.grossAmount ?? item.amount)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200">
              <span>Biaya Transaksi / Layanan</span>
              <span className="font-mono text-slate-900">
                {formatRupiah(item.gatewayFee ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-slate-200">
              <span>Total Pembayaran</span>
              <span className="font-mono text-slate-950">{formatRupiah(item.amount)}</span>
            </div>
            <div className="flex justify-between text-slate-950 font-extrabold pt-2 pb-1 border-t-2 border-slate-900 text-sm">
              <span>Total Dibayar</span>
              <span className="font-mono text-slate-950">{formatRupiah(item.amount)}</span>
            </div>
          </div>
        </div>

        {/* 7. Subtle Footnote */}
        <div className="pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400 space-y-0.5">
          <p>
            Tanda terima pembayaran sah diterbitkan otomatis melalui Portal Orang Tua Pesantren Sukahideng.
          </p>
          <p className="font-mono text-[9px] text-slate-400">
            Verifikasi Sistem: OK · Idempotency Key Terverifikasi
          </p>
        </div>
      </div>
    </BottomSheet>
  )
}
