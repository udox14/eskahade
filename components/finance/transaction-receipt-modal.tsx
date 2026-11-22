'use client'

import React, { useEffect, useState } from 'react'
import { getReceiptLetterheadAction } from '@/app/dashboard/keuangan/riwayat/actions'
import type { GlobalTransactionRow } from '@/lib/finance/history'
import type { getTransactionDetail } from '@/app/dashboard/keuangan/riwayat/actions'
import {
  FinanceReceiptModal,
  RECEIPT_ISSUER,
  RECEIPT_ISSUER_PESANTREN,
  applyLetterhead,
  type ResolvedReceiptLetterhead,
  formatReceiptDate,
  formatReceiptRupiah,
  makeReceiptNumber,
  type ReceiptData,
} from './receipt-document'

interface TransactionReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: GlobalTransactionRow | null
  detailData: Awaited<ReturnType<typeof getTransactionDetail>> | null
}

const METHOD_LABELS: Record<string, string> = {
  BRI: 'BRIVA',
  BRI_VA: 'BRIVA',
  TRANSFER: 'Transfer bank',
  MANUAL_TRANSFER: 'Transfer bank',
  CASH: 'Tunai loket',
}

export function TransactionReceiptModal({
  isOpen,
  onClose,
  transaction,
  detailData,
}: TransactionReceiptModalProps) {
  const [letterheads, setLetterheads] = useState<Record<string, ResolvedReceiptLetterhead>>({})
  const lhKey = transaction?.category === 'DISTRIBUTION' ? 'receipt_penyaluran' : 'receipt_pembayaran'

  useEffect(() => {
    if (!isOpen) return
    let active = true
    getReceiptLetterheadAction(lhKey)
      .then((res) => {
        if (active) setLetterheads((prev) => ({ ...prev, [lhKey]: res }))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isOpen, lhKey])

  if (!isOpen || !transaction) return null

  const isDistribution = transaction.category === 'DISTRIBUTION'
  const isWithdrawal = transaction.category === 'WITHDRAWAL'

  let title = 'Kuitansi Pembayaran'
  if (isDistribution) title = 'Bukti Penyaluran Dana'
  else if (isWithdrawal) title = 'Bukti Penarikan Uang Jajan'
  else if (transaction.category === 'TOPUP') title = 'Bukti Pengisian Saldo'
  else if (transaction.category === 'CORRECTION') title = 'Bukti Koreksi Keuangan'

  const ref = transaction.transactionNumber
  const receiptNumber = makeReceiptNumber(ref)
  const date = formatReceiptDate(transaction.createdAt)
  const method =
    METHOD_LABELS[transaction.channel] || METHOD_LABELS[transaction.method] || transaction.channel || transaction.method || '-'

  const allocations = detailData?.allocations ?? []
  const rows =
    allocations.length > 0
      ? allocations.map((a) => ({ label: a.itemLabel, unitPrice: a.amount, amount: a.amount }))
      : [
          {
            label: transaction.itemLabel || transaction.categoryLabel,
            unitPrice: transaction.amount,
            amount: transaction.amount,
          },
        ]

  const isPayment =
    !isDistribution &&
    !isWithdrawal &&
    transaction.category !== 'TOPUP' &&
    transaction.category !== 'CORRECTION' &&
    transaction.direction === 'IN'

  const party: ReceiptData['party'] = transaction.santriName
    ? {
        title: isPayment ? 'Ditagihkan Kepada' : 'Pemilik Saldo',
        name: transaction.santriName,
        lines: [
          `NIS: ${transaction.santriNis || '-'}`,
          ...(transaction.santriAsrama
            ? [`Asrama: ${transaction.santriAsrama}${transaction.santriKamar ? ` (Kamar ${transaction.santriKamar})` : ''}`]
            : []),
        ],
      }
    : {
        title: isDistribution ? 'Diterima Oleh' : 'Pihak Terkait',
        name: transaction.recipientInfo || '-',
        lines: [],
      }

  const summary = isPayment
    ? [
        { label: 'Subtotal Tagihan', value: formatReceiptRupiah(transaction.grossAmount ?? transaction.amount) },
        { label: 'Biaya Transaksi / Layanan', value: formatReceiptRupiah(transaction.gatewayFee ?? 0) },
        { label: 'Total Pembayaran', value: formatReceiptRupiah(transaction.amount), bold: true },
      ]
    : []

  const meta: ReceiptData['meta'] = [
    { label: 'Nomor Transaksi', value: ref, mono: true },
    { label: 'Nomor Kuitansi', value: receiptNumber, mono: true },
    { label: isDistribution ? 'Tanggal Penyaluran' : 'Tanggal Bayar', value: date },
    { label: isDistribution ? 'Metode Penyaluran' : 'Metode Pembayaran', value: method },
  ]
  if (transaction.operatorName) meta.push({ label: 'Petugas', value: transaction.operatorName })
  if (detailData?.auditTrail.bankDestination) {
    meta.push({
      label: 'Rekening Tujuan',
      value: `${detailData.auditTrail.bankDestination} - ${detailData.auditTrail.accountNumber ?? '-'}`,
    })
  }

  const data: ReceiptData = {
    title,
    fileName: `Kuitansi-${receiptNumber}`,
    meta,
    issuer: isPayment ? RECEIPT_ISSUER : RECEIPT_ISSUER_PESANTREN,
    variant: isPayment ? 'full' : 'simple',
    signatures: isDistribution
      ? [
          { role: 'Penerima Dana', name: transaction.recipientInfo || '' },
          { role: 'Petugas / Bendahara', name: transaction.operatorName || '' },
        ]
      : undefined,
    party,
    heroText: isDistribution
      ? `${formatReceiptRupiah(transaction.amount)} disalurkan pada ${date}`
      : `${formatReceiptRupiah(transaction.amount)} ${transaction.direction === 'IN' ? 'dibayar' : 'dikeluarkan'} pada ${date}`,
    rowsHeader: isPayment ? 'Deskripsi Tagihan' : 'Deskripsi',
    rows,
    summary,
    totalLabel: isDistribution ? 'Total Disalurkan' : isPayment ? 'Total Dibayar' : 'Total Nominal',
    totalValue: formatReceiptRupiah(transaction.amount),
    footerNote:
      'Dokumen diterbitkan melalui Sistem Administrasi & Keuangan Pondok Pesantren Sukahideng sebagai bukti transaksi yang valid.',
  }

  const finalData = applyLetterhead(data, letterheads[lhKey] ?? null, { issuerFromProfile: !isPayment })

  return <FinanceReceiptModal data={finalData} subtitle={`No. Bukti: ${ref}`} onClose={onClose} />
}
