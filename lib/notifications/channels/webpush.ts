// Web Push (RFC 8030) dengan VAPID (RFC 8292) dan enkripsi aes128gcm (RFC 8291).
// Murni Web Crypto — berjalan di Cloudflare Workers dan Node (test) tanpa dependency.

const encoder = new TextEncoder()
const RECORD_SIZE = 4096
export const WEBPUSH_PAYLOAD_MAX = 3000

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export interface WebPushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushOutcome = 'SENT' | 'EXPIRED' | 'REJECTED' | 'TRANSIENT'

export interface PushSendResult {
  outcome: PushOutcome
  httpStatus: number | null
  errorCode: string | null
}

export function b64urlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) throw new Error('Format base64url tidak valid.')
  const clean = value.replace(/=+$/, '')
  const base64 = clean.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (clean.length % 4)) % 4)
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function bytesToB64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

/** Salin ke ArrayBuffer baru: Web Crypto menolak view dengan offset/SharedArrayBuffer di beberapa runtime. */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

function decodeKey(value: string, length: number, label: string): Uint8Array {
  let bytes: Uint8Array
  try { bytes = b64urlToBytes(value) } catch { throw new Error(`${label} tidak valid.`) }
  if (bytes.length !== length) throw new Error(`${label} tidak valid.`)
  return bytes
}

export function decodeP256Public(value: string, label = 'Kunci publik'): Uint8Array {
  const bytes = decodeKey(value, 65, label)
  if (bytes[0] !== 0x04) throw new Error(`${label} tidak valid.`)
  return bytes
}

/** Konfigurasi VAPID dari secret. Tidak lengkap/tidak valid → null (kanal mati, fail closed). */
export function parseVapidConfig(env: Record<string, unknown>): VapidConfig | null {
  const publicKey = typeof env.VAPID_PUBLIC_KEY === 'string' ? env.VAPID_PUBLIC_KEY.trim() : ''
  const privateKey = typeof env.VAPID_PRIVATE_KEY === 'string' ? env.VAPID_PRIVATE_KEY.trim() : ''
  const subject = typeof env.VAPID_SUBJECT === 'string' ? env.VAPID_SUBJECT.trim() : ''
  if (!publicKey || !privateKey || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) return null
  try {
    decodeP256Public(publicKey)
    decodeKey(privateKey, 32, 'Kunci privat')
  } catch {
    return null
  }
  return { publicKey, privateKey, subject }
}

function p256Jwk(publicRaw: Uint8Array, privateRaw?: Uint8Array): JsonWebKey {
  return {
    kty: 'EC', crv: 'P-256', ext: true,
    x: bytesToB64url(publicRaw.slice(1, 33)),
    y: bytesToB64url(publicRaw.slice(33, 65)),
    ...(privateRaw ? { d: bytesToB64url(privateRaw) } : {}),
  }
}

const signingKeys = new Map<string, Promise<CryptoKey>>()

function vapidSigningKey(config: VapidConfig): Promise<CryptoKey> {
  const cacheKey = `${config.publicKey}:${config.privateKey.slice(0, 6)}`
  let key = signingKeys.get(cacheKey)
  if (!key) {
    const jwk = p256Jwk(decodeP256Public(config.publicKey), decodeKey(config.privateKey, 32, 'Kunci privat'))
    key = crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    key.catch(() => signingKeys.delete(cacheKey))
    signingKeys.set(cacheKey, key)
  }
  return key
}

/** Header Authorization VAPID (skema "vapid", RFC 8292 §3). */
export async function vapidAuthorization(endpoint: string, config: VapidConfig, nowMs = Date.now()): Promise<string> {
  const header = bytesToB64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bytesToB64url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(nowMs / 1000) + 12 * 3600,
    sub: config.subject,
  })))
  const unsigned = `${header}.${claims}`
  // Web Crypto ECDSA menghasilkan tanda tangan IEEE P1363 (r||s, 64 byte) — format JWS ES256.
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await vapidSigningKey(config), buf(encoder.encode(unsigned))))
  return `vapid t=${unsigned}.${bytesToB64url(signature)}, k=${config.publicKey}`
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8))
}

export interface EncryptOptions {
  /** Hanya untuk test vector RFC 8291 §5. Produksi selalu memakai kunci & salt acak. */
  senderPrivate?: string
  senderPublic?: string
  salt?: string
}

