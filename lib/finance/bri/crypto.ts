// lib/finance/bri/crypto.ts
// Official cryptographic primitives and signature algorithms for BRIAPI / SNAP BI

import crypto from 'node:crypto'
import { BriError } from './errors'
import type { BriSignatureResult } from './types'

/**
 * Formats a Date object into official SNAP BI ISO 8601 timestamp with millisecond precision and timezone offset.
 * Independent of the host OS/runtime timezone.
 *
 * NOTE: BRI public documentation contains contradictions regarding timezone (some sections specify local client time
 * with TZD such as +07:00, while the Signature API Access section mentions UTC).
 * This helper isolates the offset calculation and is flagged as NOT YET VERIFIED AGAINST BRI SANDBOX.
 */
export function getBriTimestamp(dateInput?: Date | string | number, offsetHours: number = 7): string {
  const d = dateInput ? (dateInput instanceof Date ? dateInput : new Date(dateInput)) : new Date()
  if (isNaN(d.getTime())) {
    throw new BriError('SIGNATURE_ERROR', 'Invalid date supplied to getBriTimestamp.')
  }

  // Calculate local time for the given timezone offset mathematically from UTC
  const utcMs = d.getTime()
  const targetTime = new Date(utcMs + 3600000 * offsetHours)

  const year = targetTime.getUTCFullYear()
  const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(targetTime.getUTCDate()).padStart(2, '0')
  const hours = String(targetTime.getUTCHours()).padStart(2, '0')
  const minutes = String(targetTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(targetTime.getUTCSeconds()).padStart(2, '0')
  const milliseconds = String(targetTime.getUTCMilliseconds()).padStart(3, '0')

  let offsetStr: string
  if (offsetHours === 0) {
    offsetStr = 'Z'
  } else {
    const sign = offsetHours >= 0 ? '+' : '-'
    const absOffset = Math.abs(offsetHours)
    offsetStr = `${sign}${String(absOffset).padStart(2, '0')}:00`
  }

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetStr}`
}

/**
 * Minifies a JSON body deterministically by removing all unnecessary whitespace.
 * For undefined/null/empty string, returns an empty string.
 */
export function minifyJsonBody(body: unknown): string {
  if (body === undefined || body === null || body === '') {
    return ''
  }

  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) return ''
    try {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(parsed)
    } catch {
      return trimmed
    }
  }

  return JSON.stringify(body)
}

/**
 * Computes the lowercase hex-encoded SHA-256 digest of a minified request body.
 *
 * CONTRACT RULE (BRI Signature API Access):
 * - If there is NO body (undefined/null/empty string): the body segment in string-to-sign is empty string ("").
 * - If there IS a body (including empty object "{}"): hash the minified body and return lowercase hex.
 */
export function hashBodySha256(minifiedBody: string): string {
  if (!minifiedBody) {
    return ''
  }

  return crypto
    .createHash('sha256')
    .update(minifiedBody, 'utf8')
    .digest('hex')
    .toLowerCase()
}

/**
 * Generates asymmetric X-SIGNATURE for SNAP BI OAuth B2B Access Token request (/snap/v1.0/access-token/b2b).
 * Formula: SHA256withRSA(client_key + "|" + X-TIMESTAMP)
 * Returns Base64 encoded signature.
 */
export function generateBriTokenSignature(clientKey: string, timestamp: string, privateKeyPem: string): string {
  if (!clientKey || !timestamp || !privateKeyPem) {
    throw new BriError('SIGNATURE_ERROR', 'Missing required parameter for B2B token signature.')
  }

  const stringToSign = `${clientKey}|${timestamp}`

  try {
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(stringToSign, 'utf8')
    return sign.sign(privateKeyPem, 'base64')
  } catch (err) {
    throw new BriError('SIGNATURE_ERROR', 'Failed to generate RSA token signature. Verify private key format.', { cause: err })
  }
}

/**
 * Verifies asymmetric X-SIGNATURE for SNAP BI OAuth B2B Access Token request.
 */
export function verifyBriTokenSignature(
  clientKey: string,
  timestamp: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  if (!clientKey || !timestamp || !signatureBase64 || !publicKeyPem) {
    return false
  }

  const stringToSign = `${clientKey}|${timestamp}`

  try {
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(stringToSign, 'utf8')
    return verify.verify(publicKeyPem, signatureBase64, 'base64')
  } catch {
    return false
  }
}

/**
 * Generates symmetric X-SIGNATURE for BRI business API requests.
 *
 * Formula:
 * stringToSign = HTTPMethod + ":" + EndpointUrl + ":" + AccessToken + ":" + bodySegment + ":" + X-TIMESTAMP
 *
 * Body segment semantics:
 * - When body is absent/undefined/empty: bodySegment is "" (empty string).
 * - When body is present: bodySegment is Lowercase(HexEncode(SHA-256(minify(body)))).
 *
 * signature = Base64(HMAC-SHA512(stringToSign, clientSecret))
 */
export function generateBriBusinessSignature(params: {
  method: string
  endpointPath: string
  accessToken: string
  body?: unknown
  timestamp: string
  clientSecret: string
}): BriSignatureResult {
  const { method, endpointPath, accessToken, body, timestamp, clientSecret } = params

  if (!method || !endpointPath || !accessToken || !timestamp || !clientSecret) {
    throw new BriError('SIGNATURE_ERROR', 'Missing required parameter for business request signature.')
  }

  const normalizedMethod = method.toUpperCase().trim()
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`

  const hasBody = body !== undefined && body !== null && body !== ''
  const minifiedBody = hasBody ? minifyJsonBody(body) : ''
  const bodyHash = hasBody ? hashBodySha256(minifiedBody) : ''

  const stringToSign = `${normalizedMethod}:${normalizedPath}:${accessToken}:${bodyHash}:${timestamp}`

  try {
    const signature = crypto
      .createHmac('sha512', clientSecret)
      .update(stringToSign, 'utf8')
      .digest('base64')

    return {
      signature,
      stringToSign,
      bodyHash,
      minifiedBody,
    }
  } catch (err) {
    throw new BriError('SIGNATURE_ERROR', 'Failed to generate HMAC-SHA512 business signature.', { cause: err })
  }
}

