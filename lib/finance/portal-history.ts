// lib/finance/portal-history.ts
//
// Riwayat alokasi instan (Bayar Cepat / cicil USPP / top up Jajan-Makan-
// Laundry) yang dibuat orang tua dari Portal Ortu — read-only, tidak pernah
// menulis. Berbeda dari portal_payment_submission (pengajuan transfer/QRIS
// manual, DB utama) — baris ini datang dari finance_allocations (DB finance),
// dibuat lewat allocateStudentFunds tiap kali guardian memakai "Bayar Cepat".

import { financeQuery } from '@/lib/db'

export type PortalAllocationHistoryRow = {
  id: string
  destination_kind: 'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'
  amount_rupiah: number
  status: 'RESERVED' | 'COMMITTED' | 'DISBURSED' | 'RETURNED'
  billing_reference: string | null
  created_at: string
}

export async function getPortalAllocationHistory(santriId: string): Promise<PortalAllocationHistoryRow[]> {
  return financeQuery<PortalAllocationHistoryRow>(
    `SELECT id, destination_kind, amount_rupiah, status, billing_reference, created_at
     FROM finance_allocations
     WHERE santri_id = ? AND created_by_type = 'GUARDIAN'
     ORDER BY datetime(created_at) DESC
     LIMIT 50`,
    [santriId]
  )
}
