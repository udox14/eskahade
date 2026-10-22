import type { BillingStore } from './billing-store'
import { billingClock } from './billing-periods'

export const APP_SETTING_KOPERASI_EFFECTIVE_AT = 'finance_koperasi_effective_at'

/** Existing snapshots remain stored, but cannot be collected before operational cutover. */
export function serviceBillingSql(alias = 'o') {
  return `(${alias}.item_type NOT IN ('UANG_MAKAN','UANG_NYUCI') OR EXISTS(
    SELECT 1 FROM app_settings bcut WHERE bcut.key='${APP_SETTING_KOPERASI_EFFECTIVE_AT}'
    AND julianday(bcut.value)<=julianday('now')
    AND ${alias}.period>=strftime('%Y-%m',bcut.value,'+7 hours')))`
}

/** Operational cutover, independent of the historical legacy migration boundary. */
export async function readBillingCutover(store: BillingStore, at = new Date()) {
  const row = await store.queryOne<{ value: string | null }>(
    'SELECT value FROM app_settings WHERE key=? LIMIT 1', [APP_SETTING_KOPERASI_EFFECTIVE_AT])
  const value = row?.value?.trim()
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error('Konfigurasi tanggal Koperasi tidak valid.')
  if (timestamp > at.getTime()) return null
  return { effectiveAt: new Date(timestamp).toISOString(), monthly: billingClock(new Date(timestamp)).monthly }
}

export function createServiceBillingGate(store: BillingStore, at = new Date()) {
  // Invocation-local configuration snapshot; never cache balances, payments or tariffs.
  let snapshot: ReturnType<typeof readBillingCutover> | undefined
  return async (item: string, period: string) => {
    if (item !== 'UANG_MAKAN' && item !== 'UANG_NYUCI') return null
    const cutover = await (snapshot ??= readBillingCutover(store, at))
    if (!cutover) return 'Tagihan makan/nyuci menunggu waktu efektif cutover Koperasi.'
    if (period < cutover.monthly) return 'Periode makan/nyuci sebelum cutover Koperasi.'
    return null
  }
}

export function serviceBillingBlock(store: BillingStore, item: string, period: string, at = new Date()) {
  return createServiceBillingGate(store,at)(item,period)
}
