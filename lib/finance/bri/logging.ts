// lib/finance/bri/logging.ts
// Secure redaction and audit logging helpers for BRIAPI operations

export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/(client_secret|clientSecret|secret|passApp|pass_app)=([^&\s]+)/gi, '$1=[REDACTED]')
}

export function maskVa(va: string): string {
  if (!va || typeof va !== 'string') return ''
  if (va.length <= 8) return va.slice(0, 2) + '****' + va.slice(-2)
  return va.slice(0, 4) + '****' + va.slice(-4)
}

export function maskAccount(account: string): string {
  if (!account || typeof account !== 'string') return ''
  if (account.length <= 6) return account.slice(0, 2) + '***' + account.slice(-2)
  return account.slice(0, 3) + '******' + account.slice(-3)
}

export function sanitizePayload(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    if (typeof data === 'string') return redactSecrets(data)
    return data
  }

  if (Array.isArray(data)) {
    return data.map(sanitizePayload)
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes('secret') ||
      lowerKey.includes('privatekey') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('pin') ||
      lowerKey.includes('passapp')
    ) {
      sanitized[key] = '[REDACTED]'
    } else if (lowerKey.includes('va') || lowerKey.includes('virtualaccount')) {
      sanitized[key] = typeof value === 'string' ? maskVa(value) : value
    } else if (lowerKey.includes('account') || lowerKey.includes('rekening')) {
      sanitized[key] = typeof value === 'string' ? maskAccount(value) : value
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value)
    } else if (typeof value === 'string') {
      sanitized[key] = redactSecrets(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export interface BriLogMeta {
  endpoint?: string
  method?: string
  correlationId?: string
  externalId?: string
  httpStatus?: number
  durationMs?: number
  errorCategory?: string
  details?: Record<string, unknown>
}

export function briLog(level: 'info' | 'warn' | 'error', event: string, meta: BriLogMeta = {}): void {
  const sanitizedMeta: Record<string, unknown> = {
    event,
    timestamp: new Date().toISOString(),
    endpoint: meta.endpoint,
    method: meta.method,
    correlationId: meta.correlationId,
    externalId: meta.externalId,
    httpStatus: meta.httpStatus,
    durationMs: meta.durationMs,
    errorCategory: meta.errorCategory,
  }

  if (meta.details) {
    sanitizedMeta.details = sanitizePayload(meta.details)
  }

  const logStr = `[BRI_AUDIT] ${JSON.stringify(sanitizedMeta)}`

  if (level === 'error') {
    console.error(logStr)
  } else if (level === 'warn') {
    console.warn(logStr)
  } else {
    console.log(logStr)
  }
}
