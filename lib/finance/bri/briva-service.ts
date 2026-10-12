// lib/finance/bri/briva-service.ts
// Core business service for SNAP BI Virtual Account (BRIVA Online) Inbound Inquiry & Payment Notification
// Hardened with strict headers, exact money parsing, canonical path, DB compare-and-set guards, and correlation.

import crypto from 'node:crypto'
import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { loadBriConfig } from './config'
import { verifyBriInboundNotificationSignature, hashBodySha256 } from './crypto'
import { briLog, sanitizePayload } from './logging'
import { parseBrivaMoney } from './money'
import { isAsramaBebasTagihan } from '@/lib/finance/non-billable-santri'
import {
  BRI_VA_INQUIRY_CODES,
  BRI_VA_PAYMENT_CODES,
  type BriInboundHeaders,
  type BriVaInquiryRequest,
  type BriVaInquiryResponse,
  type BriVaPaymentRequest,
  type BriVaPaymentResponse,
} from './briva-types'
import type { BriConfig } from './types'

export interface BrivaServiceResult<T> {
  status: number
  body: T
}

/**
 * Operational Kill Switch for Inbound BRIVA processing.
 * Independent of parent checkout flag (FEATURE_FLAG_BRIVA_ONLINE) and outbound kill switch.
 * Production default: false (fail-closed).
 * Server/deployment controlled strictly via environment variable BRI_BRIVA_INBOUND_ENABLED.
 */
export function isBrivaInboundEnabled(env?: string): boolean {
  const val = process.env.BRI_BRIVA_INBOUND_ENABLED?.trim().toLowerCase()
  return val === 'true' || val === '1'
}

/**
 * Internal contract-aware builder for SNAP BI BRIVA response additionalInfo.
 * Strictly adheres to SNAP BI v1.0 schema:
 * - INQUIRY response: only 'idApp' and 'info1'. ('passApp' and 'trxId' are forbidden).
 * - PAYMENT response: only 'idApp', 'passApp' (wire only), and 'info1'. ('trxId' and arbitrary fields are forbidden).
 *
 * idApp Contract Invariant:
 * If response includes additionalInfo, idApp MUST be present.
 * If neither request nor server/onboarding env (BRI_ID_APP) provides idApp,
 * additionalInfo CANNOT be constructed validly, so it is strictly omitted (undefined).
 * The system never fabricates or guesses an idApp value.
 */
function buildResponseAdditionalInfoInternal(
  serviceType: 'INQUIRY' | 'PAYMENT',
  input?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  // Check candidate fields to echo
  const hasInfo1 = input.info1 !== undefined && input.info1 !== null && String(input.info1).trim() !== ''
  const hasPassApp = serviceType === 'PAYMENT' && input.passApp !== undefined && input.passApp !== null && String(input.passApp).trim() !== ''
  const hasRequestIdApp = input.idApp !== undefined && input.idApp !== null && String(input.idApp).trim() !== ''

  // If there are no documented echo candidates (e.g. only trxId or unlisted keys), omit additionalInfo
  if (!hasRequestIdApp && !hasInfo1 && !hasPassApp) {
    return undefined
  }

  // Resolve authoritative idApp: from request, or authoritative server environment (BRI_ID_APP)
  let resolvedIdApp: string | undefined
  if (hasRequestIdApp) {
    resolvedIdApp = String(input.idApp).trim()
  } else if (process.env.BRI_ID_APP?.trim()) {
    resolvedIdApp = process.env.BRI_ID_APP.trim()
  }

  // If idApp cannot be resolved authoritatively, do NOT fabricate. Omit additionalInfo completely.
  if (!resolvedIdApp) {
    return undefined
  }

  const result: Record<string, unknown> = {
    idApp: resolvedIdApp,
  }

  if (hasInfo1) {
    result.info1 = String(input.info1).trim()
  }

  if (hasPassApp) {
    result.passApp = input.passApp
  }

  return result
}

/**
 * Builds contract-compliant additionalInfo for SNAP BI Inquiry Response (Service Code 24).
 * Allowed fields: 'idApp', 'info1'.
 * Forbidden: 'passApp', 'trxId', and arbitrary fields.
 */
export function buildInquiryResponseAdditionalInfo(
  input?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return buildResponseAdditionalInfoInternal('INQUIRY', input)
}

/**
 * Builds contract-compliant additionalInfo for SNAP BI Payment Response (Service Code 25).
 * Allowed fields: 'idApp', 'passApp' (wire-only), 'info1'.
 * Forbidden: 'trxId' and arbitrary fields.
 */
export function buildPaymentResponseAdditionalInfo(
  input?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return buildResponseAdditionalInfoInternal('PAYMENT', input)
}

/**
 * Polymorphic helper preserving backward compatibility while enforcing strict service schema.
 */
export function buildResponseAdditionalInfo(
  serviceTypeOrInput: 'INQUIRY' | 'PAYMENT' | Record<string, unknown> | undefined,
  maybeInput?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (serviceTypeOrInput === 'INQUIRY' || serviceTypeOrInput === 'PAYMENT') {
    return buildResponseAdditionalInfoInternal(serviceTypeOrInput, maybeInput)
  }
  return buildResponseAdditionalInfoInternal('PAYMENT', serviceTypeOrInput)
}

/**
 * Computes deterministic SHA-256 fingerprint of canonical financial identity fields.
 * Strictly excludes any credentials, secrets, or passApp.
 */
export function computePaymentFingerprint(params: {
  partnerServiceId: string
  customerNo: string
  virtualAccountNo: string
  paymentRequestId: string
  trxId: string
  paidAmountRupiah: number
  currency: string
}): string {
  const canonicalStr = [
    params.partnerServiceId.trim(),
    params.customerNo.trim(),
    params.virtualAccountNo.trim(),
    params.paymentRequestId.trim(),
    params.trxId.trim(),
    params.paidAmountRupiah.toString(),
    params.currency.trim().toUpperCase(),
  ].join('|')
  return crypto.createHash('sha256').update(canonicalStr, 'utf8').digest('hex')
}

export interface CollisionCheckResult {
  isDuplicate: boolean
  conflictReason?: string
}

/**
 * Distinguishes legitimate idempotent duplicate notifications from identifier collisions.
 * Validates identity across: paymentRequestId, trxId, amount, currency, VA, customerNo, partnerServiceId, santriId.
 */
