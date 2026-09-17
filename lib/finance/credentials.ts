import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { financeError } from './errors'
import { decryptFinanceValue, encryptFinanceValue } from './encryption'
import type { CredentialKind } from './types'

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

export function normalizeCredentialToken(_kind: CredentialKind, rawToken: string): string {
  return String(rawToken || '').trim()
}

function credentialCardNumber(id: string) {
  return `SKH-QR-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

export async function issueCredential(input: {
  santriId: string
  kind: CredentialKind
  rawToken?: string
  version?: number
  expiresAt?: string | null
  actorId?: string | null
  reissue?: boolean
}) {
  try {
    const version = input.version || 1
    const rawToken = normalizeCredentialToken('QR_STATIC', input.rawToken || generateQrToken())
    if (rawToken.length < 32) throw new Error('Token credential tidak valid.')
    const id = generateId()
    const db = await getDB()
    const current = await db.prepare(`SELECT id FROM student_credentials WHERE santri_id=? AND credential_kind=?
      AND status IN ('ACTIVE','BLOCKED') LIMIT 1`).bind(input.santriId,'QR_STATIC').first() as {id:string}|null
    if (current && !input.reissue) throw new Error('Santri sudah mempunyai credential jenis ini.')
    const encrypted = await encryptFinanceValue(rawToken)
    const cardNumber = credentialCardNumber(id)
    const statements = []
    if (current) statements.push(db.prepare(`UPDATE student_credentials SET status='REVOKED',blocked_reason='REISSUED' WHERE id=?`).bind(current.id))
    statements.push(
      db.prepare(`INSERT INTO student_credentials
        (id,santri_id,credential_kind,token_hmac,token_encrypted,token_version,card_number,status,expires_at,created_by,physically_verified_at,physically_verified_by)
        VALUES(?,?,?,?,?,?,?,'ACTIVE',?,?,datetime('now'),?)`).bind(
          id,input.santriId,'QR_STATIC',await credentialHmac(rawToken,version),encrypted,version,cardNumber,input.expiresAt||null,input.actorId||null,input.actorId||null,
      ),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,before_json,after_json)
        VALUES(?,'STAFF',?,?,'STUDENT_CREDENTIAL',?,?,?)`).bind(
          generateId(),input.actorId||null,current?'REISSUE_CREDENTIAL':'ISSUE_CREDENTIAL',id,current?JSON.stringify({replacedCredentialId:current.id}):null,JSON.stringify({santriId:input.santriId,kind:'QR_STATIC',cardNumber}),
      ),
    )
    if (current) statements.push(db.prepare('UPDATE student_credentials SET replacement_credential_id=? WHERE id=?').bind(id,current.id))
    await db.batch(statements)
    return { success: true as const, credentialId: id, version, cardNumber }
  } catch (error) {
    return { success: false as const, ...financeError(error) }
  }
}

export async function resolveCredential(kind: CredentialKind, rawToken: string) {
  // Hanya QR. Mode HYBRID dan BOTH_TRANSITION beserta penyelesaian transisi
  // otomatis pada scan pertama sudah dihapus - tidak ada lagi dua metode
  // berjalan bersamaan, jadi tidak ada yang perlu dinegosiasikan di sini.
  if (kind !== 'QR_STATIC') return null
  for (let version = 10; version >= 1; version--) {
    const row = await queryOne<{
      id: string; santri_id: string; credential_kind: CredentialKind; token_version: number; status: string; expires_at: string | null
    }>(`SELECT id,santri_id,credential_kind,token_version,status,expires_at FROM student_credentials
      WHERE credential_kind='QR_STATIC' AND token_hmac=? AND token_version=? LIMIT 1`,
      [await credentialHmac(normalizeCredentialToken(kind, rawToken), version), version])
    if (!row) continue
    if (row.status !== 'ACTIVE' || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())) return null
    return row
  }
  return null
}

export async function getPrintableQrToken(credentialId: string): Promise<string | null> {
  const row = await queryOne<{token_encrypted:string|null;credential_kind:CredentialKind;status:string}>(
    `SELECT token_encrypted,credential_kind,status FROM student_credentials WHERE id=?`,[credentialId]
  )
  if (!row || row.credential_kind !== 'QR_STATIC' || !row.token_encrypted || row.status !== 'ACTIVE') return null
  return decryptFinanceValue(row.token_encrypted)
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
