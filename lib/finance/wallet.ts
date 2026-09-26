// lib/finance/wallet.ts
// Modul Buku Besar & Saldo Uang Jajan Santri (Fase 5: PRD #15, #16 & Implementation Plan #2, #18, #19)
// Menjamin mutasi buku besar sebagai SUMBER KEBENARAN MUTLAK (Authoritative Source of Truth),
// rekalkulasi derived cache, serta kalkulasi limit penarikan bertingkat.

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { assertSantriBillable } from '@/lib/finance/non-billable-santri'

export type WalletDirection = 'IN' | 'OUT'
export type WalletMovementType =
  | 'TOPUP_ONLINE'
  | 'TOPUP_CASH'
  | 'WITHDRAWAL_LOKET'
  | 'REVERSAL'

export interface FinanceWalletLedgerEntry {
  id: string
  santri_id: string
  direction: WalletDirection
  movement_type: WalletMovementType
  amount: number
  balance_before: number
  balance_after: number
  reference_id: string | null
  cash_session_id: string | null
  operator_id: string | null
  operator_name?: string | null
  notes: string | null
  created_at: string
}

export interface FinanceWalletLimits {
  santri_id: string
  parent_daily_limit: number | null
  parent_weekly_limit: number | null
  parent_monthly_limit: number | null
  updated_at: string
  updated_by: string | null
}

export interface WalletLimitEvaluation {
  globalDailyLimit: number
  parentDailyLimit: number | null
  parentWeeklyLimit: number | null
  parentMonthlyLimit: number | null
  effectiveDailyLimit: number
  withdrawnToday: number
  remainingDailyQuota: number
}

export interface RecordWalletMutationInput {
  santriId: string
  direction: WalletDirection
  movementType: WalletMovementType
  amount: number
  referenceId?: string | null
  cashSessionId?: string | null
  operatorId?: string | null
  notes?: string | null
}

export const DEFAULT_GLOBAL_DAILY_LIMIT = 100000

// ─── AUTHORITATIVE BALANCE & REKALKULASI ────────────────────────────────────

/**
 * Mengambil saldo uang jajan santri.
 * Mengembalikan:
 * - balance: Saldo authoritatif hasil akumulasi riil SUM(IN) - SUM(OUT) dari finance_wallet_ledger
 * - cachedBalance: Saldo proyeksi di kolom santri.saldo_uang_jajan
 */
export async function getStudentWalletBalance(
  santriId: string
): Promise<{ balance: number; cachedBalance: number }> {
  const authoritativeRes = await queryOne<{ balance: number }>(
    `SELECT COALESCE(
       SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END),
       0
     ) AS balance
     FROM finance_wallet_ledger
     WHERE santri_id = ?`,
    [santriId]
  )

  const cachedRes = await queryOne<{ saldo_uang_jajan: number }>(
    `SELECT COALESCE(saldo_uang_jajan, 0) AS saldo_uang_jajan
     FROM santri
     WHERE id = ?`,
    [santriId]
  )

  return {
    balance: authoritativeRes?.balance ?? 0,
    cachedBalance: cachedRes?.saldo_uang_jajan ?? 0,
  }
}

/**
 * Rekalkulasi Authoritatif Saldo Uang Jajan (Implementation Plan 2.1 #2 & 2.3)
 * Menghitung ulang saldo dari seluruh entri finance_wallet_ledger dan menyelaraskan
 * derived cache kolom santri.saldo_uang_jajan.
 */
export async function recalculateStudentWallet(santriId: string): Promise<number> {
  const { balance } = await getStudentWalletBalance(santriId)

  await execute(
    `UPDATE santri
     SET saldo_uang_jajan = ?,
         updated_at = ?
     WHERE id = ?`,
    [balance, now(), santriId]
  )

  return balance
}

// ─── PENCATATAN MUTASI BUKU BESAR ATOMIK & RACE-SAFE ───────────────────────
 
/**
 * Mencatat mutasi baru pada buku besar uang jajan santri.
 * Menjamin:
 * 1. Validasi ketat: Nominal mutasi positif (> 0).
 * 2. Race-Safe: Mutasi dieksekusi secara terpadu melalui batch insert ledger & update cache.
 * 3. Database Trigger Protection: Trigger trg_finance_wallet_verify_balance memvalidasi
 *    secara instan bahwa balance_before sama persis dengan kondisi akumulasi riil SUM(IN)-SUM(OUT).
 * 4. Automatic Retry with Backoff: Jika terjadi perebutan konkurensi (stale balance read),
 *    sistem secara otomatis membaca ulang saldo terkini. Jika saldo masih mencukupi / operasi valid,
 *    mutasi dieksekusi dengan saldo baru tanpa menyebabkan inkonsistensi atau saldo negatif.
 * 5. Jika saldo tidak mencukupi (overdraw), penarikan langsung ditolak tanpa retry.
 */
