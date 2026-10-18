import type { PaymentOrderWithItems } from './payment-types'

/** Compose existing finance engines into ONE D1 batch; never execute a plan piecemeal. */
export interface FinanceWritePlan {
  statements: Array<{ sql: string; params: unknown[] }>
  orders: Map<string, PaymentOrderWithItems>
}

export function financeWritePlan(): FinanceWritePlan {
  return { statements: [], orders: new Map() }
}
