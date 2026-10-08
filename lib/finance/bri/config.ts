// lib/finance/bri/config.ts
// Secure configuration loader and fail-closed environment boundary for BRI integration

import { BriError } from './errors'
import type { BriConfig, BriEnvironment } from './types'

export const BRI_DEFAULT_SANDBOX_BASE_URL = 'https://sandbox.partner.api.bri.co.id'
export const BRI_DEFAULT_PRODUCTION_BASE_URL = 'https://partner.api.bri.co.id'

/**
 * Validates that an RSA private key is present and in PEM format.
 */
function validatePrivateKeyFormat(pem: string): void {
  if (!pem || typeof pem !== 'string') {
    throw new BriError('CONFIG_ERROR', 'Missing required configuration: BRI_PRIVATE_KEY')
  }
  const trimmed = pem.trim()
  if (!trimmed.includes('-----BEGIN') || !trimmed.includes('PRIVATE KEY-----')) {
    throw new BriError('CONFIG_ERROR', 'Invalid BRI_PRIVATE_KEY format. Must be a valid RSA private key in PEM format.')
  }
}

/**
 * Loads raw environment record from process.env or provided context dictionary.
 */
function getRawEnv(customEnv?: Record<string, string | undefined>): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = {}
  if (typeof process !== 'undefined' && process.env) {
    Object.assign(merged, process.env)
  }
  if (customEnv) {
    Object.assign(merged, customEnv)
  }
  return merged
}

/**
 * Authoritative configuration loader for BRI integration.
 * Strict fail-closed rules:
 * 1. Missing credentials immediately throw CONFIG_ERROR.
 * 2. Invalid environment immediately throws CONFIG_ERROR.
 * 3. Mismatch between BRI_CLIENT_KEY and BRI_CLIENT_ID immediately throws CONFIG_ERROR.
 * 4. Cross-environment boundary pollution (sandbox keys in prod, prod keys in sandbox) is rejected.
 * 5. Kill switch defaults to OFF (outboundEnabled: false).
 */
export function loadBriConfig(overrides?: Partial<BriConfig>, rawEnvDictionary?: Record<string, string | undefined>): BriConfig {
  const rawEnv = getRawEnv(rawEnvDictionary)

  // 1. Determine environment (fail closed if invalid)
  const envRaw = (overrides?.env || rawEnv.BRI_ENV || 'sandbox').trim().toLowerCase()
  if (envRaw !== 'sandbox' && envRaw !== 'production') {
    throw new BriError('CONFIG_ERROR', `Invalid BRI_ENV "${envRaw}". Must be strictly "sandbox" or "production".`)
  }
  const env: BriEnvironment = envRaw as BriEnvironment

  // 2. Base URL resolution
  let baseUrl = (overrides?.baseUrl || rawEnv.BRI_BASE_URL || (env === 'production' ? BRI_DEFAULT_PRODUCTION_BASE_URL : BRI_DEFAULT_SANDBOX_BASE_URL)).trim()
  baseUrl = baseUrl.replace(/\/+$/, '')
  if (!baseUrl.startsWith('https://')) {
    throw new BriError('CONFIG_ERROR', 'BRI Base URL must use secure HTTPS protocol.')
  }

  // Ensure production baseUrl does not target sandbox
  if (env === 'production' && baseUrl.includes('sandbox')) {
    throw new BriError('CONFIG_ERROR', 'Production environment cannot use a sandbox BRI Base URL.')
  }

  // 3. Unify Client Key / Client ID (Fail-closed on mismatch)
  const rawClientKey = (overrides?.clientKey || rawEnv.BRI_CLIENT_KEY || '').trim()
  const rawClientId = (overrides?.clientId || rawEnv.BRI_CLIENT_ID || '').trim()

  if (rawClientKey && rawClientId && rawClientKey !== rawClientId) {
    throw new BriError(
      'CONFIG_ERROR',
      'Configuration conflict: BRI_CLIENT_KEY and BRI_CLIENT_ID are both set but have different values. They must be identical.'
    )
  }

  const clientKey = rawClientKey || rawClientId
  if (!clientKey) {
    throw new BriError('CONFIG_ERROR', 'Missing required configuration: BRI_CLIENT_KEY (or BRI_CLIENT_ID).')
  }

  // 4. Partner ID for business headers (X-PARTNER-ID)
  // Distinct from BRIVA partnerServiceId
  const partnerId = (overrides?.partnerId || rawEnv.BRI_PARTNER_ID || '').trim()

  // 5. Client Secret
  const clientSecret = (overrides?.clientSecret || rawEnv.BRI_CLIENT_SECRET || '').trim()
  if (!clientSecret) {
    throw new BriError('CONFIG_ERROR', 'Missing required configuration: BRI_CLIENT_SECRET.')
  }

  // 6. RSA Private Key
  const privateKey = (overrides?.privateKey || rawEnv.BRI_PRIVATE_KEY || '').trim()
  validatePrivateKeyFormat(privateKey)

  // 7. Cross-environment safety boundary checks
  if (env === 'production') {
    if (clientKey.toLowerCase().includes('sandbox') || clientKey.toLowerCase().includes('test_dummy')) {
      throw new BriError('CONFIG_ERROR', 'Production environment cannot use sandbox or test Client Key/ID.')
    }
    if (clientSecret.toLowerCase().includes('sandbox_secret') || clientSecret.toLowerCase().includes('test_secret')) {
      throw new BriError('CONFIG_ERROR', 'Production environment cannot use sandbox or test Client Secret.')
    }
  } else {
    if (clientKey.toLowerCase().startsWith('prod_live_') || clientKey.toLowerCase().includes('bri_live_')) {
      throw new BriError('CONFIG_ERROR', 'Sandbox environment cannot use production Client Key/ID.')
    }
  }

  // 8. Channel ID
  const channelId = (overrides?.channelId || rawEnv.BRI_CHANNEL_ID || '00009').trim()

  // 9. Timeout
  const rawTimeout = overrides?.timeoutMs ?? (rawEnv.BRI_TIMEOUT_MS ? parseInt(rawEnv.BRI_TIMEOUT_MS, 10) : 15000)
  const timeoutMs = isNaN(rawTimeout) || rawTimeout <= 0 ? 15000 : rawTimeout

  // 10. Timestamp Timezone Offset (Default +7 WIB, configurable, flagged as NOT YET VERIFIED AGAINST BRI SANDBOX)
  const rawOffset = overrides?.timestampOffsetHours ?? (rawEnv.BRI_TIMESTAMP_OFFSET_HOURS ? parseInt(rawEnv.BRI_TIMESTAMP_OFFSET_HOURS, 10) : 7)
  const timestampOffsetHours = isNaN(rawOffset) ? 7 : rawOffset

  // 11. Operational Kill Switch (Default: OFF / false)
  let outboundEnabled = false
  if (typeof overrides?.outboundEnabled === 'boolean') {
    outboundEnabled = overrides.outboundEnabled
  } else if (rawEnv.BRI_OUTBOUND_ENABLED === 'true' || rawEnv.BRI_OUTBOUND_ENABLED === '1') {
    outboundEnabled = true
  }

  const config: BriConfig = Object.freeze({
    env,
    baseUrl,
    clientKey,
    clientId: clientKey, // Alias
    partnerId,
    clientSecret,
    privateKey,
    timestampOffsetHours,
    channelId,
    timeoutMs,
    outboundEnabled,
  })

  return config
}
