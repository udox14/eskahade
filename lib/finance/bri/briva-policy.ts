// lib/finance/bri/briva-policy.ts
// Endpoint response policies for SNAP BI Virtual Account (Inquiry Service 24 & Payment Service 25)

import type { BriEndpointResponsePolicy } from './types'
import {
  BRI_VA_INQUIRY_CODES,
  BRI_VA_PAYMENT_CODES,
  type BriVaInquiryResponse,
  type BriVaPaymentResponse,
} from './briva-types'

/**
 * SNAP BI BRIVA Inquiry Response Policy (Service Code 24)
 */
export const BRI_VA_INQUIRY_POLICY: BriEndpointResponsePolicy<BriVaInquiryResponse> = {
  endpointName: 'BRIVA_INQUIRY',
  successCodes: [BRI_VA_INQUIRY_CODES.SUCCESS],
  pendingCodes: [],
  terminalRejectionCodes: [
    BRI_VA_INQUIRY_CODES.INVALID_VIRTUAL_ACCOUNT,
    BRI_VA_INQUIRY_CODES.BILL_NOT_FOUND,
    BRI_VA_INQUIRY_CODES.INVALID_AMOUNT,
    BRI_VA_INQUIRY_CODES.BILL_ALREADY_PAID,
    BRI_VA_INQUIRY_CODES.BAD_REQUEST,
    BRI_VA_INQUIRY_CODES.INVALID_MANDATORY_FIELD,
    BRI_VA_INQUIRY_CODES.INVALID_FIELD_FORMAT,
  ],
  authFailureCodes: [BRI_VA_INQUIRY_CODES.UNAUTHORIZED],
  suspendCodes: [
    BRI_VA_INQUIRY_CODES.RATE_LIMIT_EXCEEDED,
    BRI_VA_INQUIRY_CODES.GENERAL_ERROR,
    BRI_VA_INQUIRY_CODES.GATEWAY_TIMEOUT,
  ],
}

/**
 * SNAP BI BRIVA Payment Response Policy (Service Code 25)
 */
export const BRI_VA_PAYMENT_POLICY: BriEndpointResponsePolicy<BriVaPaymentResponse> = {
  endpointName: 'BRIVA_PAYMENT',
  successCodes: [BRI_VA_PAYMENT_CODES.SUCCESS],
  pendingCodes: [],
  terminalRejectionCodes: [
    BRI_VA_PAYMENT_CODES.INVALID_VIRTUAL_ACCOUNT,
    BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND,
    BRI_VA_PAYMENT_CODES.INVALID_AMOUNT,
    BRI_VA_PAYMENT_CODES.BILL_ALREADY_PAID,
    BRI_VA_PAYMENT_CODES.CONFLICT,
    BRI_VA_PAYMENT_CODES.BAD_REQUEST,
    BRI_VA_PAYMENT_CODES.INVALID_MANDATORY_FIELD,
    BRI_VA_PAYMENT_CODES.INVALID_FIELD_FORMAT,
  ],
  authFailureCodes: [BRI_VA_PAYMENT_CODES.UNAUTHORIZED],
  suspendCodes: [
    BRI_VA_PAYMENT_CODES.RATE_LIMIT_EXCEEDED,
    BRI_VA_PAYMENT_CODES.GENERAL_ERROR,
    BRI_VA_PAYMENT_CODES.GATEWAY_TIMEOUT,
  ],
}
