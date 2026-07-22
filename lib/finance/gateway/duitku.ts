import { createHash } from 'node:crypto'
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GatewayPaymentRequest, GatewayPaymentResult, PaymentGateway } from './types'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} belum dikonfigurasi.`)
  return value
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

export class DuitkuGateway implements PaymentGateway {
  readonly name = 'DUITKU'

  async createPayment(request: GatewayPaymentRequest): Promise<GatewayPaymentResult> {
    const merchantCode = required('DUITKU_MERCHANT_CODE')
    const apiKey = required('DUITKU_API_KEY')
    const production = process.env.DUITKU_PRODUCTION === 'true'
    const endpoint = production
      ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry'
      : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'
    const signature = md5(`${merchantCode}${request.merchantOrderId}${request.amountRupiah}${apiKey}`)
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        merchantCode, paymentAmount: request.amountRupiah, paymentMethod: request.paymentMethod,
        merchantOrderId: request.merchantOrderId, productDetails: 'Top up saldo santri',
        customerVaName: request.customerName, email: request.email || 'wali@pesantren.invalid',
        phoneNumber: request.phone || '', callbackUrl: request.callbackUrl, returnUrl: request.returnUrl,
        signature, expiryPeriod: request.expiryMinutes,
      }),
    })
    const raw = await response.json().catch(() => ({})) as Record<string, any>
    if (!response.ok || raw.statusCode && String(raw.statusCode) !== '00') {
      throw new Error(`Duitku menolak transaksi: ${raw.statusMessage || response.status}`)
    }
    return {
      providerReference: raw.reference || null,
      paymentUrl: raw.paymentUrl || null,
      vaNumber: raw.vaNumber || null,
      qrString: raw.qrString || null,
      raw,
    }
  }

  verifyCallback(payload: Record<string, string>): boolean {
    const merchantCode = required('DUITKU_MERCHANT_CODE')
    const signature = md5(`${merchantCode}${payload.amount || ''}${payload.merchantOrderId || ''}${required('DUITKU_API_KEY')}`)
    const supplied = String(payload.signature || '').toLowerCase()
    if (signature.length !== supplied.length) return false
    let mismatch = 0
    for (let i = 0; i < signature.length; i++) mismatch |= signature.charCodeAt(i) ^ supplied.charCodeAt(i)
    return mismatch === 0
  }

  callbackEventKey(payload: Record<string, string>): string {
    return `${payload.merchantOrderId || 'unknown'}:${payload.reference || payload.amount || 'event'}:${payload.resultCode || ''}`
  }
}