/** Enkripsi satu record aes128gcm (RFC 8291 §3.4 + RFC 8188). */
export async function encryptWebPushPayload(plaintext: Uint8Array, target: Pick<WebPushTarget, 'p256dh' | 'auth'>, options: EncryptOptions = {}): Promise<Uint8Array> {
  if (plaintext.length > RECORD_SIZE - 17) throw new Error('Payload push terlalu besar.')
  const uaPublic = decodeP256Public(target.p256dh, 'Kunci p256dh')
  const authSecret = decodeKey(target.auth, 16, 'Kunci auth')

  let senderPrivateKey: CryptoKey
  let senderPublic: Uint8Array
  if (options.senderPrivate && options.senderPublic) {
    senderPublic = decodeP256Public(options.senderPublic)
    senderPrivateKey = await crypto.subtle.importKey('jwk', p256Jwk(senderPublic, decodeKey(options.senderPrivate, 32, 'Kunci pengirim')),
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
    senderPrivateKey = pair.privateKey
    senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
  }

  const uaKey = await crypto.subtle.importKey('raw', buf(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderPrivateKey, 256))
  const ikm = await hkdf(authSecret, ecdhSecret, concat(encoder.encode('WebPush: info\0'), uaPublic, senderPublic), 32)

  const salt = options.salt ? decodeKey(options.salt, 16, 'Salt') : crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', buf(cek), { name: 'AES-GCM' }, false, ['encrypt'])
  // Delimiter 0x02 = record terakhir, tanpa padding.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, aesKey, buf(concat(plaintext, new Uint8Array([0x02])))))

  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = senderPublic.length
  return concat(header, senderPublic, ciphertext)
}

// Allowlist layanan push resmi browser: mencegah server dipakai menembak URL sembarang (SSRF).
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
]

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
    return PUSH_HOSTS.some(re => re.test(url.hostname))
  } catch {
    return false
  }
}

export function isValidSubscriptionKeys(p256dh: unknown, auth: unknown): boolean {
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return false
  try {
    decodeP256Public(p256dh)
    decodeKey(auth, 16, 'auth')
    return true
  } catch {
    return false
  }
}

export function classifyPushStatus(status: number): PushSendResult {
  if (status >= 200 && status < 300) return { outcome: 'SENT', httpStatus: status, errorCode: null }
  if (status === 404 || status === 410) return { outcome: 'EXPIRED', httpStatus: status, errorCode: 'SUBSCRIPTION_GONE' }
  if (status === 429 || status >= 500) return { outcome: 'TRANSIENT', httpStatus: status, errorCode: status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR' }
  // 401/403 = kredensial VAPID ditolak → masalah konfigurasi, perangkat jangan dinonaktifkan.
  if (status === 401 || status === 403) return { outcome: 'REJECTED', httpStatus: status, errorCode: 'VAPID_REJECTED' }
  if (status === 413) return { outcome: 'REJECTED', httpStatus: status, errorCode: 'PAYLOAD_TOO_LARGE' }
  return { outcome: 'REJECTED', httpStatus: status, errorCode: 'BAD_REQUEST' }
}

export async function sendWebPush(
  target: WebPushTarget,
  payload: Record<string, unknown>,
  config: VapidConfig,
  options: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; fetchImpl?: typeof fetch } = {},
): Promise<PushSendResult> {
  if (!isAllowedPushEndpoint(target.endpoint)) return { outcome: 'EXPIRED', httpStatus: null, errorCode: 'ENDPOINT_NOT_ALLOWED' }
  const body = encoder.encode(JSON.stringify(payload))
  if (body.length > WEBPUSH_PAYLOAD_MAX) return { outcome: 'REJECTED', httpStatus: null, errorCode: 'PAYLOAD_TOO_LARGE' }
  let encrypted: Uint8Array
  try {
    encrypted = await encryptWebPushPayload(body, target)
  } catch {
    return { outcome: 'EXPIRED', httpStatus: null, errorCode: 'INVALID_SUBSCRIPTION_KEYS' }
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(target.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: await vapidAuthorization(target.endpoint, config),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttlSeconds ?? 86400),
        Urgency: options.urgency ?? 'normal',
      },
      body: buf(encrypted),
    })
    return classifyPushStatus(response.status)
  } catch {
    return { outcome: 'TRANSIENT', httpStatus: null, errorCode: 'NETWORK' }
  }
}
