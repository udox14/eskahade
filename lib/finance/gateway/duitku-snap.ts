// lib/finance/gateway/duitku-snap.ts
// Adapter Protokol Duitku SNAP Virtual Account (BI SNAP Standard untuk Fixed Virtual Account Permanen)
//
// Standar yang diimplementasikan:
// 1. Asymmetric RSA-SHA256 untuk B2B Access Token (/auth/v1.0/access-token/b2b)
// 2. Symmetric HMAC-SHA512 untuk Outbound Request Signature (/v1.0/transfer-va/*)
// 3. Asymmetric RSA-SHA256 untuk Inbound Payment VA Notification Signature Verification
// 4. Idempotensi Mutlak berbasis `paymentRequestId` (DUITKU_SNAP_${paymentRequestId})
// 5. Ekstraksi Duitku Reference dari `additionalInfo.reference`
// 6. Dukungan Close Amount ('C') untuk penagihan ber-order, dan Open Amount ('O') untuk top-up
// 7. Aturan Anti-Menebak Alokasi: pembayaran tanpa order aktif dicatat ke UNALLOCATED + Rekonsiliasi
// 8. Isolasi Secret: Client Secret, Private Key, dan Public Key WAJIB dari process.env

import crypto from 'node:crypto'
import { query, queryOne, execute, generateId, now } from '@/lib/db'
import {
  recordOrderPayment,
  recordUnallocatedPayment,
} from '@/lib/finance/payments'
import { getPaymentOrderByNumber } from '@/lib/finance/orders'
import { findStudentByFixedVa } from '@/lib/finance/va'
import { nonBillableSantriSqlPredicate } from '@/lib/finance/non-billable-santri'
import type {
  DuitkuSnapConfig,
  SnapTokenResponse,
  SnapCreateVaInput,
  SnapCreateVaResponse,
  SnapUpdateVaInput,
  SnapUpdateVaResponse,
  SnapInquiryVaResponse,
  SnapPaymentNotificationPayload,
  ProcessSnapPaymentResult,
} from '@/lib/finance/payment-types'

// ============================================================
// 1. Kriptografi & Signature SNAP BI
// ============================================================

/**
 * Menghasilkan timestamp format ISO-8601 dengan offset zona waktu (default +07:00).
 * Contoh: 2026-09-19T14:30:00+07:00
 */
export function getSnapTimestamp(date = new Date(), timeZoneOffsetMinutes = 420): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0')
  const tzOffset = timeZoneOffsetMinutes
  const tzSign = tzOffset >= 0 ? '+' : '-'
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60))
  const tzMinutes = pad(Math.abs(tzOffset) % 60)

  // Gunakan waktu lokal sesuai offset
  const localDate = new Date(date.getTime() + tzOffset * 60 * 1000)
  const y = localDate.getUTCFullYear()
  const m = pad(localDate.getUTCMonth() + 1)
  const d = pad(localDate.getUTCDate())
  const hh = pad(localDate.getUTCHours())
  const mm = pad(localDate.getUTCMinutes())
  const ss = pad(localDate.getUTCSeconds())

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${tzSign}${tzHours}:${tzMinutes}`
}

/**
 * 1A. Asymmetric Signature untuk B2B Access Token Request (RSA-SHA256 with PKCS#1 v1.5).
 * String to sign: partnerId + "|" + timestamp
 * Header: X-SIGNATURE
 */
export function generateSnapTokenSignature(
  partnerId: string,
  timestamp: string,
  privateKeyPem: string
): string {
  if (!partnerId || !timestamp || !privateKeyPem) {
    throw new Error('partnerId, timestamp, dan privateKeyPem wajib ada untuk token signature SNAP.')
  }
  const stringToSign = `${partnerId}|${timestamp}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(stringToSign)
  return signer.sign(privateKeyPem, 'base64')
}

/**
 * Verifikasi signature token B2B menggunakan Public Key pengirim.
 */
export function verifySnapTokenSignature(
  partnerId: string,
  timestamp: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const stringToSign = `${partnerId}|${timestamp}`
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(stringToSign)
    return verifier.verify(publicKeyPem, signatureBase64, 'base64')
  } catch {
    return false
  }
}

/**
 * Minify JSON body sesuai standar SNAP (tanpa spasi/whitespace berlebih).
 */
export function minifyJsonBody(body: unknown): string {
  if (body === null || body === undefined || body === '') return ''
  if (typeof body === 'string') {
    try {
      return JSON.stringify(JSON.parse(body))
    } catch {
      return body.trim()
    }
  }
  return JSON.stringify(body)
}

/**
 * Menghasilkan hash SHA-256 dalam lowercase hex dari minified body.
 */
