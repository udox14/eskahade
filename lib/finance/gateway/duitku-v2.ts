// lib/finance/gateway/duitku-v2.ts
// Adapter Protokol Duitku Web API V2 (Dynamic Payments, Checkout, QRIS)
// Menggunakan HMAC-SHA256 sesuai standar resmi Duitku Web API V2.
// Secret (API Key) WAJIB dimuat dari environment / Cloudflare Secrets, BUKAN database.

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import {
  recordOrderPayment,
  recordUnallocatedPayment,
} from '@/lib/finance/payments'
import { getPaymentOrderByNumber } from '@/lib/finance/orders'
import type {
  DuitkuConfig,
  DuitkuCallbackPayload,
  DuitkuCreateTransactionInput,
  DuitkuCreateTransactionResponse,
  DuitkuCheckTransactionResponse,
  ProcessDuitkuCallbackResult,
} from '@/lib/finance/payment-types'

// ============================================================
// 1. Kriptografi & Signature Web API V2 (HMAC-SHA256)
// ============================================================

export async function generateHmacSha256(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Signature Permintaan Transaksi V2:
 * stringToSign = merchantCode + merchantOrderId + paymentAmount
 * signature = HMAC_SHA256(stringToSign, apiKey)
 */
export async function generateInquirySignatureV2(
  merchantCode: string,
  merchantOrderId: string,
  paymentAmount: number | string,
  apiKey: string
): Promise<string> {
  const stringToSign = `${merchantCode}${merchantOrderId}${paymentAmount}`
  return generateHmacSha256(stringToSign, apiKey)
}

/**
 * Signature Status Transaksi V2:
 * stringToSign = merchantCode + merchantOrderId
 * signature = HMAC_SHA256(stringToSign, apiKey)
 */
export async function generateCheckStatusSignatureV2(
  merchantCode: string,
  merchantOrderId: string,
  apiKey: string
): Promise<string> {
  const stringToSign = `${merchantCode}${merchantOrderId}`
  return generateHmacSha256(stringToSign, apiKey)
}

/**
 * Signature Callback Webhook V2:
 * stringToSign = merchantCode + amount + merchantOrderId
 * signature = HMAC_SHA256(stringToSign, apiKey)
 */
export async function generateCallbackSignatureV2(
  merchantCode: string,
  amount: number | string,
  merchantOrderId: string,
  apiKey: string
): Promise<string> {
  const stringToSign = `${merchantCode}${amount}${merchantOrderId}`
  return generateHmacSha256(stringToSign, apiKey)
}

export async function verifyDuitkuCallbackSignatureV2(
  payload: DuitkuCallbackPayload,
  apiKey: string
): Promise<boolean> {
  if (!payload.merchantCode || payload.amount === undefined || !payload.merchantOrderId || !payload.signature) {
    return false
  }

  const expectedSignature = await generateCallbackSignatureV2(
    payload.merchantCode,
    payload.amount,
    payload.merchantOrderId,
    apiKey
  )

  return timingSafeEqual(payload.signature.toLowerCase().trim(), expectedSignature.toLowerCase().trim())
}

// ============================================================
// 2. Konfigurasi Gateway Web API V2
// ============================================================

/**
 * Memuat konfigurasi Duitku V2.
 * Terhubung langsung ke tabel app_settings (konfigurasi yang diatur di Modul Pengaturan Keuangan SPA)
 * dengan fallback ke environment / Cloudflare Secrets jika belum disetel di database.
 */
export async function getDuitkuV2Config(): Promise<DuitkuConfig> {
  // Nilai awal / fallback dari environment
  let apiKey = (process.env.DUITKU_API_KEY || '').trim()
  let merchantCode = (process.env.DUITKU_MERCHANT_CODE || '').trim()
  let environment: 'sandbox' | 'production' =
    process.env.DUITKU_ENV === 'production' ? 'production' : 'sandbox'
  let callbackUrl = (process.env.DUITKU_CALLBACK_URL || '').trim()
  let returnUrl = (process.env.DUITKU_RETURN_URL || '').trim()
  let defaultExpiryMinutes = parseInt(process.env.DUITKU_EXPIRY_MINUTES || '1440', 10)

  try {
    const dbSettings = await query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN (
        'duitku_merchant_code', 'duitku_env', 'duitku_api_key',
        'duitku_callback_url', 'duitku_return_url', 'duitku_expiry_minutes'
      )`
    )
    for (const row of dbSettings) {
      if (row.key === 'duitku_merchant_code' && row.value) merchantCode = row.value.trim()
      if (row.key === 'duitku_api_key' && row.value) apiKey = row.value.trim()
      if (row.key === 'duitku_env' && row.value) {
        environment = row.value === 'production' ? 'production' : 'sandbox'
      }
      if (row.key === 'duitku_callback_url' && row.value) callbackUrl = row.value.trim()
      if (row.key === 'duitku_return_url' && row.value) returnUrl = row.value.trim()
      if (row.key === 'duitku_expiry_minutes' && row.value) {
        const val = parseInt(row.value, 10)
        if (!isNaN(val) && val > 0) defaultExpiryMinutes = val
      }
    }
  } catch {
    // Abaikan pada environment testing tanpa tabel app_settings
  }

  return {
    merchantCode,
    apiKey,
    environment,
    callbackUrl: callbackUrl || undefined,
    returnUrl: returnUrl || undefined,
    defaultExpiryMinutes: isNaN(defaultExpiryMinutes) ? 1440 : defaultExpiryMinutes,
  }
}

export interface GatewayFeeSettings {
  feePayer: 'CUSTOMER' | 'INSTITUTION'
  defaultVaFee: number
  defaultQrisFeePercent: number
}

/**
 * Mengambil pengaturan penanggung fee gateway (CUSTOMER vs INSTITUTION)
 * dan nominal/persentase fee default dari app_settings.
 */
export async function getGatewayFeeSettings(): Promise<GatewayFeeSettings> {
  let feePayer: 'CUSTOMER' | 'INSTITUTION' = 'CUSTOMER'
  let defaultVaFee = 4000
  let defaultQrisFeePercent = 0.7

  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN (
        'gateway_fee_payer', 'gateway_default_va_fee', 'gateway_default_qris_fee_percent'
      )`
    )
    for (const r of rows) {
      if (r.key === 'gateway_fee_payer' && (r.value === 'CUSTOMER' || r.value === 'INSTITUTION')) {
        feePayer = r.value
      } else if (r.key === 'gateway_default_va_fee') {
        const val = parseInt(r.value, 10)
        if (!isNaN(val) && val >= 0) defaultVaFee = val
      } else if (r.key === 'gateway_default_qris_fee_percent') {
        const val = parseFloat(r.value)
        if (!isNaN(val) && val >= 0) defaultQrisFeePercent = val
      }
    }
  } catch {
    // Abaikan pada testing tanpa tabel
  }

  return { feePayer, defaultVaFee, defaultQrisFeePercent }
}

