// lib/finance/bri/statement-types.ts
// SNAP BI v2.1 Bank Statement, Settlement, and Transaction Recovery Type Definitions

export interface BriAmount {
  value: string // e.g. "153000.00"
  currency: string // strictly 'IDR'
}

export type BriTypeNormalized = 'CREDIT' | 'DEBIT'
export type BriIdentityStrength = 'STRONG' | 'WEAK'

export interface BriBankStatementDetailData {
  transactionId?: string // Optional transaction-level identifier
  detailBalance?: {
    startAmount?: BriAmount
    endAmount?: BriAmount
  }
  amount: BriAmount
  type: string // "CR" | "DB" | "Credit" | "Debit" | "CREDIT" | "DEBIT"
  dateTime: string // ISO-8601 with offset, e.g. "2026-10-08T10:15:30+07:00"
  remark?: string
  additionalInfo?: {
    remarkCustom?: string
    bankCardToken?: string
    trxId?: string
    [key: string]: unknown
  }
}

/**
 * SNAP BI v2.1 Bank Statement Request Body
 * Endpoint: POST /snap/v2.1/bank-statement
 * Headers: X-EXTERNAL-ID (9-digit numeric), X-SIGNATURE, X-TIMESTAMP, Authorization: Bearer, X-PARTNER-ID, CHANNEL-ID
 */
export interface BriBankStatementRequest {
  partnerReferenceNo: string // Reference assigned by partner
  accountNo: string // Cooperative bank account number
  fromDateTime: string // ISO-8601 mandatory e.g. "2026-10-08T00:00:00+07:00"
  toDateTime: string // ISO-8601 mandatory e.g. "2026-10-08T23:59:59+07:00"
  additionalInfo?: Record<string, unknown>
}

/**
 * SNAP BI v2.1 Bank Statement Response Body (Official Service Code 14)
 */
export interface BriBankStatementResponse {
  responseCode: string // e.g. "2001400"
  responseMessage: string // e.g. "Successful"
  referenceNo?: string // Top-level fetch reference
  partnerReferenceNo?: string
  accountNo?: string
  name?: string
  totalCreditEntries?: number | string
  totalDebitEntries?: number | string
  totalCreditAmount?: BriAmount | string
  totalDebitAmount?: BriAmount | string
  detailData?: BriBankStatementDetailData[]
  additionalInfo?: Record<string, unknown>
}

/**
 * Persisted Bank Statement Fetch Metadata
 */
export interface FinanceBriStatementFetch {
  id: string
  fetch_reference_no: string
  account_no: string
  from_date_time: string
  to_date_time: string
  total_items_fetched: number
  total_credits_count: number
  total_credits_amount: number
  total_debits_count: number
  total_debits_amount: number
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'DISCREPANCY'
  response_code: string | null
  response_message: string | null
  cursor_advanced: number
  body_hash: string
  created_at: string
}

/**
 * Persisted Bank Statement Transaction Line
 */
export type BriStatementMatchStatus =
  | 'UNMATCHED'
  | 'MATCHED'
  | 'AMBIGUOUS'
  | 'IGNORED_DEBIT'
  | 'UNALLOCATED_RECORDED'

export interface FinanceBriStatementTransaction {
  id: string
  fetch_id: string
  account_no: string
  transaction_id: string | null
  identity_strength: BriIdentityStrength
  dedup_key: string
  weak_fingerprint: string | null
  transaction_date_raw: string
  transaction_date_utc: string | null
  type_raw: string
  type_normalized: BriTypeNormalized
  amount: number // Integer Rupiah
  amount_raw: string
  currency: string
  remark: string | null
  remark_custom: string | null
  start_balance_raw: string | null
  end_balance_raw: string | null
  bri_trx_id: string | null
  va_number: string | null
  observation_count: number
  raw_evidence_hash: string
  match_status: BriStatementMatchStatus
  matched_payment_id: string | null
  first_seen_at: string
  last_seen_at: string
  raw_json: string
  created_at: string
}