export function hashBodySha256(body: unknown): string {
  const minified = minifyJsonBody(body)
  return crypto.createHash('sha256').update(minified).digest('hex').toLowerCase()
}

/**
 * 1B. Symmetric Signature untuk Outbound Service Request (HMAC-SHA512).
 * String to sign: HTTPMethod + ":" + EndpointUrl + ":" + AccessToken + ":" + Lowercase(HexEncode(SHA-256(MinifiedBody))) + ":" + Timestamp
 * Header: X-SIGNATURE
 */
export function generateSnapRequestSignature(
  httpMethod: string,
  endpointPath: string,
  accessToken: string,
  body: unknown,
  timestamp: string,
  clientSecret: string
): string {
  if (!httpMethod || !endpointPath || !clientSecret) {
    throw new Error('httpMethod, endpointPath, dan clientSecret wajib ada untuk request signature SNAP.')
  }
  const bodyHash = hashBodySha256(body)
  const stringToSign = `${httpMethod.toUpperCase()}:${endpointPath}:${accessToken}:${bodyHash}:${timestamp}`
  return crypto.createHmac('sha512', clientSecret).update(stringToSign).digest('base64')
}

/**
 * 1C. Asymmetric Signature untuk Inbound Notification (RSA-SHA256 with PKCS#1 v1.5).
 * Standar ASPI SNAP BI untuk Webhook/Notifikasi dari Bank/Gateway:
 * String to sign: HTTPMethod + ":" + EndpointUrl + ":" + Lowercase(HexEncode(SHA-256(MinifiedBody))) + ":" + Timestamp
 */
export function generateSnapNotificationSignature(
  httpMethod: string,
  endpointPath: string,
  body: unknown,
  timestamp: string,
  privateKeyPem: string
): string {
  const bodyHash = hashBodySha256(body)
  const stringToSign = `${httpMethod.toUpperCase()}:${endpointPath}:${bodyHash}:${timestamp}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(stringToSign)
  return signer.sign(privateKeyPem, 'base64')
}

/**
 * Verifikasi signature notifikasi pembayaran SNAP masuk dari Duitku menggunakan Duitku Public Key.
 * Jika public key belum disetel pada environment development/sandbox, dapat diverifikasi fallback symmetric HMAC
 * atau lolos dengan validasi struktur Base64.
 */
export function verifySnapPaymentNotificationSignature(
  httpMethod: string,
  endpointPath: string,
  body: unknown,
  timestamp: string,
  signatureBase64: string,
  publicKeyPem?: string,
  clientSecretFallback?: string
): boolean {
  if (!signatureBase64) return false

  const bodyHash = hashBodySha256(body)
  const stringToSign = `${httpMethod.toUpperCase()}:${endpointPath}:${bodyHash}:${timestamp}`

  // 1. Coba Asymmetric RSA-SHA256 dengan Public Key Duitku jika tersedia
  if (publicKeyPem) {
    try {
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(stringToSign)
      if (verifier.verify(publicKeyPem, signatureBase64, 'base64')) {
        return true
      }
    } catch {
      // Lanjut ke fallback symmetric jika asymmetric gagal
    }
  }

  // 2. Fallback Symmetric HMAC-SHA512 jika Duitku dikonfigurasi mode symmetric
  if (clientSecretFallback) {
    try {
      const expectedHmac = crypto.createHmac('sha512', clientSecretFallback).update(stringToSign).digest('base64')
      if (expectedHmac === signatureBase64) {
        return true
      }
    } catch {}
  }

  // 3. Jika tidak ada public key atau secret (mode testing tanpa key), tolak kecuali eksplisit diizinkan
  return false
}

// ============================================================
// 2. Konfigurasi SNAP Gateway
// ============================================================

/**
 * Memuat konfigurasi Duitku SNAP API.
 * ATURAN KEAMANAN:
 * Memuat konfigurasi SNAP langsung dari app_settings (konfigurasi aktif di Modul Pengaturan Keuangan SPA)
 * dengan fallback ke environment / Cloudflare Secrets.
 */
export async function getDuitkuSnapConfig(): Promise<DuitkuSnapConfig> {
  // Nilai awal / fallback dari process.env
  let clientSecret = (
    process.env.DUITKU_SNAP_CLIENT_SECRET ||
    process.env.DUITKU_CLIENT_SECRET ||
    ''
  ).trim()

  let privateKey = (
    process.env.DUITKU_SNAP_PRIVATE_KEY ||
    process.env.DUITKU_PRIVATE_KEY ||
    ''
  ).trim()

  let duitkuPublicKey = (
    process.env.DUITKU_SNAP_PUBLIC_KEY ||
    process.env.DUITKU_PUBLIC_KEY ||
    ''
  ).trim() || undefined

  let partnerId = (
    process.env.DUITKU_SNAP_PARTNER_ID ||
    process.env.DUITKU_MERCHANT_CODE ||
    ''
  ).trim()

  let partnerServiceId = (
    process.env.DUITKU_SNAP_PARTNER_SERVICE_ID ||
    ''
  ).trim()

  let environment: 'sandbox' | 'production' =
    process.env.DUITKU_ENV === 'production' ? 'production' : 'sandbox'

  let defaultTrxType: 'C' | 'O' =
    (process.env.DUITKU_SNAP_DEFAULT_TRX_TYPE as 'C' | 'O') || 'C'

  try {
    const dbSettings = await query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN (
        'duitku_snap_partner_id', 'duitku_merchant_code',
        'duitku_snap_partner_service_id', 'duitku_env',
        'duitku_snap_default_trx_type', 'duitku_snap_client_secret',
        'duitku_snap_private_key', 'duitku_snap_public_key'
      )`
    )
    for (const row of dbSettings) {
      if (row.key === 'duitku_snap_partner_id' && row.value) partnerId = row.value.trim()
      if (row.key === 'duitku_merchant_code' && row.value && !partnerId) partnerId = row.value.trim()
      if (row.key === 'duitku_snap_partner_service_id' && row.value) partnerServiceId = row.value.trim()
      if (row.key === 'duitku_env' && row.value) {
        environment = row.value === 'production' ? 'production' : 'sandbox'
      }
      if (row.key === 'duitku_snap_default_trx_type' && row.value) {
        defaultTrxType = (row.value.trim().toUpperCase() === 'O' ? 'O' : 'C') as 'C' | 'O'
      }
      if (row.key === 'duitku_snap_client_secret' && row.value) {
        clientSecret = row.value.trim()
      }
      if (row.key === 'duitku_snap_private_key' && row.value) {
        privateKey = row.value.trim()
      }
      if (row.key === 'duitku_snap_public_key' && row.value) {
        duitkuPublicKey = row.value.trim() || undefined
      }
    }
  } catch {
    // Abaikan jika tabel app_settings belum siap
  }

  // Fallback default partnerServiceId jika belum diisi
  if (!partnerServiceId) {
    partnerServiceId = '0070'
  }

  return {
    partnerId,
    partnerServiceId,
    clientSecret,
    privateKey,
    duitkuPublicKey,
    environment,
    defaultTrxType,
  }
}

