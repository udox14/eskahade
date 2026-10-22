// Existing cutover and legacy policy; shared with the scheduled billing runtime.
import { queryOne, query, execute } from '@/lib/db'
import { createLegacyReader } from './legacy-reader'
export { FINANCE_CUTOVER_START_MONTHLY, FINANCE_CUTOVER_START_ANNUAL } from './legacy-reader'
export type { LegacySettlementCheckResult, LegacyUsppStatus } from './legacy-reader'
export const { getHistoricalUsppTariff, checkLegacyUsppStatus, checkLegacySettlement } = createLegacyReader({ queryOne, query, execute })
