'use client'

// app/dashboard/keuangan/rekonsiliasi/manual-allocation-modal.tsx
// Modal Alokasi Manual Transaksi Unallocated / Tak Bertuan

import React, { useState, useEffect } from 'react'
import {
  X,
  ArrowsSplit,
  CheckCircle,
  Coins,
  Wallet,
  User,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  resolveUnallocatedManualAction,
  getStudentUnpaidObligations,
} from './actions'
import type {
  UnallocatedReconciliationRow,
  ManualAllocationTargetInput,
} from '@/lib/finance/reconciliation-types'

interface ManualAllocationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  item: UnallocatedReconciliationRow | null
}

interface StudentObligationRow {
  id: string
  item_type: string
  period: string
  amount_expected: number
  amount_paid: number
  amount_exempted: number
  remaining: number
}

export default function ManualAllocationModal({
  isOpen,
  onClose,
  onSuccess,
  item,
}: ManualAllocationModalProps) {
  const [obligations, setObligations] = useState<StudentObligationRow[]>([])
  const [isLoadingObligations, setIsLoadingObligations] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, number>>({})
  const [walletAmount, setWalletAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const unallocatedTarget = item?.discrepancy_amount || item?.gross_amount || 0

  useEffect(() => {
    if (isOpen && item?.santri_id) {
      setIsLoadingObligations(true)
      getStudentUnpaidObligations(item.santri_id)
        .then((data) => {
          setObligations(data)
          setAllocations({})
          setWalletAmount(0)
          setNotes(`Alokasi manual transfer Fixed VA: ${item.external_reference || item.payment_number}`)
        })
        .catch(() => toast.error('Gagal mengambil data kewajiban santri.'))
        .finally(() => setIsLoadingObligations(false))
    }
  }, [isOpen, item])

  if (!isOpen || !item) return null

  // Hitung total yang dialokasikan
  const totalAllocated =
    Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0) +
    (walletAmount || 0)
  const remainingToAllocate = unallocatedTarget - totalAllocated

  const handleObligationChange = (obligationId: string, valStr: string, maxQuota: number) => {
    const rawVal = parseInt(valStr.replace(/\D/g, ''), 10) || 0
    const clamped = Math.min(rawVal, maxQuota)
    setAllocations((prev) => ({
      ...prev,
      [obligationId]: clamped,
    }))
  }

  const handleQuickFill = (obligationId: string, remainingQuota: number) => {
    // Alokasikan sisa dana yang masih tersedia hingga kuota tagihan terpenuhi
    const currentThisItem = allocations[obligationId] || 0
    const availableTotal = remainingToAllocate + currentThisItem
    const fillAmount = Math.min(remainingQuota, availableTotal)
    setAllocations((prev) => ({
      ...prev,
      [obligationId]: fillAmount,
    }))
  }

  const handleQuickFillWallet = () => {
    if (remainingToAllocate > 0) {
      setWalletAmount((prev) => prev + remainingToAllocate)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (totalAllocated !== unallocatedTarget) {
      toast.error(
        `Total alokasi (Rp ${totalAllocated.toLocaleString('id-ID')}) harus sama persis dengan nominal transfer tak bertuan (Rp ${unallocatedTarget.toLocaleString('id-ID')}).`
      )
      return
    }

    if (!notes.trim()) {
      toast.error('Catatan resolusi alokasi manual wajib diisi.')
      return
    }

    const payloadAllocations: ManualAllocationTargetInput[] = []

    for (const [oblgId, amt] of Object.entries(allocations)) {
      if (amt > 0) {
        const oblg = obligations.find((o) => o.id === oblgId)
        payloadAllocations.push({
          obligationId: oblgId,
          targetType: 'OBLIGATION',
          itemType: oblg?.item_type || 'SPP',
          amount: amt,
        })
      }
    }

    if (walletAmount > 0) {
      payloadAllocations.push({
        obligationId: null,
        targetType: 'UANG_JAJAN',
        itemType: 'UANG_JAJAN',
        amount: walletAmount,
      })
    }

    setIsSubmitting(true)
    try {
      const res = await resolveUnallocatedManualAction({
        reconciliationItemId: item.id,
        paymentId: item.payment_id,
        santriId: item.santri_id,
        allocations: payloadAllocations,
        resolutionNotes: notes.trim(),
      })

      if (res.success) {
        toast.success(res.message)
        onSuccess()
        onClose()
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat mengeksekusi alokasi manual.')
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ArrowsSplit size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Alokasi Manual Transaksi Belum Dialokasikan
              </h3>
              <p className="text-xs text-slate-500">
                Tentukan peruntukan dana transfer ke pos tagihan santri atau dompet uang jajan
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
            {/* Informasi Identitas Transaksi */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold">
                  <User size={16} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{item.santri_name}</div>
                  <div className="text-[11px] text-slate-500">
                    NIS: {item.nis} • Asrama: {item.asrama || '-'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500">Total Dana Tak Bertuan:</span>
                <div className="text-base font-bold text-amber-700">
                  Rp {unallocatedTarget.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Sisa Dana Status Bar */}
            <div
              className={`flex items-center justify-between rounded-xl p-3 border ${
                remainingToAllocate === 0
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : remainingToAllocate > 0
                  ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Coins size={18} weight="bold" />
                <span className="font-medium">
                  {remainingToAllocate === 0
                    ? 'Dana telah dialokasikan pas 100%.'
                    : remainingToAllocate > 0
                    ? `Sisa dana yang belum dialokasikan: Rp ${remainingToAllocate.toLocaleString('id-ID')}`
                    : `Kelebihan alokasi: Rp ${Math.abs(remainingToAllocate).toLocaleString('id-ID')} (harus pas)`}
                </span>
              </div>
              <span className="font-bold">
                Rp {totalAllocated.toLocaleString('id-ID')} / Rp {unallocatedTarget.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Daftar Pos Tagihan Tertunggak */}
            <div className="space-y-2">
              <span className="font-semibold text-slate-700">
                Pilih Pos Kewajiban / Tagihan Santri
              </span>

              {isLoadingObligations ? (
                <div className="p-4 text-center text-slate-400">Memuat tagihan santri...</div>
              ) : obligations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-500">
                  Santri tidak memiliki tunggakan kewajiban aktif. Anda dapat mengalokasikan seluruh dana ke Uang Jajan di bawah.
                </div>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2.5">
                  {obligations.map((oblg) => {
                    const currentAmt = allocations[oblg.id] || 0
                    return (
                      <div
                        key={oblg.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">
                            {oblg.item_type} ({oblg.period})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Tagihan: Rp {oblg.amount_expected.toLocaleString('id-ID')} • Sisa: Rp{' '}
                            {oblg.remaining.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickFill(oblg.id, oblg.remaining)}
                            className="rounded px-2 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                          >
                            Isi Penuh
                          </button>
                          <input
                            type="text"
                            value={currentAmt > 0 ? `Rp ${currentAmt.toLocaleString('id-ID')}` : ''}
                            onChange={(e) => handleObligationChange(oblg.id, e.target.value, oblg.remaining)}
                            placeholder="Rp 0"
                            className="w-32 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right font-medium text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Opsi Alokasi ke Uang Jajan */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-indigo-600" />
                  <span className="font-semibold text-slate-800">Top-Up ke Saldo Uang Jajan Santri</span>
                </div>
                {remainingToAllocate > 0 && (
                  <button
                    type="button"
                    onClick={handleQuickFillWallet}
                    className="text-[11px] font-medium text-indigo-600 hover:underline"
                  >
                    Alokasikan Seluruh Sisa ({`Rp ${remainingToAllocate.toLocaleString('id-ID')}`})
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  Dana yang dialokasikan ke uang jajan akan langsung menambah saldo dompet santri via mutasi buku besar online.
                </p>
                <input
                  type="text"
                  value={walletAmount > 0 ? `Rp ${walletAmount.toLocaleString('id-ID')}` : ''}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                    setWalletAmount(raw)
                  }}
                  placeholder="Rp 0"
                  className="w-36 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right font-semibold text-indigo-700 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Catatan Resolusi */}
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Catatan / Alasan Alokasi Manual (Audit Trail)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Konfirmasi wali santri via WA bahwa transfer Rp 500.000 diperuntukkan untuk SPP September dan Uang Jajan"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
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
              disabled={isSubmitting || remainingToAllocate !== 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle size={15} />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Alokasi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
