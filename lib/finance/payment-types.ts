// lib/finance/payment-types.ts
// Tipe data pembayaran, order, alokasi, dan gateway (Fase 3A: Payment Engine Core)

import type { FinanceItemType } from '@/lib/finance/types'

export type FinancePaymentMethod = 'DUITKU_VA' | 'DUITKU_QRIS' | 'CASH'

export type FinancePayerType = 'PORTAL_ORTU' | 'LOKET'

export type FinanceFeePayer = 'CUSTOMER' | 'INSTITUTION'

export type FinanceOrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'

export type FinancePaymentChannel = 'DUITKU' | 'CASH'

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
  santri_id: string
  va_number: string
  bank_code: string
  created_at: string
}

export interface FinancePaymentOrder {
  id: string
  order_number: string
  santri_id: string
  payer_type: FinancePayerType
  gross_amount: number
  gateway_fee: number
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
  gateway_fee: number
  net_amount: number
  status: FinancePaymentStatus
  correction_status: FinanceCorrectionStatus
  allocation_status: FinanceAllocationStatus
  paid_at: string
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
  gatewayFee?: number
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
  gatewayFee?: number
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
  gatewayFee?: number
  cashSessionId?: string | null
  receivedBy?: string | null
  paidAt?: string
}

export interface PaymentWithAllocations extends FinancePayment {
  allocations: FinanceAllocation[]
}

// ============================================================
// Duitku Payment Gateway Types (Fase 3B)
// ============================================================

export interface DuitkuConfig {
  merchantCode: string
  apiKey: string
  environment: 'sandbox' | 'production'
  callbackUrl?: string
  returnUrl?: string
  defaultExpiryMinutes: number
}

export interface DuitkuCallbackPayload {
  merchantCode: string
  amount: string | number
  merchantOrderId: string
  productDetail?: string
  additionalParam?: string
  paymentCode?: string
  resultCode: string // '00' = Success, '01' = Failed
  merchantUserId?: string
  reference: string
  signature: string
  publisherOrderId?: string
  spUserHash?: string
  settlementDate?: string
  issuerCode?: string
  customerName?: string
}

export interface DuitkuCreateTransactionInput {
  paymentAmount: number
  paymentMethod: string
  merchantOrderId: string
  productDetails: string
  email: string
  phoneNumber?: string
  customerVaName: string
  callbackUrl?: string
  returnUrl?: string
  expiryPeriod?: number // in minutes
}

export interface DuitkuCreateTransactionResponse {
  merchantCode: string
  reference: string
  paymentUrl: string
  vaNumber?: string
  qrString?: string
  amount: string
  statusCode: string // '00' = Success
  statusMessage: string
}

export interface DuitkuCheckTransactionResponse {
  merchantOrderId: string
  reference: string
  amount: string
  fee: string
  statusCode: string // '00' = Success, '01' = Pending, '02' = Canceled
  statusMessage: string
}

export interface ProcessDuitkuCallbackResult {
  success: boolean
  message: string
  paymentId?: string
  paymentNumber?: string
  orderId?: string | null
  reconciliationItemId?: string
  isDuplicate: boolean
  matchType:
    | 'ORDER_ALLOCATED'
    | 'UNALLOCATED_TRANSFER'
    | 'UNMATCHED_EXTERNAL'
    | 'EXPIRED_OR_CANCELLED_ORDER'
    | 'AMOUNT_MISMATCH'
    | 'ALREADY_PROCESSED'
}

// ============================================================
// Duitku SNAP API Types (Fixed Virtual Account)
// ============================================================

export interface DuitkuSnapConfig {
  partnerId: string
  partnerServiceId: string // Prefix VA bank dari Duitku
  clientSecret: string
  privateKey: string
  duitkuPublicKey?: string
  environment: 'sandbox' | 'production'
  defaultTrxType: 'C' | 'O' // 'C' = Close Amount, 'O' = Open Amount
}

export interface SnapTokenResponse {
  responseCode: string // '2007300'
  responseMessage: string
  accessToken: string
  tokenType: string // 'Bearer'
  expiresIn: string // e.g. '900'
}

export interface SnapCreateVaInput {
  customerNo: string
  virtualAccountName: string
  trxId: string
  trxType?: 'C' | 'O'
  amount?: number
  expiredDate?: string // ISO-8601
  minAmount?: number
  maxAmount?: number
}

export interface SnapCreateVaResponse {
  responseCode: string // '2002700'
  responseMessage: string
  virtualAccountData: {
    partnerServiceId: string
    customerNo: string
    virtualAccountNo: string
    virtualAccountName: string
    trxId: string
    totalAmount: {
      value: string
      currency: string
    }
    virtualAccountTrxType: 'C' | 'O'
    expiredDate: string
  }
}

export interface SnapUpdateVaInput {
  customerNo: string
  virtualAccountName?: string
  trxId: string
  amount?: number
  expiredDate?: string
}

export interface SnapUpdateVaResponse {
  responseCode: string // '2002800'
  responseMessage: string
  virtualAccountData: {
    partnerServiceId: string
    customerNo: string
    virtualAccountNo: string
    virtualAccountName: string
    trxId: string
    totalAmount: {
      value: string
      currency: string
    }
  }
}

export interface SnapInquiryVaResponse {
  responseCode: string // '2003000'
  responseMessage: string
  virtualAccountData: {
    partnerServiceId: string
    customerNo: string
    virtualAccountNo: string
    virtualAccountName: string
    trxId: string
    totalAmount: {
      value: string
      currency: string
    }
    virtualAccountTrxType: 'C' | 'O'
    expiredDate: string
  }
}

export interface SnapPaymentNotificationPayload {
  partnerServiceId: string
  customerNo: string
  virtualAccountNo: string
  paymentRequestId: string
  trxId: string
  paidAmount: {
    value: string
    currency: string
  }
  additionalInfo: {
    reference: string
    paymentCode?: string
    [key: string]: unknown
  }
}

export interface SnapPaymentNotificationResponse {
  responseCode: string // '2002500'
  responseMessage: string
  virtualAccountData?: {
    partnerServiceId: string
    customerNo: string
    virtualAccountNo: string
    virtualAccountName: string
    paymentRequestId: string
    paidAmount: {
      value: string
      currency: string
    }
  }
}

export interface ProcessSnapPaymentResult {
  success: boolean
  responseCode: string
  responseMessage: string
  paymentId?: string
  paymentNumber?: string
  orderId?: string | null
  isDuplicate: boolean
  matchType:
    | 'ORDER_ALLOCATED'
    | 'UNALLOCATED_TRANSFER'
    | 'EXPIRED_OR_CANCELLED_ORDER'
    | 'AMOUNT_MISMATCH'
    | 'ALREADY_PROCESSED'
  virtualAccountData?: {
    partnerServiceId: string
    customerNo: string
    virtualAccountNo: string
    virtualAccountName: string
    paymentRequestId: string
    paidAmount: {
      value: string
      currency: string
    }
  }
}

