'use client'

// app/dashboard/keuangan/rekonsiliasi/input-settlement-modal.tsx
// Modal Pencatatan Batch Settlement Bank dari BRI (Fase 8 / BRI-1)

import React, { useState, useMemo } from 'react'
import {
  X,
  Bank,
  CheckCircle,
  Warning,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createSettlementBatchAction } from './actions'
import type { SettlementPaymentCandidate } from '@/lib/finance/reconciliation-types'

interface InputSettlementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  candidates: SettlementPaymentCandidate[]
}

const BANK_OPTIONS = [
  'Bank Syariah Indonesia (BSI)',
  'Bank Rakyat Indonesia (BRI)',
  'Bank Mandiri',
  'Bank Central Asia (BCA)',
  'Bank Muamalat',
  'Bank Jabar Banten (BJB)',
]

export default function InputSettlementModal({
  isOpen,
  onClose,
  onSuccess,
  candidates,
}: InputSettlementModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [settlementDate, setSettlementDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [destinationBank, setDestinationBank] = useState(BANK_OPTIONS[0])
  const [destinationAccount, setDestinationAccount] = useState('7123456789 - Rekening Utama Pesantren')
  const [bankStatementNet, setBankStatementNet] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Hitung ringkasan transaksi terpilih
  const { totalGross, totalFee, totalNet } = useMemo(() => {
    let gross = 0
    let fee = 0
    let net = 0
    const set = new Set(selectedIds)
    for (const c of candidates) {
      if (set.has(c.payment_id)) {
        gross += c.gross_amount
        fee += c.gateway_fee
        net += c.net_amount
      }
    }
    return { totalGross: gross, totalFee: fee, totalNet: net }
  }, [selectedIds, candidates])

  if (!isOpen) return null

  const handleToggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(candidates.map((c) => c.payment_id))
    }
  }

  const handleToggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const expectedNetNum = bankStatementNet
    ? parseInt(bankStatementNet.replace(/\D/g, ''), 10) || totalNet
    : totalNet
  const hasDiscrepancy = expectedNetNum !== totalNet

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0) {
      toast.error('Pilih minimal satu pembayaran untuk dimasukkan ke dalam batch settlement.')
      return
    }

    if (!destinationBank || !destinationAccount.trim()) {
      toast.error('Rekening dan bank tujuan pencairan wajib diisi.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createSettlementBatchAction({
        settlementDate,
        destinationBank,
        destinationAccount: destinationAccount.trim(),
        paymentIds: selectedIds,
        expectedTotalNet: expectedNetNum,
        notes: notes.trim() || undefined,
      })

      if (res.success) {
        toast.success(res.message)
        onSuccess()
        onClose()
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat mencatat settlement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Bank size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Pencatatan Settlement Bank (BRI)
              </h3>
              <p className="text-xs text-slate-500">
                Cocokkan pencairan rekening koran bank dengan pembayaran online berstatus PAID
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {/* Konfigurasi Bank Tujuan */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Tanggal Settlement Bank
                </label>
                <input
                  type="date"
                  value={settlementDate}
                  onChange={(e) => setSettlementDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Bank Tujuan Pencairan
                </label>
                <select
                  value={destinationBank}
                  onChange={(e) => setDestinationBank(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                >
                  {BANK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Nomor & Nama Rekening Bank
                </label>
                <input
                  type="text"
                  value={destinationAccount}
                  onChange={(e) => setDestinationAccount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="Contoh: 7123456789 - Pesantren Sukahideng"
                  required
                />
              </div>
            </div>

            {/* Pemilihan Transaksi Pembayaran */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Pilih Pembayaran Online yang Tercakup ({selectedIds.length} dari {candidates.length})
                </span>
                {candidates.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-xs font-medium text-emerald-600 hover:underline"
                  >
                    {selectedIds.length === candidates.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                )}
              </div>

              {candidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  Tidak ada transaksi pembayaran online yang berstatus belum settlement pada periode ini.
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 text-xs">
                  {candidates.map((c) => {
                    const isChecked = selectedIds.includes(c.payment_id)
                    return (
                      <label
                        key={c.payment_id}
                        className={`flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors ${
                          isChecked ? 'bg-emerald-50/70 text-emerald-950' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleItem(c.payment_id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="font-semibold">{c.santri_name}</span>
                            <span className="ml-1 text-[11px] text-slate-400">({c.nis})</span>
                            <div className="text-[10px] text-slate-500">
                              {c.payment_number} • {c.method} • {c.paid_at.slice(0, 10)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-800">
                            Rp {c.net_amount.toLocaleString('id-ID')}
                          </div>
                          {c.gateway_fee > 0 && (
                            <div className="text-[10px] text-slate-400">
                              Fee: Rp {c.gateway_fee.toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Total Kalkulasi & Input Statement Bank */}
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
              <div>
                <span className="text-[11px] text-slate-500">Total Bruto Pembayaran:</span>
                <p className="text-sm font-semibold text-slate-800">
                  Rp {totalGross.toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Total Fee Gateway:</span>
                <p className="text-sm font-semibold text-slate-600">
                  Rp {totalFee.toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Net Sistem Pesantren:</span>
                <p className="text-sm font-semibold text-emerald-700">
                  Rp {totalNet.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* Pengecekan Selisih Rekening Koran */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nominal Bersih yang Masuk di Rekening Koran Bank (Opsional, kosongkan jika sama persis)
              </label>
              <input
                type="text"
                value={bankStatementNet}
                onChange={(e) => setBankStatementNet(e.target.value)}
                placeholder={`Default: Rp ${totalNet.toLocaleString('id-ID')}`}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
              />
              {hasDiscrepancy && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                  <Warning size={14} className="shrink-0 text-amber-600" />
                  <span>
                    Terdeteksi selisih nominal Rp{' '}
                    {Math.abs(expectedNetNum - totalNet).toLocaleString('id-ID')}. Batch akan ditandai
                    status <strong>DISCREPANCY</strong> dan dicatat ke antrean rekonsiliasi.
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Catatan Settlement (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pencairan BRI Batch Harian tanggal 19/09"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Modal Footer */}
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
              disabled={isSubmitting || selectedIds.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle size={15} />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Batch Settlement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
