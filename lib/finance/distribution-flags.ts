// lib/finance/distribution-flags.ts
// Gerbang metode penyaluran dana yang TIDAK bergantung pada integrasi bank apa pun.
// CASH dan MANUAL_TRANSFER aktif secara default; QLola otomatis tidak pernah aktif dari sini
// (eksekusi non-STP hanya lewat Signer di portal bank — lihat AGENTS.md §23).
import type { FinanceDistributionMethod } from './distribution-types'

export interface DistributionFlags {
  cashEnabled: boolean
  manualTransferEnabled: boolean
}

function envValue(key: string, customEnv?: Record<string, string | undefined>): string {
  if (customEnv && customEnv[key] !== undefined) return (customEnv[key] || '').trim()
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) return (process.env[key] || '').trim()
  return ''
}

function parseFlag(val: string, defaultValue: boolean): boolean {
  if (!val) return defaultValue
  const lower = val.toLowerCase()
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on'
}

/** Nama env dipertahankan (BRI_DIST_*) agar konfigurasi deploy yang ada tidak berubah. */
export function getDistributionFlags(customEnv?: Record<string, string | undefined>): DistributionFlags {
  return {
    cashEnabled: parseFlag(envValue('BRI_DIST_CASH_ENABLED', customEnv), true),
    manualTransferEnabled: parseFlag(envValue('BRI_DIST_MANUAL_ENABLED', customEnv), true),
  }
}

export function assertDistributionMethodEnabled(
  method: FinanceDistributionMethod,
  customEnv?: Record<string, string | undefined>
): void {
  if (!['CASH', 'MANUAL_TRANSFER', 'BRI_QLOLA'].includes(method)) throw new Error('Metode penyaluran tidak didukung.')
  const flags = getDistributionFlags(customEnv)
  if (method === 'CASH' && !flags.cashEnabled) throw new Error('Metode penyaluran tunai (CASH) sedang dinonaktifkan.')
  if (method === 'MANUAL_TRANSFER' && !flags.manualTransferEnabled) {
    throw new Error('Metode penyaluran transfer manual (MANUAL_TRANSFER) sedang dinonaktifkan.')
  }
  if (method === 'BRI_QLOLA') {
    throw new Error(
      'QLOLA_INTEGRATION_DISABLED: Eksekusi otomatis QLola dinonaktifkan. Penyaluran hanya dapat disiapkan sebagai draf dan disetujui via QLola portal eksternal oleh Signer.'
    )
  }
}
