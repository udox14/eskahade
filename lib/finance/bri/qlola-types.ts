// lib/finance/bri/qlola-types.ts
// Kontrak & Tipe Data Penyaluran Dana Non-STP BRI / QLola (Fase BRI-5)
// Berdasarkan PRD Bab 24 s.d. 29, AGENTS.md, dan Reviewer Hardening

import type { FinanceItemType } from '@/lib/finance/types'

export type BriDistributionRecipientType = 'PESANTREN' | 'KATERING' | 'LAUNDRY'

export type BriDistributionMethod = 'BRI_QLOLA' | 'CASH' | 'MANUAL_TRANSFER'

export type BriDistributionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PROCESSING'
  | 'CANCEL_PENDING'
  | 'DISTRIBUTED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED'

export type QlolaApprovalInternalStatus =
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'UNKNOWN'

export type QlolaTransferIntentStatus =
  | 'CREATED'
  | 'SUBMISSION_PENDING'
  | 'UNKNOWN'
  | 'CANCEL_PENDING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'FAILED'

export type BriSubmissionOutcome =
  | 'NOT_DISPATCHED'
  | 'SUBMISSION_PENDING'
  | 'SUBMITTED'
  | 'UNKNOWN'
  | 'FAILED'

export type BriDistributionRole =
  | 'admin_koperasi'
  | 'petugas_koperasi'
  | 'bendahara'
  | 'pimpinan'
  | 'admin'
  | 'tester'

export type BriProviderEvidenceSource =
  | 'BANK_WEBHOOK'
  | 'BANK_STATEMENT'
  | 'H2H_SYNC'
  | 'MANUAL_OFFICIAL_PROOF'
  | 'TEST_PROVIDER'

export type BriProviderEvidenceType =
  | 'SUBMISSION_ACK'
  | 'APPROVAL_PROGRESS'
  | 'EXECUTION_SUCCESS'
  | 'EXECUTION_REJECTED'
  | 'EXECUTION_FAILED'
  | 'CANCELLATION_CONFIRMED'
  | 'APPROVAL_REJECTED'

export type BriProviderEvidenceStrength =
  | 'AUTHORITATIVE_EXACT'
  | 'MANUAL_RESOLVED'
  | 'CANDIDATE'

// ─── DEKLARASI KONTRAK FORMAL BRI-5 (CONTRACT_TBD / NOT VERIFIED) ───────────

export const QLOLA_H2H_CONTRACT_STATE = 'QLOLA_H2H_CONTRACT_TBD' as const
export const BRIAPI_TRANSFER_QLOLA_QUEUE_STATE = 'CONTRACT_TBD' as const
export const DIRECT_BRI_TRANSFER_NON_STP_COMPATIBILITY = 'NOT_VERIFIED' as const
export const QLOLA_CANCELLATION_CONTRACT_STATE = 'QLOLA_CANCELLATION_CONTRACT_TBD' as const
export const QLOLA_STATUS_SYNC_CONTRACT_STATE = 'QLOLA_STATUS_SYNC_CONTRACT_TBD' as const
export const QLOLA_REAL_APPROVAL_STATUS_SYNC = 'NOT_IMPLEMENTED / CONTRACT_TBD' as const
export const QLOLA_REAL_SUBMISSION = 'DISABLED' as const
export const QLOLA_REAL_EXECUTION_STATUS = 'CONTRACT_TBD' as const
export const TEST_PROVIDER_CANNOT_AUTHORIZE_PRODUCTION = true as const
export const TEST_PROVIDER_IS_NEVER_ELIGIBLE_FINANCIAL_EVIDENCE = true as const
export const PRE_ACK_CANCELLATION_LIVES_ON_TRANSFER_INTENT = true as const
export const ACK_RESERVATION_HANDOFF_IS_ATOMIC = true as const
export const MANUAL_PROOF_IDENTITY_COMES_FROM_AUTHENTICATED_SERVER_SESSION = true as const
export const SUBMISSION_PENDING_RESERVES_FUNDS = true as const

// ─── OFFICIAL BRI PUBLIC TRANSFER PATHS (BI-FAST & INTRABANK) ───────────────
export const BRI_OFFICIAL_INTRABANK_PATH = '/intrabank/snap/v1.0/transfer-intrabank' as const
export const BRI_OFFICIAL_INTRABANK_V2_PATH = '/intrabank/snap/v2.0/transfer-intrabank' as const
export const BRI_OFFICIAL_INTERBANK_PATH = '/interbank/snap/v1.0/transfer-interbank' as const
export const BRI_OFFICIAL_INTERBANK_V2_PATH = '/interbank/snap/v2.0/transfer-interbank' as const

// ─── MAPPING RECIPIENT RESMI PRD LOCKED ─────────────────────────────────────