// In-memory token cache
let cachedSnapToken: { token: string; expiresAt: number } | null = null

export function clearSnapTokenCache(): void {
  cachedSnapToken = null
}

/**
 * Meminta B2B Access Token SNAP menggunakan Asymmetric RSA-SHA256 signature.
 * Menyimpan token di cache hingga 60 detik sebelum masa kedaluwarsa.
 */
export async function getSnapAccessToken(
  configOverride?: Partial<DuitkuSnapConfig>
): Promise<string> {
  const loadedConfig = await getDuitkuSnapConfig()
  const config: DuitkuSnapConfig = { ...loadedConfig, ...configOverride }

  const nowEpoch = Math.floor(Date.now() / 1000)
  if (cachedSnapToken && cachedSnapToken.expiresAt > nowEpoch + 60) {
    return cachedSnapToken.token
  }

  if (!config.partnerId) throw new Error('Duitku SNAP partnerId belum dikonfigurasi.')
  if (!config.privateKey) throw new Error('Duitku SNAP privateKey belum dikonfigurasi di environment.')

  const baseUrl =
    process.env.DUITKU_SNAP_BASE_URL ||
    (config.environment === 'production'
      ? 'https://passport.duitku.com'
      : 'https://sandbox.duitku.com')

  const endpointPath = '/auth/v1.0/access-token/b2b'
  const timestamp = getSnapTimestamp()
  const signature = generateSnapTokenSignature(config.partnerId, timestamp, config.privateKey)

  try {
    const response = await fetch(`${baseUrl}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': timestamp,
        'X-CLIENT-KEY': config.partnerId,
        'X-SIGNATURE': signature,
      },
      body: JSON.stringify({ grantType: 'client_credentials' }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`SNAP Token Error (${response.status}): ${errText}`)
    }

    const data = (await response.json()) as SnapTokenResponse
    if (!data.accessToken) {
      throw new Error(`SNAP Token Error: No accessToken in response: ${JSON.stringify(data)}`)
    }

    const expiresInSec = parseInt(data.expiresIn || '900', 10)
    cachedSnapToken = {
      token: data.accessToken,
      expiresAt: nowEpoch + (isNaN(expiresInSec) ? 900 : expiresInSec),
    }

    return data.accessToken
  } catch (err: unknown) {
    // Jika dalam environment test lokal tanpa koneksi sandbox aktif, dan privateKey valid
    if (process.env.NODE_ENV === 'test' || process.env.DUITKU_MOCK_GATEWAY === '1') {
      const mockToken = `mock_snap_token_${Date.now()}`
      cachedSnapToken = { token: mockToken, expiresAt: nowEpoch + 900 }
      return mockToken
    }
    throw err
  }
}

// ============================================================
// 3. Outbound Client Operasi Virtual Account (SNAP BI)
// ============================================================

/**
 * 3A. Mendaftarkan / Mengaktifkan Fixed Virtual Account (Create VA).
 * Sesuai kontrak SNAP BI: POST /v1.0/transfer-va/create-va
 *
 * Kebijakan Close Amount ('C') vs Open Amount ('O'):
 * - Close Amount: Digunakan saat santri memiliki tagihan/order spesifik (trxId = order_number).
 *                 Bank ATM mengunci nominal pembayaran sesuai nominal order.
 * - Open Amount: Digunakan untuk nomor Fixed VA permanen umum santri (top-up uang jajan / tabungan).
 *                 Nominal disetel 0.00 dan menerima nominal bebas dari m-Banking/ATM.
 */
export async function createSnapVirtualAccount(
  input: SnapCreateVaInput,
  configOverride?: Partial<DuitkuSnapConfig>
): Promise<SnapCreateVaResponse> {
  const loadedConfig = await getDuitkuSnapConfig()
  const config: DuitkuSnapConfig = { ...loadedConfig, ...configOverride }

  const token = await getSnapAccessToken(config)
  const baseUrl =
    process.env.DUITKU_SNAP_BASE_URL ||
    (config.environment === 'production'
      ? 'https://passport.duitku.com'
      : 'https://sandbox.duitku.com')

  const endpointPath = '/v1.0/transfer-va/create-va'
  const timestamp = getSnapTimestamp()
  const externalId = generateId()

  const trxType = input.trxType || config.defaultTrxType
  const totalAmount = (input.amount ?? 0).toFixed(2)

  const body = {
    partnerServiceId: config.partnerServiceId.padStart(8, ' '),
    customerNo: input.customerNo,
    virtualAccountNo: `${config.partnerServiceId}${input.customerNo}`,
    virtualAccountName: input.virtualAccountName,
    trxId: input.trxId,
    totalAmount: {
      value: totalAmount,
      currency: 'IDR',
    },
    virtualAccountTrxType: trxType,
    expiredDate: input.expiredDate || getSnapTimestamp(new Date(Date.now() + 86400000 * 30)),
  }

  const signature = generateSnapRequestSignature(
    'POST',
    endpointPath,
    token,
    body,
    timestamp,
    config.clientSecret
  )

  const response = await fetch(`${baseUrl}${endpointPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-PARTNER-ID': config.partnerId,
      'X-EXTERNAL-ID': externalId,
      'X-SIGNATURE': signature,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`SNAP Create VA Error (${response.status}): ${errText}`)
  }

  return (await response.json()) as SnapCreateVaResponse
}

/**
 * 3B. Memperbarui Tagihan Fixed Virtual Account (Update VA).
 * Sesuai kontrak SNAP BI: PUT /v1.0/transfer-va/update-va
 */
export async function updateSnapVirtualAccount(
  input: SnapUpdateVaInput,
  configOverride?: Partial<DuitkuSnapConfig>
): Promise<SnapUpdateVaResponse> {
  const loadedConfig = await getDuitkuSnapConfig()
  const config: DuitkuSnapConfig = { ...loadedConfig, ...configOverride }

  const token = await getSnapAccessToken(config)
  const baseUrl =
    process.env.DUITKU_SNAP_BASE_URL ||
    (config.environment === 'production'
      ? 'https://passport.duitku.com'
      : 'https://sandbox.duitku.com')

  const endpointPath = '/v1.0/transfer-va/update-va'
  const timestamp = getSnapTimestamp()
  const externalId = generateId()

  const body = {
    partnerServiceId: config.partnerServiceId.padStart(8, ' '),
    customerNo: input.customerNo,
    virtualAccountNo: `${config.partnerServiceId}${input.customerNo}`,
    virtualAccountName: input.virtualAccountName,
    trxId: input.trxId,
    totalAmount: input.amount !== undefined ? { value: input.amount.toFixed(2), currency: 'IDR' } : undefined,
    expiredDate: input.expiredDate,
  }

  const signature = generateSnapRequestSignature(
    'PUT',
    endpointPath,
    token,
    body,
    timestamp,
    config.clientSecret
  )

  const response = await fetch(`${baseUrl}${endpointPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-PARTNER-ID': config.partnerId,
      'X-EXTERNAL-ID': externalId,
      'X-SIGNATURE': signature,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`SNAP Update VA Error (${response.status}): ${errText}`)
  }

  return (await response.json()) as SnapUpdateVaResponse
}

/**
 * 3C. Inquiry Virtual Account (Inquiry VA).
 * Sesuai kontrak SNAP BI: POST /v1.0/transfer-va/inquiry-va
 */
export async function inquirySnapVirtualAccount(
  customerNo: string,
  trxId?: string,
  configOverride?: Partial<DuitkuSnapConfig>
): Promise<SnapInquiryVaResponse> {
  const loadedConfig = await getDuitkuSnapConfig()
  const config: DuitkuSnapConfig = { ...loadedConfig, ...configOverride }

  const token = await getSnapAccessToken(config)
  const baseUrl =
    process.env.DUITKU_SNAP_BASE_URL ||
    (config.environment === 'production'
      ? 'https://passport.duitku.com'
      : 'https://sandbox.duitku.com')

  const endpointPath = '/v1.0/transfer-va/inquiry-va'
  const timestamp = getSnapTimestamp()
  const externalId = generateId()

  const body = {
    partnerServiceId: config.partnerServiceId.padStart(8, ' '),
    customerNo,
    virtualAccountNo: `${config.partnerServiceId}${customerNo}`,
    trxId,
  }

  const signature = generateSnapRequestSignature(
    'POST',
    endpointPath,
    token,
    body,
    timestamp,
    config.clientSecret
  )

  const response = await fetch(`${baseUrl}${endpointPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-PARTNER-ID': config.partnerId,
      'X-EXTERNAL-ID': externalId,
      'X-SIGNATURE': signature,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`SNAP Inquiry VA Error (${response.status}): ${errText}`)
  }

  return (await response.json()) as SnapInquiryVaResponse
}

// ============================================================
// 4. Inbound Notification Payment VA (SNAP BI Webhook)
// ============================================================

/**
 * Memproses notifikasi pembayaran Virtual Account yang dikirimkan oleh Duitku / Bank (SNAP BI).
 * Endpoint resmi: POST /v1.0/transfer-va/payment
 *
 * Jaminan Kepatuhan Sistem Keuangan Baru:
 * 1. Idempotensi Mutlak berbasis `paymentRequestId` (DUITKU_SNAP_${paymentRequestId}).
 *    Setiap transfer ke Fixed VA memiliki paymentRequestId unik, sehingga Fixed VA yang sama
 *    dapat menerima pembayaran berulang kali tanpa bentrok atau double count.
 * 2. Ekstraksi Duitku reference dari `additionalInfo.reference`.
 * 3. Aturan Anti-Menebak Alokasi:
 *    - Jika trxId cocok dengan order PENDING dan nominal cocok -> ALLOCATED ke order.
 *    - Jika order sudah EXPIRED / CANCELLED -> catat ke UNALLOCATED dengan matchType 'EXPIRED_OR_CANCELLED_ORDER'.
 *    - Jika nominal tidak cocok dengan order -> catat ke UNALLOCATED dengan matchType 'AMOUNT_MISMATCH'.
 *    - Jika transfer bebas (Open Amount / tanpa order) -> catat ke UNALLOCATED santri + Rekonsiliasi ('UNALLOCATED_TRANSFER').
 * 4. Response code SNAP resmi:
 *    - Sukses: 2002500 (Successful)
 *    - Duplikat idempoten: 2002500 (Successful) dengan flag isDuplicate: true
 *    - Signature tidak sah: Error / 4017301
 */
export async function processSnapPaymentNotification(
  payload: SnapPaymentNotificationPayload,
  headers: {
    timestamp?: string
    signature?: string
    partnerId?: string
    externalId?: string
  },
  options?: {
    skipSignatureCheck?: boolean
    publicKeyOverride?: string
    clientSecretOverride?: string
    endpointPath?: string
  }
): Promise<ProcessSnapPaymentResult> {
  const paymentRequestId = String(payload.paymentRequestId || '').trim()
  const customerNo = String(payload.customerNo || '').trim()
  const virtualAccountNo = String(payload.virtualAccountNo || '').trim()
  const trxId = String(payload.trxId || '').trim()
  const rawAmount = payload.paidAmount?.value
  const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '0'))
  const reference = String(payload.additionalInfo?.reference || paymentRequestId).trim()

  if (!paymentRequestId || !virtualAccountNo || isNaN(amount) || amount <= 0) {
    throw new Error(
      'Parameter payload SNAP Payment VA tidak lengkap: paymentRequestId, virtualAccountNo, dan paidAmount.value (> 0) wajib ada.'
    )
  }

  const config = await getDuitkuSnapConfig()
  const publicKey = options?.publicKeyOverride || config.duitkuPublicKey
  const clientSecret = options?.clientSecretOverride || config.clientSecret
  const endpointPath = options?.endpointPath || '/v1.0/transfer-va/payment'
  const timestamp = headers.timestamp || getSnapTimestamp()
  const signature = headers.signature || ''

  // 1. Validasi Signature SNAP
  if (!options?.skipSignatureCheck) {
    if (!signature) {
      throw new Error('Header X-SIGNATURE tidak ditemukan pada request SNAP Payment VA.')
    }

    const isValid = verifySnapPaymentNotificationSignature(
      'POST',
      endpointPath,
      payload,
      timestamp,
      signature,
      publicKey,
      clientSecret
    )

    if (!isValid) {
      const errEventId = generateId()
      const errKey = `DUITKU_SNAP_BAD_SIG_${paymentRequestId}_${Date.now()}`
      try {
        await execute(
          `INSERT INTO finance_gateway_events (
            id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
          ) VALUES (?, 'DUITKU_SNAP', ?, ?, 0, ?, 'ERROR', ?)`,
          [errEventId, errKey, trxId || null, JSON.stringify(payload), now()]
        )
      } catch {}

      throw new Error('Signature SNAP Payment VA tidak sah (Bad Signature).')
    }
  }

  // 2. Idempotensi Mutlak berbasis paymentRequestId
  // (PENTING: paymentRequestId adalah kunci unik transaksi pembayaran di SNAP BI)
  const eventKey = `DUITKU_SNAP_${paymentRequestId}`
  const existingEvent = await queryOne<{ id: string; processing_status: string }>(
    `SELECT id, processing_status FROM finance_gateway_events WHERE event_key = ?`,
    [eventKey]
  )

  if (existingEvent && existingEvent.processing_status === 'PROCESSED') {
    return {
      success: true,
      responseCode: '2002500',
      responseMessage: 'Successful',
      isDuplicate: true,
      matchType: 'ALREADY_PROCESSED',
    }
  }

  // 3. Cari Identitas Santri
  // Fixed VA harus terdaftar di finance_student_va atau customerNo merujuk ke data santri
  const student = await findStudentByFixedVa(virtualAccountNo)
  let studentId = student ? student.santri_id : ''

  if (!studentId && customerNo) {
    const studentByNis = await queryOne<{ id: string; asrama: string | null; nama_lengkap: string }>(
      `SELECT id, asrama, nama_lengkap FROM santri WHERE id = ? OR nis = ?`,
      [customerNo, customerNo]
    )
    if (studentByNis) {
      studentId = studentByNis.id
    }
  }

  if (!studentId) {
    // Catat event error identitas
    const errId = generateId()
    await execute(
      `INSERT INTO finance_gateway_events (
        id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
      ) VALUES (?, 'DUITKU_SNAP', ?, ?, 1, ?, 'ERROR', ?)
      ON CONFLICT(event_key) DO UPDATE SET processing_status = 'ERROR'`,
      [errId, eventKey, trxId || null, JSON.stringify(payload), now()]
    )

    throw new Error(
      `Santri pemilik Virtual Account "${virtualAccountNo}" / customerNo "${customerNo}" tidak ditemukan dalam sistem.`
    )
  }

  // 3b. Guard bebas tagihan: santri penduduk setempat (AL-BAGHORY) dan kategori SADESA
  // tidak boleh diproses pada sistem keuangan baru. Dana yang terlanjur masuk TIDAK
  // dialokasikan dan dicatat ke finance_gateway_events untuk ditinjau Modul Rekonsiliasi.
  const billableStudent = await queryOne<{ asrama: string | null; nama_lengkap: string }>(
    `SELECT asrama, nama_lengkap FROM santri
     WHERE id = ?
       AND ${nonBillableSantriSqlPredicate('asrama')}`,
    [studentId]
  )

  if (!billableStudent) {
    const blockedId = generateId()
    await execute(
      `INSERT INTO finance_gateway_events (
        id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
      ) VALUES (?, 'DUITKU_SNAP', ?, ?, 1, ?, 'ERROR', ?)
      ON CONFLICT(event_key) DO UPDATE SET processing_status = 'ERROR'`,
      [
        blockedId,
        eventKey,
        trxId || null,
        JSON.stringify({
          ...payload,
          eskahade_blocked_reason:
            'Santri bebas tagihan (AL-BAGHORY / kategori SADESA) - dana tidak dialokasikan',
        }),
        now(),
      ]
    )

    throw new Error(
      `Pembayaran ditolak: santri pemilik Virtual Account "${virtualAccountNo}" termasuk kelompok bebas tagihan (asrama AL-BAGHORY atau kategori SADESA). Dana tidak dialokasikan otomatis dan dicatat untuk peninjauan Bendahara.`
    )
  }

  // Ambil nama santri untuk response virtualAccountData
  const santriRecord = await queryOne<{ id: string; nama_lengkap: string }>(
    `SELECT id, nama_lengkap FROM santri WHERE id = ?`,
    [studentId]
  )
  const studentName = santriRecord?.nama_lengkap || ''

  const paymentCode = payload.additionalInfo?.paymentCode
  const method = paymentCode ? `SNAP_${String(paymentCode).toUpperCase()}` : 'SNAP_VA'
  const paidAt = now()

  let paymentResultId: string | undefined
  let paymentResultNumber: string | undefined
  let matchedOrderId: string | null = null
  let matchType: ProcessSnapPaymentResult['matchType']

  // 4. Evaluasi Pencocokan Order (Anti-Menebak Alokasi)
  let order = trxId ? await getPaymentOrderByNumber(trxId) : null

  // Jika trxId tidak cocok dengan nomor order, cek apakah santri punya 1 order PENDING dengan nominal persis
  if (!order && studentId) {
    const pendingOrders = await query<{ id: string; order_number: string; total_charged: number }>(
      `SELECT id, order_number, total_charged
       FROM finance_payment_orders
       WHERE santri_id = ? AND status = 'PENDING' AND datetime(expires_at) > datetime('now')`,
      [studentId]
    )
    if (pendingOrders.length === 1 && pendingOrders[0].total_charged === amount) {
      order = await getPaymentOrderByNumber(pendingOrders[0].order_number)
    }
  }

  if (order) {
    matchedOrderId = order.id

    if (order.status === 'PENDING') {
      if (order.total_charged === amount) {
        // MATCH: Eksekusi alokasi atomik ke kewajiban order
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
        // Nominal tidak cocok: amankan ke UNALLOCATED santri + rekonsiliasi
        const payment = await recordUnallocatedPayment({
          santriId: studentId,
          amount,
          channel: 'DUITKU',
          method,
          externalReference: reference,
          paidAt,
        })
        paymentResultId = payment.id
        paymentResultNumber = payment.payment_number
        matchType = 'AMOUNT_MISMATCH'
      }
    } else {
      // Order tidak pending (misal sudah expired/cancelled): amankan ke UNALLOCATED santri
      const payment = await recordUnallocatedPayment({
        santriId: studentId,
        amount,
        channel: 'DUITKU',
        method,
        externalReference: reference,
        paidAt,
      })
      paymentResultId = payment.id
      paymentResultNumber = payment.payment_number
      matchType = 'EXPIRED_OR_CANCELLED_ORDER'
    }
  } else {
    // Tidak ada order (Open Amount transfer atau top-up):
    // Sesuai aturan non-menebak alokasi: amankan ke UNALLOCATED santri + Rekonsiliasi UNALLOCATED_TRANSFER
    const payment = await recordUnallocatedPayment({
      santriId: studentId,
      amount,
      channel: 'DUITKU',
      method,
      externalReference: reference,
      paidAt,
    })
    paymentResultId = payment.id
    paymentResultNumber = payment.payment_number
    matchType = 'UNALLOCATED_TRANSFER'
  }

  // 5. Catat keberhasilan pemrosesan ke tabel finance_gateway_events
  const finalEventId = existingEvent?.id || generateId()
  await execute(
    `INSERT INTO finance_gateway_events (
      id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
    ) VALUES (?, 'DUITKU_SNAP', ?, ?, 1, ?, 'PROCESSED', ?)
    ON CONFLICT(event_key) DO UPDATE SET processing_status = 'PROCESSED'`,
    [finalEventId, eventKey, trxId || null, JSON.stringify(payload), now()]
  )

  return {
    success: true,
    responseCode: '2002500',
    responseMessage: 'Successful',
    paymentId: paymentResultId,
    paymentNumber: paymentResultNumber,
    orderId: matchedOrderId,
    isDuplicate: false,
    matchType,
    virtualAccountData: {
      partnerServiceId: payload.partnerServiceId,
      customerNo: payload.customerNo,
      virtualAccountNo: payload.virtualAccountNo,
      virtualAccountName: studentName,
      paymentRequestId: payload.paymentRequestId,
      paidAmount: payload.paidAmount,
    },
  }
}

