'use client'

// Format kuitansi seragam (sama dengan kuitansi Portal Orang Tua → Riwayat).
// Dipakai oleh Riwayat Transaksi dan Penyaluran Dana pada Sistem Keuangan Baru.

import { Download } from 'lucide-react'
import type { DocumentPrintConfig, LetterheadMode, LetterheadProfile } from '@/lib/print/letterhead'

export interface ReceiptRow {
  label: string
  qty?: number
  unitPrice: number
  tax?: string
  amount: number
}

export interface ReceiptSummaryRow {
  label: string
  value: string
  bold?: boolean
}

export interface ReceiptData {
  title: string // judul besar, mis. "Kuitansi Pembayaran"
  fileName: string
  meta: Array<{ label: string; value: string; mono?: boolean }>
  issuer: { name: string; address: string; contact: string }
  party: { title: string; name?: string | null; lines: string[] }
  heroText: string
  rowsHeader?: string // default "Deskripsi Tagihan"
  rows: ReceiptRow[]
  summary: ReceiptSummaryRow[]
  totalLabel: string
  totalValue: string
  footerNote: string
  /** 'full' = Kuantitas/Harga/Pajak (pembayaran); 'simple' = Deskripsi + Jumlah saja */
  variant?: 'full' | 'simple'
  /** Kolom tanda tangan (mis. penyaluran). */
  signatures?: Array<{ role: string; name: string }>
  /** Identitas kop (dari Pengaturan Keuangan → Kop). */
  brand?: { short: string; logoUrl: string; hidden?: boolean }
}

export interface ResolvedReceiptLetterhead {
  mode: LetterheadMode
  profile: LetterheadProfile | null
  config: DocumentPrintConfig | null
}

/**
 * Terapkan Pengaturan Kop ke data kuitansi (sama seperti kuitansi Portal Orang Tua).
 * - brand/logo dari profil kop; mode 'none' menyembunyikan logo+brand.
 * - issuerFromProfile: nama penerbit mengikuti profil (penyaluran); bila false nama
 *   penerbit tetap (Koperasi) dan hanya alamat/kontak yang mengikuti profil.
 * - tanda tangan mengikuti config dokumen (showSignatureBlock + judul).
 */
export function applyLetterhead(
  data: ReceiptData,
  lh: ResolvedReceiptLetterhead | null,
  opts: { issuerFromProfile?: boolean } = {},
): ReceiptData {
  if (!lh) return data
  const profile = lh.profile
  const out: ReceiptData = { ...data }

  const fullName = profile?.institutionName || 'Pondok Pesantren Sukahideng'
  out.brand = {
    short: fullName.toLowerCase().replace(/^(pondok pesantren|pesantren)\s+/i, ''),
    logoUrl: profile?.logoUrl || '/logo.png',
    hidden: lh.mode === 'none',
  }

  out.issuer = {
    name: opts.issuerFromProfile ? fullName : data.issuer.name,
    address: profile?.address || data.issuer.address,
    contact: profile?.contactLine || data.issuer.contact,
  }

  if (out.signatures) {
    if (lh.config?.showSignatureBlock === false) {
      out.signatures = undefined
    } else if (lh.config) {
      const [left, right] = out.signatures
      out.signatures = [
        { ...left, role: lh.config.signatoryTitleLeft?.trim() || left.role },
        { ...right, role: lh.config.signatoryTitleRight?.trim() || right.role },
      ]
    }
  }
  return out
}

export const RECEIPT_ISSUER_PESANTREN = {
  name: 'Pondok Pesantren Sukahideng',
  address: 'Desa Sukarapih, Kec. Sukarame, Tasikmalaya 46461',
  contact: 'kopskhd@gmail.com',
}

export const RECEIPT_ISSUER = {
  name: 'Koperasi Pondok Pesantren Sukahideng',
  address: 'Desa Sukarapih, Kec. Sukarame, Tasikmalaya 46461',
  contact: 'kopskhd@gmail.com',
}

