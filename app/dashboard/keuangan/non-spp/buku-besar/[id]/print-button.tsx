'use client'

import { printIframe } from '@/lib/utils'

export function PrintReceiptButton({ receiptId }: { receiptId: string }) {
  return (
    <button
      type="button"
      onClick={() => printIframe(`/dashboard/keuangan/non-spp/kuitansi/${receiptId}`)}
      className="rounded border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
    >
      Cetak
    </button>
  )
}
