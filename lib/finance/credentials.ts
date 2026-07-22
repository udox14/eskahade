import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { financeError } from './errors'
import type { CredentialKind, CredentialMode } from './types'

function secret(): string {
  const value = process.env.CREDENTIAL_HMAC_SECRET || process.env.JWT_SECRET
  if (!value) throw new Error('CREDENTIAL_HMAC_SECRET belum dikonfigurasi.')
  return value
}

export async function credentialHmac(rawToken: string, version: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`credential:v${version}:${rawToken}`))
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')
}

export function generateQrToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `SKH1.${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}

export async function issueCredential(input: {
  santriId: string
  kind: CredentialKind
  rawToken?: string
  version?: number
  expiresAt?: string | null
  actorId?: string | null
}) {
  try {
    const version = input.version || 1
    const rawToken = input.kind === 'QR_STATIC' ? (input.rawToken || generateQrToken()) : String(input.rawToken || '').trim()
    if (rawToken.length < (input.kind === 'QR_STATIC' ? 32 : 4)) throw new Error('Token credential tidak valid.')
    const id = generateId()
    await (await getDB()).prepare(`INSERT INTO student_credentials
      (id,santri_id,credential_kind,token_hmac,token_version,status,expires_at,created_by,physically_verified_at,physically_verified_by)
      VALUES(?,?,?,?,?,'ACTIVE',?,?,datetime('now'),?)`).bind(
        id, input.santriId, input.kind, await credentialHmac(rawToken, version), version, input.expiresAt || null, input.actorId || null, input.actorId || null,
      ).run()
    return { success: true as const, credentialId: id, rawToken, version }
  } catch (error) {
    return { success: false as const, ...financeError(error) }
  }
}

export async function resolveCredential(kind: CredentialKind, rawToken: string) {
  let policy = await queryOne<{ mode: CredentialMode; transition_to: 'RFID'|'QR'|null; transition_ends_at: string | null }>(`SELECT mode,transition_to,transition_ends_at FROM finance_credential_policy WHERE singleton_id=1`)
  if (!policy) return null
  if(policy.mode==='BOTH_TRANSITION'&&policy.transition_to&&policy.transition_ends_at&&new Date(policy.transition_ends_at).getTime()<=Date.now()){
    const activeKind=policy.transition_to==='RFID'?'RFID_UID':'QR_STATIC',db=await getDB()
    await db.batch([
      db.prepare(`UPDATE student_credentials SET status='SUSPENDED_BY_POLICY',blocked_reason='TRANSITION_ENDED' WHERE status='ACTIVE' AND credential_kind<>?`).bind(activeKind),
      db.prepare(`UPDATE finance_credential_policy SET mode=?,transition_from=NULL,transition_to=NULL,transition_ends_at=NULL,updated_at=datetime('now') WHERE singleton_id=1 AND mode='BOTH_TRANSITION'`).bind(policy.transition_to),
    ])
    policy=await queryOne<any>(`SELECT mode,transition_to,transition_ends_at FROM finance_credential_policy WHERE singleton_id=1`)
    if(!policy)return null
  }
  const expectedMode = kind === 'RFID_UID' ? 'RFID' : 'QR'
  const allowed = policy.mode === expectedMode || (policy.mode === 'BOTH_TRANSITION' && (!policy.transition_ends_at || new Date(policy.transition_ends_at).getTime() > Date.now()))
  if (!allowed) return null
  for (let version = 10; version >= 1; version--) {
    const row = await queryOne<{
      id: string; santri_id: string; credential_kind: CredentialKind; token_version: number; status: string; expires_at: string | null
    }>(`SELECT id,santri_id,credential_kind,token_version,status,expires_at FROM student_credentials
      WHERE credential_kind=? AND token_hmac=? AND token_version=? LIMIT 1`, [kind, await credentialHmac(rawToken, version), version])
    if (!row) continue
    if (row.status !== 'ACTIVE' || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())) return null
    return row
  }
  return null
}

export async function setCredentialMode(input: {
  mode: CredentialMode
  transitionFrom?: 'RFID' | 'QR' | null
  transitionTo?: 'RFID' | 'QR' | null
  transitionEndsAt?: string | null
  actorId: string
}) {
  try {
    if (input.mode === 'BOTH_TRANSITION' && (!input.transitionFrom || !input.transitionTo || input.transitionFrom === input.transitionTo || !input.transitionEndsAt)) {
      throw new Error('Mode transisi memerlukan metode asal, tujuan, dan tanggal selesai.')
    }
    const db = await getDB()
    const statements = [db.prepare(`UPDATE finance_credential_policy SET mode=?,transition_from=?,transition_to=?,transition_ends_at=?,updated_by=?,updated_at=datetime('now') WHERE singleton_id=1`).bind(
      input.mode, input.transitionFrom || null, input.transitionTo || null, input.transitionEndsAt || null, input.actorId,
    )]
    if (input.mode !== 'BOTH_TRANSITION') {
      const activeKind = input.mode === 'RFID' ? 'RFID_UID' : 'QR_STATIC'
      statements.push(db.prepare(`UPDATE student_credentials SET status='SUSPENDED_BY_POLICY',blocked_reason='GLOBAL_MODE' WHERE status='ACTIVE' AND credential_kind<>?`).bind(activeKind))
      statements.push(db.prepare(`UPDATE student_credentials SET status='ACTIVE',blocked_reason=NULL WHERE status='SUSPENDED_BY_POLICY' AND credential_kind=? AND physically_verified_at IS NOT NULL`).bind(activeKind))
    }
    await db.batch(statements)
    return { success: true as const }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

export async function setStudentPin(santriId: string, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) return { success: false as const, error: 'PIN harus 4–8 digit.' }
  const hash = await hashPassword(pin)
  await (await getDB()).prepare(`INSERT INTO finance_student_security(santri_id,pin_hash) VALUES(?,?)
    ON CONFLICT(santri_id) DO UPDATE SET pin_hash=excluded.pin_hash,failed_attempts=0,blocked_until=NULL,pin_changed_at=datetime('now'),updated_at=datetime('now')`).bind(santriId, hash).run()
  return { success: true as const }
}

export async function verifyStudentPin(santriId: string, pin: string): Promise<boolean> {
  const security = await queryOne<{ pin_hash: string; failed_attempts: number; blocked_until: string | null }>(`SELECT pin_hash,failed_attempts,blocked_until FROM finance_student_security WHERE santri_id=?`, [santriId])
  if (!security || (security.blocked_until && new Date(security.blocked_until).getTime() > Date.now())) return false
  const valid = await verifyPassword(pin, security.pin_hash)
  const db = await getDB()
  if (valid) {
    await db.prepare(`UPDATE finance_student_security SET failed_attempts=0,blocked_until=NULL,updated_at=datetime('now') WHERE santri_id=?`).bind(santriId).run()
    return true
  }
  await db.prepare(`UPDATE finance_student_security SET failed_attempts=failed_attempts+1,
    blocked_until=CASE WHEN failed_attempts+1 >= COALESCE((SELECT pin_max_attempts FROM finance_credential_policy WHERE singleton_id=1),3) THEN datetime('now','+15 minutes') ELSE blocked_until END,
    updated_at=datetime('now') WHERE santri_id=?`).bind(santriId).run()
  return false
}
