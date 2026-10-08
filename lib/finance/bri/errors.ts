// lib/finance/bri/errors.ts
// Typed error taxonomy and safe sanitization for BRIAPI integration

import type { BriErrorCategory } from './types'

function sanitizeSecretStrings(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    // Redact Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    // Redact RSA private keys
    .replace(/-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    // Redact client secret occurrences
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[REDACTED]')
    .replace(/"clientSecret"\s*:\s*"[^"]+"/gi, '"clientSecret":"[REDACTED]"')
}

export class BriError extends Error {
  readonly category: BriErrorCategory
  /** Indicates whether the state of the request at the provider is deterministically known */
  readonly outcomeKnown: boolean
  readonly httpStatus?: number
  readonly providerCode?: string
  readonly providerMessage?: string
  readonly correlationId?: string
  readonly sanitizedDetails?: Record<string, unknown>

  constructor(
    category: BriErrorCategory,
    message: string,
    options?: {
      outcomeKnown?: boolean
      httpStatus?: number
      providerCode?: string
      providerMessage?: string
      correlationId?: string
      sanitizedDetails?: Record<string, unknown>
      cause?: unknown
    }
  ) {
    const cleanMessage = sanitizeSecretStrings(message)
    super(`[BRI_${category}] ${cleanMessage}`, { cause: options?.cause })
    this.name = 'BriError'
    this.category = category

    // If not explicitly set, determine whether outcome is known:
    // TIMEOUT_UNKNOWN and NETWORK_UNKNOWN mean outcome is NOT known
    if (options?.outcomeKnown !== undefined) {
      this.outcomeKnown = options.outcomeKnown
    } else if (category === 'TIMEOUT_UNKNOWN' || category === 'NETWORK_UNKNOWN') {
      this.outcomeKnown = false
    } else {
      this.outcomeKnown = true
    }

    this.httpStatus = options?.httpStatus
    this.providerCode = options?.providerCode
    this.providerMessage = options?.providerMessage ? sanitizeSecretStrings(options.providerMessage) : undefined
    this.correlationId = options?.correlationId
    this.sanitizedDetails = options?.sanitizedDetails

    // Clean stack trace of any accidental secret leakage
    if (this.stack) {
      this.stack = sanitizeSecretStrings(this.stack)
    }
  }

  toJSON() {
    return {
      name: this.name,
      category: this.category,
      outcomeKnown: this.outcomeKnown,
      message: this.message,
      httpStatus: this.httpStatus,
      providerCode: this.providerCode,
      providerMessage: this.providerMessage,
      correlationId: this.correlationId,
      sanitizedDetails: this.sanitizedDetails,
    }
  }
}

export function isBriError(error: unknown): error is BriError {
  return (
    error instanceof BriError ||
    (typeof error === 'object' && error !== null && 'category' in error && (error as { name?: string }).name === 'BriError')
  )
}
