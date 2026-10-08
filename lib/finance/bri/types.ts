// lib/finance/bri/types.ts
// Official type definitions for BRIAPI / SNAP BI integration

export type BriEnvironment = 'sandbox' | 'production'

/**
 * Validation policy for X-EXTERNAL-ID per product / endpoint contract.
 * BRI imposes different constraints across products (e.g. BRIVA: 36 numeric; Bank Statement: 9 numeric).
 */
export interface BriExternalIdPolicy {
  /** Character class constraint */
  readonly format: 'numeric' | 'alphanumeric'
  /** Exact length constraint if fixed */
  readonly exactLength?: number
  /** Minimum length if variable */
  readonly minLength?: number
  /** Maximum length if variable */
  readonly maxLength?: number
  /** Descriptive identifier of the endpoint contract */
  readonly description?: string
}

/** Standard endpoint policies derived from official BRIAPI product documentation */
export const BRI_ENDPOINT_EXTERNAL_ID_POLICIES = {
  /** BRIVA Online transactional APIs: Numeric string, length 36 */
  BRIVA_ONLINE: {
    format: 'numeric',
    exactLength: 36,
    description: 'BRIVA Online (Numeric, 36 digits)',
  } as BriExternalIdPolicy,

  /** Bank Statement SNAP BI API: Numeric string, length 9 */
  BANK_STATEMENT: {
    format: 'numeric',
    exactLength: 9,
    description: 'Bank Statement SNAP BI (Numeric, 9 digits)',
  } as BriExternalIdPolicy,

  /** BRIVA Payment Push Notification: Alphanumeric string, length 12 */
  BRIVA_PAYMENT_NOTIFICATION: {
    format: 'alphanumeric',
    exactLength: 12,
    description: 'BRIVA Payment Notification (Alphanumeric, 12 chars)',
  } as BriExternalIdPolicy,
} as const

export interface BriConfig {
  /** Target environment: strictly 'sandbox' or 'production' */
  readonly env: BriEnvironment
  /** Base URL for BRIAPI endpoints (e.g. https://sandbox.partner.api.bri.co.id) */
  readonly baseUrl: string
  /** Canonical Client Key / Client ID issued by BRIAPI */
  readonly clientKey: string
  /** Alias for clientKey */
  readonly clientId: string
  /** Partner ID for X-PARTNER-ID header (distinct from partnerServiceId) */
  readonly partnerId: string
  /** Client Secret for HMAC-SHA512 signing */
  readonly clientSecret: string
  /** RSA-2048 Private Key in PEM format (PKCS#8 or PKCS#1) for B2B token signing */
  readonly privateKey: string
  /** Configured timestamp timezone offset in hours (e.g. 7 for WIB, 0 for UTC). Subject to sandbox verification */
  readonly timestampOffsetHours: number
  /** Channel identifier (e.g. '00009') */
  readonly channelId: string
  /** Request timeout in milliseconds (default: 15,000ms) */
  readonly timeoutMs: number
  /** Server-side outbound kill switch. If false, all outbound network requests are blocked */
  readonly outboundEnabled: boolean
  /** Authoritative Cooperative Collection Account Number (e.g. '001901000123301'). Mandatory fail-closed in production */
  readonly collectionAccountNo?: string
}

export type BriErrorCategory =
  | 'CONFIG_ERROR'
  | 'AUTH_ERROR'
  | 'SIGNATURE_ERROR'
  | 'TOKEN_ERROR'
  | 'NETWORK_ERROR'
  | 'NETWORK_UNKNOWN'
  | 'TIMEOUT_UNKNOWN'
  | 'SERVER_RESPONSE_ERROR'
  | 'PROVIDER_OUTCOME_UNKNOWN'
  | 'PROVIDER_REJECTED'
  | 'MALFORMED_RESPONSE'

export interface BriTokenRequest {
  grantType: 'client_credentials'
  additionalInfo?: Record<string, unknown>
}

