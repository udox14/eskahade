// lib/finance/pins.ts
// Modul Keamanan & Lifecycle PIN Santri (Fase 5: PRD #18 & Implementation Plan 4.5, Tabel #17)
// Menjamin:
// 1. PIN 6 digit angka numerik.
// 2. Hashing aman PBKDF2 100.000 iterasi via lib/auth/password.ts. Zero plaintext secrets.
// 3. Batas percobaan salah 3 kali dengan temporary lockout 15 menit.
// 4. Audit trail mutlak di finance_pin_audit_logs untuk set, reset, lock, dan unlock.

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { assertSantriBillable } from '@/lib/finance/non-billable-santri'

export const MAX_PIN_FAILED_ATTEMPTS = 3
export const PIN_LOCKOUT_MINUTES = 15

export interface FinanceStudentPin {
  santri_id: string
  pin_hash: string
  failed_attempts: number
  locked_until: string | null
  updated_at: string
  updated_by: string | null
}

export interface PinStatus {
  hasPin: boolean
  isLocked: boolean
  lockedUntil: string | null
  failedAttempts: number
  remainingLockSeconds: number
}

export interface VerifyPinResult {
  verified: boolean
  locked: boolean
  attemptsLeft: number
  remainingLockSeconds?: number
}

export interface PinAuditLogEntry {
  id: string
  santri_id: string
  action: 'SET' | 'RESET' | 'LOCK' | 'UNLOCK' | 'FAILED_ATTEMPT'
  performed_by: string | null
  performer_name?: string | null
  reason: string | null
  ip_address: string | null
  created_at: string
}

/**
 * Validasi ketat format PIN santri:
 * Wajib tepat 6 karakter angka numerik (000000 - 999999).
 */
export function validatePinFormat(pin: string): void {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
    throw new Error('PIN santri harus terdiri dari tepat 6 digit angka numerik.')
  }
}

const PIN_SPACE = 1_000_000
// Domain unsigned 32-bit: [0, 2^32 - 1] di mana 2^32 = 4.294.967.296.
// 4.294.967.296 / 1.000.000 = 4.294 dengan sisa 967.296.
// Batas terbesar yang habis dibagi PIN_SPACE adalah 4.294 * 1.000.000 = 4.294.000.000.
// Nilai dalam rentang [4.294.000.000, 4.294.967.295] ditolak dan diundi ulang (rejection sampling)
// untuk mengeliminasi modulo bias secara mutlak dan menjamin distribusi seragam (uniform).
const MAX_UNBIASED_LIMIT = Math.floor(4_294_967_296 / PIN_SPACE) * PIN_SPACE // 4_294_000_000

/**
 * Menghasilkan PIN acak 6-digit yang aman secara kriptografis (Web Crypto CSPRNG).
 * Menggunakan rejection sampling pada domain unsigned 32-bit untuk mengeliminasi modulo bias.
 * Range: 000000 - 999999 (distribusi seragam / uniform).
 * Catatan: Setiap PIN dibangkitkan secara independen; kesamaan PIN antar dua santri
 * adalah kemungkinan statistik wajar dan bukan security failure.
 */
export function generateRandomPin(): string {
  const buf = new Uint32Array(1)
  while (true) {
    crypto.getRandomValues(buf)
    const val = buf[0]
    if (val < MAX_UNBIASED_LIMIT) {
      const pinNum = val % PIN_SPACE
      return pinNum.toString().padStart(6, '0')
    }
  }
}


/**
 * Mengambil status kredensial PIN santri (apakah sudah dibuat, sedang terkunci, dll).
 */
export async function getStudentPinStatus(santriId: string): Promise<PinStatus> {
  const record = await queryOne<FinanceStudentPin>(
    `SELECT * FROM finance_student_pins WHERE santri_id = ?`,
    [santriId]
  )

  if (!record) {
    return {
      hasPin: false,
      isLocked: false,
      lockedUntil: null,
      failedAttempts: 0,
      remainingLockSeconds: 0,
    }
  }

  const nowMs = Date.now()
  let isLocked = false
  let remainingLockSeconds = 0

  if (record.locked_until) {
    const lockExpiryMs = new Date(record.locked_until).getTime()
    if (lockExpiryMs > nowMs) {
      isLocked = true
      remainingLockSeconds = Math.ceil((lockExpiryMs - nowMs) / 1000)
    }
  }

  return {
    hasPin: true,
    isLocked,
    lockedUntil: record.locked_until,
    failedAttempts: record.failed_attempts,
    remainingLockSeconds,
  }
}