/**
 * Mengambil daftar channel pembayaran yang aktif diizinkan dari app_settings.
 * Default: ['DUITKU_VA', 'DUITKU_QRIS']
 */
export async function getEnabledPaymentChannels(): Promise<Array<'DUITKU_VA' | 'DUITKU_QRIS'>> {
  try {
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'gateway_channels_enabled'`
    )
    if (row?.value) {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((c: unknown): c is 'DUITKU_VA' | 'DUITKU_QRIS' =>
          c === 'DUITKU_VA' || c === 'DUITKU_QRIS'
        )
        if (valid.length > 0) return valid
      }
    }
  } catch {
    // Abaikan jika belum siap
  }
  return ['DUITKU_VA', 'DUITKU_QRIS']
}

// ============================================================
// 3. Outbound Client Web API V2
// ============================================================

export async function createDuitkuV2Transaction(
  input: DuitkuCreateTransactionInput,
  configOverride?: Partial<DuitkuConfig>
): Promise<DuitkuCreateTransactionResponse> {
  const loadedConfig = await getDuitkuV2Config()
  const config: DuitkuConfig = { ...loadedConfig, ...configOverride }

  if (!config.merchantCode) throw new Error('Duitku Merchant Code belum dikonfigurasi.')
  if (!config.apiKey) throw new Error('Duitku API Key belum dikonfigurasi di environment.')

  const endpoint =
    config.environment === 'production'
      ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry'
      : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'

  const expiryPeriod = input.expiryPeriod || config.defaultExpiryMinutes
  const signature = await generateInquirySignatureV2(
    config.merchantCode,
    input.merchantOrderId,
    input.paymentAmount,
    config.apiKey
  )

  const payload = {
    merchantCode: config.merchantCode,
    paymentAmount: Math.round(input.paymentAmount),
    paymentMethod: input.paymentMethod,
    merchantOrderId: input.merchantOrderId,
    productDetails: input.productDetails,
    additionalParam: '',
    merchantUserInfo: '',
    customerVaName: input.customerVaName,
    email: input.email,
    phoneNumber: input.phoneNumber || '',
    callbackUrl: input.callbackUrl || config.callbackUrl || '',
    returnUrl: input.returnUrl || config.returnUrl || '',
    signature,
    expiryPeriod,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Duitku V2 API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as DuitkuCreateTransactionResponse
  if (data.statusCode && data.statusCode !== '00') {
    throw new Error(`Duitku V2 transaksi ditolak: [${data.statusCode}] ${data.statusMessage}`)
  }

  return data
}

export async function checkDuitkuV2TransactionStatus(
  merchantOrderId: string,
  configOverride?: Partial<DuitkuConfig>
): Promise<DuitkuCheckTransactionResponse> {
  const loadedConfig = await getDuitkuV2Config()
  const config: DuitkuConfig = { ...loadedConfig, ...configOverride }

  if (!config.merchantCode || !config.apiKey) {
    throw new Error('Duitku merchantCode atau apiKey belum dikonfigurasi.')
  }

  const endpoint =
    config.environment === 'production'
      ? 'https://passport.duitku.com/webapi/api/merchant/transactionStatus'
      : 'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus'

  const signature = await generateCheckStatusSignatureV2(
    config.merchantCode,
    merchantOrderId,
    config.apiKey
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantCode: config.merchantCode,
      merchantOrderId,
      signature,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Duitku V2 transactionStatus error (${response.status}): ${errText}`)
  }

  return (await response.json()) as DuitkuCheckTransactionResponse
}

