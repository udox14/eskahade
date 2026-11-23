// Firebase Cloud Messaging HTTP v1 untuk APK Android (Capacitor). Murni Web Crypto + fetch.
// Kredensial service account dari secret: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY.
// Access token OAuth hanya disimpan di memori isolate (tidak di KV/D1) dan tidak pernah di-log.

import type { PushSendResult } from './webpush'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const FCM_PAYLOAD_MAX = 3500
const encoder = new TextEncoder()

export interface FcmConfig {
  projectId: string
  clientEmail: string
  privateKey: string
}

export function parseFcmConfig(env: Record<string, unknown>): FcmConfig | null {
  const projectId = typeof env.FCM_PROJECT_ID === 'string' ? env.FCM_PROJECT_ID.trim() : ''
  const clientEmail = typeof env.FCM_CLIENT_EMAIL === 'string' ? env.FCM_CLIENT_EMAIL.trim() : ''
  const privateKey = typeof env.FCM_PRIVATE_KEY === 'string' ? env.FCM_PRIVATE_KEY.trim() : ''
  if (!/^[a-z][a-z0-9-]{3,62}$/.test(projectId)) return null
  if (!/^[^\s@]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) return null
  if (!privateKey.includes('BEGIN PRIVATE KEY')) return null
  return { projectId, clientEmail, privateKey }
}

export function isValidFcmToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_:-]{20,4096}$/.test(token)
}

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToPkcs8(pem: string): ArrayBuffer {
  // Secret sering disimpan dengan "\n" literal (dari JSON service account).
  const body = pem.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const binary = atob(body)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out.buffer
}

class FcmAuthError extends Error {
  constructor(readonly transient: boolean, message: string) { super(message) }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()
const inFlight = new Map<string, Promise<string>>()

export function clearFcmTokenCache() {
  tokenCache.clear()
  inFlight.clear()
}

async function mintAccessToken(config: FcmConfig, fetchImpl: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claims = b64url(encoder.encode(JSON.stringify({ iss: config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })))
  const unsigned = `${header}.${claims}`
  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(config.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  } catch {
    throw new FcmAuthError(false, 'FCM_PRIVATE_KEY tidak valid.')
  }
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned)))
  let response: Response
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
    })
  } catch {
    throw new FcmAuthError(true, 'Server token Google tidak terjangkau.')
  }
  if (response.status >= 300 && response.status < 400) {
    throw new FcmAuthError(true, `Redirect token FCM ditolak (${response.status}).`)
  }
  if (!response.ok) throw new FcmAuthError(response.status >= 500 || response.status === 429, `Token FCM ditolak (${response.status}).`)
  const json = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new FcmAuthError(true, 'Respons token FCM kosong.')
  tokenCache.set(config.clientEmail, { token: json.access_token, expiresAt: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 300) * 1000 })
  return json.access_token
}

async function accessToken(config: FcmConfig, fetchImpl: typeof fetch): Promise<string> {
  const cached = tokenCache.get(config.clientEmail)
  if (cached && cached.expiresAt > Date.now()) return cached.token
  let pending = inFlight.get(config.clientEmail)
  if (!pending) {
    pending = mintAccessToken(config, fetchImpl).finally(() => inFlight.delete(config.clientEmail))
    inFlight.set(config.clientEmail, pending)
  }
  return pending
}

interface FcmErrorBody {
  error?: { status?: string; details?: Array<{ errorCode?: string }> }
}

export function classifyFcmResponse(status: number, body: FcmErrorBody | null): PushSendResult {
  if (status >= 200 && status < 300) return { outcome: 'SENT', httpStatus: status, errorCode: null }
  if (status >= 300 && status < 400) return { outcome: 'TRANSIENT', httpStatus: status, errorCode: 'REDIRECT_BLOCKED' }
  const code = body?.error?.details?.find(d => d.errorCode)?.errorCode ?? body?.error?.status ?? null
  // Token tidak berlaku lagi (aplikasi dihapus/di-reset) atau milik project Firebase lain.
  if (code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH' || status === 404) {
    return { outcome: 'EXPIRED', httpStatus: status, errorCode: code ?? 'UNREGISTERED' }
  }
  if (status === 429 || status >= 500 || code === 'QUOTA_EXCEEDED' || code === 'UNAVAILABLE' || code === 'INTERNAL') {
    return { outcome: 'TRANSIENT', httpStatus: status, errorCode: code ?? 'PROVIDER_ERROR' }
  }
  // 401/403 = kredensial server ditolak → salah konfigurasi, jangan nonaktifkan perangkat.
  if (status === 401 || status === 403 || code === 'THIRD_PARTY_AUTH_ERROR') {
    return { outcome: 'REJECTED', httpStatus: status, errorCode: 'FCM_AUTH_REJECTED' }
  }
  return { outcome: 'REJECTED', httpStatus: status, errorCode: code === 'INVALID_ARGUMENT' ? 'INVALID_ARGUMENT' : 'BAD_REQUEST' }
}

export interface FcmPayload {
  id: string
  title: string
  body: string
  url: string
  tag: string
}

export function buildFcmMessage(token: string, payload: FcmPayload, urgency: 'high' | 'normal') {
  return {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      // data dibaca runtime web saat notifikasi diketuk (deep link internal).
      data: { id: payload.id, url: payload.url, tag: payload.tag },
      android: {
        priority: urgency === 'high' ? 'HIGH' : 'NORMAL',
        ttl: '86400s',
        notification: {
          channel_id: 'default',
          icon: 'ic_stat_ic_notification',
          color: '#15803D',
          sound: 'default',
          tag: payload.id,
          notification_priority: urgency === 'high' ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
          visibility: 'PUBLIC',
        },
      },
    },
  }
}

export async function sendFcm(
  token: string,
  payload: FcmPayload,
  config: FcmConfig,
  options: { urgency?: 'high' | 'normal'; fetchImpl?: typeof fetch } = {},
): Promise<PushSendResult> {
  if (!isValidFcmToken(token)) return { outcome: 'EXPIRED', httpStatus: null, errorCode: 'INVALID_TOKEN' }
  const fetchImpl = options.fetchImpl ?? fetch
  const body = JSON.stringify(buildFcmMessage(token, payload, options.urgency ?? 'normal'))
  if (encoder.encode(body).length > FCM_PAYLOAD_MAX) return { outcome: 'REJECTED', httpStatus: null, errorCode: 'PAYLOAD_TOO_LARGE' }

  let bearer: string
  try {
    bearer = await accessToken(config, fetchImpl)
  } catch (error) {
    const transient = error instanceof FcmAuthError ? error.transient : true
    return { outcome: transient ? 'TRANSIENT' : 'REJECTED', httpStatus: null, errorCode: transient ? 'FCM_AUTH_UNAVAILABLE' : 'FCM_AUTH_REJECTED' }
  }

  try {
    const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body,
    })
    if (response.status === 401) tokenCache.delete(config.clientEmail)
    const parsed = response.ok ? null : await response.json().catch(() => null) as FcmErrorBody | null
    return classifyFcmResponse(response.status, parsed)
  } catch {
    return { outcome: 'TRANSIENT', httpStatus: null, errorCode: 'NETWORK' }
  }
}
