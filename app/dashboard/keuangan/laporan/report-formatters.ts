// app/dashboard/keuangan/laporan/report-formatters.ts
// Helper format tampilan manusiawi untuk Modul Laporan & Ekspor Keuangan

import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

export function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  const sign = val < 0 ? '-' : ''
  return `${sign}Rp${Math.round(Math.abs(val)).toLocaleString('id-ID')}`
}

export function formatPeriodLabel(period: string | null | undefined): string {
  if (!period) return '—'
  if (period === 'LIFETIME') return 'Sepanjang Masa'
  const match = period.match(/^(\d{4})-(\d{2})$/)
  if (!match) return period
  const [, year, month] = match
  const idx = Number(month) - 1
  return idx >= 0 && idx < 12 ? `${MONTH_NAMES_SHORT[idx]} ${year}` : period
}

export function formatItemCode(code: string): string {
  const key = code.trim()
  if (key === 'UANG_JAJAN') return 'Uang Jajan'
  if (key === 'KOREKSI') return 'Koreksi'
  if (key === 'ALL') return 'Semua Pos'
  return FINANCE_ITEM_LABELS[key as FinanceItemType] || key.replace(/_/g, ' ')
}

export function formatItemsCsv(raw: string | null | undefined): string {
  if (!raw || raw === '-') return '—'
  return raw
    .split(',')
    .map((part) => formatItemCode(part))
    .filter(Boolean)
    .join(', ')
}

/**
 * Mengubah string mentah GROUP_CONCAT seperti:
 * "SPP: Rp500000, UANG_MAKAN: Rp200000, SPP: Rp300000, SPP: Rp300000"
 * menjadi ringkasan teragregasi & terformat:
 * "SPP (3×) Rp1.100.000, Uang Makan Rp200.000"
 */
export function formatAllocationsSummary(raw: string | null | undefined): {
  display: string
  full: string
} {
  if (!raw || raw === 'Uang Jajan / Standalone') {
    return { display: 'Uang Jajan', full: 'Uang Jajan' }
  }

  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const grouped = new Map<string, { label: string; count: number; total: number }>()
  const fullParts: string[] = []

  for (const part of parts) {
    const match = part.match(/^([A-Z0-9_]+)\s*:\s*Rp\s*(-?\d+)$/i)
    if (match) {
      const code = match[1].toUpperCase()
      const amount = Number(match[2])
      const label = formatItemCode(code)
      fullParts.push(`${label} ${formatRupiah(amount)}`)
      const prev = grouped.get(code)
      if (prev) {
        prev.count += 1
        prev.total += amount
      } else {
        grouped.set(code, { label, count: 1, total: amount })
      }
    } else {
      fullParts.push(part)
      const prev = grouped.get(part)
      if (!prev) {
        grouped.set(part, { label: part, count: 1, total: Number.NaN })
      }
    }
  }

  const displayParts = Array.from(grouped.values()).map((entry) => {
    if (Number.isNaN(entry.total)) return entry.label
    return entry.count > 1
      ? `${entry.label} (${entry.count}×) ${formatRupiah(entry.total)}`
      : `${entry.label} ${formatRupiah(entry.total)}`
  })

  return {
    display: displayParts.join(', ') || '—',
    full: fullParts.join(', ') || raw,
  }
}

export function formatRecipientType(type: string): string {
  switch (type) {
    case 'PESANTREN':
    case 'BENDAHARA':
    case 'BENDAHARA_PESANTREN':
      return 'Bendahara Pesantren'
    case 'KATERING':
      return 'Katering'
    case 'LAUNDRY':
      return 'Laundry'
    default:
      return type.replace(/_/g, ' ')
  }
}

export function formatDistributionMethod(method: string): string {
  if (method === 'BRI_QLOLA') return 'BRI QLola'
  if (method === 'MANUAL_TRANSFER' || method === 'TRANSFER') return 'Transfer Manual'
  if (method === 'CASH') return 'Tunai'
  return method.replace(/_/g, ' ')
}

