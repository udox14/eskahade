'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getDistributionReceiptAction, getReceiptLetterheadAction } from './actions'
import type { DistributionDetailWithItems } from '@/lib/finance/distribution-types'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import {
  FinanceReceiptModal,
  RECEIPT_ISSUER_PESANTREN,
  applyLetterhead,
  type ResolvedReceiptLetterhead,
  formatReceiptDate,
  formatReceiptRupiah,
  makeReceiptNumber,
  type ReceiptData,
} from '@/components/finance/receipt-document'

interface BuktiPenyaluranModalProps {
  isOpen: boolean
  onClose: () => void
  distributionId: string | null
}

const METHOD_LABELS: Record<string, string> = {
  BRI_QLOLA: 'BRI QLola',
  TRANSFER: 'Transfer bank',
  MANUAL_TRANSFER: 'Transfer manual',
  CASH: 'Tunai (Cash)',
}

function buildReceipt(data: DistributionDetailWithItems): ReceiptData {
  const itemLabel = FINANCE_ITEM_LABELS[data.item_type as FinanceItemType] || data.item_type
  const date = formatReceiptDate(data.transferred_at)
  const receiptNumber = makeReceiptNumber(data.distribution_number)
  const isBank = data.method !== 'CASH'

  const meta: ReceiptData['meta'] = [
    { label: 'Nomor Transaksi', value: data.distribution_number, mono: true },
    { label: 'Nomor Kuitansi', value: receiptNumber, mono: true },
    { label: 'Tanggal Penyaluran', value: date },
    { label: 'Metode Penyaluran', value: METHOD_LABELS[data.method] || data.method },
    { label: 'Pos / Periode', value: `${itemLabel} (${data.period})` },
  ]
  if (data.operator_name) meta.push({ label: 'Petugas', value: data.operator_name })
  if (data.notes) meta.push({ label: 'Catatan', value: data.notes })

  const partyLines: string[] = []
  if (isBank && data.destination_bank) {
    partyLines.push(`${data.destination_bank} • ${data.destination_account ?? '-'}`)
    if (data.account_holder_name) partyLines.push(`a.n ${data.account_holder_name}`)
  }

  const rows =
    data.items && data.items.length > 0
      ? data.items.map((it) => ({
          label: `${it.santri_name} (${it.santri_nis}) — ${itemLabel} ${data.period}`,
          unitPrice: it.amount,
          amount: it.amount,
        }))
      : [{ label: `${itemLabel} ${data.period}`, unitPrice: data.total_amount, amount: data.total_amount }]

  return {
    title: 'Bukti Penyaluran Dana',
    fileName: `Bukti-Penyaluran-${receiptNumber}`,
    meta,
    issuer: RECEIPT_ISSUER_PESANTREN,
    variant: 'simple',
    signatures: [
      { role: 'Penerima Dana', name: data.recipient_name },
      { role: 'Petugas / Bendahara', name: data.operator_name || '' },
    ],
    party: { title: 'Diterima Oleh', name: data.recipient_name, lines: partyLines },
    heroText: `${formatReceiptRupiah(data.total_amount)} disalurkan pada ${date}`,
    rowsHeader: `Rincian Alokasi Santri (${rows.length} transaksi)`,
    rows,
    summary: [],
    totalLabel: 'Total Disalurkan',
    totalValue: formatReceiptRupiah(data.total_amount),
    footerNote:
      'Dokumen diterbitkan melalui Sistem Administrasi & Keuangan Pondok Pesantren Sukahideng sebagai bukti penyaluran dana yang valid.',
  }
}

export default function BuktiPenyaluranModal({
  isOpen,
  onClose,
  distributionId,
}: BuktiPenyaluranModalProps) {
  const [data, setData] = useState<DistributionDetailWithItems | null>(null)
  const [letterhead, setLetterhead] = useState<ResolvedReceiptLetterhead | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    getReceiptLetterheadAction('receipt_penyaluran')
      .then((res) => {
        if (active) setLetterhead(res)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !distributionId) return
    let active = true
    setData(null)
    getDistributionReceiptAction(distributionId)
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err: unknown) => {
        if (active) toast.error(err instanceof Error ? err.message : 'Gagal memuat bukti penyaluran.')
      })
    return () => {
      active = false
    }
  }, [isOpen, distributionId])

  if (!isOpen || !distributionId) return null

  return (
    <FinanceReceiptModal
      data={data ? applyLetterhead(buildReceipt(data), letterhead, { issuerFromProfile: true }) : null}
      subtitle={data ? `No. Bukti: ${data.distribution_number}` : undefined}
      onClose={onClose}
    />
  )
}
