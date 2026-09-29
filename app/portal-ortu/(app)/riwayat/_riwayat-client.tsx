'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock3,
  FileQuestion,
  Loader2,
  XCircle,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  ChevronRight,
} from 'lucide-react'
import { formatRupiah, formatTanggalId } from '@/lib/portal/format'
import type { PortalTransactionHistoryItem } from '@/lib/portal/finance'
import type { LetterheadProfile } from '@/lib/print/letterhead'
import { cancelSubmission } from '../tagihan/actions'
import { UploadBukti } from '../tagihan/_upload-bukti'
import { ReceiptModal } from './_receipt-modal'

export type LegacyRiwayatItem = {
  id: string
  kategori: 'SPP' | 'NON_SPP'
  rincian: string[]
  jumlah: number
  metode: 'TRANSFER' | 'QRIS'
  bank: string | null
  buktiUrl: string | null
  status: 'menunggu_konfirmasi' | 'terkonfirmasi' | 'ditolak' | 'dibatalkan'
  rejectReason: string | null
  createdAt: string
}

const LEGACY_STATUS_META = {
  menunggu_konfirmasi: {
    label: 'Menunggu',
    cls: 'bg-amber-100 text-amber-800',
    icon: Clock3,
  },
  terkonfirmasi: {
    label: 'Terkonfirmasi',
    cls: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak',
    cls: 'bg-rose-100 text-rose-800',
    icon: XCircle,
  },
  dibatalkan: {
    label: 'Dibatalkan',
    cls: 'bg-slate-100 text-slate-600',
    icon: XCircle,
  },
} as const

function formatPortalStatus(status: string): string {
  switch (status) {
    case 'PAID':
    case 'COMPLETED':
      return 'Lunas'
    case 'PENDING':
      return 'Menunggu Bayar'
    case 'EXPIRED':
      return 'Kedaluwarsa'
    case 'CANCELLED':
      return 'Dibatalkan'
    default:
      return status
  }
}

