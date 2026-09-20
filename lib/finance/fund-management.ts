// lib/finance/fund-management.ts
// Modul Tata Kelola Pemisahan Pengelolaan Dana (Fund Management Separation)
// Membedakan Asal Transaksi (source: LEGACY vs NEW_FINANCE)
// dan Pengelola Dana (fund_management: PRE_KOPERASI vs KOPERASI)

import { queryOne, execute, now } from '@/lib/db'
import type { FinanceFundManagement, FinancePaymentSource } from '@/lib/finance/payment-types'

export const APP_SETTING_KOPERASI_EFFECTIVE_AT = 'finance_koperasi_effective_at'

export const FUND_MANAGEMENT_LABELS: Record<FinanceFundManagement, string> = {
  PRE_KOPERASI: 'Pra-Koperasi',
  KOPERASI: 'Koperasi',
} as const

export const PAYMENT_SOURCE_LABELS: Record<FinancePaymentSource, string> = {
  LEGACY: 'Modul Lama',
  NEW_FINANCE: 'Sistem Baru',
} as const

/**
 * Mengambil timestamp efektif pengalihan pengelolaan dana ke Koperasi dari app_settings.
 * Jika NULL atau kosong, berarti sistem masih berada pada masa transisi pra-Koperasi.
 */
export async function getKoperasiEffectiveTimestamp(): Promise<string | null> {
  try {
    const row = await queryOne<{ value: string | null }>(
      `SELECT value FROM app_settings WHERE key = ? LIMIT 1`,
      [APP_SETTING_KOPERASI_EFFECTIVE_AT]
    )
    const val = row?.value?.trim()
    return val ? val : null
  } catch {
    return null
  }
}

/**
 * Mengatur atau memperbarui tanggal efektif pengalihan ke Koperasi.
 * Transaksi historis sebelum tanggal ini TETAP 'PRE_KOPERASI' (immutable).
 */
export async function setKoperasiEffectiveTimestamp(
  timestamp: string | null,
  userId?: string | null
): Promise<void> {
  const cleanVal = timestamp ? timestamp.trim() : ''
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [APP_SETTING_KOPERASI_EFFECTIVE_AT, cleanVal, now()]
  )
}

/**
 * Menentukan klasifikasi pengelolaan dana ('PRE_KOPERASI' | 'KOPERASI') secara deterministik.
 *
 * Aturan Bisnis:
 * 1. Jika sumber adalah 'LEGACY', MAKA MUTLAK 'PRE_KOPERASI' (Historical & Immutable).
 * 2. Jika overrideFundManagement diberikan secara eksplisit, gunakan nilai tersebut.
 * 3. Jika effective timestamp Koperasi belum disetel (NULL / kosong), MAKA 'PRE_KOPERASI'.
 * 4. Jika tanggal bayar (paidAt) >= effective timestamp, MAKA 'KOPERASI'.
 * 5. Selain itu, MAKA 'PRE_KOPERASI'.
 */
export async function resolveFundManagement(
  paidAt: string,
  source?: FinancePaymentSource,
  overrideFundManagement?: FinanceFundManagement
): Promise<FinanceFundManagement> {
  if (overrideFundManagement) {
    return overrideFundManagement
  }

  // Aturan kaku: Seluruh pembayaran dari legacy bridge adalah PRE_KOPERASI
  if (source === 'LEGACY') {
    return 'PRE_KOPERASI'
  }

  const effectiveAt = await getKoperasiEffectiveTimestamp()
  if (!effectiveAt) {
    return 'PRE_KOPERASI'
  }

  // Format perbandingan ISO string (Asia/Jakarta / YYYY-MM-DD...)
  if (paidAt >= effectiveAt) {
    return 'KOPERASI'
  }

  return 'PRE_KOPERASI'
}
