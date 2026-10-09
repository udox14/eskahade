// lib/finance/bri/cash-manual-distribution-types.ts
// Tipe Data Distribusi Kas (CASH) & Transfer Manual (MANUAL_TRANSFER)
// Fase BRI-6: Cash & Manual Distribution Hardening

export type CashDistributionStatus = 'DRAFT' | 'PROCESSING' | 'DISTRIBUTED' | 'CANCELLED'

export type ManualTransferDistributionStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'DISTRIBUTED'
  | 'FAILED'
  | 'CANCELLED'

export type CashManualEvidenceType =
  | 'CASH_PREPARED'
  | 'CASH_HANDOVER_RECEIPT'
  | 'CASH_RETURNED'
  | 'MANUAL_TRANSFER_INITIATED'
  | 'MANUAL_TRANSFER_SUCCESS'
  | 'MANUAL_TRANSFER_FAILED'
  | 'MANUAL_TRANSFER_UNKNOWN'
  | 'BANK_STATEMENT_DEBIT'
  | 'MANUAL_OFFICIAL_PROOF'

export type CashManualEvidenceStrength = 'AUTHORITATIVE_EXACT' | 'MANUAL_RESOLVED' | 'CANDIDATE'

export type CashManualEvidenceSource =
  | 'CASH_DESK'
  | 'PHYSICAL_RECEIPT'
  | 'BANK_RECEIPT'
  | 'BANK_STATEMENT'
  | 'MANUAL_OFFICIAL_PROOF'
  | 'AUDIT_RECORD'

export interface FinanceCashManualEvidence {
  id: string
  distribution_id: string
  evidence_type: CashManualEvidenceType
  evidence_strength: CashManualEvidenceStrength
  source: CashManualEvidenceSource
  reference_number: string | null
  raw_evidence_hash: string
  observed_at: string
  recorded_at: string
  operator_id: string
  operator_role_snapshot: string
  receiving_person_name: string | null
  notes: string | null
  attachment_url: string | null
  attachment_hash: string | null
  attachment_mime: string | null
  attachment_size: number | null
  created_at: string
}

export interface PrepareCashDistributionInput {
  distributionId: string
  cashSessionId?: string
  operatorId: string
  operatorRole: string
  notes?: string
}

export interface FinalizeCashDistributionInput {
  distributionId: string
  receivingPersonName: string
  receiptReference?: string
  proofAttachmentUrl?: string
  proofAttachmentHash?: string
  proofAttachmentMime?: string
  proofAttachmentSize?: number
  proofAttachmentRef?: string
  notes?: string
  operatorId: string
  operatorRole: string
  distributionRequestId?: string
}

export interface CancelCashDistributionInput {
  distributionId: string
  reason: string
  operatorId: string
  operatorRole: string
}

export interface InitiateManualTransferInput {
  distributionId: string
  sourceAccountId?: string
  sourceAccountNumber?: string
  operatorId: string
  operatorRole: string
  notes?: string
}

export interface FinalizeManualTransferInput {
  distributionId: string
  evidenceType: 'MANUAL_TRANSFER_SUCCESS' | 'BANK_STATEMENT_DEBIT' | 'MANUAL_OFFICIAL_PROOF'
  evidenceStrength?: CashManualEvidenceStrength
  statementTransactionId?: string
  isReconciledAuthoritative?: boolean
  referenceNumber: string
  bankFee?: number | null
  proofAttachmentUrl?: string
  proofAttachmentHash?: string
  proofAttachmentMime?: string
  proofAttachmentSize?: number
  proofAttachmentRef?: string
  notes?: string
  operatorId: string
  operatorRole: string
}

export interface RecordManualTransferUnknownOutcomeInput {
  distributionId: string
  reason: string
  notes?: string
  operatorId: string
  operatorRole: string
}

export interface FailManualTransferInput {
  distributionId: string
  referenceNumber: string
  reason: string
  evidenceStrength?: 'AUTHORITATIVE_EXACT' | 'MANUAL_RESOLVED'
  operatorId: string
  operatorRole: string
}

export interface CancelManualTransferInput {
  distributionId: string
  reason: string
  operatorId: string
  operatorRole: string
}

export interface ProofUploadValidationInput {
  buffer: Buffer | Uint8Array
  mimeType: string
  originalFilename: string
  sizeBytes: number
}

export interface ProofUploadValidationResult {
  valid: boolean
  proofId?: string
  proofRef?: string
  objectKey?: string
  hash?: string
  mimeType?: string
  sizeBytes?: number
  error?: string
}
