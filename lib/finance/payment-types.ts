// lib/finance/payment-types.ts
// Tipe data pembayaran, order, alokasi, dan koperasi (Fase BRI-1)
// Seluruh referensi Duitku telah direposisi ke BRI dan Biaya Administrasi Koperasi

import type { FinanceItemType } from '@/lib/finance/types'

export type FinancePaymentMethod = 'BRI_VA' | 'CASH'

export type FinancePayerType = 'PORTAL_ORTU' | 'LOKET'

export type FinanceFeePayer = 'CUSTOMER' | 'INSTITUTION'

export type FinanceOrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REPLACED'

export type FinancePaymentChannel = 'BRI' | 'CASH'

export type FinancePaymentSource = 'NEW_FINANCE' | 'LEGACY'

export type FinanceFundManagement = 'PRE_KOPERASI' | 'KOPERASI'

export type FinancePaymentStatus = 'PAID' | 'SETTLED'

export type FinanceCorrectionStatus = 'NONE' | 'PARTIALLY_CORRECTED' | 'FULLY_CORRECTED'

export type FinanceAllocationStatus = 'ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED'

export type FinanceAllocationTargetType = 'OBLIGATION' | 'UANG_JAJAN'

export type FinanceDistributionStatus = 'UNDISBURSED' | 'PARTIALLY_DISBURSED' | 'DISBURSED'

export type FinanceGatewayEventStatus = 'PROCESSED' | 'IGNORED' | 'ERROR'

export type FinanceReconciliationMatchStatus =
  | 'MATCHED'
  | 'UNMATCHED_INTERNAL'
  | 'UNMATCHED_EXTERNAL'
  | 'AMOUNT_MISMATCH'
  | 'UNALLOCATED_TRANSFER'

export type FinanceReconciliationResolutionAction =
  | 'NONE'
  | 'MANUAL_ALLOCATION'
  | 'REFUND_RECORDED'
  | 'VOID_RECORDED'
  | 'ADJUSTMENT'

export interface FinanceStudentVa {
  id?: string
  santri_id: string
  va_number: string
  customer_no: string
  status: 'ACTIVE' | 'INACTIVE'
  activated_at?: string | null
  deactivated_at?: string | null
  created_at: string
  updated_at: string
}

export interface FinancePaymentOrder {
  id: string
  order_number: string
  santri_id: string
  payer_type: FinancePayerType
  gross_amount: number
  cooperative_admin_fee: number
  fee_payer: FinanceFeePayer
  total_charged: number
  payment_method: FinancePaymentMethod | null
  fixed_va_number: string | null
  status: FinanceOrderStatus
  expires_at: string
  cash_session_id: string | null
  created_at: string
  updated_at: string
}

export interface FinanceOrderItem {
  id: string
  order_id: string
  obligation_id: string | null
  item_type: string
  amount: number
}

export interface FinancePayment {
  id: string
  payment_number: string
  order_id: string | null
  santri_id: string
  channel: FinancePaymentChannel
  method: string
  gross_amount: number
  cooperative_admin_fee: number
  bri_fee_amount: number | null
  net_amount: number
  status: FinancePaymentStatus
  correction_status: FinanceCorrectionStatus
  allocation_status: FinanceAllocationStatus
  paid_at: string
  bri_payment_request_id?: string | null
  bri_trx_id?: string | null
  source: FinancePaymentSource
  fund_management: FinanceFundManagement
  external_reference: string | null
  cash_session_id: string | null
  received_by: string | null
  created_at: string
}

export interface FinanceAllocation {
  id: string
  payment_id: string
  obligation_id: string | null
  target_type: FinanceAllocationTargetType
  item_type: string
  provider_id: string | null
  amount: number
  disbursed_amount: number
  distribution_status: FinanceDistributionStatus
  created_at: string
}

export interface FinanceGatewayEvent {
  id: string
  provider: string
  event_key: string
  merchant_order_id: string | null
  signature_valid: number
  payload_json: string
  processing_status: FinanceGatewayEventStatus
  created_at: string
}

export interface FinanceReconciliationItem {
  id: string
  reconciliation_id: string | null
  payment_id: string | null
  settlement_id: string | null
  cash_session_id: string | null
  external_reference: string | null
  internal_amount: number
  external_amount: number
  discrepancy_amount: number
  match_status: FinanceReconciliationMatchStatus
  resolution_action: FinanceReconciliationResolutionAction
  resolution_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface CreatePaymentOrderItemInput {
  obligationId?: string | null
  itemType: FinanceItemType | 'UANG_JAJAN'
  amount: number
}

export interface CreatePaymentOrderInput {
  santriId: string
  payerType: FinancePayerType
  paymentMethod?: FinancePaymentMethod | null
  feePayer?: FinanceFeePayer
  cooperativeAdminFee?: number
  expiresInHours?: number
  cashSessionId?: string | null
  items: CreatePaymentOrderItemInput[]
}

export interface PaymentOrderWithItems extends FinancePaymentOrder {
  items: FinanceOrderItem[]
}

export interface RecordOrderPaymentInput {
  orderId: string
  channel: FinancePaymentChannel
  method: string
  source?: FinancePaymentSource
  fundManagement?: FinanceFundManagement
  externalReference?: string | null
  cooperativeAdminFee?: number
  briFeeAmount?: number | null
  briPaymentRequestId?: string | null
  briTrxId?: string | null
  cashSessionId?: string | null
  receivedBy?: string | null
  paidAt?: string
}

export interface RecordUnallocatedPaymentInput {
  santriId: string
  amount: number
  channel: FinancePaymentChannel
  method: string
  source?: FinancePaymentSource
  fundManagement?: FinanceFundManagement
  externalReference?: string | null
  cooperativeAdminFee?: number
  briFeeAmount?: number | null
  briPaymentRequestId?: string | null
  briTrxId?: string | null
  cashSessionId?: string | null
  receivedBy?: string | null
  paidAt?: string
}

export interface PaymentWithAllocations extends FinancePayment {
  allocations: FinanceAllocation[]
}

// ============================================================
// BIAYA ADMINISTRASI KOPERASI & APPEND-ONLY INCOME LEDGER
// ============================================================

export interface FinanceCooperativeAdminFeeRule {
  id: string
  code: string
  name: string
  is_enabled: number
  amount: number
  applies_to_channel: 'BRI'
  effective_from: string
  effective_until: string | null
  closed_by?: string | null
  closed_at?: string | null
  created_by: string | null
  created_at: string
}

export type FinanceCooperativeIncomeEntryType = 'INCOME' | 'REVERSAL' | 'REFUND'

export interface FinanceCooperativeIncome {
  id: string
  income_number: string
  entry_type: FinanceCooperativeIncomeEntryType
  reference_income_id: string | null
  correction_id: string | null
  payment_id: string
  order_id: string | null
  amount: number
  rule_id: string | null
  rule_snapshot: string | null
  reference_note: string | null
  created_by: string | null
  created_at: string
}