export interface BriTokenResponse {
  responseCode?: string
  responseMessage?: string
  accessToken: string
  tokenType: string
  expiresIn: string | number
  additionalInfo?: Record<string, unknown>
}

export interface CachedBriToken {
  accessToken: string
  tokenType: string
  expiresAt: number
}

export type BriHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// =========================================================================
// TRANSPORT VS PRODUCT BUSINESS OUTCOME SEPARATION
// =========================================================================

/**
 * Layer 1: Pure Transport Result from HTTP Network Interaction
 */
export interface BriTransportResponse<T = unknown> {
  httpStatus: number
  data: T
  headers: Record<string, string>
  responseCode?: string
  responseMessage?: string
  correlationId: string
  externalId: string
  durationMs: number
}

/**
 * Classification of Provider Business Outcome
 */
export type BriOutcomeClassification =
  | 'SUCCESS'                  // Terminal success (e.g. 2007300)
  | 'PENDING'                  // In-progress / pending (e.g. HTTP 202 or known pending code)
  | 'TERMINAL_REJECTED'        // Known terminal rejection by provider
  | 'AUTH_FAILURE'             // Token authentication error (requires cache invalidation)
  | 'SUSPEND_INVESTIGATE'      // Requires suspend / status inquiry (e.g. 429, 500, 504)
  | 'PROVIDER_OUTCOME_UNKNOWN' // Unknown or unlisted provider responseCode

/**
 * Layer 2: Product Business Outcome derived from Transport Result + Endpoint Contract
 */
export interface BriBusinessOutcome<T = unknown> {
  classification: BriOutcomeClassification
  /** True ONLY if the outcome is deterministically known at the provider */
  outcomeKnown: boolean
  /** Underlying transport response */
  transport: BriTransportResponse<T>
  /** Indicates whether the state is terminal (cannot transition further) */
  isTerminal: boolean
  /** Indicates whether status inquiry / reconciliation / reversal is needed */
  requiresInquiryOrReconciliation: boolean
  /** Human-readable sanitized description of outcome */
  sanitizedMessage: string
}

/**
 * Policy definition for mapping endpoint-specific response codes to business outcomes
 */
export interface BriEndpointResponsePolicy<T = unknown> {
  endpointName?: string
  /** Known terminal success response codes (e.g. ['2007300', '2000000']) */
  successCodes?: string[]
  /** Known in-progress / pending response codes (e.g. ['2027300']) */
  pendingCodes?: string[]
  /** Known terminal rejection codes (e.g. ['4047300', '4037301']) */
  terminalRejectionCodes?: string[]
  /** Known B2B token auth failure codes (e.g. ['4017300', '4017301']) */
  authFailureCodes?: string[]
  /** Known suspend / investigate codes (e.g. ['4297300', '5007300', '5047300']) */
  suspendCodes?: string[]
  /** Optional custom resolver function */
  customResolver?: (transport: BriTransportResponse<T>) => BriBusinessOutcome<T>
}

export interface BriRequestOptions<T = unknown> {
  method: BriHttpMethod
  endpointPath: string
  body?: unknown
  /** Explicit external ID or external ID generation policy */
  externalId?: string
  externalIdPolicy?: BriExternalIdPolicy
  partnerId?: string
  channelId?: string
  correlationId?: string
  headers?: Record<string, string>
  timeoutMs?: number
  /** Endpoint response mapping policy */
  responsePolicy?: BriEndpointResponsePolicy<T>
}

/**
 * Combined result providing both transport details and resolved business outcome
 */
export interface BriClientResult<T = unknown> {
  transport: BriTransportResponse<T>
  outcome: BriBusinessOutcome<T>
  // Aliases for convenient backward compatibility
  status: number
  data: T
  headers: Record<string, string>
  correlationId: string
  externalId: string
  durationMs: number
}

/**
 * Backward compatibility alias for BriClientResult
 */
export type BriResponse<T = unknown> = BriClientResult<T>

export interface BriSignatureResult {
  signature: string
  stringToSign: string
  bodyHash: string
  minifiedBody: string
}