export function checkPaymentDuplicateOrCollision(params: {
  existing: {
    id: string
    santri_id: string
    order_id: string
    gross_amount: number
    cooperative_admin_fee: number
    bri_payment_request_id: string | null
    bri_trx_id: string | null
    virtual_account_no?: string | null
    customer_no?: string | null
    partner_service_id?: string | null
    paid_amount?: number | null
  }
  incoming: {
    paymentRequestId: string
    trxId: string
    vaNo: string
    custNo: string
    partnerServiceId: string
    parsedPaidRupiah: number
    currency: string
    santriId?: string
  }
}): CollisionCheckResult {
  const { existing, incoming } = params

  // 1. paymentRequestId conflict
  if (
    existing.bri_payment_request_id &&
    existing.bri_payment_request_id !== incoming.paymentRequestId
  ) {
    return {
      isDuplicate: false,
      conflictReason: `paymentRequestId mismatch: existing="${existing.bri_payment_request_id}" vs incoming="${incoming.paymentRequestId}"`,
    }
  }

  // 2. trxId conflict
  if (
    existing.bri_trx_id &&
    incoming.trxId &&
    existing.bri_trx_id !== incoming.trxId
  ) {
    return {
      isDuplicate: false,
      conflictReason: `trxId mismatch: existing="${existing.bri_trx_id}" vs incoming="${incoming.trxId}"`,
    }
  }

  // 3. Amount comparison
  const existingTotal =
    existing.paid_amount ??
    existing.gross_amount + (existing.cooperative_admin_fee || 0)
  if (existingTotal !== incoming.parsedPaidRupiah) {
    return {
      isDuplicate: false,
      conflictReason: `paidAmount mismatch: existing=${existingTotal} vs incoming=${incoming.parsedPaidRupiah}`,
    }
  }

  // 4. Currency
  if (incoming.currency !== 'IDR') {
    return {
      isDuplicate: false,
      conflictReason: `currency mismatch: expected IDR vs incoming=${incoming.currency}`,
    }
  }

  // 5. virtualAccountNo
  if (existing.virtual_account_no && existing.virtual_account_no !== incoming.vaNo) {
    return {
      isDuplicate: false,
      conflictReason: `virtualAccountNo mismatch: existing="${existing.virtual_account_no}" vs incoming="${incoming.vaNo}"`,
    }
  }

  // 6. customerNo
  if (existing.customer_no && existing.customer_no !== incoming.custNo) {
    return {
      isDuplicate: false,
      conflictReason: `customerNo mismatch: existing="${existing.customer_no}" vs incoming="${incoming.custNo}"`,
    }
  }

  // 7. partnerServiceId
  if (existing.partner_service_id && existing.partner_service_id !== incoming.partnerServiceId) {
    return {
      isDuplicate: false,
      conflictReason: `partnerServiceId mismatch: existing="${existing.partner_service_id}" vs incoming="${incoming.partnerServiceId}"`,
    }
  }

  // 8. santriId
  if (incoming.santriId && existing.santri_id !== incoming.santriId) {
    return {
      isDuplicate: false,
      conflictReason: `santriId mismatch: existing="${existing.santri_id}" vs incoming="${incoming.santriId}"`,
    }
  }

  return { isDuplicate: true }
}

/**
 * Extracts and normalizes SNAP BI headers from Next.js Headers or plain record.
 */
export function extractBrivaHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): BriInboundHeaders {
  const getHeader = (name: string): string => {
    if (typeof (headers as Headers).get === 'function') {
      return ((headers as Headers).get(name) || '').trim()
    }
    const rec = headers as Record<string, string | string[] | undefined>
    const val = rec[name] || rec[name.toLowerCase()]
    if (Array.isArray(val)) return (val[0] || '').trim()
    return (val || '').trim()
  }

  return {
    timestamp: getHeader('x-timestamp'),
    signature: getHeader('x-signature'),
    partnerId: getHeader('x-partner-id'),
    externalId: getHeader('x-external-id'),
    channelId: getHeader('channel-id') || undefined,
    contentType: getHeader('content-type'),
    authorization: getHeader('authorization') || undefined,
  }
}

/**
 * Validates inbound SNAP BI headers, mandatory Bearer token, CHANNEL-ID,
 * configurable clock-skew replay window, and symmetric HMAC-SHA512 signature.
 */
