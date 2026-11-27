'use client'

// app/dashboard/keuangan/riwayat/transaction-detail-drawer.tsx
// Slide-over Drawer untuk Rincian Transaksi Global (PRD Bab 30 & UI/UX Guidelines Bab 43)

import React, { useEffect, useState, useTransition } from 'react'
import {
  X,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  RefreshCw,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { TransactionReceiptModal } from '@/components/finance/transaction-receipt-modal'
import { formatFinanceDate } from '@/lib/finance/date-format'
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

function formatReferenceShort(rawRef: string, category: GlobalTransactionRow['category']): string {
  if (!rawRef) return '-'
  const trimmed = rawRef.trim()
  if (trimmed.startsWith('LOKET_DEPOSIT:')) {
    const shortId = (trimmed.split(':')[1] || '').replace(/-/g, '').slice(0, 6).toUpperCase()
    return shortId ? `LOKET-${shortId}` : 'LOKET-SETOR'
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    const prefix = category === 'WITHDRAWAL' ? 'WDR' : category === 'TOPUP' ? 'TOP' : 'REF'
    return `${prefix}-${trimmed.slice(0, 8).toUpperCase()}`
  }
  return trimmed.length > 26 ? `${trimmed.slice(0, 23)}…` : trimmed
}

function formatMethodLabel(method?: string | null, channel?: string | null): string {
  const raw = method || channel || ''
  switch (raw) {
    case 'CASH':
      return 'Tunai'
    case 'MANUAL_TRANSFER':
    case 'TRANSFER':
      return 'Transfer Manual'
    case 'BRI_VA':
    case 'BRIVA':
    case 'BRI':
      return 'BRIVA'
    case 'BRI_QLOLA':
      return 'BRI QLola'
    case 'SYSTEM':
      return 'Sistem'
    default:
      return raw ? raw.replace(/_/g, ' ') : '-'
  }
}

function formatStatusInfo(status: string): { label: string; className: string } {
  switch (status) {
    case 'SETTLED':
      return {
        label: 'Settled Bank',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      }
    case 'PAID':
      return {
        label: 'Diterima',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    case 'COMPLETED':
      return {
        label: 'Selesai',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    case 'VOID':
      return {
        label: 'Dibatalkan',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    case 'REVERSAL':
      return {
        label: 'Koreksi',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    case 'REFUND':
      return {
        label: 'Pengembalian',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      }
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      }
  }
}

function formatRecipientLabel(info?: string | null): string {
  if (!info) return '-'
  switch (info) {
    case 'PESANTREN':
    case 'BENDAHARA':
      return 'Bendahara Pesantren'
    case 'KATERING':
      return 'Katering'
    case 'LAUNDRY':
      return 'Laundry'
    default:
      return info
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
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : 'Rincian transaksi belum dapat dimuat.')
        }
      }
    })

    return () => {
      isMounted = false
    }
  }, [transaction])

  // Escape key handler
  useEffect(() => {
    if (!transaction) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isReceiptOpen) setIsReceiptOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [transaction, isReceiptOpen, onClose])

  if (!transaction) return null

  const isIncoming = transaction.direction === 'IN'
  const isPesantren = transaction.fundType === 'PESANTREN'
  const statusInfo = formatStatusInfo(transaction.status)
  const refShort = formatReferenceShort(transaction.transactionNumber, transaction.category)
  const isRefTruncated = refShort !== transaction.transactionNumber

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="slide-over-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl">
          <div className="flex h-full flex-col divide-y divide-slate-100 bg-white">
            {/* Header Drawer */}
            <div className="bg-slate-50/80 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      id="slide-over-title"
                      className="font-mono text-sm font-bold text-slate-900 truncate"
                      title={transaction.transactionNumber}
                    >
                      {refShort}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                    <span>{transaction.categoryLabel}</span>
                    <span>·</span>
                    <span>{formatFinanceDate(transaction.createdAt, true)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Tutup panel rincian transaksi"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors cursor-pointer"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="relative flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {isPending && (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
                    <span>Memuat rincian transaksi…</span>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                  {errorMessage}
                </div>
              )}

              {!isPending && (
                <>
                  {/* 1. Ringkasan Nominal & Arus Kas */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500">Nominal Transaksi</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          isIncoming
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
                            : 'bg-slate-200/70 text-slate-800'
                        }`}
                      >
                        {isIncoming ? (
                          <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        )}
                        {isIncoming ? 'Dana Masuk' : 'Dana Keluar'}
                      </span>
                    </div>

                    <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                      {formatRupiah(transaction.amount)}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-xs text-slate-600">
                      <span>Klasifikasi Dana</span>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          isPesantren
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-indigo-50 text-indigo-800'
                        }`}
                      >
                        {isPesantren ? 'Kas Operasional Pesantren' : 'Dana Titipan Santri (Uang Jajan)'}
                      </span>
                    </div>
                  </div>

                  {/* 2. Pihak Terkait */}
                  {(transaction.santriName || transaction.recipientInfo) && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {transaction.santriName ? 'Identitas Santri' : 'Pihak Penerima'}
                      </h4>

                      {transaction.santriName ? (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                          <SantriPhotoAvatar src={null} name={transaction.santriName} size="md" clickable={false} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-sm truncate">
                              {transaction.santriName}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              NIS {transaction.santriNis || '—'}
                              {transaction.santriAsrama && ` · ${transaction.santriAsrama}`}
                              {transaction.santriKamar ? ` / ${transaction.santriKamar}` : ''}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                          <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                            <Building2 className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              {formatRecipientLabel(transaction.recipientInfo)}
                            </div>
                            <div className="text-xs text-slate-500">Penyedia Jasa / Unit Tujuan</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Breakdown Alokasi Item */}
                  {detailData?.allocations && detailData.allocations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Rincian Pos Biaya
                      </h4>

                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                        {detailData.allocations.map((alloc) => (
                          <div
                            key={alloc.id}
                            className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{alloc.itemLabel}</span>
                              {alloc.distributionStatus !== 'N/A' && (
                                <div className="text-[11px] text-slate-500">
                                  Status salur: <span className="font-medium">{alloc.distributionStatus}</span>
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatRupiah(alloc.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Informasi Audit & Kanal */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Informasi Audit &amp; Metode
                    </h4>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Metode</span>
                        <span className="font-semibold text-slate-900">
                          {formatMethodLabel(transaction.method, transaction.channel)}
                        </span>
                      </div>

                      {isRefTruncated && (
                        <div className="flex flex-col gap-0.5 border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Referensi Lengkap</span>
                          <span className="font-mono text-[11px] text-slate-700 break-all">
                            {transaction.transactionNumber}
                          </span>
                        </div>
                      )}

                      {detailData?.auditTrail.orderNumber && (
                        <div className="flex justify-between gap-3 border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">No. Order</span>
                          <span className="font-mono font-medium text-slate-800">
                            {detailData.auditTrail.orderNumber}
                          </span>
                        </div>
                      )}

                      {transaction.externalReference &&
                        transaction.externalReference !== transaction.transactionNumber && (
                          <div className="flex justify-between gap-3 border-t border-slate-200/60 pt-2">
                            <span className="text-slate-500 shrink-0">Referensi Bank</span>
                            <span className="font-mono text-slate-800 break-all text-right">
                              {transaction.externalReference}
                            </span>
                          </div>
                        )}

                      {detailData?.auditTrail.cashSessionCode && (
                        <div className="flex justify-between gap-3 border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Kode Sesi Kasir</span>
                          <span className="font-mono font-medium text-emerald-800">
                            {detailData.auditTrail.cashSessionCode}
                          </span>
                        </div>
                      )}

                      {detailData?.auditTrail.bankDestination && (
                        <div className="flex justify-between gap-3 border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500 shrink-0">Rekening Tujuan</span>
                          <span className="font-medium text-slate-800 text-right">
                            {detailData.auditTrail.bankDestination} · {detailData.auditTrail.accountNumber} (
                            {detailData.auditTrail.accountHolder || '—'})
                          </span>
                        </div>
                      )}

                      {detailData?.auditTrail.reason && (
                        <div className="border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500 block mb-0.5">Alasan Koreksi</span>
                          <span className="font-medium text-rose-800">{detailData.auditTrail.reason}</span>
                        </div>
                      )}

                      {detailData?.auditTrail.approvedBy && (
                        <div className="flex justify-between gap-3 border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Disetujui Oleh</span>
                          <span className="font-medium text-slate-800">{detailData.auditTrail.approvedBy}</span>
                        </div>
                      )}

                      {transaction.operatorName && (
                        <div className="flex justify-between gap-3 border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500">Petugas</span>
                          <span className="font-medium text-slate-800">{transaction.operatorName}</span>
                        </div>
                      )}

                      {transaction.notes && (
                        <div className="border-t border-slate-200/60 pt-2">
                          <span className="text-slate-500 block mb-0.5">Catatan</span>
                          <span className="text-slate-700">{transaction.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer Drawer */}
            <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-between gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cetak Kuitansi</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
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