export function formatReceiptRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

export function formatReceiptDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

export function makeReceiptNumber(ref: string): string {
  return `KW-${ref.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || '001'}`
}

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const BRAND_SHORT = 'sukahideng'

function printReceipt(data: ReceiptData) {
  const old = document.getElementById('isolated-receipt-print-frame')
  if (old) old.remove()

  const simple = data.variant === 'simple'
  const rowsHtml = data.rows
    .map((it) =>
      simple
        ? `
        <tr>
          <td style="padding: 12px 8px 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">${esc(it.label)}</td>
          <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a;">${formatReceiptRupiah(it.amount)}</td>
        </tr>`
        : `
        <tr>
          <td style="padding: 12px 8px 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">${esc(it.label)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-family: monospace;">${it.qty ?? 1}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace;">${formatReceiptRupiah(it.unitPrice)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace; color: #64748b;">${esc(it.tax ?? '0%')}</td>
          <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a;">${formatReceiptRupiah(it.amount)}</td>
        </tr>`,
    )
    .join('')

  const sigHtml = (data.signatures ?? [])
    .map(
      (g) => `
      <div style="flex:1; text-align:center;">
        <p style="margin:0; color:#475569;">${esc(g.role)},</p>
        <div style="height:64px;"></div>
        <div style="border-bottom:1px solid #94a3b8; width:70%; margin:0 auto;"></div>
        <p style="margin:4px 0 0; font-weight:bold;">${esc(g.name)}</p>
      </div>`,
    )
    .join('')

  const metaHtml = data.meta
    .map(
      (m) => `
          <div class="meta-row">
            <span class="meta-label">${esc(m.label)}</span>
            <span class="meta-val"${m.mono ? ' style="font-family: monospace;"' : ''}>${esc(m.value)}</span>
          </div>`,
    )
    .join('')

  const summaryHtml = data.summary
    .map(
      (s) => `
            <div class="summary-row"${s.bold ? ' style="font-weight: bold; color: #0f172a;"' : ''}>
              <span>${esc(s.label)}</span>
              <span style="font-family: monospace; color: #0f172a;">${esc(s.value)}</span>
            </div>`,
    )
    .join('')

  const partyHtml = [
    data.party.name
      ? `<p class="address-line" style="font-weight: 600; color: #0f172a;">${esc(data.party.name)}</p>`
      : '',
    ...data.party.lines.map((l) => `<p class="address-line">${esc(l)}</p>`),
  ].join('')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${esc(data.fileName)}</title>
<style>
  @page { size: A4 portrait; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; font-size: 12px; line-height: 1.5; }
  .top-stripe { height: 4px; background-color: #0f172a; width: 100%; margin-bottom: 28px; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .receipt-title { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; margin: 0; color: #0f172a; }
  .brand-box { display: flex; align-items: center; gap: 10px; text-align: left; }
  .brand-name { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; display: block; text-transform: capitalize; line-height: 1.2; }
  .brand-sub { font-size: 11px; color: #64748b; display: block; line-height: 1.2; }
  .brand-logo { width: 44px; height: 44px; object-fit: contain; }
  .meta-list { margin-bottom: 24px; font-size: 12px; }
  .meta-row { display: flex; margin-bottom: 5px; }
  .meta-label { width: 160px; color: #475569; }
  .meta-val { font-weight: 500; color: #0f172a; }
  .address-grid { display: flex; justify-content: space-between; margin-bottom: 36px; font-size: 12px; line-height: 1.45; }
  .address-col { width: 48%; }
  .address-title { font-weight: bold; color: #0f172a; margin: 0 0 4px 0; font-size: 13px; }
  .address-line { color: #334155; margin: 0 0 2px 0; }
  .hero-line { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin: 32px 0 20px 0; }
  .table-items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .table-items th { border-bottom: 2px solid #0f172a; padding: 0 8px 10px 0; font-size: 12px; font-weight: bold; text-align: left; color: #0f172a; }
  .summary-container { display: flex; justify-content: flex-end; margin-top: 10px; }
  .summary-box { width: 300px; }
  .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; }
  .summary-row.total-row { border-top: 2px solid #0f172a; font-weight: 800; font-size: 14px; color: #0f172a; padding: 10px 0; }
  .footer-note { margin-top: 50px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="top-stripe"></div>
  <div class="header-row">
    <div><h1 class="receipt-title">${esc(data.title)}</h1></div>
    ${
      data.brand?.hidden
        ? ''
        : `<div class="brand-box">
      <img class="brand-logo" src="${new URL(data.brand?.logoUrl || '/logo.png', window.location.origin).href}" alt="Logo" />
      <div>
        <span class="brand-sub">Pondok Pesantren</span>
        <span class="brand-name">${esc(data.brand?.short ?? BRAND_SHORT)}</span>
      </div>
    </div>`
    }
  </div>
  <div class="meta-list">${metaHtml}</div>
  <div class="address-grid">
    <div class="address-col">
      <p class="address-title">${esc(data.issuer.name)}</p>
      <p class="address-line">${esc(data.issuer.address)}</p>
      <p class="address-line" style="font-size: 11px; color: #64748b; margin-top: 4px;">${esc(data.issuer.contact)}</p>
    </div>
    <div class="address-col">
      <p class="address-title">${esc(data.party.title)}</p>
      ${partyHtml}
    </div>
  </div>
  <div class="hero-line">${esc(data.heroText)}</div>
  <table class="table-items">
    <thead>
      ${
        simple
          ? `<tr>
        <th style="width: 75%;">${esc(data.rowsHeader ?? 'Deskripsi')}</th>
        <th style="text-align: right; width: 25%; padding-right: 0;">Jumlah</th>
      </tr>`
          : `<tr>
        <th style="width: 50%;">${esc(data.rowsHeader ?? 'Deskripsi Tagihan')}</th>
        <th style="text-align: center; width: 15%;">Kuantitas</th>
        <th style="text-align: right; width: 15%;">Harga Satuan</th>
        <th style="text-align: right; width: 10%;">Pajak</th>
        <th style="text-align: right; width: 15%; padding-right: 0;">Jumlah</th>
      </tr>`
      }
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="summary-container">
    <div class="summary-box">
      ${summaryHtml}
      <div class="summary-row total-row">
        <span>${esc(data.totalLabel)}</span>
        <span style="font-family: monospace;">${esc(data.totalValue)}</span>
      </div>
    </div>
  </div>
  ${sigHtml ? `<div style="display:flex; gap:40px; margin-top:48px; font-size:12px;">${sigHtml}</div>` : ''}
  <div class="footer-note">${esc(data.footerNote)}</div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.focus(); window.print(); }, 250);
    });
  <\/script>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.id = 'isolated-receipt-print-frame'
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] gap-2 items-baseline">
      <span className="text-slate-500 font-normal">{label}</span>
      <span className={`text-slate-900 font-medium ${mono ? 'font-mono select-all' : ''}`}>{value}</span>
    </div>
  )
}

interface FinanceReceiptModalProps {
  data: ReceiptData | null
  subtitle?: string
  onClose: () => void
}

export function FinanceReceiptModal({ data, subtitle, onClose }: FinanceReceiptModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h3 className="font-bold text-sm text-slate-900">{data?.title ?? 'Kuitansi'}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>

        <div className="overflow-y-auto flex-1">
          {!data ? (
            <div className="text-center py-12 text-slate-400 text-sm">Memuat kuitansi...</div>
          ) : (
            <div className="bg-white text-slate-900 p-5 sm:p-7 space-y-6 text-xs">
              <div className="-mx-5 -mt-5 sm:-mx-7 sm:-mt-7 h-1.5 bg-[#0f172a]" />

              <div className="flex items-start justify-between gap-4 pt-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">{data.title}</h2>
                {!data.brand?.hidden && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.brand?.logoUrl || '/logo.png'} alt="Logo" className="h-10 w-10 object-contain shrink-0" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] text-slate-500 font-medium">Pondok Pesantren</span>
                      <span className="font-extrabold text-base text-slate-900 tracking-tight capitalize">{data.brand?.short ?? BRAND_SHORT}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs">
                {data.meta.map((m) => (
                  <Meta key={m.label} {...m} />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-100 text-xs">
                <div className="space-y-0.5 leading-relaxed">
                  <p className="font-bold text-slate-950">{data.issuer.name}</p>
                  <p className="text-slate-600">{data.issuer.address}</p>
                  <p className="text-slate-500 text-[11px] font-mono mt-1">{data.issuer.contact}</p>
                </div>
                <div className="space-y-0.5 leading-relaxed">
                  <p className="font-bold text-slate-950">{data.party.title}</p>
                  {data.party.name && <p className="text-slate-900 font-semibold">{data.party.name}</p>}
                  {data.party.lines.map((l, i) => (
                    <p key={i} className="text-slate-600 text-[11px]">{l}</p>
                  ))}
                </div>
              </div>

              <div className="py-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">{data.heroText}</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-900 font-semibold text-[11px]">
                      <th className="pb-2.5 font-bold w-1/2">{data.rowsHeader ?? 'Deskripsi Tagihan'}</th>
                      {data.variant !== 'simple' && (
                        <>
                          <th className="pb-2.5 font-bold text-center w-16">Kuantitas</th>
                          <th className="pb-2.5 font-bold text-right">Harga Satuan</th>
                          <th className="pb-2.5 font-bold text-right">Pajak</th>
                        </>
                      )}
                      <th className="pb-2.5 font-bold text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                    {data.rows.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-3 pr-2 font-medium text-slate-900 leading-snug">{it.label}</td>
                        {data.variant !== 'simple' && (
                          <>
                            <td className="py-3 px-1 text-center font-mono text-slate-700">{it.qty ?? 1}</td>
                            <td className="py-3 px-1 text-right font-mono text-slate-700">{formatReceiptRupiah(it.unitPrice)}</td>
                            <td className="py-3 px-1 text-right font-mono text-slate-500">{it.tax ?? '0%'}</td>
                          </>
                        )}
                        <td className="py-3 pl-2 text-right font-mono font-bold text-slate-950">{formatReceiptRupiah(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-72 space-y-2 text-xs">
                  {data.summary.map((s) => (
                    <div
                      key={s.label}
                      className={`flex justify-between pt-1.5 border-t border-slate-200 ${
                        s.bold ? 'text-slate-900 font-bold' : 'text-slate-600'
                      }`}
                    >
                      <span>{s.label}</span>
                      <span className="font-mono text-slate-900">{s.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-slate-950 font-extrabold pt-2 pb-1 border-t-2 border-slate-900 text-sm">
                    <span>{data.totalLabel}</span>
                    <span className="font-mono">{data.totalValue}</span>
                  </div>
                </div>
              </div>

              {data.signatures && data.signatures.length > 0 && (
                <div className="flex gap-8 pt-4 text-center">
                  {data.signatures.map((g) => (
                    <div key={g.role} className="flex-1">
                      <p className="text-slate-500">{g.role},</p>
                      <div className="h-16" />
                      <div className="border-b border-slate-400 w-4/5 mx-auto" />
                      <p className="font-bold text-slate-800 mt-1">{g.name}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400">
                <p>{data.footerNote}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={!data}
            onClick={() => data && printReceipt(data)}
            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 px-4 py-2 text-xs font-bold text-[#bef264] transition"
          >
            <Download className="h-4 w-4" />
            <span>Unduh</span>
          </button>
        </div>
      </div>
    </div>
  )
}