/**
 * Persisted Settlement Item (1-to-1 linkage between payment and statement transaction)
 * Provenance is DB-enforced via match_strength and match_method.
 */
export type BriSettlementItemMatchStrength = 'AUTHORITATIVE_EXACT' | 'MANUAL_RESOLVED'

export interface FinanceBriSettlementItem {
  id: string
  settlement_id: string
  payment_id: string
  statement_transaction_id: string
  gross_amount: number
  cooperative_admin_fee: number
  net_amount: number
  match_strength: BriSettlementItemMatchStrength
  match_method: string
  reconciliation_item_id: string | null
  currency: string
  resolved_by: string | null
  resolution_notes: string | null
  resolved_at: string | null
  settled_at: string
  created_at: string
}

/**
 * Matching Strength Classification
 */
export type BriMatchingStrength =
  | 'AUTHORITATIVE_EXACT'
  | 'CANDIDATE'
  | 'AMBIGUOUS'
  | 'NO_MATCH'

export type BriMatchClassification =
  | 'EXACT_MATCH'
  | 'ALREADY_SETTLED'
  | 'AMBIGUOUS'
  | 'AMOUNT_MISMATCH'
  | 'NO_MATCH'
  | 'IGNORED_DEBIT'

export interface BriMatchResult {
  classification: BriMatchClassification
  matchingStrength: BriMatchingStrength
  statementTransactionId: string
  matchedPaymentId?: string
  matchedOrderId?: string
  candidatePaymentsCount: number
  details?: {
    statementAmount: number
    paymentAmount?: number
    vaNumber?: string
    briTrxId?: string
    notes?: string
  }
}

/**
 * Recovery Lifecycle States
 */
export type BriRecoveryState =
  | 'OPEN'
  | 'INQUIRY_PENDING'
  | 'BANK_CONFIRMED'
  | 'BANK_NOT_FOUND'
  | 'STATEMENT_MATCHED'
  | 'DISCREPANCY'
  | 'RESOLVED'

export interface FinanceBriRecoveryQueueItem {
  id: string
  order_id: string | null
  santri_id: string
  virtual_account_no: string
  payment_request_id: string | null
  bri_trx_id: string | null
  expected_amount: number
  recovery_status: BriRecoveryState
  recovered_payment_id: string | null
  statement_transaction_id: string | null
  reason: string
  notes: string | null
  attempt_count: number
  last_attempt_at: string | null
  resolved_at: string | null
  created_at: string
}

/**
 * Reconciliation Session States
 */
export type BriReconciliationSessionStatus =
  | 'RUNNING'
  | 'BALANCED'
  | 'DISCREPANCY_OPEN'
  | 'FAILED'
  | 'RESOLVED'

export interface FinanceBriReconciliationSession {
  id: string
  session_code: string
  period: string
  account_no: string
  started_at: string
  completed_at: string | null
  fetched_count: number
  matched_count: number
  unmatched_count: number
  ambiguous_count: number
  discrepancy_amount: number
  status: BriReconciliationSessionStatus
  notes: string | null
  conducted_by: string | null
  created_at: string
}

/**
 * Status Inquiry Contract Seam State
 */
export const BRIVA_STATUS_INQUIRY_CONTRACT_STATE = 'BRIVA_STATUS_INQUIRY_CONTRACT_TBD' as const

export interface BriTransactionStatusInquiryRequest {
  partnerReferenceNo: string
  serviceCode?: string
  accountNo?: string
  originalPartnerReferenceNo?: string
  originalReferenceNo?: string
  originalExternalId?: string
  additionalInfo?: Record<string, unknown>
}

export interface BriTransactionStatusInquiryResponse {
  status: typeof BRIVA_STATUS_INQUIRY_CONTRACT_STATE
  message: string
}