export const DISTRIBUTABLE_ITEM_RECIPIENT_MAP: Record<FinanceItemType, BriDistributionRecipientType> = {
  SPP: 'PESANTREN',
  USPP: 'PESANTREN',
  EHB: 'PESANTREN',
  EKSKUL: 'PESANTREN',
  KESEHATAN: 'PESANTREN',
  UANG_MAKAN: 'KATERING',
  UANG_NYUCI: 'LAUNDRY',
}

// ─── MODEL RECIPIENT ACCOUNT SNAPSHOT ────────────────────────────────────────

export interface BriRecipientAccountSnapshot {
  recipientId: string
  recipientName: string
  recipientCategory: BriDistributionRecipientType
  accountId: string
  bankCode: string
  accountNumber: string
  accountHolder: string
  isPrimary: boolean
  isActive: boolean
}

// ─── MODEL INTENT OUTBOX ─────────────────────────────────────────────────────

export interface BriQlolaTransferIntent {
  id: string
  distributionId: string
  distributionRequestId: string
  intentStatus: QlolaTransferIntentStatus
  externalId: string | null
  makerUserId: string
  payloadHash: string
  providerStatus: string | null
  errorDetails: string | null
  createdAt: string
  updatedAt: string
}

// ─── MODEL BUKTI PENYEDIA (PROVIDER EVIDENCE) ───────────────────────────────

export interface BriQlolaProviderEvidence {
  id: string
  distributionId: string
  source: BriProviderEvidenceSource
  evidenceType: BriProviderEvidenceType
  evidenceStrength: BriProviderEvidenceStrength
  providerState: string
  providerReference: string | null
  observedAt: string
  rawEvidenceHash: string
  recordedBy: string
  operatorAuthorizedBy?: string | null
  operatorRoleSnapshot?: string | null
  manualProofReference?: string | null
  auditLinkage?: string | null
  notes?: string | null
  resolvedAt?: string | null
  createdAt: string
}

// ─── INPUT / OUTPUT SERVICES ────────────────────────────────────────────────

export interface CreateDistributionBatchInput {
  recipientId: string
  itemType: FinanceItemType
  period: string
  amount: number
  method: BriDistributionMethod
  accountId?: string | null
  createdBy: string
  notes?: string | null
}

export interface SubmitDistributionToQlolaInput {
  distributionId: string
  distributionRequestId: string
  submittedBy: string
  /**
   * Adapter pengiriman ke bank.
   * Pada produksi, contract TBD sehingga fail-closed.
   * Pada unit-test, diberikan simulated test adapter.
   */
  testProviderAdapter?: {
    dispatchTransfer: (payload: {
      distributionId: string
      amount: number
      destinationAccount: string
      batchReference: string
    }) => Promise<
      | { outcome: 'ACKNOWLEDGED'; providerReference: string; providerState: string }
      | { outcome: 'TIMEOUT'; error: string }
      | { outcome: 'REJECTED'; error: string }
    >
  }
}

export interface SubmitDistributionToQlolaResult {
  distributionId: string
  distributionNumber: string
  distributionRequestId: string
  status: 'PENDING_APPROVAL' | 'DRAFT'
  intentStatus: QlolaTransferIntentStatus
  isNonStp: true
  isReserved: boolean
  makerReference: string
  batchReference: string
  intentId: string
  alreadySubmitted?: boolean
  submissionOutcome?: BriSubmissionOutcome
  error?: string
}

export interface CancelDistributionInput {
  distributionId: string
  cancelledBy: string
  reason: string
  confirmedByBank?: boolean
}

export interface CancelDistributionResult {
  distributionId: string
  status: 'CANCELLED' | 'CANCEL_PENDING' | 'DRAFT'
  intentStatus?: QlolaTransferIntentStatus
  isReservationReleased: boolean
  cancellationReason: string
}

export interface SyncQlolaStatusInput {
  distributionId: string
  operatorId: string
  externalStatus: string
  source?: BriProviderEvidenceSource
  evidenceType?: BriProviderEvidenceType
  evidenceStrength?: BriProviderEvidenceStrength
  operatorAuthorizedBy?: string | null
  manualProofReference?: string | null
  auditLinkage?: string | null
  bankTransactionReference?: string | null
  bankFeeAmount?: number | null
  bankFeeBearer?: 'KOPERASI' | 'BENEFICIARY' | null
  bankFeeReference?: string | null
  notes?: string | null
  rejectionReason?: string | null
}

export interface SyncQlolaStatusResult {
  distributionId: string
  previousStatus: BriDistributionStatus
  currentStatus: BriDistributionStatus
  isReservationReleased: boolean
  isDistributedFinal: boolean
  providerEvidenceId?: string
}

export interface AccountInquiryInput {
  bankCode: string
  accountNumber: string
  expectedAccountHolder?: string | null
}

export interface AccountInquiryResult {
  bankCode: string
  accountNumber: string
  accountHolderName: string
  isMatched: boolean
  inquiryReference: string
  inquiredAt: string
}