export function formatDistributionStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'DISTRIBUTED':
      return { label: 'Tersalurkan', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'PENDING_APPROVAL':
      return { label: 'Menunggu Approval QLola', className: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'PROCESSING':
      return { label: 'Diproses', className: 'bg-sky-50 text-sky-800 border-sky-200' }
    case 'CANCEL_PENDING':
      return { label: 'Menunggu Pembatalan', className: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'FAILED':
      return { label: 'Gagal', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'REJECTED':
      return { label: 'Ditolak', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'CANCELLED':
      return { label: 'Dibatalkan', className: 'bg-slate-100 text-slate-600 border-slate-200' }
    case 'DRAFT':
      return { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' }
    default:
      return { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

export function formatPaymentChannel(channel: string): { label: string; className: string } {
  switch (channel) {
    case 'BRI':
      return { label: 'BRIVA', className: 'bg-sky-50 text-sky-800 border-sky-200/80' }
    case 'TRANSFER':
      return { label: 'Transfer Manual', className: 'bg-indigo-50 text-indigo-800 border-indigo-200/80' }
    case 'CASH':
      return { label: 'Tunai', className: 'bg-emerald-50 text-emerald-800 border-emerald-200/80' }
    default:
      return { label: channel.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

export function formatPaymentMethod(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Tunai'
    case 'MANUAL_TRANSFER':
    case 'TRANSFER':
      return 'Transfer Manual'
    case 'BRIVA':
    case 'BRI_VA':
    case 'BRI':
      return 'BRIVA'
    default:
      return method.replace(/_/g, ' ')
  }
}

export function formatPaymentStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'SETTLED':
      return { label: 'Settled Bank', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'PAID':
      return { label: 'Diterima', className: 'bg-slate-100 text-slate-700 border-slate-200' }
    case 'VOID':
      return { label: 'Dibatalkan', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'REVERSAL':
      return { label: 'Koreksi', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'REFUND':
      return { label: 'Pengembalian', className: 'bg-amber-50 text-amber-800 border-amber-200' }
    default:
      return { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

export function formatObligationStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'PAID':
      return { label: 'Lunas', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'PARTIALLY_PAID':
      return { label: 'Sebagian', className: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'UNPAID':
      return { label: 'Belum Bayar', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'EXEMPTED':
      return { label: 'Dibebaskan', className: 'bg-sky-50 text-sky-800 border-sky-200' }
    default:
      return { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

export function formatExemptionStatus(status: string): { label: string; className: string } {
  if (status === 'ACTIVE') {
    return { label: 'Aktif', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
  }
  if (status === 'REVOKED') {
    return { label: 'Dicabut', className: 'bg-rose-50 text-rose-700 border-rose-200' }
  }
  return { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' }
}

export function formatWalletMovement(type: string): string {
  switch (type) {
    case 'TOPUP_ONLINE':
      return 'Top-Up Online'
    case 'TOPUP_CASH':
      return 'Setoran Loket'
    case 'WITHDRAWAL_LOKET':
      return 'Tarik Loket'
    case 'WITHDRAWAL_KOLEKTIF':
      return 'Pencairan Kolektif'
    case 'WITHDRAWAL_KOLEKTIF_RETURN':
      return 'Batal Cair (Kembali)'
    case 'ADJUSTMENT':
      return 'Penyesuaian'
    case 'REFUND':
      return 'Pengembalian'
    default:
      return type.replace(/_/g, ' ')
  }
}

export function formatCashSessionStatus(status: string): { label: string; className: string } {
  if (status === 'OPEN') {
    return { label: 'Terbuka', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
  }
  return { label: 'Ditutup', className: 'bg-slate-100 text-slate-700 border-slate-200' }
}

export function formatSettlementStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'SETTLED':
    case 'COMPLETED':
      return { label: 'Settled Bank', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'PENDING':
      return { label: 'Menunggu', className: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'DISCREPANCY':
      return { label: 'Selisih', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    default:
      return { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

export function formatMatchStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'MATCHED':
      return { label: 'Cocok', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'UNALLOCATED':
      return { label: 'Belum Dialokasi', className: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'AMOUNT_MISMATCH':
      return { label: 'Selisih Nominal', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'MISSING_IN_SYSTEM':
      return { label: 'Belum di Sistem', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'MISSING_IN_BANK':
      return { label: 'Belum di Bank', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    default:
      return { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

export function formatResolutionAction(action: string): string {
  switch (action) {
    case 'NONE':
      return 'Belum Ditindaklanjuti'
    case 'MANUAL_ALLOCATION':
      return 'Alokasi Manual'
    case 'IGNORED':
      return 'Diabaikan'
    case 'RESOLVED':
      return 'Selesai'
    case 'AUTO_MATCHED':
      return 'Cocok Otomatis'
    default:
      return action.replace(/_/g, ' ')
  }
}

export function formatCorrectionType(type: string): string {
  switch (type) {
    case 'VOID':
      return 'Pembatalan'
    case 'REVERSAL':
      return 'Pembalikan'
    case 'REFUND':
      return 'Pengembalian'
    default:
      return type.replace(/_/g, ' ')
  }
}
