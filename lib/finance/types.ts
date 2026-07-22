export type FinanceAccountCode =
  | '1101' | '1102' | '1103' | '1104' | '1201'
  | '2101' | '2102' | '2103' | '2104' | '2105'
  | '4101' | '4102' | '4103' | '4104'
  | '5101' | '5102' | '9999'

export type WalletKind = 'TITIPAN' | 'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'
export type CredentialKind = 'RFID_UID' | 'QR_STATIC'
export type CredentialMode = 'RFID' | 'QR' | 'HYBRID' | 'BOTH_TRANSITION'

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
