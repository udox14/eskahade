import crypto from 'node:crypto'
import { BriError } from './errors'
import { generateBriBusinessSignature, getBriTimestamp, minifyJsonBody } from './crypto'
import { BriTokenClient } from './token'
import { briLog } from './logging'
import { isKnownTokenAuthError, resolveBriOutcome } from './outcome'
import type {
  BriClientResult,
  BriConfig,
  BriExternalIdPolicy,
  BriRequestOptions,
  BriResponse,
  BriTransportResponse,
} from './types'

/**
 * Validates an external ID against an explicit product / endpoint policy.
 */
export function validateExternalId(externalId: string, policy: BriExternalIdPolicy): void {
  if (!externalId || typeof externalId !== 'string') {
    throw new BriError('CONFIG_ERROR', `X-EXTERNAL-ID must be a non-empty string. Target: ${policy.description || 'Unknown'}`)
  }

  if (policy.format === 'numeric' && !/^\d+$/.test(externalId)) {
    throw new BriError(
      'CONFIG_ERROR',
      `X-EXTERNAL-ID must be strictly numeric for ${policy.description || 'endpoint'}. Received: "${externalId}"`
    )
  }

  if (policy.format === 'alphanumeric' && !/^[a-zA-Z0-9]+$/.test(externalId)) {
    throw new BriError(
      'CONFIG_ERROR',
      `X-EXTERNAL-ID must be alphanumeric for ${policy.description || 'endpoint'}. Received: "${externalId}"`
    )
  }

  if (policy.exactLength !== undefined && externalId.length !== policy.exactLength) {
    throw new BriError(
      'CONFIG_ERROR',
      `X-EXTERNAL-ID length mismatch for ${policy.description || 'endpoint'}. Expected exact length ${policy.exactLength}, got ${externalId.length}.`
    )
  }

  if (policy.minLength !== undefined && externalId.length < policy.minLength) {
    throw new BriError(
      'CONFIG_ERROR',
      `X-EXTERNAL-ID length too short for ${policy.description || 'endpoint'}. Expected >= ${policy.minLength}, got ${externalId.length}.`
    )
  }

  if (policy.maxLength !== undefined && externalId.length > policy.maxLength) {
    throw new BriError(
      'CONFIG_ERROR',
      `X-EXTERNAL-ID length too long for ${policy.description || 'endpoint'}. Expected <= ${policy.maxLength}, got ${externalId.length}.`
    )
  }
}

/**
 * Generates an external ID complying with an explicit endpoint policy.
 */
export function generateExternalIdForPolicy(policy: BriExternalIdPolicy): string {
  const targetLen = policy.exactLength ?? policy.maxLength ?? 16

  if (policy.format === 'numeric') {
    const timeStr = Date.now().toString() // ~13 digits
    if (targetLen <= 13) {
      return timeStr.slice(-targetLen)
    }
    const remaining = targetLen - timeStr.length
    let rand = ''
    while (rand.length < remaining) {
      rand += Math.floor(Math.random() * 10).toString()
    }
    return `${timeStr}${rand}`
  }

  // Alphanumeric
  const randomChars = crypto.randomBytes(Math.ceil(targetLen / 2)).toString('hex').slice(0, targetLen)
  return randomChars
}

/**
 * Generates an internal correlation ID for tracing and logging.
 */
export function generateCorrelationId(): string {
  const randHex = crypto.randomBytes(6).toString('hex')
  return `bri_${Date.now()}_${randHex}`
}

export interface BriClientOptions {
  config: BriConfig
  tokenClient?: BriTokenClient
  customFetch?: typeof fetch
}

export class BriClient {
  readonly config: BriConfig
  readonly tokenClient: BriTokenClient
  private readonly fetchFn: typeof fetch

  constructor(options: BriClientOptions) {
    this.config = options.config
    this.fetchFn = options.customFetch || fetch
    this.tokenClient = options.tokenClient || new BriTokenClient({ config: options.config, customFetch: this.fetchFn })
  }

