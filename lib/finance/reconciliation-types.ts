// lib/finance/reconciliation-types.ts
// Tipe data Rekonsiliasi, Settlement Bank, dan Koreksi Finansial (Fase 8)
// Sesuai PRD Bab 32 & Implementation Plan #3.3, #3.5, #3.7

import type {
  FinancePaymentChannel,
  FinancePaymentStatus,
  FinanceCorrectionStatus,
  FinanceAllocationStatus,
  FinanceReconciliationMatchStatus,
  FinanceReconciliationResolutionAction,
} from '@/lib/finance/payment-types'

// ─── SETTLEMENT TYPES ───────────────────────────────────────────────────────

export type SettlementStatus = 'PENDING' | 'COMPLETED' | 'DISCREPANCY'

export interface FinanceSettlement {
  id: string
  settlement_number: string
  provider: string
  settlement_date: string // YYYY-MM-DD
  destination_bank: string
  destination_account: string
  total_payments_count: number
  total_gross_amount: number
  total_fee_amount: number
  total_net_amount: number
  status: SettlementStatus
  notes: string | null
  verified_by: string | null
  created_at: string
}

export interface FinanceSettlementItem {
  id: string
  settlement_id: string
  payment_id: string
  gross_amount: number
  gateway_fee: number
  net_amount: number
  created_at: string
}

export interface SettlementPaymentCandidate {
  payment_id: string
  payment_number: string
  santri_id: string
  santri_name: string
  nis: string
  paid_at: string
  external_reference: string | null
  channel: FinancePaymentChannel
  method: string
  gross_amount: number
  gateway_fee: number
  net_amount: number
  status: FinancePaymentStatus
}

export interface CreateSettlementBatchInput {
  settlementDate: string // YYYY-MM-DD
  destinationBank: string
  destinationAccount: string
  paymentIds: string[]
  provider?: string
  expectedTotalNet?: number
  notes?: string | null
  verifiedBy: string
}

export interface SettlementDetailWithItems {
  settlement: FinanceSettlement & { verifier_name?: string | null }
  items: Array<
    FinanceSettlementItem & {
      payment_number: string
      paid_at: string
      external_reference: string | null
      method: string
      santri_name: string
      nis: string
    }
  >
}

// ─── CORRECTION TYPES (VOID / REVERSAL / REFUND) ────────────────────────────

export type FinanceCorrectionType = 'VOID' | 'REVERSAL' | 'REFUND'
export type FinanceCorrectionMethod = 'CASH' | 'TRANSFER' | 'GATEWAY'
export type FinanceRecoveryStatus = 'NONE' | 'PENDING_RECOVERY' | 'RECOVERED'

export interface FinanceCorrection {
  id: string
  correction_number: string
  correction_type: FinanceCorrectionType
  target_payment_id: string
  total_amount: number
  method: FinanceCorrectionMethod | null
  reason: string
  is_recovery_case: number // 0 | 1
  recovery_amount: number
  recovery_status: FinanceRecoveryStatus
  recovery_notes: string | null
  cash_session_id: string | null
  approved_by: string | null
  created_by: string
  created_at: string
}

export interface FinanceCorrectionItem {
  id: string
  correction_id: string
  target_allocation_id: string | null
  obligation_id: string | null
  target_type: 'OBLIGATION' | 'UANG_JAJAN'
  amount: number
  is_disbursed_portion: number // 0 | 1
  created_at: string
}

export interface TargetAllocationCorrectionItemInput {
  allocationId: string
  amount: number
}

export interface RecordCorrectionInput {
  paymentId: string
  correctionType: FinanceCorrectionType
  method?: FinanceCorrectionMethod | null
  reason: string
  items: TargetAllocationCorrectionItemInput[]
  cashSessionId?: string | null
  createdBy: string
  approvedBy?: string | null
  recoveryNotes?: string | null
}

export interface CorrectionDetailWithItems {
  correction: FinanceCorrection & {
    creator_name?: string | null
    approver_name?: string | null
    payment_number: string
    paid_at: string
    channel: FinancePaymentChannel
    santri_id: string
    santri_name: string
    nis: string
  }
  items: Array<
    FinanceCorrectionItem & {
      item_type: string
      provider_name?: string | null
      obligation_period?: string | null
    }
  >
}

// ─── RECONCILIATION TYPES ───────────────────────────────────────────────────

export type FinanceReconciliationChannel = 'BRI' | 'CASH'
export type FinanceReconciliationStatus = 'BALANCED' | 'DISCREPANCY_OPEN' | 'RESOLVED'

export interface FinanceReconciliation {
  id: string
  reconciliation_code: string
  period: string // YYYY-MM
  channel: FinanceReconciliationChannel
  total_matched_count: number
  total_discrepancy_count: number
  total_internal_amount: number
  total_external_amount: number
  status: FinanceReconciliationStatus
  notes: string | null
  conducted_by: string
  created_at: string
}

export interface UnallocatedReconciliationRow {
  id: string // reconciliation_item_id
  payment_id: string
  payment_number: string
  santri_id: string
  santri_name: string
  nis: string
  asrama: string | null
  paid_at: string
  channel: FinancePaymentChannel
  method: string
  gross_amount: number
  gateway_fee: number
  net_amount: number
  allocation_status: FinanceAllocationStatus
  correction_status: FinanceCorrectionStatus
  match_status: FinanceReconciliationMatchStatus
  resolution_action: FinanceReconciliationResolutionAction
  resolution_notes: string | null
  external_reference: string | null
  discrepancy_amount: number
  resolved_at: string | null
  resolved_by_name: string | null
}

export interface ManualAllocationTargetInput {
  obligationId?: string | null
  targetType: 'OBLIGATION' | 'UANG_JAJAN'
  itemType: string
  amount: number
}

export interface ResolveManualAllocationInput {
  reconciliationItemId: string
  paymentId: string
  santriId: string
  allocations: ManualAllocationTargetInput[]
  resolutionNotes: string
  resolvedBy: string
}

export interface ResolveRecoveryCaseInput {
  correctionId: string
  recoveredAmount?: number
  notes: string
  resolvedBy: string
}

export interface CashSessionReconciliationSummary {
  sessionId: string
  sessionCode: string
  operatorId: string
  operatorName: string | null
  openedAt: string
  closedAt: string | null
  status: 'OPEN' | 'CLOSED'
  openingBalance: number
  totalCashIn: number
  totalCashOut: number
  expectedClosingBalance: number
  actualClosingBalance: number | null
  difference: number | null
  differenceNotes: string | null
  isBalanced: boolean
  reconciliationStatus: 'SEIMBANG' | 'SELISIH' | 'BELUM_DITUTUP'
}

export interface ReconciliationKpiOverview {
  totalOnlinePaidAmount: number
  totalSettledAmount: number
  totalPendingSettlementAmount: number
  pendingSettlementCount: number
  totalUnallocatedAmount: number
  unallocatedCount: number
  totalCashDifference: number
  discrepancySessionsCount: number
  totalRecoveryPendingAmount: number
  recoveryPendingCount: number
}
