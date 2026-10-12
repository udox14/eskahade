// lib/finance/bri/briva-types.ts
// Official SNAP BI Virtual Account (BRIVA Online) type definitions, request/response contracts, and status codes

/**
 * Common SNAP BI Currency & Amount Structure
 */
export interface BriVaAmount {
  value: string // String decimal formatted to 2 decimal places, e.g. "153000.00"
  currency: 'IDR' | string
}

/**
 * Inbound Request Headers for SNAP BI Webhooks
 */
export interface BriInboundHeaders {
  timestamp: string
  signature: string
  partnerId: string
  externalId: string
  channelId?: string
  contentType: string
  authorization?: string
}

/**
 * SNAP BI Virtual Account Inquiry Request (Service Code 24)
 * Endpoint: POST .../transfer-va/inquiry
 */
export interface BriVaInquiryRequest {
  partnerServiceId: string
  customerNo: string
  virtualAccountNo: string
  inquiryRequestId: string
  channelId?: string
  trxDateInit?: string
  additionalInfo?: Record<string, unknown>
}

/**
 * Virtual Account Data payload inside Inquiry Response
 */
export interface BriVaInquiryVirtualAccountData {
  partnerServiceId: string
  customerNo: string
  virtualAccountNo: string
  virtualAccountName: string
  totalAmount: BriVaAmount
  virtualAccountTrxType?: string // "1" = Closed/Fixed Bill
  feeAmount?: BriVaAmount
  inquiryRequestId: string
  additionalInfo?: Record<string, unknown>
}

/**
 * SNAP BI Virtual Account Inquiry Response (Service Code 24)
 */
export interface BriVaInquiryResponse {
  responseCode: string
  responseMessage: string
  virtualAccountData?: BriVaInquiryVirtualAccountData
}

/**
 * SNAP BI Virtual Account Payment Notification Request (Service Code 25)
 * Endpoint: POST .../transfer-va/payment
 */
export interface BriVaPaymentRequest {
  partnerServiceId: string
  customerNo: string
  virtualAccountNo: string
  virtualAccountName?: string
  paymentRequestId: string
  inquiryRequestId?: string
  channelId?: string
  paidAmount: BriVaAmount
  totalAmount?: BriVaAmount
  trxDateTime?: string
  referenceNo?: string
  journalNum?: string
  additionalInfo?: {
    trxId?: string
    [key: string]: unknown
  }
}

/**
 * Virtual Account Data payload inside Payment Notification Response
 */
export interface BriVaPaymentVirtualAccountData {
  partnerServiceId: string
  customerNo: string
  virtualAccountNo: string
  virtualAccountName: string
  paymentRequestId: string
  paidAmount: BriVaAmount
  additionalInfo?: Record<string, unknown>
}

/**
 * SNAP BI Virtual Account Payment Notification Response (Service Code 25)
 */
export interface BriVaPaymentResponse {
  responseCode: string
  responseMessage: string
  virtualAccountData?: BriVaPaymentVirtualAccountData
}

/**
 * SNAP BI Response Codes for BRIVA Inquiry (Service Code: 24)
 * Format: [HTTP_STATUS][SERVICE_CODE][CASE_CODE]
 */
export const BRI_VA_INQUIRY_CODES = {
  SUCCESS: '2002400',
  BAD_REQUEST: '4002400',
  INVALID_MANDATORY_FIELD: '4002401',
  INVALID_FIELD_FORMAT: '4002402',
  UNAUTHORIZED: '4012400',
  INVALID_VIRTUAL_ACCOUNT: '4042411',
  BILL_NOT_FOUND: '4042412',
  INVALID_AMOUNT: '4042413',
  BILL_ALREADY_PAID: '4042414',
  RATE_LIMIT_EXCEEDED: '4292400',
  GENERAL_ERROR: '5002400',
  GATEWAY_TIMEOUT: '5042400',
} as const

/**
 * SNAP BI Response Codes for BRIVA Payment (Service Code: 25)
 * Format: [HTTP_STATUS][SERVICE_CODE][CASE_CODE]
 */
export const BRI_VA_PAYMENT_CODES = {
  SUCCESS: '2002500',
  BAD_REQUEST: '4002500',
  INVALID_MANDATORY_FIELD: '4002501',
  INVALID_FIELD_FORMAT: '4002502',
  UNAUTHORIZED: '4012500',
  INVALID_VIRTUAL_ACCOUNT: '4042511',
  BILL_NOT_FOUND: '4042512',
  INVALID_AMOUNT: '4042513',
  BILL_ALREADY_PAID: '4042514',
  CONFLICT: '4092500',
  RATE_LIMIT_EXCEEDED: '4292500',
  GENERAL_ERROR: '5002500',
  GATEWAY_TIMEOUT: '5042500',
} as const