export function verifyInboundAuth(params: {
  headers: BriInboundHeaders
  rawBody: string
  endpointPath: string
  method: string
  config: BriConfig
  serviceCode: '24' | '25'
  maxClockSkewSeconds?: number
}): { valid: boolean; errorStatus?: number; errorCode?: string; errorMessage?: string } {
  const { headers, rawBody, endpointPath, method, config, serviceCode } = params

  const isService24 = serviceCode === '24'
  const errBadReq = isService24 ? BRI_VA_INQUIRY_CODES.BAD_REQUEST : BRI_VA_PAYMENT_CODES.BAD_REQUEST
  const errMandatory = isService24 ? BRI_VA_INQUIRY_CODES.INVALID_MANDATORY_FIELD : BRI_VA_PAYMENT_CODES.INVALID_MANDATORY_FIELD
  const errFormat = isService24 ? BRI_VA_INQUIRY_CODES.INVALID_FIELD_FORMAT : BRI_VA_PAYMENT_CODES.INVALID_FIELD_FORMAT
  const errAuth = isService24 ? BRI_VA_INQUIRY_CODES.UNAUTHORIZED : BRI_VA_PAYMENT_CODES.UNAUTHORIZED
  const errGeneral = isService24 ? BRI_VA_INQUIRY_CODES.GENERAL_ERROR : BRI_VA_PAYMENT_CODES.GENERAL_ERROR

  // 0. Server-Side Configuration Integrity Check
  if (!config.partnerId || !config.partnerId.trim() || !config.clientSecret) {
    return {
      valid: false,
      errorStatus: 500,
      errorCode: errGeneral,
      errorMessage: 'General Error',
    }
  }

  // 1. Content-Type Validation
  if (!headers.contentType || !headers.contentType.toLowerCase().includes('application/json')) {
    return {
      valid: false,
      errorStatus: 400,
      errorCode: errBadReq,
      errorMessage: 'Invalid Content-Type. Must be application/json.',
    }
  }

  // 2. Mandatory Headers Validation (Authorization, X-TIMESTAMP, X-SIGNATURE, X-PARTNER-ID, CHANNEL-ID, X-EXTERNAL-ID)
  if (
    !headers.authorization ||
    !headers.timestamp ||
    !headers.signature ||
    !headers.partnerId ||
    !headers.channelId ||
    !headers.externalId
  ) {
    return {
      valid: false,
      errorStatus: 400,
      errorCode: errMandatory,
      errorMessage: 'Missing required SNAP BI headers (Authorization, X-TIMESTAMP, X-SIGNATURE, X-PARTNER-ID, CHANNEL-ID, X-EXTERNAL-ID).',
    }
  }

  // 3. Authorization Bearer Token Validation & Extraction
  // INBOUND BEARER CONTRACT: NOT VERIFIED AGAINST SANDBOX (Seam preserved for onboarding)
  if (!headers.authorization.startsWith('Bearer ')) {
    return {
      valid: false,
      errorStatus: 401,
      errorCode: errAuth,
      errorMessage: 'Unauthorized [Malformed Authorization header. Must be Bearer <token>].',
    }
  }

  const accessToken = headers.authorization.slice(7).trim()
  if (!accessToken) {
    return {
      valid: false,
      errorStatus: 401,
      errorCode: errAuth,
      errorMessage: 'Unauthorized [Empty Bearer token].',
    }
  }

  // 4. CHANNEL-ID Format & Value Validation
  if (!/^\d{5}$/.test(headers.channelId)) {
    return {
      valid: false,
      errorStatus: 400,
      errorCode: errFormat,
      errorMessage: 'Invalid CHANNEL-ID format. Must be exactly 5 numeric digits.',
    }
  }

  const expectedChannelId = config.channelId || '00009'
  if (headers.channelId !== expectedChannelId) {
    return {
      valid: false,
      errorStatus: 400,
      errorCode: errBadReq,
      errorMessage: `Invalid CHANNEL-ID "${headers.channelId}". Expected "${expectedChannelId}".`,
    }
  }

  // 5. Partner ID Match Validation (Mismatch with server config is Unauthorized request)
  if (headers.partnerId !== config.partnerId) {
    return {
      valid: false,
      errorStatus: 401,
      errorCode: errAuth,
      errorMessage: 'Unauthorized [Invalid X-PARTNER-ID].',
    }
  }

  // 6. Canonical Path Enforcement in Production
  const canonicalInquiryPath = process.env.BRI_CANONICAL_INQUIRY_PATH || '/snap/v1.0/transfer-va/inquiry'
  const canonicalPaymentPath = process.env.BRI_CANONICAL_PAYMENT_PATH || '/snap/v1.0/transfer-va/payment'
  const expectedPath = isService24 ? canonicalInquiryPath : canonicalPaymentPath

  if (config.env === 'production' && endpointPath !== expectedPath) {
    return {
      valid: false,
      errorStatus: 404,
      errorCode: isService24 ? BRI_VA_INQUIRY_CODES.BILL_NOT_FOUND : BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND,
      errorMessage: 'Endpoint path not found or disabled in production.',
    }
  }

  // 7. Timestamp Freshness & Replay Window (Configurable via BRI_INBOUND_MAX_SKEW_SECONDS, default 300s)
  const parsedTime = Date.parse(headers.timestamp)
  if (isNaN(parsedTime)) {
    return {
      valid: false,
      errorStatus: 400,
      errorCode: errFormat,
      errorMessage: 'Invalid X-TIMESTAMP ISO8601 format.',
    }
  }

  let maxClockSkew: number
  const envSkewStr = process.env.BRI_INBOUND_MAX_SKEW_SECONDS
  if (config.env === 'production') {
    if (!envSkewStr || !envSkewStr.trim()) {
      return {
        valid: false,
        errorStatus: 500,
        errorCode: errGeneral,
        errorMessage: 'General Error',
      }
    }
    const parsedSkew = parseInt(envSkewStr, 10)
    if (isNaN(parsedSkew) || parsedSkew <= 0 || parsedSkew > 3600) {
      return {
        valid: false,
        errorStatus: 500,
        errorCode: errGeneral,
        errorMessage: 'General Error',
      }
    }
    maxClockSkew = parsedSkew
  } else {
    // Non-production (sandbox/test/local): allow override or safe test default (300)
    const parsedSkew = envSkewStr ? parseInt(envSkewStr, 10) : NaN
    maxClockSkew = params.maxClockSkewSeconds ?? (!isNaN(parsedSkew) && parsedSkew > 0 ? parsedSkew : 300)
  }

  const skewSeconds = Math.abs(Date.now() - parsedTime) / 1000
  if (skewSeconds > maxClockSkew) {
    return {
      valid: false,
      errorStatus: 401,
      errorCode: errAuth,
      errorMessage: `Unauthorized [X-TIMESTAMP outside freshness window: ${Math.round(skewSeconds)}s > ${maxClockSkew}s].`,
    }
  }

  // 8. Symmetric HMAC-SHA512 Signature Verification
  // The exact Bearer access token is included in the string-to-sign per SNAP BI specification
  const isSigValid = verifyBriInboundNotificationSignature({
    method,
    endpointPath,
    accessToken,
    body: rawBody,
    timestamp: headers.timestamp,
    clientSecret: config.clientSecret,
    signatureBase64: headers.signature,
  })

  if (!isSigValid) {
    return {
      valid: false,
      errorStatus: 401,
      errorCode: errAuth,
      errorMessage: 'Unauthorized [Invalid X-SIGNATURE].',
    }
  }

  return { valid: true }
}

/**
 * Validates the cross-field identity trio:
 * 1. partnerServiceId == configured partner service ID (preserving spaces)
 * 2. customerNo == studentVa.customer_no (preserving leading zeros)
 * 3. virtualAccountNo == studentVa.va_number
 * 4. virtualAccountNo == partnerServiceId.trim() + customerNo
 */
export function validateVaIdentityTrio(params: {
  reqPartnerServiceId: string
  reqCustomerNo: string
  reqVaNo: string
  studentVa: { va_number: string; customer_no: string }
  configPartnerId: string
}): { valid: boolean; error?: string } {
  const { reqPartnerServiceId, reqCustomerNo, reqVaNo, studentVa, configPartnerId } = params

  const expectedPartnerServiceId = process.env.BRI_PARTNER_SERVICE_ID || configPartnerId

  if (reqPartnerServiceId !== expectedPartnerServiceId) {
    return {
      valid: false,
      error: `partnerServiceId mismatch. Expected "${expectedPartnerServiceId}", received "${reqPartnerServiceId}".`,
    }
  }

  if (reqCustomerNo !== studentVa.customer_no) {
    return {
      valid: false,
      error: `customerNo mismatch. Expected "${studentVa.customer_no}", received "${reqCustomerNo}".`,
    }
  }

  if (reqVaNo !== studentVa.va_number) {
    return {
      valid: false,
      error: `virtualAccountNo mismatch. Expected "${studentVa.va_number}", received "${reqVaNo}".`,
    }
  }

  const canonicalConcat = reqPartnerServiceId.trim() + reqCustomerNo
  if (reqVaNo !== canonicalConcat) {
    return {
      valid: false,
      error: `virtualAccountNo "${reqVaNo}" does not match concatenation "${canonicalConcat}".`,
    }
  }

  return { valid: true }
}

/**
 * Handles Inbound BRIVA Online Inquiry (Service Code 24)
 * Resolves active PENDING payment order snapshot for student Fixed BRIVA
 * and persists durable correlation evidence for matching payments.
 */