  /**
   * Executes the raw signed HTTP transport request to BRIAPI following SNAP BI standards.
   * Authoritative strictly for transport facts:
   * - HTTP status
   * - Response headers
   * - Parsed / raw body
   * - Duration
   * - Correlation ID & External ID
   */
  async executeTransportRequest<T = unknown>(options: BriRequestOptions<T>): Promise<BriTransportResponse<T>> {
    // 1. Operational Kill Switch Guard
    if (!this.config.outboundEnabled) {
      throw new BriError(
        'CONFIG_ERROR',
        'BRI outbound network operations are disabled by operational kill switch (BRI_OUTBOUND_ENABLED=false).'
      )
    }

    const correlationId = options.correlationId || generateCorrelationId()
    const endpointPath = options.endpointPath.startsWith('/') ? options.endpointPath : `/${options.endpointPath}`
    const fullUrl = `${this.config.baseUrl}${endpointPath}`
    const method = options.method.toUpperCase().trim() as BriRequestOptions['method']
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs

    // 2. Validate / Resolve X-PARTNER-ID (Required for business requests)
    const partnerId = (options.partnerId || this.config.partnerId || '').trim()
    if (!partnerId) {
      throw new BriError(
        'CONFIG_ERROR',
        'Missing required X-PARTNER-ID for BRI business API request. Configure BRI_PARTNER_ID or pass partnerId in options.'
      )
    }

    // 3. Resolve and validate X-EXTERNAL-ID per Endpoint Policy
    // Universal 16-digit default is strictly forbidden. Must be provided or policy-generated.
    let externalId: string
    if (options.externalId) {
      externalId = options.externalId.trim()
      if (options.externalIdPolicy) {
        validateExternalId(externalId, options.externalIdPolicy)
      }
    } else if (options.externalIdPolicy) {
      externalId = generateExternalIdForPolicy(options.externalIdPolicy)
      validateExternalId(externalId, options.externalIdPolicy)
    } else {
      throw new BriError(
        'CONFIG_ERROR',
        `X-EXTERNAL-ID contract is endpoint-specific and cannot use a universal default. ` +
          `Provide an explicit externalId or specify externalIdPolicy for endpoint: ${endpointPath}`
      )
    }

    // 4. Obtain valid B2B OAuth access token
    let accessToken: string
    try {
      accessToken = await this.tokenClient.getAccessToken()
    } catch (tokenErr) {
      if (tokenErr instanceof BriError) {
        throw tokenErr
      }
      throw new BriError('TOKEN_ERROR', 'Failed to obtain B2B access token before signing request', {
        correlationId,
        cause: tokenErr,
      })
    }

    // 5. Timestamp and Signature calculation
    const timestamp = getBriTimestamp(undefined, this.config.timestampOffsetHours)

    const hasBody = options.body !== undefined && options.body !== null
    const minifiedBody = hasBody ? minifyJsonBody(options.body) : ''

    let signature: string
    try {
      const sigResult = generateBriBusinessSignature({
        method,
        endpointPath,
        accessToken,
        body: hasBody ? options.body : undefined,
        timestamp,
        clientSecret: this.config.clientSecret,
      })
      signature = sigResult.signature
    } catch (sigErr) {
      throw new BriError('SIGNATURE_ERROR', 'Failed to generate business request HMAC-SHA512 signature', {
        correlationId,
        cause: sigErr,
      })
    }

    // 6. Construct authoritative SNAP BI headers
    const channelId = options.channelId || this.config.channelId
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-SIGNATURE': signature,
      'X-TIMESTAMP': timestamp,
      'X-PARTNER-ID': partnerId,
      'X-EXTERNAL-ID': externalId,
      'CHANNEL-ID': channelId,
      ...options.headers,
    }

