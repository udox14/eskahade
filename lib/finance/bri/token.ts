// lib/finance/bri/token.ts
// OAuth 2.0 B2B token client with stampede-protected caching for BRIAPI / SNAP BI

import { BriError } from './errors'
import { generateBriTokenSignature, getBriTimestamp } from './crypto'
import { briLog } from './logging'
import type { BriConfig, BriTokenRequest, BriTokenResponse, CachedBriToken } from './types'

export interface TokenClientOptions {
  config: BriConfig
  customFetch?: typeof fetch
  getKvBinding?: () => Promise<{
    get(k: string): Promise<string | null>
    put(k: string, v: string, opt?: { expirationTtl?: number }): Promise<void>
    delete(k: string): Promise<void>
  } | null>
}

export class BriTokenClient {
  private readonly config: BriConfig
  private readonly fetchFn: typeof fetch
  private readonly getKvBinding?: TokenClientOptions['getKvBinding']

  // In-memory cache for current isolate
  private inMemoryCache: CachedBriToken | null = null

  // Single-flight lock to prevent token stampede across concurrent callers in the current isolate
  // NOTE: This lock is per-isolate. Cloudflare Workers multi-isolate distributed locking is not guaranteed by in-memory mutex.
  private inflightPromise: Promise<string> | null = null

  constructor(options: TokenClientOptions) {
    this.config = options.config
    this.fetchFn = options.customFetch || fetch
    this.getKvBinding = options.getKvBinding
  }

  /**
   * Returns a valid B2B OAuth access token.
   * Reuses unexpired token from memory or KV, refreshing safely before expiration.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now()
    const safetyMarginMs = 60_000 // 60 seconds before expiration

    // 1. Check in-memory cache
    if (this.inMemoryCache && now < this.inMemoryCache.expiresAt - safetyMarginMs) {
      return this.inMemoryCache.accessToken
    }

    // 2. Check KV cache if available and memory cache is empty
    if (!this.inMemoryCache && this.getKvBinding) {
      try {
        const kv = await this.getKvBinding()
        if (kv) {
          const cacheKey = `bri:b2b_token:${this.config.env}:${this.config.clientKey}`
          const kvData = await kv.get(cacheKey)
          if (kvData) {
            const parsed = JSON.parse(kvData) as CachedBriToken
            if (parsed.accessToken && now < parsed.expiresAt - safetyMarginMs) {
              this.inMemoryCache = parsed
              return parsed.accessToken
            }
          }
        }
      } catch {
        // KV lookup failure should not block token acquisition; proceed to fetch
      }
    }

    // 3. Concurrency guard: If a token request is already in-flight in this isolate, await it
    if (this.inflightPromise) {
      return this.inflightPromise
    }

    // 4. Initiate fresh token request with single-flight mutex
    this.inflightPromise = this.fetchNewToken().finally(() => {
      this.inflightPromise = null
    })

    return this.inflightPromise
  }

  /**
   * Deterministically invalidates both in-memory and KV token cache upon authentication failure.
   */
  async invalidateTokenCache(): Promise<void> {
    this.inMemoryCache = null

    if (this.getKvBinding) {
      try {
        const kv = await this.getKvBinding()
        if (kv) {
          const cacheKey = `bri:b2b_token:${this.config.env}:${this.config.clientKey}`
          await kv.delete(cacheKey)
        }
      } catch {
        // Suppress KV deletion error
      }
    }

    briLog('info', 'BRI_TOKEN_CACHE_INVALIDATED', {
      endpoint: '/snap/v1.0/access-token/b2b',
      details: { env: this.config.env, reason: 'Auth failure or explicit invalidation' },
    })
  }