// ============================================================
// 4. Inbound Webhook Callback Web API V2
// ============================================================

export async function processDuitkuV2Callback(
  payload: DuitkuCallbackPayload,
  options?: { apiKeyOverride?: string; skipSignatureCheck?: boolean }
): Promise<ProcessDuitkuCallbackResult> {
  const merchantCode = String(payload.merchantCode || '').trim()
  const rawAmount = payload.amount !== undefined ? payload.amount : ''
  const amount = typeof rawAmount === 'number' ? rawAmount : parseInt(String(rawAmount).trim(), 10)
  const merchantOrderId = String(payload.merchantOrderId || '').trim()
  const reference = String(payload.reference || '').trim()
  const incomingSignature = String(payload.signature || '').trim()
  const resultCode = String(payload.resultCode || '').trim()
  const paymentCode = String(payload.paymentCode || '').trim()

  if (!merchantCode || isNaN(amount) || !merchantOrderId || !reference || !incomingSignature) {
    throw new Error(
      'Parameter callback Duitku V2 tidak lengkap: merchantCode, amount, merchantOrderId, reference, dan signature wajib ada.'
    )
  }

  const config = await getDuitkuV2Config()
  const apiKey = options?.apiKeyOverride || config.apiKey

  // 1. Verifikasi Signature HMAC-SHA256
  if (!options?.skipSignatureCheck) {
    if (!apiKey) {
      throw new Error('Duitku API Key tidak ditemukan di environment untuk verifikasi callback V2.')
    }

    const isSignatureValid = await verifyDuitkuCallbackSignatureV2(payload, apiKey)
    if (!isSignatureValid) {
      const errorEventId = generateId()
      const errorKey = `DUITKU_V2_BAD_SIG_${reference}_${Date.now()}`
      try {
        await execute(
          `INSERT INTO finance_gateway_events (
            id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
          ) VALUES (?, 'DUITKU_V2', ?, ?, 0, ?, 'ERROR', ?)`,
          [errorEventId, errorKey, merchantOrderId, JSON.stringify(payload), now()]
        )
      } catch {}
      throw new Error('Signature callback Duitku V2 tidak sah (Bad Signature).')
    }
  }

  // 2. Idempotensi Mutlak berbasis reference
  const eventKey = `DUITKU_V2_${reference}`
  const existingEvent = await queryOne<{ id: string; processing_status: string }>(
    `SELECT id, processing_status FROM finance_gateway_events WHERE event_key = ?`,
    [eventKey]
  )

  if (existingEvent && existingEvent.processing_status === 'PROCESSED') {
    return {
      success: true,
      message: 'Callback Duitku V2 ini sudah pernah diproses sebelumnya (idempoten).',
      isDuplicate: true,
      matchType: 'ALREADY_PROCESSED',
    }
  }

  // 3. Evaluasi status resultCode
  if (resultCode !== '00') {
    const eventId = existingEvent?.id || generateId()
    await execute(
      `INSERT INTO finance_gateway_events (
        id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
      ) VALUES (?, 'DUITKU_V2', ?, ?, 1, ?, 'IGNORED', ?)
      ON CONFLICT(event_key) DO UPDATE SET processing_status = 'IGNORED'`,
      [eventId, eventKey, merchantOrderId, JSON.stringify(payload), now()]
    )

    return {
      success: false,
      message: `Status transaksi gateway bukan sukses (resultCode: ${resultCode}). Event diabaikan.`,
      isDuplicate: false,
      matchType: 'ALREADY_PROCESSED',
    }
  }

  const method = paymentCode ? `DUITKU_${paymentCode.toUpperCase()}` : 'DUITKU_V2'
  const paidAt = payload.settlementDate ? `${payload.settlementDate}T12:00:00Z` : now()

  // 4. Matching Order
  const order = await getPaymentOrderByNumber(merchantOrderId)
  let paymentResultId: string | undefined
  let paymentResultNumber: string | undefined
  let matchedOrderId: string | null = null
  let recItemId: string | undefined
  let matchType: ProcessDuitkuCallbackResult['matchType']

  if (order) {
    matchedOrderId = order.id
    if (order.status === 'PENDING') {
      if (order.total_charged === amount) {
        const payment = await recordOrderPayment({
          orderId: order.id,
          channel: 'DUITKU',
          method,
          externalReference: reference,
          gatewayFee: order.gateway_fee,
          paidAt,
        })
        paymentResultId = payment.id
        paymentResultNumber = payment.payment_number
        matchType = 'ORDER_ALLOCATED'
      } else {
        const payment = await recordUnallocatedPayment({
          santriId: order.santri_id,
          amount,
          channel: 'DUITKU',
          method,
          externalReference: reference,
          gatewayFee: order.gateway_fee,
          paidAt,
        })
        paymentResultId = payment.id
        paymentResultNumber = payment.payment_number
        matchType = 'AMOUNT_MISMATCH'
      }
    } else {
      const payment = await recordOrderPayment({
        orderId: order.id,
        channel: 'DUITKU',
        method,
        externalReference: reference,
        gatewayFee: order.gateway_fee,
        paidAt,
      })
      paymentResultId = payment.id
      paymentResultNumber = payment.payment_number
      matchType = 'EXPIRED_OR_CANCELLED_ORDER'
    }
  } else {
    // Order checkout V2 tidak ditemukan, namun signature sah dan uang nyata diterima (resultCode = '00').
    // Sesuai prinsip rekonsiliasi: fakta uang diterima dipisahkan dari kemampuan matching/allocation.
    // Catat sebagai unmatched external receipt ke finance_reconciliation_items tanpa memalsukan santri_id atau menghasilkan alokasi.
    recItemId = generateId()
    await execute(
      `INSERT INTO finance_reconciliation_items (
        id, reconciliation_id, payment_id, settlement_id, cash_session_id,
        external_reference, internal_amount, external_amount, discrepancy_amount,
        match_status, resolution_action, resolution_notes, resolved_by, resolved_at, created_at
      ) VALUES (?, NULL, NULL, NULL, NULL, ?, 0, ?, ?, 'UNMATCHED_EXTERNAL', 'NONE', ?, NULL, NULL, ?)`,
      [
        recItemId,
        reference,
        amount,
        amount,
        `Penerimaan dana gateway Duitku V2 berhasil (ref: ${reference}), namun merchantOrderId "${merchantOrderId}" tidak ditemukan pada database. Tercatat sebagai unmatched external receipt untuk rekonsiliasi manual.`,
        paidAt,
      ]
    )
    matchType = 'UNMATCHED_EXTERNAL'
  }

  // 5. Mark Event PROCESSED
  const finalEventId = existingEvent?.id || generateId()
  await execute(
    `INSERT INTO finance_gateway_events (
      id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
    ) VALUES (?, 'DUITKU_V2', ?, ?, 1, ?, 'PROCESSED', ?)
    ON CONFLICT(event_key) DO UPDATE SET processing_status = 'PROCESSED'`,
    [finalEventId, eventKey, merchantOrderId, JSON.stringify(payload), now()]
  )

  return {
    success: true,
    message: order
      ? 'Callback Duitku V2 berhasil diverifikasi dan diproses oleh Payment Engine.'
      : 'Callback Duitku V2 berhasil diverifikasi dan diamankan ke rekonsiliasi sebagai unmatched external receipt.',
    paymentId: paymentResultId,
    paymentNumber: paymentResultNumber,
    orderId: matchedOrderId,
    reconciliationItemId: recItemId,
    isDuplicate: false,
    matchType,
  }
}

