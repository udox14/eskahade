// Bagan akun hidup di postings.ts — satu-satunya berkas yang boleh menyebut kode
// akun (lihat uji T3). Di sini hanya di-re-export agar impor lama tetap jalan.
import type { FinanceAccountCode } from './postings'
export type { FinanceAccountCode }

export type WalletKind = 'TITIPAN' | 'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'
// Satu metode aktif: QR. Tipe dipertahankan sebagai union satu anggota supaya
// penambahan RFID kelak tidak perlu mengubah tanda tangan fungsi.
export type CredentialKind = 'QR_STATIC'
export type CredentialMode = 'QR'

export type JournalEntryInput = {
  accountCode: FinanceAccountCode
  side: 'DEBIT' | 'CREDIT'
  amountRupiah: number
  santriId?: string | null
  asramaScope?: string | null
  counterpartyType?: string | null
  counterpartyId?: string | null
  memo?: string | null
}

export type JournalInput = {
  idempotencyKey: string
  effectiveDate?: string
  description: string
  sourceType: string
  sourceId?: string | null
  externalReference?: string | null
  actorType: 'STAFF' | 'GUARDIAN' | 'SYSTEM' | 'GATEWAY'
  actorId?: string | null
  reversalOfId?: string | null
  metadata?: Record<string, unknown> | null
  entries: JournalEntryInput[]
}

export type WalletMovementInput = {
  idempotencyKey: string
  santriId: string
  walletKind: WalletKind
  amountRupiah: number
  movementType: string
  referenceType: string
  referenceId: string
}

export type FinanceActionResult<T = undefined> = T extends undefined
  ? { success: true } | { error: string; code?: string }
  : { success: true; data: T } | { error: string; code?: string }