  /**
   * Internal routine to execute B2B token request following official SNAP BI contract.
   */
  private async fetchNewToken(): Promise<string> {
    const timestamp = getBriTimestamp(undefined, this.config.timestampOffsetHours)
    const endpointPath = '/snap/v1.0/access-token/b2b'
    const fullUrl = `${this.config.baseUrl}${endpointPath}`

    let signature: string
    try {
      signature = generateBriTokenSignature(this.config.clientKey, timestamp, this.config.privateKey)
    } catch (err) {
      throw new BriError('SIGNATURE_ERROR', 'Failed to generate token signature', { cause: err })
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CLIENT-KEY': this.config.clientKey,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
    }

    const payload: BriTokenRequest = {
      grantType: 'client_credentials',
      additionalInfo: {},
    }

    const startTime = Date.now()
    let response: Response

    try {
      response = await this.fetchFn(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    } catch (netErr) {
      const durationMs = Date.now() - startTime
      briLog('error', 'BRI_TOKEN_NETWORK_ERROR', {
        endpoint: endpointPath,
        method: 'POST',
        durationMs,
        errorCategory: 'NETWORK_ERROR',
      })
      throw new BriError('NETWORK_ERROR', 'Failed to reach BRI token endpoint', { cause: netErr })
    }

    const durationMs = Date.now() - startTime
    const status = response.status

    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {
      throw new BriError('MALFORMED_RESPONSE', 'Could not read response body from BRI token endpoint.', {
        httpStatus: status,
      })
    }

    let parsed: BriTokenResponse
    try {
      parsed = JSON.parse(bodyText) as BriTokenResponse
    } catch {
      throw new BriError('MALFORMED_RESPONSE', 'Invalid JSON returned from BRI token endpoint.', {
        httpStatus: status,
        sanitizedDetails: { bodySnippet: bodyText.slice(0, 200) },
      })
    }

    if (!response.ok || !parsed.accessToken) {
      briLog('error', 'BRI_TOKEN_REQUEST_FAILED', {
        endpoint: endpointPath,
        method: 'POST',
        httpStatus: status,
        durationMs,
        errorCategory: 'AUTH_ERROR',
        details: { responseCode: parsed.responseCode, responseMessage: parsed.responseMessage },
      })

      throw new BriError(
        'AUTH_ERROR',
        `BRI token request failed with HTTP ${status}: ${parsed.responseMessage || 'Unknown error'}`,
        {
          httpStatus: status,
          providerCode: parsed.responseCode,
          providerMessage: parsed.responseMessage,
        }
      )
    }

    // Authoritative expiration parsing & validation
    const rawExpiresIn = parsed.expiresIn
    let expiresInSeconds: number

    if (typeof rawExpiresIn === 'number') {
      expiresInSeconds = rawExpiresIn
    } else if (typeof rawExpiresIn === 'string' && /^\d+$/.test(rawExpiresIn.trim())) {
      expiresInSeconds = parseInt(rawExpiresIn.trim(), 10)
    } else {
      throw new BriError('TOKEN_ERROR', `Malformed expiresIn value from BRI token endpoint: "${rawExpiresIn}"`)
    }

    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new BriError('TOKEN_ERROR', `Invalid non-positive expiresIn value from BRI: ${expiresInSeconds}`)
    }

    const expiresAt = Date.now() + expiresInSeconds * 1000

    const cachedToken: CachedBriToken = {
      accessToken: parsed.accessToken,
      tokenType: parsed.tokenType || 'Bearer',
      expiresAt,
    }

    // Save in memory
    this.inMemoryCache = cachedToken

    // Save in KV if available
    if (this.getKvBinding) {
      try {
        const kv = await this.getKvBinding()
        if (kv) {
          const cacheKey = `bri:b2b_token:${this.config.env}:${this.config.clientKey}`
          const ttlSeconds = Math.max(60, expiresInSeconds - 60)
          await kv.put(cacheKey, JSON.stringify(cachedToken), { expirationTtl: ttlSeconds })
        }
      } catch {
        // KV write failure is non-fatal
      }
    }

    briLog('info', 'BRI_TOKEN_OBTAINED', {
      endpoint: endpointPath,
      method: 'POST',
      httpStatus: status,
      durationMs,
      details: { expiresInSeconds },
    })

    return cachedToken.accessToken
  }
}