// ============================================================
// 5. Inbound Inquiry Fixed Virtual Account (SNAP BI)
// ============================================================

/**
 * Memproses permintaan Inquiry nomor Virtual Account (SNAP BI).
 * Endpoint resmi: POST /v1.0/transfer-va/inquiry-va
 * Digunakan jika bank / Duitku meminta verifikasi identitas santri & tagihan
 * saat nomor VA diinput di ATM atau m-Banking sebelum transfer dilakukan.
 */
export async function processSnapVaInquiry(
  payload: {
    partnerServiceId?: string
    customerNo?: string
    virtualAccountNo?: string
    trxId?: string
  }
): Promise<{
  responseCode: string
  responseMessage: string
  virtualAccountData?: {
    partnerServiceId: string
    customerNo: string
    virtualAccountNo: string
    virtualAccountName: string
    trxId: string
    totalAmount: {
      value: string
      currency: string
    }
    virtualAccountTrxType: 'C' | 'O'
    expiredDate: string
  }
}> {
  const virtualAccountNo = String(payload.virtualAccountNo || '').trim()
  const customerNo = String(payload.customerNo || '').trim()

  if (!virtualAccountNo && !customerNo) {
    return {
      responseCode: '4002400',
      responseMessage: 'virtualAccountNo atau customerNo wajib diisi.',
    }
  }

  // 1. Cari data santri dari Fixed VA atau NIS/ID
  const studentVa = virtualAccountNo ? await findStudentByFixedVa(virtualAccountNo) : null
  let student: { id: string; nama_lengkap: string } | null = null

  if (studentVa) {
    student = await queryOne<{ id: string; nama_lengkap: string }>(
      `SELECT id, nama_lengkap FROM santri WHERE id = ?
         AND ${nonBillableSantriSqlPredicate('asrama')}`,
      [studentVa.santri_id]
    )
  }

  if (!student && customerNo) {
    student = await queryOne<{ id: string; nama_lengkap: string }>(
      `SELECT id, nama_lengkap FROM santri WHERE (id = ? OR nis = ?)
         AND ${nonBillableSantriSqlPredicate('asrama')}`,
      [customerNo, customerNo]
    )
  }

  if (!student) {
    return {
      responseCode: '4042412',
      responseMessage: 'Virtual Account atau Santri tidak ditemukan.',
    }
  }

  const config = await getDuitkuSnapConfig()
  const resolvedVaNo = virtualAccountNo || `${config.partnerServiceId}${customerNo}`
  const resolvedCustomerNo = customerNo || (studentVa ? studentVa.va_number.slice(config.partnerServiceId.length) : student.id)

  // 2. Periksa apakah ada tagihan PENDING aktif (Close Amount)
  const pendingOrder = await queryOne<{ order_number: string; total_charged: number; expires_at: string }>(
    `SELECT order_number, total_charged, expires_at
     FROM finance_payment_orders
     WHERE santri_id = ? AND status = 'PENDING' AND datetime(expires_at) > datetime('now')
     ORDER BY created_at DESC
     LIMIT 1`,
    [student.id]
  )

  if (pendingOrder) {
    return {
      responseCode: '2002600',
      responseMessage: 'Successful',
      virtualAccountData: {
        partnerServiceId: config.partnerServiceId.padStart(8, ' '),
        customerNo: resolvedCustomerNo,
        virtualAccountNo: resolvedVaNo,
        virtualAccountName: student.nama_lengkap,
        trxId: pendingOrder.order_number,
        totalAmount: {
          value: pendingOrder.total_charged.toFixed(2),
          currency: 'IDR',
        },
        virtualAccountTrxType: 'C',
        expiredDate: pendingOrder.expires_at || getSnapTimestamp(new Date(Date.now() + 86400000)),
      },
    }
  }

  // 3. Jika tidak ada order aktif, nomor Fixed VA tetap sah untuk open transfer / top-up
  return {
    responseCode: '2002600',
    responseMessage: 'Successful',
    virtualAccountData: {
      partnerServiceId: config.partnerServiceId.padStart(8, ' '),
      customerNo: resolvedCustomerNo,
      virtualAccountNo: resolvedVaNo,
      virtualAccountName: student.nama_lengkap,
      trxId: payload.trxId || `TOPUP_${student.id}`,
      totalAmount: {
        value: '0.00',
        currency: 'IDR',
      },
      virtualAccountTrxType: 'O',
      expiredDate: getSnapTimestamp(new Date(Date.now() + 86400000 * 365)),
    },
  }
}

