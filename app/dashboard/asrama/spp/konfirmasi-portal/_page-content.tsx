'use client'

import { KonfirmasiPortalClient } from '@/components/portal/konfirmasi-client'
import { approveSubmissionSpp, getSubmissionsSpp, rejectSubmissionSpp, undoApprovalSpp } from './actions'

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function renderRincian(detailJson: string): string[] {
  try {
    const parsed = JSON.parse(detailJson)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => {
      const label = `${BULAN[Number(item.bulan) - 1] || item.bulan} ${item.tahun}`
      return item.source === 'HISTORIS' ? `${label} (tunggakan lama)` : label
    })
  } catch {
    return []
  }
}

export default function PageContent() {
  return (
    <KonfirmasiPortalClient
      title="Konfirmasi SPP Portal"
      description="Periksa bukti transfer/QRIS pembayaran SPP dari orang tua, lalu konfirmasi atau tolak. Pembayaran terkonfirmasi masuk hitungan setoran seperti pembayaran tunai."
      renderRincian={renderRincian}
      getList={getSubmissionsSpp}
      approve={approveSubmissionSpp}
      reject={rejectSubmissionSpp}
      undo={undoApprovalSpp}
    />
  )
}