    // 7. Execute HTTP fetch with strict timeout & conservative unknown outcome handling
    const controller = new AbortController()
    let timeoutHandle: NodeJS.Timeout | null = null

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        controller.abort()
      }, timeoutMs)
    }

    const startTime = Date.now()
    let response: Response

    try {
      response = await this.fetchFn(fullUrl, {
        method,
        headers,
        body: method !== 'GET' && hasBody ? minifiedBody : undefined,
        signal: controller.signal,
      })
    } catch (fetchErr: unknown) {
      const durationMs = Date.now() - startTime

      const isAbort =
        (typeof fetchErr === 'object' && fetchErr !== null && (fetchErr as { name?: string }).name === 'AbortError') ||
        controller.signal.aborted

      if (isAbort) {
        briLog('error', 'BRI_REQUEST_TIMEOUT', {
          endpoint: endpointPath,
          method,
          correlationId,
          externalId,
          durationMs,
          errorCategory: 'TIMEOUT_UNKNOWN',
        })
        throw new BriError(
          'TIMEOUT_UNKNOWN',
          `Request to BRI timed out after ${timeoutMs}ms. Status of operation is UNKNOWN. DO NOT retry blindly.`,
          {
            outcomeKnown: false,
            correlationId,
            sanitizedDetails: { timeoutMs, durationMs, externalId },
          }
        )
      }

      // In-flight network failure (connection reset, socket drop, fetch failure)
      briLog('error', 'BRI_REQUEST_NETWORK_UNKNOWN', {
        endpoint: endpointPath,
        method,
        correlationId,
        externalId,
        durationMs,
        errorCategory: 'NETWORK_UNKNOWN',
      })
      throw new BriError(
        'NETWORK_UNKNOWN',
        'In-flight network connection failure while communicating with BRI. Outcome of request is UNKNOWN. DO NOT retry blindly.',
        {
          outcomeKnown: false,
          correlationId,
          sanitizedDetails: { durationMs, externalId },
          cause: fetchErr,
        }
      )
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
    }

    const durationMs = Date.now() - startTime
    const httpStatus = response.status

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val
    })

    // 8. Parse Response Body
    let rawBody = ''
    try {
      rawBody = await response.text()
    } catch {
      throw new BriError('MALFORMED_RESPONSE', 'Could not read response stream from BRI.', {
        httpStatus,
        correlationId,
      })
    }

    let parsedData: unknown
    try {
      parsedData = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      briLog('error', 'BRI_MALFORMED_RESPONSE', {
        endpoint: endpointPath,
        method,
        correlationId,
        externalId,
        httpStatus,
        durationMs,
        errorCategory: 'MALFORMED_RESPONSE',
      })
      throw new BriError('MALFORMED_RESPONSE', 'BRI returned non-JSON or malformed payload.', {
        httpStatus,
        correlationId,
        sanitizedDetails: { bodySnippet: rawBody.slice(0, 200) },
      })
    }

    const responseObj = (typeof parsedData === 'object' && parsedData !== null ? parsedData : {}) as {
      responseCode?: string
      responseMessage?: string
    }

    return {
      httpStatus,
      responseCode: responseObj.responseCode,
      responseMessage: responseObj.responseMessage,
      data: parsedData as T,
      headers: responseHeaders,
      correlationId,
      externalId,
      durationMs,
    }
  }

  /**
   * Executes signed request and resolves the product business outcome using the endpoint contract policy.
   * Safety guarantees:
   * 1. Transport decoupled from business outcome (no naive 2xx=success or 4xx=fail assumptions).
   * 2. HTTP 202 is mapped to PENDING (outcomeKnown: false).
   * 3. Unknown response codes fail-safe to PROVIDER_OUTCOME_UNKNOWN (outcomeKnown: false).
   * 4. Token cache invalidated ONLY on verified OAuth B2B token errors, NEVER on business 403 rejections.
   * 5. Strictly NO BLIND RETRY.
   * 6. Zero financial database writes.
   */
  async executeSignedRequest<T = unknown>(options: BriRequestOptions<T>): Promise<BriClientResult<T>> {
    const transport = await this.executeTransportRequest<T>(options)
    const outcome = resolveBriOutcome<T>(transport, options.responsePolicy)

    // Token Cache Invalidation ONLY for verified auth failure (e.g. 4017300, Invalid Token), NEVER for business 403
    if (outcome.classification === 'AUTH_FAILURE' || isKnownTokenAuthError(transport.responseCode, transport.responseMessage)) {
      await this.tokenClient.invalidateTokenCache()

      briLog('warn', 'BRI_AUTH_FAILURE', {
        endpoint: options.endpointPath,
        method: options.method,
        correlationId: transport.correlationId,
        externalId: transport.externalId,
        httpStatus: transport.httpStatus,
        durationMs: transport.durationMs,
        errorCategory: 'AUTH_ERROR',
        details: { responseCode: transport.responseCode, responseMessage: transport.responseMessage },
      })
    } else if (outcome.classification === 'SUCCESS') {
      briLog('info', 'BRI_REQUEST_SUCCESS', {
        endpoint: options.endpointPath,
        method: options.method,
        correlationId: transport.correlationId,
        externalId: transport.externalId,
        httpStatus: transport.httpStatus,
        durationMs: transport.durationMs,
        details: { responseCode: transport.responseCode || 'SUCCESS' },
      })
    } else if (outcome.classification === 'PENDING') {
      briLog('info', 'BRI_REQUEST_PENDING', {
        endpoint: options.endpointPath,
        method: options.method,
        correlationId: transport.correlationId,
        externalId: transport.externalId,
        httpStatus: transport.httpStatus,
        durationMs: transport.durationMs,
        details: { responseCode: transport.responseCode, responseMessage: transport.responseMessage },
      })
    } else if (outcome.classification === 'SUSPEND_INVESTIGATE') {
      briLog('error', 'BRI_REQUEST_SUSPEND', {
        endpoint: options.endpointPath,
        method: options.method,
        correlationId: transport.correlationId,
        externalId: transport.externalId,
        httpStatus: transport.httpStatus,
        durationMs: transport.durationMs,
        details: { responseCode: transport.responseCode, responseMessage: transport.responseMessage },
      })
    } else if (outcome.classification === 'TERMINAL_REJECTED') {
      briLog('warn', 'BRI_REQUEST_REJECTED', {
        endpoint: options.endpointPath,
        method: options.method,
        correlationId: transport.correlationId,
        externalId: transport.externalId,
        httpStatus: transport.httpStatus,
        durationMs: transport.durationMs,
        details: { responseCode: transport.responseCode, responseMessage: transport.responseMessage },
      })
    } else {
      // PROVIDER_OUTCOME_UNKNOWN
      briLog('warn', 'BRI_REQUEST_OUTCOME_UNKNOWN', {
        endpoint: options.endpointPath,
        method: options.method,
        correlationId: transport.correlationId,
        externalId: transport.externalId,
        httpStatus: transport.httpStatus,
        durationMs: transport.durationMs,
        details: { responseCode: transport.responseCode, responseMessage: transport.responseMessage },
      })
    }

    return {
      transport,
      outcome,
      status: transport.httpStatus,
      data: transport.data,
      headers: transport.headers,
      correlationId: transport.correlationId,
      externalId: transport.externalId,
      durationMs: transport.durationMs,
    }
  }
}
