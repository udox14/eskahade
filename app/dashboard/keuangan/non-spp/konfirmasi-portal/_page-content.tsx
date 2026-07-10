'use client'

import { KonfirmasiPortalClient, type KonfirmasiRow } from '@/components/portal/konfirmasi-client'
import {
  approveSubmissionNonSpp, getSubmissionsNonSpp, rejectSubmissionNonSpp, undoApprovalNonSpp,
} from './actions'

const LABEL: Record<string, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB',
  EKSKUL: 'Ekstrakurikuler',
}

function renderRincian(detailJson: string): string[] {
  try {
    const parsed = JSON.parse(detailJson)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => LABEL[item.jenis_biaya] || String(item.jenis_biaya))
  } catch {
    return []
  }
}

export default function PageContent() {
  return (
    <KonfirmasiPortalClient
      title="Konfirmasi Non-SPP Portal"
      description="Periksa bukti transfer/QRIS pembayaran biaya tahunan (bangunan, kesehatan, EHB, ekskul) dari orang tua, lalu konfirmasi atau tolak."
      renderRincian={renderRincian}
      getList={getSubmissionsNonSpp as (f: string) => Promise<{ rows: KonfirmasiRow[] } | { error: string }>}
      approve={approveSubmissionNonSpp}
      reject={rejectSubmissionNonSpp}
      undo={undoApprovalNonSpp}
    />
  )
}