/**
 * Verifies symmetric X-SIGNATURE for BRI business API requests using timing-safe comparison.
 */
export function verifyBriBusinessSignature(params: {
  method: string
  endpointPath: string
  accessToken: string
  body?: unknown
  timestamp: string
  clientSecret: string
  signatureBase64: string
}): boolean {
  if (!params.signatureBase64) return false

  try {
    const expected = generateBriBusinessSignature(params)
    const expectedBuf = Buffer.from(expected.signature, 'base64')
    const actualBuf = Buffer.from(params.signatureBase64, 'base64')

    if (expectedBuf.length !== actualBuf.length) {
      return false
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}

/**
 * Generates symmetric X-SIGNATURE for BRIVA Inbound Notifications (e.g. BRIVA Payment Push Notification).
 *
 * Per official BRIVA SNAP BI contract, inbound notification uses HMAC-SHA512 (symmetric key: clientSecret).
 * RSA asymmetric is NOT used for BRIVA inbound callbacks.
 */
export function generateBriInboundNotificationSignature(params: {
  method: string
  endpointPath: string
  accessToken?: string
  body: unknown
  timestamp: string
  clientSecret: string
}): string {
  const normalizedMethod = params.method.toUpperCase().trim()
  const normalizedPath = params.endpointPath.startsWith('/') ? params.endpointPath : `/${params.endpointPath}`
  const minifiedBody = minifyJsonBody(params.body)
  const bodyHash = hashBodySha256(minifiedBody)
  const tokenSegment = params.accessToken || ''

  const stringToSign = `${normalizedMethod}:${normalizedPath}:${tokenSegment}:${bodyHash}:${params.timestamp}`

  return crypto
    .createHmac('sha512', params.clientSecret)
    .update(stringToSign, 'utf8')
    .digest('base64')
}

/**
 * Verifies symmetric X-SIGNATURE for BRIVA Inbound Notifications using timing-safe comparison.
 */
export function verifyBriInboundNotificationSignature(params: {
  method: string
  endpointPath: string
  accessToken?: string
  body: unknown
  timestamp: string
  clientSecret: string
  signatureBase64: string
}): boolean {
  if (!params.signatureBase64) return false

  try {
    const expectedSig = generateBriInboundNotificationSignature(params)
    const expectedBuf = Buffer.from(expectedSig, 'base64')
    const actualBuf = Buffer.from(params.signatureBase64, 'base64')

    if (expectedBuf.length !== actualBuf.length) {
      return false
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}