export async function handleBrivaInquiry(params: {
  rawBody: string
  headers: BriInboundHeaders
  endpointPath: string
  method: string
  configOverride?: BriConfig
}): Promise<BrivaServiceResult<BriVaInquiryResponse>> {
  const startTime = Date.now()
  const config = params.configOverride || loadBriConfig()

  // 0. Operational Inbound Kill Switch (fail-closed before any database processing)
  if (!isBrivaInboundEnabled(config.env)) {
    briLog('warn', 'BRIVA_INBOUND_DISABLED', {
      endpoint: params.endpointPath,
      durationMs: Date.now() - startTime,
      details: { serviceCode: '24' },
    })
    return {
      status: 500,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.GENERAL_ERROR,
        responseMessage: 'General Error',
      },
    }
  }

  // 1. Authenticate & Verify Signature
  const auth = verifyInboundAuth({
    headers: params.headers,
    rawBody: params.rawBody,
    endpointPath: params.endpointPath,
    method: params.method,
    config,
    serviceCode: '24',
  })

  if (!auth.valid) {
    briLog('warn', 'BRIVA_INQUIRY_AUTH_REJECTED', {
      endpoint: params.endpointPath,
      durationMs: Date.now() - startTime,
      details: {
        errorCode: auth.errorCode,
        errorMessage: auth.errorMessage,
      },
    })
    return {
      status: auth.errorStatus || 401,
      body: {
        responseCode: auth.errorCode || BRI_VA_INQUIRY_CODES.UNAUTHORIZED,
        responseMessage: auth.errorMessage || 'Unauthorized',
      },
    }
  }

  // 2. Parse JSON Payload
  let req: BriVaInquiryRequest
  try {
    req = JSON.parse(params.rawBody) as BriVaInquiryRequest
  } catch {
    return {
      status: 400,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.BAD_REQUEST,
        responseMessage: 'Malformed JSON payload.',
      },
    }
  }

  // 3. Validate Mandatory Inquiry Fields (Do NOT trim away leading spaces/zeros prematurely)
  const vaNo = req.virtualAccountNo || ''
  const custNo = req.customerNo || ''
  const partnerServiceId = req.partnerServiceId || ''
  const inquiryRequestId = (req.inquiryRequestId || '').trim()

  if (!vaNo || !partnerServiceId || !custNo || !inquiryRequestId) {
    return {
      status: 400,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.INVALID_MANDATORY_FIELD,
        responseMessage: 'Missing mandatory inquiry fields (virtualAccountNo, customerNo, partnerServiceId, inquiryRequestId).',
      },
    }
  }

  // 4. Resolve Fixed BRIVA from database
  const studentVa = await queryOne<{
    santri_id: string
    va_number: string
    customer_no: string
    status: string
  }>(
    `SELECT santri_id, va_number, customer_no, status
     FROM finance_student_va
     WHERE va_number = ?
     LIMIT 1`,
    [vaNo]
  )

  if (!studentVa || studentVa.status !== 'ACTIVE') {
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  // 5. Cross-Field VA Identity Trio Validation
  const trioCheck = validateVaIdentityTrio({
    reqPartnerServiceId: partnerServiceId,
    reqCustomerNo: custNo,
    reqVaNo: vaNo,
    studentVa,
    configPartnerId: config.partnerId,
  })

  if (!trioCheck.valid) {
    briLog('warn', 'BRIVA_INQUIRY_TRIO_MISMATCH', {
      details: { error: trioCheck.error, vaNo, custNo, partnerServiceId },
    })
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  // 6. Validate Student Billability
  const student = await queryOne<{
    id: string
    nama_lengkap: string
    status_global: string
    asrama: string | null
    kategori_santri: string | null
  }>(
    `SELECT id, nama_lengkap, status_global, asrama, kategori_santri
     FROM santri
     WHERE id = ?`,
    [studentVa.santri_id]
  )

  if (!student || student.status_global !== 'aktif') {
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  // Non-billable guard (AL-BAGHORY has no bills)
  if (isAsramaBebasTagihan(student.asrama)) {
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  // 7. Resolve Active PENDING Payment Order (Immutable Snapshot)
  const activeOrder = await queryOne<{
    id: string
    order_number: string
    gross_amount: number
    cooperative_admin_fee: number
    total_charged: number
    status: string
    expires_at: string
  }>(
    `SELECT id, order_number, gross_amount, cooperative_admin_fee, total_charged, status, expires_at
     FROM finance_payment_orders
     WHERE santri_id = ?
       AND payment_method = 'BRI_VA'
       AND status = 'PENDING'
     LIMIT 1`,
    [studentVa.santri_id]
  )

  if (!activeOrder) {
    const latestOrder = await queryOne<{ status: string }>(
      `SELECT status
       FROM finance_payment_orders
       WHERE santri_id = ? AND payment_method = 'BRI_VA'
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentVa.santri_id]
    )

    if (latestOrder && latestOrder.status === 'PAID') {
      return {
        status: 404,
        body: {
          responseCode: BRI_VA_INQUIRY_CODES.BILL_ALREADY_PAID,
          responseMessage: 'Bill already paid',
        },
      }
    }

    return {
      status: 404,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.BILL_NOT_FOUND,
        responseMessage: 'Bill not found',
      },
    }
  }

  // Check Expiry of active order
  const currentTime = now()
  if (activeOrder.expires_at < currentTime) {
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_INQUIRY_CODES.BILL_NOT_FOUND,
        responseMessage: 'Bill not found',
      },
    }
  }

  // 8. Persist Durable Inquiry Evidence for Payment Correlation
  const inquiryRecordId = generateId()
  try {
    await query(
      `INSERT INTO finance_briva_inquiries (
         id, inquiry_request_id, partner_service_id, customer_no,
         virtual_account_no, santri_id, order_id, total_amount, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(inquiry_request_id) DO UPDATE SET
         order_id = excluded.order_id,
         total_amount = excluded.total_amount,
         expires_at = excluded.expires_at`,
      [
        inquiryRecordId,
        inquiryRequestId,
        partnerServiceId,
        custNo,
        vaNo,
        student.id,
        activeOrder.id,
        activeOrder.total_charged,
        activeOrder.expires_at,
        currentTime,
      ]
    )
  } catch (inqErr) {
    briLog('warn', 'BRIVA_INQUIRY_LOG_ERROR', {
      details: { error: inqErr instanceof Error ? inqErr.message : String(inqErr) },
    })
  }

  // 9. Format Authoritative Response from Order Snapshot (Strict .00 format)
  const totalAmountDecimal = `${activeOrder.total_charged}.00`
  const feeAmountDecimal = '0.00'

  briLog('info', 'BRIVA_INQUIRY_RESOLVED', {
    durationMs: Date.now() - startTime,
    details: {
      santriId: student.id,
      vaNumber: studentVa.va_number,
      orderId: activeOrder.id,
      totalCharged: activeOrder.total_charged,
    },
  })

  return {
    status: 200,
    body: {
      responseCode: BRI_VA_INQUIRY_CODES.SUCCESS,
      responseMessage: 'Successful',
      virtualAccountData: {
        partnerServiceId,
        customerNo: custNo,
        virtualAccountNo: vaNo,
        virtualAccountName: student.nama_lengkap,
        totalAmount: {
          value: totalAmountDecimal,
          currency: 'IDR',
        },
        virtualAccountTrxType: '1', // Closed / Fixed Amount bill
        feeAmount: {
          value: feeAmountDecimal,
          currency: 'IDR',
        },
        inquiryRequestId,
        ...(buildInquiryResponseAdditionalInfo(req.additionalInfo)
          ? { additionalInfo: buildInquiryResponseAdditionalInfo(req.additionalInfo) }
          : {}),
      },
    },
  }
}

/**
 * Handles Inbound BRIVA Online Payment Notification (Service Code 25)
 * Atomically records Payment (PAID != SETTLED), Allocations, Cooperative Income,
 * Reconciliation Metadata, and Wallet Mutation with hard DB compare-and-set guards.
 */
export async function handleBrivaPayment(params: {
  rawBody: string
  headers: BriInboundHeaders
  endpointPath: string
  method: string
  configOverride?: BriConfig
}): Promise<BrivaServiceResult<BriVaPaymentResponse>> {
  const startTime = Date.now()
  const config = params.configOverride || loadBriConfig()

  // 0. Operational Inbound Kill Switch (fail-closed before any financial/database processing)
  if (!isBrivaInboundEnabled(config.env)) {
    briLog('warn', 'BRIVA_INBOUND_DISABLED', {
      endpoint: params.endpointPath,
      durationMs: Date.now() - startTime,
      details: { serviceCode: '25' },
    })
    return {
      status: 500,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.GENERAL_ERROR,
        responseMessage: 'General Error',
      },
    }
  }

  // 1. Authenticate & Verify Signature
  const auth = verifyInboundAuth({
    headers: params.headers,
    rawBody: params.rawBody,
    endpointPath: params.endpointPath,
    method: params.method,
    config,
    serviceCode: '25',
  })

  if (!auth.valid) {
    briLog('warn', 'BRIVA_PAYMENT_AUTH_REJECTED', {
      endpoint: params.endpointPath,
      durationMs: Date.now() - startTime,
      details: {
        errorCode: auth.errorCode,
        errorMessage: auth.errorMessage,
      },
    })
    return {
      status: auth.errorStatus || 401,
      body: {
        responseCode: auth.errorCode || BRI_VA_PAYMENT_CODES.UNAUTHORIZED,
        responseMessage: auth.errorMessage || 'Unauthorized',
      },
    }
  }

  // 2. Parse JSON Payload
  let req: BriVaPaymentRequest
  try {
    req = JSON.parse(params.rawBody) as BriVaPaymentRequest
  } catch {
    return {
      status: 400,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.BAD_REQUEST,
        responseMessage: 'Malformed JSON payload.',
      },
    }
  }

  // 3. Validate Mandatory Payment Fields
  const vaNo = req.virtualAccountNo || ''
  const custNo = req.customerNo || ''
  const partnerServiceId = req.partnerServiceId || ''
  const paymentRequestId = (req.paymentRequestId || '').trim()

  if (!vaNo || !partnerServiceId || !custNo || !paymentRequestId || !req.paidAmount) {
    return {
      status: 400,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.INVALID_MANDATORY_FIELD,
        responseMessage: 'Missing mandatory payment notification fields (virtualAccountNo, customerNo, partnerServiceId, paymentRequestId, paidAmount).',
      },
    }
  }

  // 4. Strict Decimal Money Parsing (NO FLOATING POINT)
  const moneyParse = parseBrivaMoney(req.paidAmount)
  if (!moneyParse.valid) {
    briLog('warn', 'BRIVA_PAYMENT_MONEY_PARSE_ERROR', {
      details: { error: moneyParse.error, rawValue: req.paidAmount?.value },
    })
    return {
      status: 400,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.INVALID_FIELD_FORMAT,
        responseMessage: moneyParse.error || 'Invalid paidAmount format.',
      },
    }
  }
  const parsedPaidRupiah = moneyParse.rupiah

  // 5. Resolve Identifiers & Compute Canonical Payment Fingerprint
  const rawTrxId = (req.additionalInfo?.trxId || req.referenceNo || paymentRequestId).toString().trim()
  const eventKey = `briva_pay_${paymentRequestId}_${rawTrxId}`
  const paymentFingerprint = computePaymentFingerprint({
    partnerServiceId,
    customerNo: custNo,
    virtualAccountNo: vaNo,
    paymentRequestId,
    trxId: rawTrxId,
    paidAmountRupiah: parsedPaidRupiah,
    currency: req.paidAmount.currency,
  })

  // 6. Check Idempotency vs Identifier Collision
  // Distinguishes legitimate idempotent duplicate notifications from identifier collisions (HTTP 409).
  const existingPayment = await queryOne<{
    id: string
    santri_id: string
    order_id: string
    gross_amount: number
    cooperative_admin_fee: number
    bri_payment_request_id: string | null
    bri_trx_id: string | null
    virtual_account_no: string | null
    customer_no: string | null
    partner_service_id: string | null
    paid_amount: number | null
  }>(
    `SELECT
       p.id, p.santri_id, p.order_id, p.gross_amount, p.cooperative_admin_fee,
       p.bri_payment_request_id, p.bri_trx_id,
       rm.virtual_account_no, rm.customer_no, rm.partner_service_id, rm.paid_amount
     FROM finance_payments p
     LEFT JOIN finance_briva_reconciliation_metadata rm ON rm.payment_id = p.id
     WHERE p.bri_payment_request_id = ? OR p.bri_trx_id = ?
     LIMIT 1`,
    [paymentRequestId, rawTrxId]
  )

  if (existingPayment) {
    const collisionCheck = checkPaymentDuplicateOrCollision({
      existing: existingPayment,
      incoming: {
        paymentRequestId,
        trxId: rawTrxId,
        vaNo,
        custNo,
        partnerServiceId,
        parsedPaidRupiah,
        currency: req.paidAmount?.currency || 'IDR',
      },
    })

    if (!collisionCheck.isDuplicate) {
      briLog('warn', 'BRIVA_PAYMENT_IDENTIFIER_COLLISION', {
        durationMs: Date.now() - startTime,
        details: {
          paymentRequestId,
          trxId: rawTrxId,
          conflictReason: collisionCheck.conflictReason,
          existingPaymentId: existingPayment.id,
          paymentFingerprint,
        },
      })
      return {
        status: 409,
        body: {
          responseCode: BRI_VA_PAYMENT_CODES.CONFLICT,
          responseMessage: 'Conflict',
        },
      }
    }

    // Legitimate duplicate: resolve student name if possible and return idempotent 200
    let studentName = req.virtualAccountName || ''
    if (!studentName && existingPayment.santri_id) {
      const existingStudent = await queryOne<{ nama_lengkap: string }>(
        `SELECT nama_lengkap FROM santri WHERE id = ? LIMIT 1`,
        [existingPayment.santri_id]
      )
      if (existingStudent) studentName = existingStudent.nama_lengkap
    }

    briLog('info', 'BRIVA_PAYMENT_IDEMPOTENT_REPLAY', {
      durationMs: Date.now() - startTime,
      details: {
        paymentId: existingPayment.id,
        paymentRequestId,
        trxId: rawTrxId,
        paymentFingerprint,
      },
    })
    return {
      status: 200,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.SUCCESS,
        responseMessage: 'Successful',
        virtualAccountData: {
          partnerServiceId: req.partnerServiceId,
          customerNo: req.customerNo,
          virtualAccountNo: req.virtualAccountNo,
          virtualAccountName: studentName,
          paymentRequestId,
          paidAmount: req.paidAmount,
          ...(buildPaymentResponseAdditionalInfo(req.additionalInfo)
            ? { additionalInfo: buildPaymentResponseAdditionalInfo(req.additionalInfo) }
            : {}),
        },
      },
    }
  }

  // 8. Resolve Fixed BRIVA from database & Validate Cross-Field Identity Trio
  const studentVa = await queryOne<{
    santri_id: string
    va_number: string
    customer_no: string
    status: string
  }>(
    `SELECT santri_id, va_number, customer_no, status
     FROM finance_student_va
     WHERE va_number = ?
     LIMIT 1`,
    [vaNo]
  )

  if (!studentVa || studentVa.status !== 'ACTIVE') {
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  const trioCheck = validateVaIdentityTrio({
    reqPartnerServiceId: partnerServiceId,
    reqCustomerNo: custNo,
    reqVaNo: vaNo,
    studentVa,
    configPartnerId: config.partnerId,
  })

  if (!trioCheck.valid) {
    briLog('warn', 'BRIVA_PAYMENT_TRIO_MISMATCH', {
      details: { error: trioCheck.error, vaNo, custNo, partnerServiceId },
    })
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  // 9. Validate Student Billability
  const student = await queryOne<{
    id: string
    nama_lengkap: string
    status_global: string
    asrama: string | null
    kategori_santri: string | null
  }>(
    `SELECT id, nama_lengkap, status_global, asrama, kategori_santri
     FROM santri
     WHERE id = ?`,
    [studentVa.santri_id]
  )

  if (!student || student.status_global !== 'aktif' || isAsramaBebasTagihan(student.asrama)) {
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.INVALID_VIRTUAL_ACCOUNT,
        responseMessage: 'Invalid Virtual Account',
      },
    }
  }

  // 10. Correlate Relevant Payment Order
  const activeOrder = await queryOne<{
    id: string
    order_number: string
    gross_amount: number
    cooperative_admin_fee: number
    total_charged: number
    status: string
    expires_at: string
  }>(
    `SELECT id, order_number, gross_amount, cooperative_admin_fee, total_charged, status, expires_at
     FROM finance_payment_orders
     WHERE santri_id = ?
       AND payment_method = 'BRI_VA'
       AND status = 'PENDING'
     LIMIT 1`,
    [studentVa.santri_id]
  )

  if (!activeOrder) {
    const latestOrder = await queryOne<{ status: string }>(
      `SELECT status
       FROM finance_payment_orders
       WHERE santri_id = ? AND payment_method = 'BRI_VA'
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentVa.santri_id]
    )

    if (latestOrder && (latestOrder.status === 'PAID' || latestOrder.status === 'CANCELLED')) {
      // Reversal semantics: informs bank that bill was already paid/cancelled, triggering refund
      return {
        status: 404,
        body: {
          responseCode: BRI_VA_PAYMENT_CODES.BILL_ALREADY_PAID,
          responseMessage: 'Bill already paid',
        },
      }
    }

    return {
      status: 404,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND,
        responseMessage: 'Bill not found',
      },
    }
  }

  // 11. Inquiry ↔ Payment Correlation Check
  // By default, production requires prior inquiry (fail closed before sandbox confirmation)
  const requirePriorInquiry = process.env.BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT !== undefined
    ? process.env.BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT === 'true'
    : config.env === 'production'

  const targetInquiryId = req.inquiryRequestId || req.paymentRequestId
  const priorInquiry = await queryOne<{
    id: string
    inquiry_request_id: string
    virtual_account_no: string
    santri_id: string
    order_id: string
    total_amount: number
    expires_at: string
  }>(
    `SELECT id, inquiry_request_id, virtual_account_no, santri_id, order_id, total_amount, expires_at
     FROM finance_briva_inquiries
     WHERE inquiry_request_id = ?
     LIMIT 1`,
    [targetInquiryId]
  )

  if (priorInquiry) {
    const isCorrelated =
      priorInquiry.virtual_account_no === vaNo &&
      priorInquiry.santri_id === studentVa.santri_id &&
      priorInquiry.order_id === activeOrder.id &&
      priorInquiry.total_amount === activeOrder.total_charged &&
      (!req.inquiryRequestId || req.inquiryRequestId === req.paymentRequestId)

    if (!isCorrelated) {
      briLog('warn', 'BRIVA_INQUIRY_CORRELATION_MISMATCH', {
        details: {
          inquiryId: priorInquiry.inquiry_request_id,
          paymentRequestId,
          orderId: activeOrder.id,
        },
      })
      return {
        status: 400,
        body: {
          responseCode: BRI_VA_PAYMENT_CODES.INVALID_FIELD_FORMAT,
          responseMessage: 'Inconsistent Request: Payment parameters do not match prior inquiry.',
        },
      }
    }
  } else {
    // Inquiry snapshot not found locally
    if (requirePriorInquiry || req.inquiryRequestId) {
      briLog('warn', 'BRIVA_PRIOR_INQUIRY_REQUIRED_REJECTED', {
        details: { paymentRequestId, targetInquiryId, requirePriorInquiry },
      })
      return {
        status: 404,
        body: {
          responseCode: BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND,
          responseMessage: 'Prior inquiry record not found for this payment transaction.',
        },
      }
    }
    // Direct payment mode explicitly allowed: proceeds safely against authoritative order and VA
  }

  // 12. Exact Amount Validation
  if (parsedPaidRupiah !== activeOrder.total_charged) {
    briLog('warn', 'BRIVA_PAYMENT_AMOUNT_MISMATCH', {
      details: {
        expected: activeOrder.total_charged,
        received: parsedPaidRupiah,
        orderId: activeOrder.id,
      },
    })
    return {
      status: 404,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.INVALID_AMOUNT,
        responseMessage: 'Invalid Amount',
      },
    }
  }

  // 13. Load Order Items for Allocation
  const orderItems = await query<{
    id: string
    obligation_id: string | null
    item_type: string
    amount: number
  }>(
    `SELECT id, obligation_id, item_type, amount
     FROM finance_order_items
     WHERE order_id = ?`,
    [activeOrder.id]
  )

  // 14. Calculate Current Wallet Balance if UANG_JAJAN is present
  const hasUangJajan = orderItems.some((item) => item.item_type === 'UANG_JAJAN')
  let currentWalletBalance = 0
  if (hasUangJajan) {
    const balanceRow = await queryOne<{ balance: number }>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) as balance
       FROM finance_wallet_ledger
       WHERE santri_id = ?`,
      [studentVa.santri_id]
    )
    currentWalletBalance = balanceRow?.balance || 0
  }

  // 15. Construct Atomic Batch Statements
  const paymentId = generateId()
  const paymentNumber = `PAY-BRI-${now().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const timestamp = now()
  const eventId = generateId()
  const recMetaId = generateId()

  // Hygiene: sanitize passApp and credentials before persisting event payload
  const sanitizedPayload = sanitizePayload(req as unknown as Record<string, unknown>)
  const sanitizedPayloadStr = JSON.stringify(sanitizedPayload)
  const bodyHash = hashBodySha256(params.rawBody)

  const statements: Array<{ sql: string; params: unknown[] }> = []

  // Step A: Durable Gateway Event
  statements.push({
    sql: `
      INSERT INTO finance_gateway_events (
        id, gateway_name, event_key, merchant_order_id, event_type,
        signature_valid, payload_json, response_code, is_processed,
        processing_status, created_at
      ) VALUES (?, 'BRI', ?, ?, 'PAYMENT_NOTIFICATION', 1, ?, '2002500', 1, 'PROCESSED', ?)
    `,
    params: [
      eventId,
      eventKey,
      activeOrder.order_number,
      sanitizedPayloadStr,
      timestamp,
    ],
  })

  // Step B: Insert Payment Record (PAID != SETTLED; status = 'PAID')
  // Protected by trigger `trg_finance_payments_briva_guard` (compare-and-set)!
  statements.push({
    sql: `
      INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
        status, correction_status, allocation_status, paid_at,
        bri_payment_request_id, bri_trx_id, external_reference,
        source, fund_management, created_at
      ) VALUES (
        ?, ?, ?, ?, 'BRI', 'BRI_VA',
        ?, ?, NULL, ?,
        'PAID', 'NONE', 'ALLOCATED', ?,
        ?, ?, ?,
        'NEW_FINANCE', 'KOPERASI', ?
      )
    `,
    params: [
      paymentId,
      paymentNumber,
      activeOrder.id,
      studentVa.santri_id,
      activeOrder.gross_amount,
      activeOrder.cooperative_admin_fee,
      activeOrder.gross_amount,
      timestamp,
      paymentRequestId,
      rawTrxId,
      params.headers.externalId,
      timestamp,
    ],
  })

  // Step C: Durable Reconciliation Evidence for BRI-4
  statements.push({
    sql: `
      INSERT INTO finance_briva_reconciliation_metadata (
        id, payment_id, order_id, virtual_account_no, partner_service_id,
        customer_no, paid_amount, trx_date_time, payment_request_id,
        bri_trx_id, reference_no, source_bank_code, channel_code,
        body_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      recMetaId,
      paymentId,
      activeOrder.id,
      vaNo,
      partnerServiceId,
      custNo,
      parsedPaidRupiah,
      req.trxDateTime || null,
      paymentRequestId,
      rawTrxId,
      req.referenceNo || null,
      (req.additionalInfo?.sourceBankCode as string) || null,
      req.channelId || params.headers.channelId || null,
      bodyHash,
      timestamp,
    ],
  })

  // Step D: Mark Payment Order as PAID
  statements.push({
    sql: `
      UPDATE finance_payment_orders
      SET status = 'PAID', updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `,
    params: [timestamp, activeOrder.id],
  })

  // Step E: Append-Only Cooperative Admin Fee Income
  if (activeOrder.cooperative_admin_fee > 0) {
    const incomeId = generateId()
    const incomeNumber = `INC-KOP-${timestamp.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    statements.push({
      sql: `
        INSERT INTO finance_cooperative_income (
          id, income_number, entry_type, reference_income_id, correction_id,
          payment_id, order_id, amount, rule_id, rule_snapshot,
          reference_note, created_by, created_at
        ) VALUES (?, ?, 'INCOME', NULL, NULL, ?, ?, ?, NULL, NULL, ?, NULL, ?)
      `,
      params: [
        incomeId,
        incomeNumber,
        paymentId,
        activeOrder.id,
        activeOrder.cooperative_admin_fee,
        `Pendapatan Biaya Operasional Koperasi atas pembayaran BRIVA ${paymentNumber}`,
        timestamp,
      ],
    })
  }

  // Step F: Create Allocations & Update Obligations
  let runningWalletBalance = currentWalletBalance

  for (const item of orderItems) {
    const allocId = generateId()

    if (item.obligation_id) {
      statements.push({
        sql: `
          INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
          )
          SELECT
            ?, ?, ?, 'OBLIGATION', ?, provider_id, ?, 0, 'UNDISBURSED', ?
          FROM finance_obligations
          WHERE id = ?
        `,
        params: [
          allocId,
          paymentId,
          item.obligation_id,
          item.item_type,
          item.amount,
          timestamp,
          item.obligation_id,
        ],
      })

      statements.push({
        sql: `
          UPDATE finance_obligations
          SET amount_paid = amount_paid + ?,
              status = CASE
                WHEN (amount_paid + ?) >= MAX(0, amount_expected - amount_exempted) THEN 'PAID'
                WHEN (amount_paid + ?) > 0 THEN 'PARTIALLY_PAID'
                ELSE 'UNPAID'
              END,
              updated_at = ?
          WHERE id = ?
        `,
        params: [
          item.amount,
          item.amount,
          item.amount,
          timestamp,
          item.obligation_id,
        ],
      })
    } else if (item.item_type === 'UANG_JAJAN') {
      statements.push({
        sql: `
          INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
          ) VALUES (?, ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', NULL, ?, 0, 'UNDISBURSED', ?)
        `,
        params: [
          allocId,
          paymentId,
          item.amount,
          timestamp,
        ],
      })

      const walletLedgerId = generateId()
      const newWalletBalance = runningWalletBalance + item.amount

      statements.push({
        sql: `
          INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, amount, balance_before, balance_after,
            source, channel, payment_id, notes, created_at
          ) VALUES (?, ?, 'IN', ?, ?, ?, 'TOPUP', 'BRI', ?, ?, ?)
        `,
        params: [
          walletLedgerId,
          studentVa.santri_id,
          item.amount,
          runningWalletBalance,
          newWalletBalance,
          paymentId,
          `Top-up Uang Jajan via BRIVA ${paymentNumber}`,
          timestamp,
        ],
      })

      runningWalletBalance = newWalletBalance
    }
  }

  // 16. Execute Atomic Batch Transaction with Race & Compare-and-Set Catch
  try {
    await batch(statements)
  } catch (batchErr) {
    const errMsg = batchErr instanceof Error ? batchErr.message : String(batchErr)

    // Case 1: BRIVA_GUARD_ABORT triggered (Order cancelled by CASH loket or changed)
    if (errMsg.includes('BRIVA_GUARD_ABORT')) {
      briLog('warn', 'BRIVA_PAYMENT_GUARD_ABORT', {
        durationMs: Date.now() - startTime,
        details: { orderId: activeOrder.id, paymentRequestId, error: errMsg },
      })
      const currentOrder = await queryOne<{ status: string }>(
        `SELECT status FROM finance_payment_orders WHERE id = ?`,
        [activeOrder.id]
      )
      if (currentOrder && (currentOrder.status === 'CANCELLED' || currentOrder.status === 'PAID')) {
        return {
          status: 404,
          body: {
            responseCode: BRI_VA_PAYMENT_CODES.BILL_ALREADY_PAID,
            responseMessage: 'Bill already paid',
          },
        }
      }
      return {
        status: 404,
        body: {
          responseCode: BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND,
          responseMessage: 'Bill not found or not payable',
        },
      }
    }

    // Case 2: Concurrent duplicate race on UNIQUE constraints
    if (
      errMsg.includes('uq_finance_payments_bri_payment_req_id') ||
      errMsg.includes('uq_finance_payments_bri_trx_id') ||
      errMsg.includes('finance_gateway_events.event_key') ||
      errMsg.includes('UNIQUE constraint failed')
    ) {
      const concurrentPayment = await queryOne<{
        id: string
        santri_id: string
        order_id: string
        gross_amount: number
        cooperative_admin_fee: number
        bri_payment_request_id: string | null
        bri_trx_id: string | null
        virtual_account_no: string | null
        customer_no: string | null
        partner_service_id: string | null
        paid_amount: number | null
      }>(
        `SELECT
           p.id, p.santri_id, p.order_id, p.gross_amount, p.cooperative_admin_fee,
           p.bri_payment_request_id, p.bri_trx_id,
           rm.virtual_account_no, rm.customer_no, rm.partner_service_id, rm.paid_amount
         FROM finance_payments p
         LEFT JOIN finance_briva_reconciliation_metadata rm ON rm.payment_id = p.id
         WHERE p.bri_payment_request_id = ? OR p.bri_trx_id = ?
         LIMIT 1`,
        [paymentRequestId, rawTrxId]
      )

      if (concurrentPayment) {
        const collisionCheck = checkPaymentDuplicateOrCollision({
          existing: concurrentPayment,
          incoming: {
            paymentRequestId,
            trxId: rawTrxId,
            vaNo,
            custNo,
            partnerServiceId,
            parsedPaidRupiah,
            currency: req.paidAmount?.currency || 'IDR',
            santriId: studentVa.santri_id,
          },
        })

        if (!collisionCheck.isDuplicate) {
          briLog('warn', 'BRIVA_PAYMENT_CONCURRENT_COLLISION', {
            durationMs: Date.now() - startTime,
            details: {
              paymentRequestId,
              trxId: rawTrxId,
              conflictReason: collisionCheck.conflictReason,
              existingPaymentId: concurrentPayment.id,
            },
          })
          return {
            status: 409,
            body: {
              responseCode: BRI_VA_PAYMENT_CODES.CONFLICT,
              responseMessage: 'Conflict',
            },
          }
        }

        briLog('info', 'BRIVA_PAYMENT_CONCURRENT_IDEMPOTENT_RECOVERY', {
          durationMs: Date.now() - startTime,
          details: {
            paymentId: concurrentPayment.id,
            paymentRequestId,
            trxId: rawTrxId,
          },
        })
        return {
          status: 200,
          body: {
            responseCode: BRI_VA_PAYMENT_CODES.SUCCESS,
            responseMessage: 'Successful',
            virtualAccountData: {
              partnerServiceId,
              customerNo: custNo,
              virtualAccountNo: vaNo,
              virtualAccountName: req.virtualAccountName || student.nama_lengkap,
              paymentRequestId,
              paidAmount: req.paidAmount,
              ...(buildPaymentResponseAdditionalInfo(req.additionalInfo)
                ? { additionalInfo: buildPaymentResponseAdditionalInfo(req.additionalInfo) }
                : {}),
            },
          },
        }
      }
    }

    // Unforeseen batch failure: Do NOT ACK success!
    briLog('error', 'BRIVA_PAYMENT_PERSIST_ERROR', {
      durationMs: Date.now() - startTime,
      details: {
        error: errMsg,
        orderId: activeOrder.id,
        paymentRequestId,
        trxId: rawTrxId,
      },
    })
    return {
      status: 500,
      body: {
        responseCode: BRI_VA_PAYMENT_CODES.GENERAL_ERROR,
        responseMessage: 'Failed to persist transaction atomically.',
      },
    }
  }

  briLog('info', 'BRIVA_PAYMENT_SUCCESS', {
    durationMs: Date.now() - startTime,
    details: {
      paymentId,
      paymentNumber,
      orderId: activeOrder.id,
      santriId: studentVa.santri_id,
      grossAmount: activeOrder.gross_amount,
      adminFee: activeOrder.cooperative_admin_fee,
      paymentRequestId,
      trxId: rawTrxId,
    },
  })

  // 17. Return Official Success Response
  return {
    status: 200,
    body: {
      responseCode: BRI_VA_PAYMENT_CODES.SUCCESS,
      responseMessage: 'Successful',
      virtualAccountData: {
        partnerServiceId,
        customerNo: custNo,
        virtualAccountNo: vaNo,
        virtualAccountName: req.virtualAccountName || student.nama_lengkap,
        paymentRequestId,
        paidAmount: req.paidAmount,
        ...(buildPaymentResponseAdditionalInfo(req.additionalInfo)
          ? { additionalInfo: buildPaymentResponseAdditionalInfo(req.additionalInfo) }
          : {}),
      },
    },
  }
}
