// lib/finance/bri/outcome.ts
// Product business outcome resolver decoupling core transport from endpoint semantics

import type { BriBusinessOutcome, BriEndpointResponsePolicy, BriTransportResponse } from './types'

/**
 * Checks if a response code or message specifically indicates an OAuth B2B token failure.
 * Distinct from business 403 rejections (Feature Not Allowed, Limit Exceeded, Suspected Fraud, etc.).
 */
export function isKnownTokenAuthError(responseCode?: string, responseMessage?: string): boolean {
  if (!responseCode && !responseMessage) return false
  const code = (responseCode || '').trim()
  const msg = (responseMessage || '').toLowerCase()

  // SNAP BI standard B2B token error codes
  if (
    code === '4017300' ||
    code === '4017301' ||
    code === '4017302' ||
    code === '4010000' ||
    code.startsWith('40173')
  ) {
    return true
  }

  // Explicit message phrases indicating token invalidity
  if (
    msg.includes('invalid token') ||
    msg.includes('token not found') ||
    msg.includes('token expired') ||
    msg.includes('unauthorized')
  ) {
    // Ensure it's not a business rejection that happens to contain "token"
    if (!msg.includes('feature not allowed') && !msg.includes('limit exceeded') && !msg.includes('fraud')) {
      return true
    }
  }

  return false
}

/**
 * Resolves a transport response into a product-level business outcome using the endpoint's contract policy.
 *
 * SAFETY INVARIANTS:
 * 1. HTTP 202 is NEVER terminal success; classified as PENDING (outcomeKnown: false).
 * 2. Unknown or unlisted response codes default to PROVIDER_OUTCOME_UNKNOWN (outcomeKnown: false).
 * 3. 429, 500, 504 are classified as SUSPEND_INVESTIGATE with outcomeKnown: false.
 * 4. Token cache is only marked for invalidation on verified AUTH_FAILURE, never on business 403 rejections.
 * 5. TERMINAL_REJECTED is applied ONLY when explicitly listed in policy.terminalRejectionCodes.
 */
export function resolveBriOutcome<T = unknown>(
  transport: BriTransportResponse<T>,
  policy?: BriEndpointResponsePolicy<T>
): BriBusinessOutcome<T> {
  // 1. Custom resolver override if provided by endpoint adapter
  if (policy?.customResolver) {
    return policy.customResolver(transport)
  }

  const code = transport.responseCode || ''
  const httpStatus = transport.httpStatus
  const message = transport.responseMessage || `HTTP ${httpStatus}`

  // 2. HTTP 202 or known pending codes -> PENDING (outcomeKnown: false)
  if (httpStatus === 202 || (policy?.pendingCodes && policy.pendingCodes.includes(code))) {
    return {
      classification: 'PENDING',
      outcomeKnown: false,
      transport,
      isTerminal: false,
      requiresInquiryOrReconciliation: true,
      sanitizedMessage: `Request in progress / pending (Code: ${code || 'HTTP 202'})`,
    }
  }

  // 3. Verified B2B token auth errors -> AUTH_FAILURE (outcomeKnown: true, requires token cache invalidation)
  if (
    httpStatus === 401 ||
    (policy?.authFailureCodes && policy.authFailureCodes.includes(code)) ||
    isKnownTokenAuthError(code, message)
  ) {
    return {
      classification: 'AUTH_FAILURE',
      outcomeKnown: true,
      transport,
      isTerminal: true,
      requiresInquiryOrReconciliation: false,
      sanitizedMessage: `B2B Token authentication failure: ${message} (HTTP: ${httpStatus}, Code: ${code || '401'})`,
    }
  }

  // 4. Known success codes -> SUCCESS (outcomeKnown: true)
  if (policy?.successCodes && policy.successCodes.includes(code)) {
    return {
      classification: 'SUCCESS',
      outcomeKnown: true,
      transport,
      isTerminal: true,
      requiresInquiryOrReconciliation: false,
      sanitizedMessage: message || 'Transaction successful',
    }
  }

  // If no successCodes configured in policy, default 200 with code starting with '200' is treated as success
  if (!policy?.successCodes && httpStatus === 200 && (!code || code.startsWith('200'))) {
    return {
      classification: 'SUCCESS',
      outcomeKnown: true,
      transport,
      isTerminal: true,
      requiresInquiryOrReconciliation: false,
      sanitizedMessage: message || 'Transaction successful',
    }
  }

  // 5. Explicitly mapped terminal rejection codes -> TERMINAL_REJECTED (outcomeKnown: true)
  if (policy?.terminalRejectionCodes && policy.terminalRejectionCodes.includes(code)) {
    return {
      classification: 'TERMINAL_REJECTED',
      outcomeKnown: true,
      transport,
      isTerminal: true,
      requiresInquiryOrReconciliation: false,
      sanitizedMessage: `Provider rejected transaction: ${message} (Code: ${code})`,
    }
  }

  // 6. Suspend / Gateway timeout / Rate limit (429, 500, 504) -> SUSPEND_INVESTIGATE (outcomeKnown: false)
  if (
    httpStatus === 429 ||
    httpStatus === 504 ||
    httpStatus >= 500 ||
    (policy?.suspendCodes && policy.suspendCodes.includes(code))
  ) {
    return {
      classification: 'SUSPEND_INVESTIGATE',
      outcomeKnown: false,
      transport,
      isTerminal: false,
      requiresInquiryOrReconciliation: true,
      sanitizedMessage: `Server suspend / investigation required: ${message} (HTTP: ${httpStatus}, Code: ${code || 'NONE'})`,
    }
  }

  // 7. Fallback: Any other unlisted code -> PROVIDER_OUTCOME_UNKNOWN (outcomeKnown: false)
  // NEVER assume rejection automatically! Status at bank is unknown and must be investigated.
  return {
    classification: 'PROVIDER_OUTCOME_UNKNOWN',
    outcomeKnown: false,
    transport,
    isTerminal: false,
    requiresInquiryOrReconciliation: true,
    sanitizedMessage: `Unknown provider response: ${message} (HTTP: ${httpStatus}, Code: ${code || 'NONE'})`,
  }
}
