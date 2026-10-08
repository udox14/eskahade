// lib/finance/cooperative-admin.ts
// Modul Pengelolaan Biaya Administrasi Koperasi & Buku Besar Pendapatan Koperasi (Append-Only)
// Sistem Keuangan Baru Pesantren (Fase BRI-1)

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import type {
  FinanceCooperativeAdminFeeRule,
  FinanceCooperativeIncome,
  FinanceCooperativeIncomeEntryType,
} from '@/lib/finance/payment-types'

function generateIncomeNumber(entryType: FinanceCooperativeIncomeEntryType): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const prefix = entryType === 'INCOME' ? 'INC' : entryType === 'REVERSAL' ? 'REV' : 'REF'
  return `${prefix}-KOP-${datePart}-${randomSuffix}`
}

/**
 * Mengambil aturan biaya administrasi Koperasi yang efektif pada tanggal tertentu.
 * Berdasarkan aturan di finance_cooperative_admin_fee_rules yang enabled dan masih berlaku.
 */
export async function getEffectiveCooperativeAdminFeeRule(
  code = 'ONLINE_CHECKOUT_FEE',
  atDate = new Date().toISOString()
): Promise<FinanceCooperativeAdminFeeRule | null> {
  const rule = await queryOne<FinanceCooperativeAdminFeeRule>(
    `SELECT id, code, name, is_enabled, amount, applies_to_channel,
            effective_from, effective_until, closed_by, closed_at, created_by, created_at
     FROM finance_cooperative_admin_fee_rules
     WHERE code = ?
       AND applies_to_channel = 'BRI'
       AND is_enabled = 1
       AND effective_from <= ?
       AND (effective_until IS NULL OR effective_until > ?)
     ORDER BY effective_from DESC, created_at DESC
     LIMIT 1`,
    [code, atDate, atDate]
  )
  return rule || null
}

/**
 * Mengambil nominal biaya administrasi Koperasi efektif untuk transaksi online.
 * Default Rp0 jika tidak aktif atau belum diatur.
 */
export async function getEffectiveCooperativeAdminFee(
  code = 'ONLINE_CHECKOUT_FEE',
  atDate = new Date().toISOString()
): Promise<number> {
  const rule = await getEffectiveCooperativeAdminFeeRule(code, atDate)
  return rule ? rule.amount : 0
}

/**
 * Mengambil daftar seluruh riwayat aturan biaya administrasi Koperasi (versioned).
 */
export async function listCooperativeAdminFeeRules(): Promise<FinanceCooperativeAdminFeeRule[]> {
  return query<FinanceCooperativeAdminFeeRule>(
    `SELECT id, code, name, is_enabled, amount, applies_to_channel,
            effective_from, effective_until, closed_by, closed_at, created_by, created_at
     FROM finance_cooperative_admin_fee_rules
     ORDER BY effective_from DESC, created_at DESC`
  )
}

/**
 * Memperbarui aturan biaya administrasi Koperasi dengan membuat versi baru (effective-dated).
 * Menutup masa berlaku aturan aktif sebelumnya secara atomik (batch) untuk mencegah window overlap.
 */
export async function setCooperativeAdminFeeRule(input: {
  code?: string
  name?: string
  amount: number
  isEnabled?: boolean
  createdBy?: string | null
}): Promise<FinanceCooperativeAdminFeeRule> {
  const cleanCode = (input.code || 'ONLINE_CHECKOUT_FEE').trim().toUpperCase()
  const cleanName = (input.name || 'Biaya Operasional Koperasi Transaksi Online').trim()
  const amount = Math.max(0, Math.floor(input.amount))
  const isEnabled = input.isEnabled !== false ? 1 : 0
  const timestamp = now()
  const id = generateId()

  // Eksekusi atomik dalam 1 batch: tutup rule lama & insert rule baru
  await batch([
    {
      sql: `UPDATE finance_cooperative_admin_fee_rules
            SET effective_until = ?, closed_by = ?, closed_at = ?
            WHERE code = ?
              AND applies_to_channel = 'BRI'
              AND (effective_until IS NULL OR effective_until > ?)`,
      params: [timestamp, input.createdBy || null, timestamp, cleanCode, timestamp],
    },
    {
      sql: `INSERT INTO finance_cooperative_admin_fee_rules (
              id, code, name, is_enabled, amount, applies_to_channel,
              effective_from, effective_until, closed_by, closed_at, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, 'BRI', ?, NULL, NULL, NULL, ?, ?)`,
      params: [id, cleanCode, cleanName, isEnabled, amount, timestamp, input.createdBy || null, timestamp],
    },
  ])

  const created = await queryOne<FinanceCooperativeAdminFeeRule>(
    `SELECT id, code, name, is_enabled, amount, applies_to_channel,
            effective_from, effective_until, closed_by, closed_at, created_by, created_at
     FROM finance_cooperative_admin_fee_rules
     WHERE id = ?`,
    [id]
  )
  if (!created) throw new Error('Gagal memuat aturan biaya administrasi baru setelah penyimpanan.')
  return created
}

