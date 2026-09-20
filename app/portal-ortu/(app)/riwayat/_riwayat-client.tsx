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
    label: 'Menunggu Konfirmasi',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock3,
  },
  terkonfirmasi: {
    label: 'Terkonfirmasi',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak',
    cls: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: XCircle,
  },
  dibatalkan: {
    label: 'Dibatalkan',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: XCircle,
  },
} as const

interface RiwayatClientProps {
  history: PortalTransactionHistoryItem[]
  santri: {
    nama: string
    nis: string
    asrama?: string | null
    kamar?: string | null
  }
  legacyItems?: LegacyRiwayatItem[]
}

export function RiwayatClient({ history, santri, legacyItems = [] }: RiwayatClientProps) {
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

  // Filter history
  const filteredHistory = history.filter(item => {
    if (filter === 'ALL') return true
    if (filter === 'TAGIHAN') return item.category === 'TAGIHAN'
    if (filter === 'UANG_JAJAN') return item.category === 'UANG_JAJAN'
    return false
  })

  return (
    <div className="space-y-4">
      {/* Tab Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          onClick={() => setFilter('ALL')}
          className={`shrink-0 rounded-lg px-3.5 py-1.5 transition ${
            filter === 'ALL'
              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
          }`}
        >
          Semua Riwayat
        </button>
        <button
          onClick={() => setFilter('TAGIHAN')}
          className={`shrink-0 rounded-lg px-3.5 py-1.5 transition ${
            filter === 'TAGIHAN'
              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
          }`}
        >
          Tagihan & USPP
        </button>
        <button
          onClick={() => setFilter('UANG_JAJAN')}
          className={`shrink-0 rounded-lg px-3.5 py-1.5 transition ${
            filter === 'UANG_JAJAN'
              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
          }`}
        >
          Uang Jajan
        </button>
        {legacyItems.length > 0 && (
          <button
            onClick={() => setFilter('LEGACY')}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 transition ${
              filter === 'LEGACY'
                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
            }`}
          >
            Pengajuan Manual ({legacyItems.length})
          </button>
        )}
      </div>

      {/* Konten History Finansial Terpadu */}
      {filter !== 'LEGACY' && (
        <>
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-8 shadow-xs text-center">
              <FileQuestion className="w-8 h-8 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">
                Belum ada catatan transaksi pada filter ini.
              </p>
              <Link
                href="/portal-ortu/tagihan"
                className="mt-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                Buka Menu Pembayaran Tagihan
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                const isPaid = item.status === 'PAID' || item.status === 'COMPLETED'
                const isPending = item.status === 'PENDING'
                const isTopUp = item.type === 'TOPUP'
                const isWithdrawal = item.type === 'WITHDRAWAL'

                return (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs transition hover:border-slate-300"
                  >
                    {/* Header item */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {isTopUp ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <ArrowDownLeft className="h-4 w-4" />
                          </div>
                        ) : isWithdrawal ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <Receipt className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-slate-900 leading-tight block">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.referenceNumber}
                          </span>
                        </div>
                      </div>

                      {/* Badge status */}
                      <span
                        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : isPending
                            ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                            : 'bg-slate-50 text-slate-700 ring-slate-600/20'
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Lunas
                          </>
                        ) : isPending ? (
                          <>
                            <Clock3 className="w-3 h-3 text-amber-600" />
                            Menunggu Bayar
                          </>
                        ) : (
                          item.status
                        )}
                      </span>
                    </div>

                    {/* Nominal */}
                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <p className={`text-lg font-bold leading-none ${isTopUp ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {isTopUp ? `+ ${formatRupiah(item.amount)}` : formatRupiah(item.amount)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatTanggalId(item.createdAt)}
                          {item.channel ? ` • ${item.channel}` : ''}
                          {item.method ? ` (${item.method})` : ''}
                        </p>
                      </div>

                      {/* Action Cetak Bukti untuk transaksi yang lunas */}
                      {isPaid && (item.type === 'PAYMENT' || item.type === 'TOPUP') && (
                        <button
                          onClick={() => setSelectedReceipt(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition"
                        >
                          <Printer className="h-3.5 w-3.5 text-slate-500" />
                          <span>Kuitansi</span>
                        </button>
                      )}
                    </div>

                    {/* Item Allocations Breakdown */}
                    {item.items && item.items.length > 0 && item.type === 'PAYMENT' && (
                      <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-1.5 text-xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Alokasi Pembayaran:
                        </p>
                        {item.items.map((sub, sIdx) => (
                          <div key={sIdx} className="flex justify-between items-center text-slate-700">
                            <div>
                              <span className="font-semibold">{sub.itemLabel}</span>
                              {sub.period && (
                                <span className="text-[10px] text-slate-400 ml-1.5">
                                  ({sub.period})
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-medium">{formatRupiah(sub.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pending Order Quick Link */}
                    {isPending && (
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <span className="text-xs text-amber-700 font-medium">
                          Segera selesaikan sebelum kedaluwarsa
                        </span>
                        <Link
                          href="/portal-ortu/tagihan"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          <span>Instruksi Bayar</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Konten Riwayat Pengajuan Bukti Lama (Legacy Manual Upload) */}
      {filter === 'LEGACY' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200/70 p-3.5 text-xs text-amber-800">
            <p className="font-bold">Arsip Pengajuan Manual Transfer</p>
            <p className="mt-0.5 text-xs text-amber-700/90">
              Pengajuan manual dengan upload slip transfer bank dari periode transisi sebelum checkout otomatis diaktifkan.
            </p>
          </div>

          {legacyItems.map((item) => {
            const meta = LEGACY_STATUS_META[item.status]
            const StatusIcon = meta.icon
            const bisaBatal = item.status === 'menunggu_konfirmasi' || item.status === 'ditolak'
            const bisaUpload =
              item.status === 'ditolak' || (item.status === 'menunggu_konfirmasi' && !item.buktiUrl)

            return (
              <div
                key={item.id}
                className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {item.kategori === 'SPP' ? 'SPP Bulanan' : 'Non-SPP'}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>

                <p className="mt-3 text-lg font-bold leading-none text-slate-900">
                  {formatRupiah(item.jumlah)}
                </p>
                <p className="mt-1 text-xs text-slate-600">{item.rincian.join(', ')}</p>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {item.metode === 'TRANSFER'
                    ? item.bank
                      ? `Transfer • ${item.bank}`
                      : 'Transfer bank'
                    : 'QRIS'}
                  {' • '}Diajukan {formatTanggalId(item.createdAt)}
                </p>

                {item.status === 'ditolak' && item.rejectReason && (
                  <p className="mt-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs leading-relaxed text-rose-800">
                    <span className="font-bold">Alasan ditolak:</span> {item.rejectReason}
                  </p>
                )}

                {item.status === 'menunggu_konfirmasi' && !item.buktiUrl && (
                  <p className="mt-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800">
                    Bukti pembayaran belum diunggah. Petugas baru bisa memeriksa setelah bukti dikirim.
                  </p>
                )}

                {(bisaUpload || bisaBatal) && (
                  <div className="mt-3.5 space-y-2.5">
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
                            onClick={() => setUploadFor(item.id)}
                            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-semibold text-white active:scale-[0.98] transition shadow-xs"
                          >
                            {item.status === 'ditolak' ? 'Upload Ulang Bukti' : 'Upload Bukti'}
                          </button>
                        )}
                        {bisaBatal && (
                          <button
                            onClick={() => handleCancelLegacy(item.id)}
                            disabled={cancelling === item.id}
                            className="flex-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 py-2.5 text-xs font-semibold text-rose-700 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                          >
                            {cancelling === item.id && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
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
      )}

      {/* Modal Kuitansi Resmi */}
      {selectedReceipt && (
        <ReceiptModal
          item={selectedReceipt}
          santri={santri}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  )
}
