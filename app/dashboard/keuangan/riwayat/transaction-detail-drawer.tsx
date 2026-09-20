'use client'

// app/dashboard/keuangan/riwayat/transaction-detail-drawer.tsx
// Slide-over Drawer untuk Rincian Transaksi Global (Fase 9: PRD Bab 30 & UI/UX Guidelines Bab 43)

import React, { useEffect, useState, useTransition } from 'react'
import {
  X,
  Building,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { TransactionReceiptModal } from '@/components/finance/transaction-receipt-modal'
import { getTransactionDetail } from './actions'
import type { GlobalTransactionRow } from '@/lib/finance/history'

interface TransactionDetailDrawerProps {
  transaction: GlobalTransactionRow | null
  onClose: () => void
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val === 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
  } catch {
    return dateStr
  }
}

export function TransactionDetailDrawer({
  transaction,
  onClose,
}: TransactionDetailDrawerProps) {
  const [detailData, setDetailData] = useState<Awaited<ReturnType<typeof getTransactionDetail>> | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false)

  useEffect(() => {
    if (!transaction) return

    let isMounted = true
    startTransition(async () => {
      try {
        setErrorMessage(null)
        const res = await getTransactionDetail(transaction.id, transaction.sourceTable)
        if (isMounted) setDetailData(res)
      } catch (err) {
        if (isMounted) setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat rincian transaksi.')
      }
    })

    return () => {
      isMounted = false
    }
  }, [transaction])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!transaction) return null

  const isIncoming = transaction.direction === 'IN'
  const isPesantren = transaction.fundType === 'PESANTREN'

  let statusBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200'
  if (transaction.status === 'PAID' || transaction.status === 'SETTLED' || transaction.status === 'COMPLETED') {
    statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  } else if (transaction.status === 'VOID' || transaction.status === 'REFUND' || transaction.status === 'REVERSAL') {
    statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-lg transform bg-white shadow-2xl transition-transform duration-300 ease-in-out">
          <div className="flex h-full flex-col divide-y divide-slate-100 bg-white">
            
            {/* Header Drawer */}
            <div className="bg-slate-50/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900">
                    {transaction.transactionNumber}
                  </span>
                  <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold ${statusBadgeColor}`}>
                    {transaction.status}
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  onClick={onClose}
                >
                  <span className="sr-only">Tutup</span>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span>{transaction.categoryLabel}</span>
                <span>&bull;</span>
                <span>{formatDateDisplay(transaction.createdAt)}</span>
              </div>
            </div>

            {/* Content Body */}
            <div className="relative flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {isPending && (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    <span>Memuat rincian transaksi...</span>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              {!isPending && (
                <>
                  {/* 1. Ringkasan Nominal & Arus Kas */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Nominal Transaksi</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isIncoming ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {isIncoming ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {isIncoming ? 'Dana Masuk' : 'Dana Keluar'}
                      </span>
                    </div>

                    <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
                      {formatRupiah(transaction.amount)}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-200/60 pt-2">
                      <span className="font-medium">Klasifikasi Dana:</span>
                      <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold ${
                        isPesantren ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {isPesantren ? 'Kas Operasional Pesantren' : 'Dana Titipan Santri (Uang Jajan)'}
                      </span>
                    </div>
                  </div>

                  {/* 2. Pihak Terkait (Santri / Vendor / Penerima) */}
                  {(transaction.santriName || transaction.recipientInfo) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {transaction.santriName ? 'Identitas Santri' : 'Pihak Penerima'}
                      </h4>

                      {transaction.santriName ? (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                          <SantriPhotoAvatar
                            src={null}
                            name={transaction.santriName}
                            size="md"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{transaction.santriName}</div>
                            <div className="text-xs text-slate-500">
                              NIS: {transaction.santriNis || '-'} · Asrama: {transaction.santriAsrama || '-'} {transaction.santriKamar ? `/ ${transaction.santriKamar}` : ''}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                          <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                            <Building className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{transaction.recipientInfo}</div>
                            <div className="text-xs text-slate-500">Penyedia Jasa / Unit Tujuan</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Breakdown Alokasi Item (Jika ada) */}
                  {detailData?.allocations && detailData.allocations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Rincian Item / Pos Biaya
                      </h4>

                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                        {detailData.allocations.map((alloc) => (
                          <div key={alloc.id} className="flex items-center justify-between p-3 text-xs bg-white">
                            <div>
                              <span className="font-semibold text-slate-900">{alloc.itemLabel}</span>
                              {alloc.distributionStatus !== 'N/A' && (
                                <div className="text-[11px] text-slate-500">
                                  Status Salur: <span className="font-medium">{alloc.distributionStatus}</span>
                                </div>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-900">
                              {formatRupiah(alloc.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Audit Trail & Metadata Teknis */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Informasi Audit & Kanal
                    </h4>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kanal & Metode:</span>
                        <span className="font-medium text-slate-800">{transaction.channel} ({transaction.method})</span>
                      </div>

                      {detailData?.auditTrail.orderNumber && (
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">No. Order Checkout:</span>
                          <span className="font-mono font-medium text-slate-800">{detailData.auditTrail.orderNumber}</span>
                        </div>
                      )}

                      {transaction.externalReference && (
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Referensi Gateway / Bank:</span>
                          <span className="font-mono text-slate-800 break-all">{transaction.externalReference}</span>
                        </div>
                      )}

                      {detailData?.auditTrail.cashSessionCode && (
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Kode Sesi Kasir:</span>
                          <span className="font-mono font-medium text-blue-700">{detailData.auditTrail.cashSessionCode}</span>
                        </div>
                      )}

                      {detailData?.auditTrail.bankDestination && (
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Rekening Tujuan:</span>
                          <span className="font-medium text-slate-800">
                            {detailData.auditTrail.bankDestination} - {detailData.auditTrail.accountNumber} ({detailData.auditTrail.accountHolder || '-'})
                          </span>
                        </div>
                      )}

                      {detailData?.auditTrail.reason && (
                        <div className="border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500 block mb-0.5">Alasan Koreksi:</span>
                          <span className="font-medium text-rose-800 italic">{detailData.auditTrail.reason}</span>
                        </div>
                      )}

                      {detailData?.auditTrail.approvedBy && (
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Disetujui Oleh:</span>
                          <span className="font-medium text-slate-800">{detailData.auditTrail.approvedBy}</span>
                        </div>
                      )}

                      {transaction.operatorName && (
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Operator / Petugas:</span>
                          <span className="font-medium text-slate-800">{transaction.operatorName}</span>
                        </div>
                      )}

                      {transaction.notes && (
                        <div className="border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500 block mb-0.5">Catatan:</span>
                          <span className="text-slate-700">{transaction.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer Drawer */}
            <div className="bg-slate-50 px-6 py-3.5 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Kuitansi / Bukti</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            {/* Receipt Modal */}
            <TransactionReceiptModal
              isOpen={isReceiptOpen}
              onClose={() => setIsReceiptOpen(false)}
              transaction={transaction}
              detailData={detailData}
            />

          </div>
        </div>
      </div>
    </div>
  )
}
