import type { PaymentGateway } from './types'
import { DuitkuGateway } from './duitku'

export function paymentGateway(provider = 'DUITKU'): PaymentGateway {
  if (provider === 'DUITKU') return new DuitkuGateway()
  throw new Error(`Payment gateway ${provider} belum didukung.`)
}

export type { PaymentGateway, GatewayPaymentRequest, GatewayPaymentResult } from './types'