/**
 * Me-reset PIN santri yang sudah ada secara eksplisit (PRD #18 & Implementation Plan 4.5).
 * Menjamin:
 * 1. Santri harus sudah terdaftar dan sudah memiliki PIN sebelumnya.
 * 2. Format PIN baru divalidasi tepat 6 digit angka numerik.
 * 3. Hashing aman PBKDF2 Web Crypto API (100.000 iterasi, salt acak). Zero plaintext.
 * 4. Mereset hitungan failed_attempts ke 0 dan membersihkan locked_until.
 * 5. Audit trail mutlak dicatat ke finance_pin_audit_logs dengan action = 'RESET'.
 */
export async function resetStudentPin(
  santriId: string,
  newPin: string,
  updatedBy?: string | null,
  reason?: string | null
): Promise<void> {
  validatePinFormat(newPin)

  const student = await queryOne<{ id: string; status_global: string; asrama: string | null; nama_lengkap: string; kategori_santri: string | null }>(
    `SELECT id, status_global, asrama, nama_lengkap, kategori_santri FROM santri WHERE id = ?`,
    [santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

  const existing = await queryOne<FinanceStudentPin>(
    `SELECT santri_id FROM finance_student_pins WHERE santri_id = ?`,
    [santriId]
  )
  if (!existing) {
    throw new Error('Santri belum memiliki PIN sebelumnya. Silakan lakukan pembuatan PIN awal.')
  }

  const pinHash = await hashPassword(newPin.trim())
  const timestamp = now()
  const logReason = reason || 'Reset PIN santri oleh petugas'

  // Update hash PIN & bersihkan status lockout
  await batch([{ sql: `UPDATE finance_student_pins
     SET pin_hash = ?,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = ?,
         updated_by = ?
     WHERE santri_id = ?`,
    params: [pinHash, timestamp, updatedBy || null, santriId]
  },

  // Catat audit trail dengan action eksplisit 'RESET'
  { sql: `INSERT INTO finance_pin_audit_logs (
       id, santri_id, action, performed_by, reason, created_at
     ) VALUES (?, ?, 'RESET', ?, ?, ?)`,
    params: [generateId(), santriId, updatedBy || null, logReason, timestamp]
  }, { sql: 'UPDATE finance_pin_authorizations SET expires_at = ? WHERE santri_id = ? AND consumed_by IS NULL', params: [timestamp, santriId] }])
}

/**
 * Mendaftarkan PIN awal santri (atau me-reset jika santri sudah punya PIN).
 * Menjamin:
 * - Jika santri sudah memiliki PIN, didelegasikan ke resetStudentPin (mencatat action 'RESET').
 * - Jika santri belum memiliki PIN, didaftarkan sebagai PIN baru (mencatat action 'SET').
 */
export async function setStudentPin(
  santriId: string,
  pin: string,
  updatedBy?: string | null,
  options?: { reason?: string; isReset?: boolean }
): Promise<void> {
  if (options?.isReset) {
    return resetStudentPin(santriId, pin, updatedBy, options.reason)
  }

  validatePinFormat(pin)

  const student = await queryOne<{ id: string; status_global: string; asrama: string | null; nama_lengkap: string; kategori_santri: string | null }>(
    `SELECT id, status_global, asrama, nama_lengkap, kategori_santri FROM santri WHERE id = ?`,
    [santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

  const existing = await queryOne<FinanceStudentPin>(
    `SELECT santri_id FROM finance_student_pins WHERE santri_id = ?`,
    [santriId]
  )
  if (existing) {
    // Santri sudah memiliki PIN terdaftar -> jalankan resetStudentPin agar action tercatat sebagai 'RESET'
    return resetStudentPin(santriId, pin, updatedBy, options?.reason || 'Reset PIN santri')
  }

  const pinHash = await hashPassword(pin.trim())
  const timestamp = now()
  const reason = options?.reason || 'Inisialisasi PIN awal santri'

  // 1. Simpan hash PIN awal
  await batch([{ sql: `INSERT INTO finance_student_pins (
       santri_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by
     ) VALUES (?, ?, 0, NULL, ?, ?)`,
    params: [santriId, pinHash, timestamp, updatedBy || null]
  },

  // 2. Catat audit trail dengan action 'SET'
  { sql: `INSERT INTO finance_pin_audit_logs (
       id, santri_id, action, performed_by, reason, created_at
     ) VALUES (?, ?, 'SET', ?, ?, ?)`,
    params: [generateId(), santriId, updatedBy || null, reason, timestamp]
  }])
}

/**
 * Memverifikasi PIN santri.
 * Mengimplementasikan perlindungan brute-force:
 * - Jika status terkunci, tolak verifikasi.
 * - Jika salah, inkremen failed_attempts.
 * - Jika gagal >= 3 kali, kunci akun santri selama 15 menit dan catat log.
 * - Jika benar, reset failed_attempts = 0.
 */
export interface PinVerificationOptions {
  authorization?: { tokenHash: string; operatorId: string; expiresAt: string }
  replacement?: { pin: string; updatedBy: string; reason: string }
}

export async function verifyStudentPin(
  santriId: string,
  inputPin: string,
  options: PinVerificationOptions = {}
): Promise<VerifyPinResult> {
  const record = await queryOne<FinanceStudentPin>(
    'SELECT * FROM finance_student_pins WHERE santri_id = ?', [santriId]
  )
  if (!record) return { verified: false, locked: false, attemptsLeft: 0 }
  const timestamp = now()
  const lockActive = record.locked_until && new Date(record.locked_until).getTime() > Date.now()
  if (lockActive) return { verified: false, locked: true, attemptsLeft: 0,
    remainingLockSeconds: Math.ceil((new Date(record.locked_until!).getTime() - Date.now()) / 1000) }

  const valid = typeof inputPin === 'string' && await verifyPassword(inputPin.trim(), record.pin_hash)
  if (valid) {
    if (options.replacement) validatePinFormat(options.replacement.pin)
    const replacementHash = options.replacement ? await hashPassword(options.replacement.pin.trim()) : null
    // Password verification is asynchronous. Compare the current hash and lock
    // inside the same batch that issues a withdrawal authorization or rotates PIN.
    const statements: { sql: string; params: unknown[] }[] = [{
      sql: `SELECT json(CASE WHEN EXISTS (SELECT 1 FROM finance_student_pins
        WHERE santri_id = ? AND pin_hash = ?
        AND (locked_until IS NULL OR julianday(locked_until) <= julianday(?)))
        THEN 'true' ELSE 'pin_verification_stale' END)`,
      params: [santriId, record.pin_hash, timestamp],
    }, {
      sql: `UPDATE finance_student_pins SET failed_attempts=0, locked_until=NULL,
        pin_hash=COALESCE(?,pin_hash), updated_at=?, updated_by=COALESCE(?,updated_by)
        WHERE santri_id=?`,
      params: [replacementHash, timestamp, options.replacement?.updatedBy || null, santriId],
    }]
    if (options.replacement) {
      statements.push({ sql: `INSERT INTO finance_pin_audit_logs
        (id,santri_id,action,performed_by,reason,created_at) VALUES (?,?,'RESET',?,?,?)`,
        params: [generateId(), santriId, options.replacement.updatedBy, options.replacement.reason, timestamp] },
        { sql: 'UPDATE finance_pin_authorizations SET expires_at=? WHERE santri_id=? AND consumed_by IS NULL', params: [timestamp, santriId] })
    } else if (options.authorization) {
      statements.push({ sql: `INSERT INTO finance_pin_authorizations
        (token_hash,santri_id,operator_id,expires_at,created_at) VALUES (?,?,?,?,?)`,
        params: [options.authorization.tokenHash, santriId, options.authorization.operatorId, options.authorization.expiresAt, timestamp] })
    }
    try { await batch(statements) }
    catch (error) {
      if (!(error instanceof Error) || !/malformed JSON|pin_verification_stale/i.test(error.message)) throw error
      const current = await getStudentPinStatus(santriId)
      return { verified: false, locked: current.isLocked, attemptsLeft: Math.max(0, MAX_PIN_FAILED_ATTEMPTS-current.failedAttempts), remainingLockSeconds: current.remainingLockSeconds }
    }
    return { verified: true, locked: false, attemptsLeft: MAX_PIN_FAILED_ATTEMPTS }
  }

  // Increment from the stored counter, never the earlier SELECT snapshot.
  // Concurrent wrong attempts therefore reach the threshold instead of all
  // overwriting the same count. Counter, lock, audit and token expiry are atomic.
  const lockExpiry = new Date(Date.now() + PIN_LOCKOUT_MINUTES*60*1000).toISOString()
  const attempts = "CASE WHEN locked_until IS NOT NULL AND julianday(locked_until)<=julianday(?) THEN 1 ELSE failed_attempts+1 END"
  await batch([{
    sql: `UPDATE finance_student_pins SET failed_attempts=${attempts},
      locked_until=CASE WHEN ${attempts} >= ? THEN ? ELSE NULL END, updated_at=?
      WHERE santri_id=? AND pin_hash=?
      AND (locked_until IS NULL OR julianday(locked_until)<=julianday(?))`,
    params: [timestamp, timestamp, MAX_PIN_FAILED_ATTEMPTS, lockExpiry, timestamp, santriId, record.pin_hash, timestamp],
  }, {
    sql: `INSERT INTO finance_pin_audit_logs(id,santri_id,action,reason,created_at)
      SELECT ?,santri_id,CASE WHEN locked_until IS NOT NULL THEN 'LOCK' ELSE 'FAILED_ATTEMPT' END,
      'Percobaan PIN salah ke-' || failed_attempts,? FROM finance_student_pins
      WHERE santri_id=? AND changes()=1`,
    params: [generateId(), timestamp, santriId],
  }, {
    sql: `UPDATE finance_pin_authorizations SET expires_at=? WHERE santri_id=? AND consumed_by IS NULL
      AND EXISTS(SELECT 1 FROM finance_student_pins WHERE santri_id=? AND julianday(locked_until)>julianday(?))`,
    params: [timestamp, santriId, santriId, timestamp],
  }])
  const current = await getStudentPinStatus(santriId)
  return { verified: false, locked: current.isLocked,
    attemptsLeft: Math.max(0, MAX_PIN_FAILED_ATTEMPTS-current.failedAttempts), remainingLockSeconds: current.remainingLockSeconds }
}

/**
 * Membuka kunci PIN santri secara manual (oleh Admin / Petugas Koperasi).
 */
export async function unlockStudentPin(
  santriId: string,
  unlockedBy?: string | null,
  reason?: string | null
): Promise<void> {
  const timestamp = now()
  await batch([{ sql: `UPDATE finance_student_pins
     SET failed_attempts = 0,
         locked_until = NULL,
         updated_at = ?,
         updated_by = ?
     WHERE santri_id = ?`,
    params: [timestamp, unlockedBy || null, santriId]
  },

  { sql: `INSERT INTO finance_pin_audit_logs (
       id, santri_id, action, performed_by, reason, created_at
     ) VALUES (?, ?, 'UNLOCK', ?, ?, ?)`,
    params: [
      generateId(),
      santriId,
      unlockedBy || null,
      reason || 'Buka kunci PIN manual oleh petugas',
      timestamp,
    ]
  }])
}

/**
 * Mengambil histori audit trail PIN santri.
 */
export async function getPinAuditLogs(
  santriId: string,
  limit: number = 20
): Promise<PinAuditLogEntry[]> {
  const logs = await query<PinAuditLogEntry>(
    `SELECT a.*, u.full_name AS performer_name
     FROM finance_pin_audit_logs a
     LEFT JOIN users u ON u.id = a.performed_by
     WHERE a.santri_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [santriId, limit]
  )
  return logs
}
