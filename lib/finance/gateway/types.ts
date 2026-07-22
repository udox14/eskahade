export type GatewayPaymentRequest = {
  merchantOrderId: string
  amountRupiah: number
  paymentMethod: string
  customerName: string
  email?: string | null
  phone?: string | null
  returnUrl: string
  callbackUrl: string
  expiryMinutes: number
}

export type GatewayPaymentResult = {
  providerReference?: string | null
  paymentUrl?: string | null
  vaNumber?: string | null
  qrString?: string | null
  raw: unknown
}

export interface PaymentGateway {
  readonly name: string
  createPayment(request: GatewayPaymentRequest): Promise<GatewayPaymentResult>
  verifyCallback(payload: Record<string, string>): boolean
  callbackEventKey(payload: Record<string, string>): string
}
