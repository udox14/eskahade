// lib/finance/bri/statement-policy.ts
// SNAP BI Bank Statement Response Policy (Official Service Code 14)

import type { BriEndpointResponsePolicy } from './types'
import type { BriBankStatementResponse } from './statement-types'

/**
 * Official BRI Bank Statement SNAP BI v2.1 Response Codes (Service Code 14)
 */
export const BRI_BANK_STATEMENT_CODES = {
  SUCCESS: '2001400',
  INVALID_FIELD_FORMAT: '4001401',
  INVALID_MANDATORY_FIELD: '4001402',
  UNAUTHORIZED: '4011400',
  TRANSACTION_NOT_FOUND: '4041401',
  CONFLICT: '4091400',
  GENERAL_ERROR: '5001400',
  TIMEOUT_PENDING: '5041400',
} as const

/**
 * Endpoint Response Policy for Bank Statement SNAP BI v2.1 (POST /snap/v2.1/bank-statement)
 * Official Service Code 14 (Account Statement / Mutasi Rekening)
 */
export const BRI_BANK_STATEMENT_POLICY: BriEndpointResponsePolicy<BriBankStatementResponse> = {
  endpointName: 'BANK_STATEMENT',
  successCodes: [BRI_BANK_STATEMENT_CODES.SUCCESS],
  pendingCodes: [BRI_BANK_STATEMENT_CODES.TIMEOUT_PENDING],
  terminalRejectionCodes: [
    BRI_BANK_STATEMENT_CODES.INVALID_FIELD_FORMAT,
    BRI_BANK_STATEMENT_CODES.INVALID_MANDATORY_FIELD,
    BRI_BANK_STATEMENT_CODES.TRANSACTION_NOT_FOUND,
    BRI_BANK_STATEMENT_CODES.CONFLICT,
  ],
  authFailureCodes: [
    BRI_BANK_STATEMENT_CODES.UNAUTHORIZED,
  ],
  suspendCodes: [
    BRI_BANK_STATEMENT_CODES.GENERAL_ERROR,
    BRI_BANK_STATEMENT_CODES.TIMEOUT_PENDING,
  ],
}
