import { query, queryOne, execute } from '@/lib/db'
import { createBillingIssuance } from './billing-issuance'
import { advanceBillingPeriods } from './billing-periods'
import { billingReviewCount } from './billing-legacy'

/** Request adapter only. The scheduled Worker uses the same service with an explicit D1 binding. */
export async function ensureStudentBilling(santriId: string, selectedPeriod?: string) {
  const result = await createBillingIssuance({ query,queryOne,execute }).ensureStudent(santriId,selectedPeriod)
  const pending = await billingReviewCount({ query,queryOne,execute },santriId)
  return {
    ...result,
    warnings: result.candidates.filter(c => c.outcome === 'FAILED' || c.outcome === 'REVIEW')
      .map(c => `${c.itemType} ${c.period}: ${c.reason}`)
      .concat(pending ? ['Ada bukti pembayaran lama yang perlu sinkronisasi/pemeriksaan; total yang tersedia belum mencakup kasus tersebut.'] : []),
    advancePeriods: advanceBillingPeriods(),
  }
}
