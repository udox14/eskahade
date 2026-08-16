'use client'

import { KonfirmasiPortalClient, type KonfirmasiRow } from '@/components/portal/konfirmasi-client'
import { approveSubmissionNonSpp, getSubmissionsNonSpp, rejectSubmissionNonSpp } from './actions'

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
      title="Konfirmasi Non-SPP Portal"
      description="Periksa bukti transfer/QRIS pembayaran biaya tahunan (bangunan, kesehatan, EHB, ekskul) dari orang tua, lalu konfirmasi atau tolak. Pembayaran terkonfirmasi masuk ke Keuangan Terpusat."
      renderRincian={renderRincian}
      getList={getSubmissionsNonSpp as (f: string) => Promise<{ rows: KonfirmasiRow[] } | { error: string }>}
      approve={approveSubmissionNonSpp}
      reject={rejectSubmissionNonSpp}
    />
  )
}