function formatTanggalDmy(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function getMonthYearHeader(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Lainnya'
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

interface RiwayatClientProps {
  history: PortalTransactionHistoryItem[]
  santri: {
    nama: string
    nis: string
    asrama?: string | null
    kamar?: string | null
  }
  letterheadProfile?: LetterheadProfile | null
  legacyItems?: LegacyRiwayatItem[]
  loadError?: boolean
}

export function RiwayatClient({
  history,
  santri,
  letterheadProfile,
  legacyItems = [],
  loadError = false,
}: RiwayatClientProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'ALL' | 'TAGIHAN' | 'UANG_JAJAN' | 'LEGACY'>('ALL')
  const [selectedReceipt, setSelectedReceipt] = useState<PortalTransactionHistoryItem | null>(null)
  const [uploadFor, setUploadFor] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function handleCancelLegacy(id: string) {
    if (cancelling) return
    if (!window.confirm('Batalkan pengajuan ini? Anda bisa membuat pengajuan baru setelahnya.')) return
    setCancelling(id)
    const res = await cancelSubmission(id)
    setCancelling(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Pengajuan dibatalkan.')
    router.refresh()
  }

  const filteredHistory = history.filter((item) => {
    if (filter === 'ALL') return true
    if (filter === 'TAGIHAN') return item.category === 'TAGIHAN'
    if (filter === 'UANG_JAJAN') return item.category === 'UANG_JAJAN'
    return false
  })

  // Grouping riwayat berdasarkan Bulan & Tahun
  const groupedHistory = filteredHistory.reduce<Record<string, PortalTransactionHistoryItem[]>>(
    (acc, item) => {
      const groupKey = getMonthYearHeader(item.createdAt)
      if (!acc[groupKey]) acc[groupKey] = []
      acc[groupKey].push(item)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-4">
      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Sebagian riwayat belum dapat dimuat.</p>
          <p className="mt-1">Coba muat ulang untuk melihat data terbaru.</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 min-h-11 font-bold text-amber-900 underline underline-offset-2"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* 1. Segmented Filter Control */}
      <nav
        aria-label="Filter Kategori Riwayat"
        className="p-1 rounded-2xl bg-slate-100/90 flex gap-1 text-xs font-bold text-slate-500"
      >
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`flex-1 min-h-[38px] rounded-xl font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center ${
            filter === 'ALL'
              ? 'bg-white text-slate-950 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Semua
        </button>
        <button
          type="button"
          onClick={() => setFilter('TAGIHAN')}
          className={`flex-1 min-h-[38px] rounded-xl font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center ${
            filter === 'TAGIHAN'
              ? 'bg-white text-slate-950 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Tagihan
        </button>
        <button
          type="button"
          onClick={() => setFilter('UANG_JAJAN')}
          className={`flex-1 min-h-[38px] rounded-xl font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center ${
            filter === 'UANG_JAJAN'
              ? 'bg-white text-slate-950 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Uang Jajan
        </button>
        {legacyItems.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter('LEGACY')}
            className={`flex-1 min-h-[38px] rounded-xl font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'LEGACY'
                ? 'bg-white text-slate-950 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Manual</span>
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 font-bold">
              {legacyItems.length}
            </span>
          </button>
        )}
      </nav>

      {/* 2. Daftar Transaksi Riwayat Berdasarkan Grup Bulan */}
      {filter !== 'LEGACY' && (
        <>
          {filteredHistory.length === 0 && !loadError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200/60">
                <FileQuestion className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">Belum ada riwayat transaksi</p>
              <p className="text-xs text-slate-500">Tidak ada transaksi pada kategori yang dipilih.</p>
              <Link
                href="/portal-ortu/tagihan"
                className="pt-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Lihat Tagihan Aktif &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedHistory).map(([monthYear, items]) => (
                <div key={monthYear} className="space-y-2">
                  <div className="px-1 pt-2">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">{monthYear}</h2>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    {items.map((item) => {
                      const isPaid = item.status === 'PAID' || item.status === 'COMPLETED'
                      const isPending = item.status === 'PENDING'
                      const isTopUp = item.type === 'TOPUP'
                      const isWithdrawal = item.type === 'WITHDRAWAL'
                      const dateStr = formatTanggalDmy(item.createdAt)

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isPaid && (item.type === 'PAYMENT' || item.type === 'TOPUP')) {
                              setSelectedReceipt(item)
                            }
                          }}
                          className={`p-3.5 flex items-center justify-between gap-3 transition ${
                            isPaid && (item.type === 'PAYMENT' || item.type === 'TOPUP')
                              ? 'cursor-pointer hover:bg-slate-50/70 active:bg-slate-50'
                              : ''
                          }`}
                        >
                          {/* Sisi Kiri: Icon Tile Color-Role & Detail */}
                          <div className="flex items-center gap-3 min-w-0 pr-1">
                            <div
                              className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
                                isTopUp
                                  ? 'bg-cyan-50 text-cyan-700'
                                  : isWithdrawal
                                  ? 'bg-slate-100 text-slate-700'
                                  : isPending
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isTopUp ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : isWithdrawal ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : isPending ? (
                                <Clock3 className="h-4 w-4" />
                              ) : (
                                <Receipt className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-snug">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500 truncate mt-0.5 font-medium font-mono">
                                {dateStr}
                                {item.method ? ` · ${item.method}` : item.channel ? ` · ${item.channel}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Sisi Kanan: Nominal & Kuitansi / Status */}
                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <p
                              className={`text-xs sm:text-sm font-bold font-mono leading-none ${
                                isTopUp ? 'text-cyan-800' : 'text-slate-950'
                              }`}
                            >
                              {isTopUp
                                ? `+${formatRupiah(item.amount)}`
                                : isWithdrawal
                                ? `-${formatRupiah(item.amount)}`
                                : formatRupiah(item.amount)}
                            </p>

                            <div className="flex items-center gap-1.5">
                              {isPaid && (item.type === 'PAYMENT' || item.type === 'TOPUP') ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedReceipt(item)
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer active:scale-95 transition"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Kuitansi</span>
                                </button>
                              ) : isPending ? (
                                <Link
                                  href="/portal-ortu/tagihan"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-700 hover:underline"
                                >
                                  <span>Bayar</span>
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              ) : (
                                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                                  {formatPortalStatus(item.status)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 3. Pengajuan Bukti Transfer Manual (Legacy Section) */}
      {filter === 'LEGACY' && (
        <div className="space-y-3 pt-1">
          <div className="rounded-2xl bg-amber-50/70 p-3.5 text-xs text-amber-900 border border-amber-200/50">
            <p className="font-bold">Arsip Pengajuan Manual</p>
            <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
              Daftar pengajuan bukti transfer bank dari periode sebelum pembayaran online otomatis diaktifkan.
            </p>
          </div>

          <div className="space-y-2.5">
            {legacyItems.map((item) => {
              const meta = LEGACY_STATUS_META[item.status]
              const StatusIcon = meta.icon
              const bisaBatal = item.status === 'menunggu_konfirmasi' || item.status === 'ditolak'
              const bisaUpload =
                item.status === 'ditolak' || (item.status === 'menunggu_konfirmasi' && !item.buktiUrl)

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {item.kategori === 'SPP' ? 'SPP Bulanan' : 'Non-SPP'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </div>

                  <div>
                    <p className="text-base font-bold font-mono text-slate-950">
                      {formatRupiah(item.jumlah)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{item.rincian.join(', ')}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium font-mono">
                      {item.metode === 'TRANSFER'
                        ? item.bank
                          ? `Transfer · ${item.bank}`
                          : 'Transfer bank'
                        : 'QRIS'}
                      {' · '}Diajukan {formatTanggalId(item.createdAt)}
                    </p>
                  </div>

                  {item.status === 'ditolak' && item.rejectReason && (
                    <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-900 border border-red-200/80 space-y-1">
                      <span className="font-bold text-red-800 block text-[11px]">Alasan Penolakan:</span>
                      <p className="text-xs text-red-700 leading-relaxed">{item.rejectReason}</p>
                    </div>
                  )}

                  {item.status === 'menunggu_konfirmasi' && !item.buktiUrl && (
                    <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">
                      Bukti transfer belum diunggah.
                    </p>
                  )}

                  {(bisaUpload || bisaBatal) && (
                    <div className="pt-1">
                      {bisaUpload && uploadFor === item.id ? (
                        <UploadBukti
                          submissionId={item.id}
                          buttonLabel={
                            item.status === 'ditolak' ? 'Kirim Ulang Bukti' : 'Kirim Bukti Pembayaran'
                          }
                          onDone={() => {
                            setUploadFor(null)
                            router.refresh()
                          }}
                        />
                      ) : (
                        <div className="flex gap-2">
                          {bisaUpload && (
                            <button
                              type="button"
                              onClick={() => setUploadFor(item.id)}
                              className="flex-1 rounded-xl bg-[#064e3b] hover:bg-[#047857] py-2 text-xs font-bold text-[#bef264] active:scale-95 transition cursor-pointer min-h-[38px]"
                            >
                              {item.status === 'ditolak' ? 'Upload Ulang Bukti' : 'Upload Bukti'}
                            </button>
                          )}
                          {bisaBatal && (
                            <button
                              type="button"
                              onClick={() => handleCancelLegacy(item.id)}
                              disabled={cancelling === item.id}
                              className="flex-1 rounded-xl bg-rose-50 hover:bg-rose-100 py-2 text-xs font-bold text-rose-700 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition min-h-[38px] border border-rose-200"
                            >
                              {cancelling === item.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Batalkan
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. Modal Kuitansi Resmi Modern Sah */}
      {selectedReceipt && (
        <ReceiptModal
          item={selectedReceipt}
          santri={santri}
          letterheadProfile={letterheadProfile}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  )
}
