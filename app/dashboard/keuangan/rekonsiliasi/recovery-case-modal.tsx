'use client'

// app/dashboard/keuangan/rekonsiliasi/recovery-case-modal.tsx
// Modal Penyelesaian Kasus Pemulihan Dana (Recovery Case)

import React, { useState } from 'react'
import { X, CheckCircle, ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { resolveRecoveryCaseAction } from './actions'
import type { FinanceCorrection } from '@/lib/finance/reconciliation-types'

interface RecoveryCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  recoveryCase: (FinanceCorrection & {
    payment_number: string
    santri_name: string
    nis: string
  }) | null
}

export default function RecoveryCaseModal({
  isOpen,
  onClose,
  onSuccess,
  recoveryCase,
}: RecoveryCaseModalProps) {
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !recoveryCase) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notes.trim()) {
      toast.error('Catatan penyelesaian klaim pemulihan dana wajib disertakan.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await resolveRecoveryCaseAction({
        correctionId: recoveryCase.id,
        notes: notes.trim(),
      })

      if (res.success) {
        toast.success(res.message)
        onSuccess()
        onClose()
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Gagal menyelesaikan kasus pemulihan dana.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ShieldCheck size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Penyelesaian Kasus Pemulihan Dana
              </h3>
              <p className="text-xs text-slate-500">
                Konfirmasi manual pengembalian dana dari vendor/bendahara
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

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Koreksi:</span>
                <span className="font-semibold text-slate-800">{recoveryCase.correction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Pembayaran:</span>
                <span className="font-semibold text-slate-800">{recoveryCase.payment_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Santri:</span>
                <span className="font-semibold text-slate-800">
                  {recoveryCase.santri_name} ({recoveryCase.nis})
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-700">Nominal yang Di-recover:</span>
                <span className="font-bold text-indigo-700 text-sm">
                  Rp {recoveryCase.recovery_amount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-blue-900 leading-relaxed">
              Kasus ini telah diamankan dari auto-deduct. Tandai <strong>RECOVERED</strong> apabila pihak vendor telah menyetorkan kembali dana fisik/transfer ke kas pesantren, atau telah dibuatkan kesepakatan tertulis resmi.
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Catatan Hasil Investigasi / Bukti Pengembalian (Wajib)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Vendor Katering telah mentransfer balik dana Rp 400.000 ke rekening BSI pesantren pada tanggal 19/09 (Ref: TRF9988)"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

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
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <CheckCircle size={15} />
              <span>{isSubmitting ? 'Menyimpan...' : 'Tandai Selesai (RECOVERED)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
