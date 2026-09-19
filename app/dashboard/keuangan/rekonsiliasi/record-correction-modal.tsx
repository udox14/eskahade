'use client'

// app/dashboard/keuangan/rekonsiliasi/record-correction-modal.tsx
// Modal Eksekusi Koreksi Finansial Non-Destruktif (VOID, REVERSAL, REFUND)

import React, { useState, useEffect } from 'react'
import {
  X,
  ArrowCounterClockwise,
  CheckCircle,
  ShieldWarning,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  recordCorrectionAction,
  getPaymentAllocationsForCorrection,
} from './actions'
import type {
  FinanceCorrectionType,
  FinanceCorrectionMethod,
} from '@/lib/finance/reconciliation-types'

interface TargetAllocationRow {
  id: string
  target_type: 'OBLIGATION' | 'UANG_JAJAN'
  item_type: string
  amount: number
  disbursed_amount: number
  distribution_status: string
  remaining_correctable: number
}

interface RecordCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  payment: {
    id: string
    payment_number: string
    gross_amount: number
    channel: string
    santri_name: string
    cash_session_id?: string | null
  } | null
}

export default function RecordCorrectionModal({
  isOpen,
  onClose,
  onSuccess,
  payment,
}: RecordCorrectionModalProps) {
  const [allocations, setAllocations] = useState<TargetAllocationRow[]>([])
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false)
  const [correctionType, setCorrectionType] = useState<FinanceCorrectionType>('VOID')
  const [method, setMethod] = useState<FinanceCorrectionMethod>('CASH')
  const [cashSessionId, setCashSessionId] = useState<string>('')
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && payment?.id) {
      setIsLoadingAllocations(true)
      getPaymentAllocationsForCorrection(payment.id)
        .then((data) => {
          setAllocations(data)
          // Default: isi semua kuota tersisa untuk koreksi penuh
          const initial: Record<string, number> = {}
          data.forEach((d) => {
            initial[d.id] = d.remaining_correctable
          })
          setAmounts(initial)
          setCashSessionId(payment.cash_session_id || '')
        })
        .catch(() => toast.error('Gagal mengambil alokasi pembayaran.'))
        .finally(() => setIsLoadingAllocations(false))
    }
  }, [isOpen, payment])

  if (!isOpen || !payment) return null

  const totalCorrection = Object.values(amounts).reduce((s, v) => s + (v || 0), 0)

  // Evaluasi apakah ada alokasi yang sudah terlanjur disalurkan
  const hasDisbursedTouch = allocations.some((a) => {
    const amt = amounts[a.id] || 0
    const availableUndisbursed = Math.max(0, a.amount - a.disbursed_amount)
    return amt > availableUndisbursed
  })

  const handleAmountChange = (allocId: string, valStr: string, maxQuota: number) => {
    const rawVal = parseInt(valStr.replace(/\D/g, ''), 10) || 0
    const clamped = Math.min(rawVal, maxQuota)
    setAmounts((prev) => ({
      ...prev,
      [allocId]: clamped,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (totalCorrection <= 0) {
      toast.error('Tentukan minimal satu nominal alokasi yang akan dikoreksi.')
      return
    }

    if (!reason.trim()) {
      toast.error('Alasan koreksi finansial wajib diisi.')
      return
    }

    if (correctionType === 'REFUND' && method === 'CASH' && !cashSessionId.trim()) {
      toast.error('Refund tunai wajib menyertakan ID sesi kas aktif.')
      return
    }

    const itemsPayload = Object.entries(amounts)
      .filter(([, amt]) => amt > 0)
      .map(([allocId, amt]) => ({
        allocationId: allocId,
        amount: amt,
      }))

    setIsSubmitting(true)
    try {
      const res = await recordCorrectionAction({
        paymentId: payment.id,
        correctionType,
        method: correctionType === 'REFUND' ? method : null,
        reason: reason.trim(),
        items: itemsPayload,
        cashSessionId: correctionType === 'REFUND' && method === 'CASH' ? cashSessionId.trim() : undefined,
      })

      if (res.success) {
        toast.success(res.message)
        onSuccess()
        onClose()
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat mengeksekusi koreksi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ArrowCounterClockwise size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Koreksi Pembayaran Non-Destruktif
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan Void, Reversal, atau Refund tanpa mengubah histori pembayaran asli
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
            {/* Kartu Identitas Pembayaran */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div>
                <span className="text-[11px] text-slate-500">Target Pembayaran:</span>
                <div className="font-bold text-slate-800">{payment.payment_number}</div>
                <div className="text-[11px] text-slate-600">{payment.santri_name} • {payment.channel}</div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500">Total Nilai Transaksi:</span>
                <div className="text-base font-bold text-slate-800">
                  Rp {payment.gross_amount.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Pilihan Jenis Koreksi */}
            <div>
              <label className="mb-1.5 block font-semibold text-slate-700">
                Jenis Koreksi Finansial
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    type: 'VOID' as const,
                    title: 'VOID',
                    desc: 'Pembatalan pembukuan internal (sebelum tutup buku/penyaluran)',
                  },
                  {
                    type: 'REVERSAL' as const,
                    title: 'REVERSAL',
                    desc: 'Pembalikan mutasi sistem atau saldo dompet santri',
                  },
                  {
                    type: 'REFUND' as const,
                    title: 'REFUND',
                    desc: 'Pengembalian dana riil kepada orang tua / santri',
                  },
                ].map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setCorrectionType(t.type)}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      correctionType === t.type
                        ? 'border-rose-500 bg-rose-50/50 text-rose-950 ring-1 ring-rose-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold">{t.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opsi Metode Pengembalian jika REFUND */}
            {correctionType === 'REFUND' && (
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Metode Pengembalian Uang</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as FinanceCorrectionMethod)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
                  >
                    <option value="CASH">Tunai (Kas Loket)</option>
                    <option value="TRANSFER">Transfer Bank Pesantren</option>
                    <option value="GATEWAY">Payment Gateway Refund</option>
                  </select>
                </div>
                {method === 'CASH' && (
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">ID Sesi Kas Aktif (Loket)</label>
                    <input
                      type="text"
                      value={cashSessionId}
                      onChange={(e) => setCashSessionId(e.target.value)}
                      placeholder="Masukkan ID Sesi Kas Kasir"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Peringatan Keras Jika Menyentuh Dana Telanjur Disalurkan */}
            {hasDisbursedTouch && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <ShieldWarning size={20} className="shrink-0 text-amber-700 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">PERHATIAN: DANA SUDAH TELANJUR DISALURKAN KE VENDOR</span>
                  <p className="mt-0.5">
                    Sebagian atau seluruh alokasi yang Anda koreksi telah disalurkan ke vendor.
                    Sistem <strong>DILARANG</strong> menerapkan pemotongan otomatis (auto-deduct) ke penyaluran periode berikutnya.
                    Transaksi ini otomatis ditandai sebagai <strong>Kasus Pemulihan Dana (Recovery Case)</strong> yang mewajibkan konfirmasi manual dari Bendahara/Vendor.
                  </p>
                </div>
              </div>
            )}

            {/* Rincian Alokasi yang Dikoreksi (Parsial vs Penuh) */}
            <div className="space-y-2">
              <span className="font-semibold text-slate-700">
                Tentukan Alokasi yang Dikoreksi (Mendukung Parsial)
              </span>

              {isLoadingAllocations ? (
                <div className="p-4 text-center text-slate-400">Memuat rincian alokasi...</div>
              ) : allocations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-500">
                  Tidak ada alokasi aktif yang dapat dikoreksi pada pembayaran ini.
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-slate-200 p-2.5">
                  {allocations.map((a) => {
                    const currentAmt = amounts[a.id] || 0
                    const isDisbursed = a.disbursed_amount > 0
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{a.item_type}</span>
                            {isDisbursed && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                Sudah Disalurkan: Rp {a.disbursed_amount.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Total Alokasi: Rp {a.amount.toLocaleString('id-ID')} • Kuota Koreksi: Rp{' '}
                            {a.remaining_correctable.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={currentAmt > 0 ? `Rp ${currentAmt.toLocaleString('id-ID')}` : ''}
                          onChange={(e) => handleAmountChange(a.id, e.target.value, a.remaining_correctable)}
                          placeholder="Rp 0"
                          className="w-32 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right font-medium text-slate-800 focus:border-rose-500 focus:outline-hidden"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Total Koreksi Bar */}
            <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3 font-semibold text-slate-800">
              <span>Total Nilai Koreksi:</span>
              <span className="text-sm font-bold text-rose-700">
                Rp {totalCorrection.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Alasan Koreksi */}
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Alasan Koreksi Finansial (Wajib / Audit Trail)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Kesalahan input jenis tagihan oleh kasir loket / Santri mengajukan pembatalan katering"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalCorrection <= 0}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
            >
              <CheckCircle size={15} />
              <span>{isSubmitting ? 'Memproses...' : `Eksekusi ${correctionType}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