export async function recordWalletMutation(
  input: RecordWalletMutationInput
): Promise<FinanceWalletLedgerEntry> {
  const amount = Math.floor(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal mutasi uang jajan harus bernilai positif lebih dari 0.')
  }

  // 1. Verifikasi santri aktif
  const student = await queryOne<{ id: string; status_global: string; asrama: string | null; nama_lengkap: string }>(
    `SELECT id, status_global, asrama, nama_lengkap FROM santri WHERE id = ?`,
    [input.santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${input.santriId}" tidak ditemukan.`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap)

  const maxRetries = 5
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 2. Baca saldo authoritatif aktual saat ini
      const { balance: balanceBefore } = await getStudentWalletBalance(input.santriId)

      let balanceAfter = 0
      if (input.direction === 'IN') {
        balanceAfter = balanceBefore + amount
      } else if (input.direction === 'OUT') {
        if (balanceBefore < amount) {
          throw new Error(
            `Saldo tidak mencukupi untuk penarikan/koreksi. Saldo saat ini: Rp${balanceBefore.toLocaleString('id-ID')}, nominal yang diminta: Rp${amount.toLocaleString('id-ID')}.`
          )
        }
        balanceAfter = balanceBefore - amount
      } else {
        throw new Error(`Arah mutasi tidak valid: "${input.direction}".`)
      }

      const id = generateId()
      const timestamp = now()

      // 3. Eksekusi atomik batch: Masukkan ke finance_wallet_ledger dan sinkronisasi santri.saldo_uang_jajan
      // Trigger database trg_finance_wallet_verify_balance menjamin bahwa balance_before
      // sama persis dengan SUM(IN)-SUM(OUT) riil pada mikrodetik eksekusi.
      // Jika transaksi paralel lain telah mendahului mengupdate ledger, trigger akan meng-ABORT batch ini.
      await batch([
        {
          sql: `INSERT INTO finance_wallet_ledger (
                  id, santri_id, direction, movement_type, amount,
                  balance_before, balance_after, reference_id,
                  cash_session_id, operator_id, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            id,
            input.santriId,
            input.direction,
            input.movementType,
            amount,
            balanceBefore,
            balanceAfter,
            input.referenceId || null,
            input.cashSessionId || null,
            input.operatorId || null,
            input.notes || null,
            timestamp,
          ],
        },
        {
          sql: `UPDATE santri
                SET saldo_uang_jajan = ?,
                    updated_at = ?
                WHERE id = ?`,
          params: [balanceAfter, timestamp, input.santriId],
        },
      ])

      const created = await queryOne<FinanceWalletLedgerEntry>(
        `SELECT l.*, u.full_name AS operator_name
         FROM finance_wallet_ledger l
         LEFT JOIN users u ON u.id = l.operator_id
         WHERE l.id = ?`,
        [id]
      )

      return created!
    } catch (err: unknown) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)

      // Jika error adalah saldo tidak mencukupi, JANGAN retry, langsung lempar error ke pemanggil
      if (msg.includes('Saldo tidak mencukupi')) {
        throw err
      }

      // Jika terdeteksi race condition (stale balance) atau lock contention, lakukan retry dengan backoff
      const isRaceOrLock =
        msg.includes('STALE_BALANCE_DETECTED') ||
        msg.includes('race condition terdeteksi') ||
        msg.includes('OVERDRAW_DETECTED') ||
        msg.includes('SQLITE_BUSY') ||
        msg.includes('database is locked')

      if (isRaceOrLock && attempt < maxRetries - 1) {
        const delayMs = 15 * (attempt + 1) + Math.floor(Math.random() * 25)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      throw err
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gagal mencatat mutasi buku besar karena tingkat konkurensi tinggi.')
}

/**
 * Alias recordWalletMovement sesuai penamaan alternatif PRD / Engine.
 */
export const recordWalletMovement = recordWalletMutation

// ─── RIWAYAT BUKU BESAR BERPAGINASI ─────────────────────────────────────────

export async function getWalletLedgerHistory(
  santriId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{ items: FinanceWalletLedgerEntry[]; total: number }> {
  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 20))
  const offset = (page - 1) * pageSize

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_wallet_ledger WHERE santri_id = ?`,
    [santriId]
  )
  const total = countRow?.total ?? 0

  const items = await query<FinanceWalletLedgerEntry>(
    `SELECT l.*, u.full_name AS operator_name
     FROM finance_wallet_ledger l
     LEFT JOIN users u ON u.id = l.operator_id
     WHERE l.santri_id = ?
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [santriId, pageSize, offset]
  )

  return { items, total }
}

// ─── LIMIT PENCAIRAN BERTINGKAT ──────────────────────────────────────────────

/**
 * Mengambil konfigurasi Limit Global Pesantren dari app_settings.
 */
export async function getGlobalDailyLimit(): Promise<number> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'uang_jajan_global_daily_limit'`
  )
  if (!row?.value) return DEFAULT_GLOBAL_DAILY_LIMIT
  const parsed = parseInt(row.value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GLOBAL_DAILY_LIMIT
}

/**
 * Mengatur Limit Global Pesantren di app_settings.
 */
export async function setGlobalDailyLimit(limit: number): Promise<void> {
  const valid = Math.floor(limit)
  if (valid < 0 || !Number.isFinite(valid)) {
    throw new Error('Limit global tidak boleh bernilai negatif.')
  }
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('uang_jajan_global_daily_limit', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [String(valid)]
  )
}

/**
 * Mengambil limit orang tua santri dari finance_wallet_limits.
 */
export async function getParentWalletLimits(
  santriId: string
): Promise<FinanceWalletLimits | null> {
  const row = await queryOne<FinanceWalletLimits>(
    `SELECT * FROM finance_wallet_limits WHERE santri_id = ?`,
    [santriId]
  )
  return row || null
}

/**
 * Menyimpan / memperbarui limit yang ditetapkan orang tua untuk santri.
 */
export async function setParentWalletLimits(
  santriId: string,
  limits: {
    daily?: number | null
    weekly?: number | null
    monthly?: number | null
  },
  updatedBy?: string | null
): Promise<void> {
  const daily = limits.daily !== undefined && limits.daily !== null ? Math.floor(limits.daily) : null
  const weekly = limits.weekly !== undefined && limits.weekly !== null ? Math.floor(limits.weekly) : null
  const monthly = limits.monthly !== undefined && limits.monthly !== null ? Math.floor(limits.monthly) : null

  if (daily !== null && daily < 0) throw new Error('Limit harian orang tua tidak boleh bernilai negatif.')
  if (weekly !== null && weekly < 0) throw new Error('Limit mingguan orang tua tidak boleh bernilai negatif.')
  if (monthly !== null && monthly < 0) throw new Error('Limit bulanan orang tua tidak boleh bernilai negatif.')

  await execute(
    `INSERT INTO finance_wallet_limits (
       santri_id, parent_daily_limit, parent_weekly_limit, parent_monthly_limit,
       updated_at, updated_by
     ) VALUES (?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT(santri_id) DO UPDATE SET
       parent_daily_limit = excluded.parent_daily_limit,
       parent_weekly_limit = excluded.parent_weekly_limit,
       parent_monthly_limit = excluded.parent_monthly_limit,
       updated_at = datetime('now'),
       updated_by = excluded.updated_by`,
    [santriId, daily, weekly, monthly, updatedBy || null]
  )
}

/**
 * Evaluasi Limit Harian Efektif (PRD #16 & Implementation Plan 4.4):
 * Effective Daily Limit = min(Global Limit, Parent Daily Limit)
 * (Jika salah satu null, gunakan yang ada; jika keduanya ada, pilih nilai paling ketat).
 * Menghitung akumulasi penarikan hari ini untuk sisa kuota harian.
 */
export async function evaluateWalletLimit(
  santriId: string
): Promise<WalletLimitEvaluation> {
  const globalDaily = await getGlobalDailyLimit()
  const parentLimits = await getParentWalletLimits(santriId)

  const parentDaily = parentLimits?.parent_daily_limit ?? null
  const parentWeekly = parentLimits?.parent_weekly_limit ?? null
  const parentMonthly = parentLimits?.parent_monthly_limit ?? null

  let effectiveDaily = globalDaily
  if (parentDaily !== null) {
    effectiveDaily = Math.min(globalDaily, parentDaily)
  }

  // Hitung total penarikan tunai santri hari ini (zona waktu lokal)
  const todayRow = await queryOne<{ total_today: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_today
     FROM finance_wallet_ledger
     WHERE santri_id = ?
       AND direction = 'OUT'
       AND movement_type = 'WITHDRAWAL_LOKET'
       AND date(created_at, 'localtime') = date('now', 'localtime')`,
    [santriId]
  )

  const withdrawnToday = todayRow?.total_today ?? 0
  const remainingDailyQuota = Math.max(0, effectiveDaily - withdrawnToday)

  return {
    globalDailyLimit: globalDaily,
    parentDailyLimit: parentDaily,
    parentWeeklyLimit: parentWeekly,
    parentMonthlyLimit: parentMonthly,
    effectiveDailyLimit: effectiveDaily,
    withdrawnToday,
    remainingDailyQuota,
  }
}