/**
 * Mencatat mutasi pada buku besar pendapatan Koperasi secara append-only.
 * Tidak ada update/edit di tempat untuk integritas audit finansial.
 */
export async function recordCooperativeIncome(input: {
  entryType: FinanceCooperativeIncomeEntryType
  amount: number
  paymentId: string
  orderId?: string | null
  referenceIncomeId?: string | null
  correctionId?: string | null
  ruleId?: string | null
  ruleSnapshot?: string | null
  referenceNote?: string | null
  createdBy?: string | null
}): Promise<FinanceCooperativeIncome> {
  const amount = Math.floor(input.amount)
  if (amount < 0 || !Number.isFinite(amount)) {
    throw new Error('Nominal pendapatan/koreksi Koperasi tidak boleh negatif.')
  }

  const id = generateId()
  const incomeNumber = generateIncomeNumber(input.entryType)
  const createdAt = now()

  await execute(
    `INSERT INTO finance_cooperative_income (
       id, income_number, entry_type, reference_income_id, correction_id,
       payment_id, order_id, amount, rule_id, rule_snapshot,
       reference_note, created_by, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      incomeNumber,
      input.entryType,
      input.referenceIncomeId || null,
      input.correctionId || null,
      input.paymentId,
      input.orderId || null,
      amount,
      input.ruleId || null,
      input.ruleSnapshot || null,
      input.referenceNote || null,
      input.createdBy || null,
      createdAt,
    ]
  )

  const created = await queryOne<FinanceCooperativeIncome>(
    `SELECT id, income_number, entry_type, reference_income_id, correction_id,
            payment_id, order_id, amount, rule_id, rule_snapshot,
            reference_note, created_by, created_at
     FROM finance_cooperative_income
     WHERE id = ?`,
    [id]
  )
  if (!created) throw new Error('Gagal memuat mutasi pendapatan Koperasi setelah pencatatan.')
  return created
}

/**
 * Menambahkan entri pembalikan (REVERSAL / REFUND) ke append-only ledger
 * tanpa memutasi row INCOME asli.
 */
export async function appendCooperativeIncomeReversal(input: {
  originalPaymentId: string
  correctionId?: string | null
  reason: string
  createdBy?: string | null
  isRefund?: boolean
}): Promise<FinanceCooperativeIncome | null> {
  const original = await queryOne<FinanceCooperativeIncome>(
    `SELECT id, income_number, entry_type, amount, payment_id, order_id, rule_id, rule_snapshot
     FROM finance_cooperative_income
     WHERE payment_id = ? AND entry_type = 'INCOME'
     LIMIT 1`,
    [input.originalPaymentId]
  )

  if (!original) {
    return null
  }

  const entryType: FinanceCooperativeIncomeEntryType = input.isRefund ? 'REFUND' : 'REVERSAL'
  return recordCooperativeIncome({
    entryType,
    amount: original.amount,
    paymentId: original.payment_id,
    orderId: original.order_id,
    referenceIncomeId: original.id,
    correctionId: input.correctionId || null,
    ruleId: original.rule_id,
    ruleSnapshot: original.rule_snapshot,
    referenceNote: `${entryType} pendapatan Koperasi atas pembayaran ref ${original.income_number}: ${input.reason}`,
    createdBy: input.createdBy || null,
  })
}

/**
 * Mengambil ringkasan saldo pendapatan Koperasi: total masuk, total reversal, total net.
 */
export async function getCooperativeIncomeSummary(): Promise<{
  totalIncome: number
  totalReversal: number
  totalRefund: number
  netIncome: number
}> {
  const row = await queryOne<{
    total_income: number
    total_reversal: number
    total_refund: number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type = 'INCOME' THEN amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN entry_type = 'REVERSAL' THEN amount ELSE 0 END), 0) AS total_reversal,
       COALESCE(SUM(CASE WHEN entry_type = 'REFUND' THEN amount ELSE 0 END), 0) AS total_refund
     FROM finance_cooperative_income`
  )

  const totalIncome = row?.total_income ?? 0
  const totalReversal = row?.total_reversal ?? 0
  const totalRefund = row?.total_refund ?? 0
  const netIncome = Math.max(0, totalIncome - totalReversal - totalRefund)

  return { totalIncome, totalReversal, totalRefund, netIncome }
}
