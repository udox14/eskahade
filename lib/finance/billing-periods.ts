import type { FinanceItemType } from './types'

export const MONTHLY_BILLING_ITEMS = ['SPP', 'UANG_MAKAN', 'UANG_NYUCI'] as const
export const ANNUAL_BILLING_ITEMS = ['EHB', 'EKSKUL', 'KESEHATAN'] as const
export type BillingPhase = 'PAST' | 'CURRENT' | 'UPCOMING'
export const BILLING_PHASE_LABELS = { PAST: 'Tunggakan', CURRENT: 'Berjalan', UPCOMING: 'Mendatang' } as const

export function billingClock(at = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
  const monthly = date.slice(0, 7)
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0)
  return { date, monthly, annual: String(year) }
}

export function billingPhase(item: string, period: string, at = new Date()): BillingPhase {
  if (item === 'USPP') return 'CURRENT'
  const clock = billingClock(at)
  const current = (ANNUAL_BILLING_ITEMS as readonly string[]).includes(item) ? clock.annual : clock.monthly
  return period < current ? 'PAST' : period > current ? 'UPCOMING' : 'CURRENT'
}

/** The same window previously offered by the portal: academic year plus six months. */
export function advanceBillingPeriods(at = new Date()): string[] {
  const { monthly, annual } = billingClock(at)
  const periods = new Set<string>()
  for (let i = 0; i < 12; i++) {
    const date = new Date(Date.UTC(Number(annual), 6 + i, 1))
    periods.add(date.toISOString().slice(0, 7))
  }
  for (let i = 1; i <= 6; i++) {
    periods.add(new Date(Date.UTC(Number(monthly.slice(0, 4)), Number(monthly.slice(5, 7)) - 1 + i, 1)).toISOString().slice(0, 7))
  }
  return [...periods].filter(p => p > monthly).sort()
}

export function currentBillingTargets(at = new Date()): Array<{ itemType: FinanceItemType; period: string }> {
  const clock = billingClock(at)
  return [
    ...MONTHLY_BILLING_ITEMS.map(itemType => ({ itemType, period: clock.monthly })),
    ...ANNUAL_BILLING_ITEMS.map(itemType => ({ itemType, period: clock.annual })),
    { itemType: 'USPP', period: 'LIFETIME' },
  ]
}

/** SQL aliases are internal literals, never user input. */
export function dueBillingSql(alias = 'o', at = new Date()): string {
  const { monthly, annual } = billingClock(at)
  return `(${alias}.item_type='USPP' OR (length(${alias}.period)=7 AND ${alias}.period<='${monthly}') OR (length(${alias}.period)=4 AND ${alias}.period<='${annual}'))`
}

export function overdueBillingSql(alias = 'o', at = new Date()): string {
  const { monthly, annual } = billingClock(at)
  return `(${alias}.item_type<>'USPP' AND ((length(${alias}.period)=7 AND ${alias}.period<'${monthly}') OR (length(${alias}.period)=4 AND ${alias}.period<'${annual}')))`
}
