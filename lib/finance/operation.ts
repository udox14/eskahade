import crypto from 'node:crypto'
import { queryOne, now } from '@/lib/db'

export function requestFingerprint(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
export function operationIdentity(scope: string, actor: string, key: string, payload: unknown) {
  if (typeof key !== 'string' || !key.trim() || key.length > 160) throw new Error('Idempotency key wajib diisi dan maksimal 160 karakter.')
  return { key: `${scope}:${actor}:${key.trim()}`, scope, actor,
    hash: requestFingerprint(payload) }
}

export async function operationReplay<T>(identity: ReturnType<typeof operationIdentity>): Promise<T | null> {
  const row = await queryOne<{ request_hash: string; actor_id: string; response_json: string; status: string }>(
    'SELECT request_hash, actor_id, response_json, status FROM finance_idempotency_keys WHERE key = ?', [identity.key])
  if (!row) return null
  if (row.request_hash !== identity.hash || row.actor_id !== identity.actor || row.status !== 'COMPLETED') throw new Error('IDEMPOTENCY_CONFLICT: Request berbeda atau belum selesai.')
  return JSON.parse(row.response_json) as T
}

export function operationStatement(identity: ReturnType<typeof operationIdentity>, result: unknown, details?: {
  santriId?: string; amount?: number; cashSessionId?: string; pinTokenHash?: string; expectedWalletBalance?: number
}) {
  return { sql: `INSERT INTO finance_idempotency_keys
    (key, scope, status, request_hash, actor_id, santri_id, amount, cash_session_id, pin_token_hash, response_json, created_at, updated_at, expected_wallet_balance)
    VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [identity.key, identity.scope, identity.hash, identity.actor, details?.santriId || null,
      details?.amount ?? null, details?.cashSessionId || null, details?.pinTokenHash || null, JSON.stringify(result), now(), now(),details?.expectedWalletBalance??null] }
}

export function hashPinAuthorization(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
