'use client'

import { KonfirmasiPortalClient, type KonfirmasiRow } from '@/components/portal/konfirmasi-client'
import { approveSubmissionSpp, getSubmissionsSpp, rejectSubmissionSpp } from './actions'

function renderRincian(detailJson: string): string[] {
  try {
    const parsed = JSON.parse(detailJson)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => String(item.title || ''))
  } catch {
    return []
  }
}

export default function PageContent() {
  return (
    <KonfirmasiPortalClient
      title="Konfirmasi SPP Portal"
      description="Periksa bukti transfer/QRIS pembayaran SPP dari orang tua, lalu konfirmasi atau tolak. Pembayaran terkonfirmasi masuk ke Keuangan Terpusat (saldo Titipan wali dialokasikan langsung ke tagihan)."
      renderRincian={renderRincian}
      getList={getSubmissionsSpp as (f: string) => Promise<{ rows: KonfirmasiRow[] } | { error: string }>}
      approve={approveSubmissionSpp}
      reject={rejectSubmissionSpp}
    />
  )
}
