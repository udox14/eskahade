// lib/finance/bri/feature-flags.ts
// Pengendalian Akses Bertahap & Fail-Closed Feature Flags (Fase BRI-7: Go-Live Gates)
// Menjamin tidak ada fitur perbankan yang aktif secara prematur tanpa konfigurasi sah

import { BriError } from './errors'
import { QLOLA_H2H_CONTRACT_STATE } from './qlola-types'
import type { FinanceDistributionMethod } from '../distribution-types'

export { QLOLA_H2H_CONTRACT_STATE }
export const QLOLA_REAL_SUBMISSION_STATE = 'DISABLED' as const
export const BRI_GO_LIVE_GATE_STATE = 'PHASED_ENABLEMENT' as const

export interface BriFeatureFlags {
  /** Gate 1: Apakah adapter inti BRI aktif */
  briCoreEnabled: boolean
  /** Gate 2: Apakah pengiriman / pembuatan BRIVA outbound diizinkan */
  brivaOutboundEnabled: boolean
  /** Gate 3: Apakah pemrosesan webhook notifikasi pembayaran BRIVA diaktifkan */
  brivaInboundCallbackEnabled: boolean
  /** Gate 4: Apakah sinkronisasi berkala Rekening Koran (Bank Statement) diaktifkan */
  bankStatementSyncEnabled: boolean
  /** Gate 5A: Apakah penyaluran tunai via loket (CASH) diaktifkan */
  distributionCashEnabled: boolean
  /** Gate 5B: Apakah transfer bank manual (MANUAL_TRANSFER) diaktifkan */
  distributionManualTransferEnabled: boolean
  /** Gate 6: Apakah integrasi langsung QLola diaktifkan (WAJIB FALSE sampai kontrak resmi tersedia) */
  distributionQlolaEnabled: boolean
  /** Lingkungan eksekusi */
  environment: 'sandbox' | 'production'
}

function getEnvValue(key: string, customEnv?: Record<string, string | undefined>): string {
  if (customEnv && customEnv[key] !== undefined) {
    return (customEnv[key] || '').trim()
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return (process.env[key] || '').trim()
  }
  return ''
}

function parseBooleanFlag(val: string, defaultValue: boolean): boolean {
  if (!val) return defaultValue
  const lower = val.toLowerCase()
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on'
}

/**
 * Memuat matriks feature flags terkini dari environment.
 * Default fail-closed: jika tidak dikonfigurasi, fitur berisiko tinggi default ke FALSE.
 */
export function getBriFeatureFlags(customEnv?: Record<string, string | undefined>): BriFeatureFlags {
  const envRaw = getEnvValue('BRI_ENV', customEnv).toLowerCase()
  const environment: 'sandbox' | 'production' = envRaw === 'production' ? 'production' : 'sandbox'

  // Gate 1: Core enabled (Kill Switch)
  const coreRaw = getEnvValue('BRI_OUTBOUND_ENABLED', customEnv)
  const briCoreEnabled = parseBooleanFlag(coreRaw, false)

  // Gate 2: BRIVA Outbound
  const brivaOutboundRaw = getEnvValue('BRI_BRIVA_OUTBOUND_ENABLED', customEnv)
  const brivaOutboundEnabled = parseBooleanFlag(brivaOutboundRaw, briCoreEnabled)

  // Gate 3: BRIVA Inbound Callback
  const brivaInboundRaw = getEnvValue('BRI_BRIVA_INBOUND_ENABLED', customEnv)
  const brivaInboundCallbackEnabled = parseBooleanFlag(brivaInboundRaw, true)

  // Gate 4: Bank Statement Sync
  const stmtSyncRaw = getEnvValue('BRI_STATEMENT_SYNC_ENABLED', customEnv)
  const bankStatementSyncEnabled = parseBooleanFlag(stmtSyncRaw, false)

  // Gate 5: Distribution Methods
  const distCashRaw = getEnvValue('BRI_DIST_CASH_ENABLED', customEnv)
  const distributionCashEnabled = parseBooleanFlag(distCashRaw, true)

  const distManualRaw = getEnvValue('BRI_DIST_MANUAL_ENABLED', customEnv)
  const distributionManualTransferEnabled = parseBooleanFlag(distManualRaw, true)

  // Gate 6: QLola Real Submission (WAJIB FALSE / DISABLED)
  // Tidak dapat di-override menjadi true tanpa revisi kontrak resmi
  const distributionQlolaEnabled = false

  return Object.freeze({
    briCoreEnabled,
    brivaOutboundEnabled,
    brivaInboundCallbackEnabled,
    bankStatementSyncEnabled,
    distributionCashEnabled,
    distributionManualTransferEnabled,
    distributionQlolaEnabled,
    environment,
  })
}

/**
 * Validasi keras: Inti BRI harus aktif untuk operasi perbankan keluar.
 */
export function assertBriCoreEnabled(customEnv?: Record<string, string | undefined>): void {
  const flags = getBriFeatureFlags(customEnv)
  if (!flags.briCoreEnabled) {
    throw new BriError(
      'CONFIG_ERROR',
      'Integrasi BRI saat ini dinonaktifkan oleh Operational Kill Switch (BRI_OUTBOUND_ENABLED=false).'
    )
  }
}

/**
 * Validasi keras: Inbound webhook callback harus aktif untuk menerima notifikasi.
 */
export function assertBrivaInboundEnabled(customEnv?: Record<string, string | undefined>): void {
  const flags = getBriFeatureFlags(customEnv)
  if (!flags.brivaInboundCallbackEnabled) {
    throw new BriError(
      'CONFIG_ERROR',
      'Penerimaan callback webhook BRIVA sedang dinonaktifkan sementara oleh sistem.'
    )
  }
}

/**
 * Validasi keras: Pengambilan mutasi bank harus aktif.
 */
export function assertBankStatementSyncEnabled(customEnv?: Record<string, string | undefined>): void {
  const flags = getBriFeatureFlags(customEnv)
  if (!flags.bankStatementSyncEnabled) {
    throw new BriError(
      'CONFIG_ERROR',
      'Sinkronisasi otomatis Rekening Koran BRI sedang dinonaktifkan oleh feature flag (BRI_STATEMENT_SYNC_ENABLED=false).'
    )
  }
}

/**
 * Validasi keras: Metode distribusi yang diminta harus aktif.
 */
export function assertDistributionMethodEnabled(
  method: FinanceDistributionMethod,
  customEnv?: Record<string, string | undefined>
): void {
  const flags = getBriFeatureFlags(customEnv)

  if (method === 'CASH' && !flags.distributionCashEnabled) {
    throw new Error('Metode penyaluran tunai (CASH) sedang dinonaktifkan.')
  }

  if (method === 'MANUAL_TRANSFER' && !flags.distributionManualTransferEnabled) {
    throw new Error('Metode penyaluran transfer manual (MANUAL_TRANSFER) sedang dinonaktifkan.')
  }

  if (method === 'BRI_QLOLA') {
    if (!flags.distributionQlolaEnabled) {
      throw new Error(
        `QLOLA_INTEGRATION_DISABLED: Eksekusi otomatis QLola dinonaktifkan (Status: ${QLOLA_H2H_CONTRACT_STATE}). Penyaluran hanya dapat disiapkan sebagai draf dan disetujui via QLola portal eksternal oleh Signer.`
      )
    }
  }
}
