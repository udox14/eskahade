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

  const filteredHistory = history.filter(item => {
    if (filter === 'ALL') return true
    if (filter === 'TAGIHAN') return item.category === 'TAGIHAN'
    if (filter === 'UANG_JAJAN') return item.category === 'UANG_JAJAN'
    return false
  })

  return (
    <div className="space-y-4">
      {/* 1. Filter Pills Native (Compact) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 transition active:scale-95 cursor-pointer ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
          }`}
        >
          Semua
        </button>
        <button
          type="button"
          onClick={() => setFilter('TAGIHAN')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 transition active:scale-95 cursor-pointer ${
            filter === 'TAGIHAN'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
          }`}
        >
          Tagihan &amp; USPP
        </button>
        <button
          type="button"
          onClick={() => setFilter('UANG_JAJAN')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 transition active:scale-95 cursor-pointer ${
            filter === 'UANG_JAJAN'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
          }`}
        >
          Uang Jajan
        </button>
        {legacyItems.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter('LEGACY')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 transition active:scale-95 cursor-pointer ${
              filter === 'LEGACY'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Pengajuan Manual ({legacyItems.length})
          </button>
        )}
      </div>

      {/* 2. Native Transaction List: Flat List (Tanpa Card Pembungkus Per Transaksi) */}
      {filter !== 'LEGACY' && (
        <>
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <FileQuestion className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600">
                Belum ada transaksi pada kategori ini.
              </p>
              <Link
                href="/portal-ortu/tagihan"
                className="mt-1 text-xs font-bold text-emerald-700 hover:underline"
              >
                Buka Tagihan
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHistory.map(item => {
                const isPaid = item.status === 'PAID' || item.status === 'COMPLETED'
                const isPending = item.status === 'PENDING'
                const isTopUp = item.type === 'TOPUP'
                const isWithdrawal = item.type === 'WITHDRAWAL'

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3.5 active:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => {
                      if (isPaid && (item.type === 'PAYMENT' || item.type === 'TOPUP')) {
                        setSelectedReceipt(item)
                      }
                    }}
                  >
                    {/* Sisi Kiri: Icon Tile Color-Role & Detail */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center ${
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
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : isWithdrawal ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : isPending ? (
                          <Clock3 className="h-5 w-5" />
                        ) : (
                          <Receipt className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate leading-snug">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                          {formatTanggalId(item.createdAt)}
                          {item.method ? ` · ${item.method}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Sisi Kanan: Nominal & Kuitansi / Status */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <p
                        className={`text-sm font-black font-mono leading-none ${
                          isTopUp ? 'text-cyan-800' : 'text-slate-900'
                        }`}
                      >
                        {isTopUp ? `+${formatRupiah(item.amount)}` : formatRupiah(item.amount)}
                      </p>

                      <div className="mt-1 flex items-center gap-1.5">
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedReceipt(item)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer active:scale-95 transition"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Kuitansi</span>
                          </button>
                        ) : isPending ? (
                          <Link
                            href="/portal-ortu/tagihan"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-700 hover:underline"
                          >
                            <span>Bayar</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
              Daftar pengajuan bukti transfer bank dari periode sebelum pembayaran otomatis diaktifkan.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {legacyItems.map(item => {
              const meta = LEGACY_STATUS_META[item.status]
              const StatusIcon = meta.icon
              const bisaBatal = item.status === 'menunggu_konfirmasi' || item.status === 'ditolak'
              const bisaUpload =
                item.status === 'ditolak' || (item.status === 'menunggu_konfirmasi' && !item.buktiUrl)

              return (
                <div key={item.id} className="py-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {item.kategori === 'SPP' ? 'SPP Bulanan' : 'Non-SPP'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </div>

                  <p className="text-base font-black font-mono text-slate-900">
                    {formatRupiah(item.jumlah)}
                  </p>
                  <p className="text-xs text-slate-600">{item.rincian.join(', ')}</p>
                  <p className="text-[11px] text-slate-400">
                    {item.metode === 'TRANSFER'
                      ? item.bank
                        ? `Transfer · ${item.bank}`
                        : 'Transfer bank'
                      : 'QRIS'}
                    {' · '}Diajukan {formatTanggalId(item.createdAt)}
                  </p>

                  {item.status === 'ditolak' && item.rejectReason && (
                    <p className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-800">
                      <span className="font-bold">Alasan:</span> {item.rejectReason}
                    </p>
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
                              className="flex-1 rounded-xl bg-[#064e3b] hover:bg-[#047857] py-2 text-xs font-bold text-[#bef264] active:scale-95 transition cursor-pointer"
                            >
                              {item.status === 'ditolak' ? 'Upload Ulang Bukti' : 'Upload Bukti'}
                            </button>
                          )}
                          {bisaBatal && (
                            <button
                              type="button"
                              onClick={() => handleCancelLegacy(item.id)}
                              disabled={cancelling === item.id}
                              className="flex-1 rounded-xl bg-rose-50 hover:bg-rose-100 py-2 text-xs font-bold text-rose-700 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
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

      {/* 4. Modal Kuitansi Resmi Sah Pesantren */}
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
