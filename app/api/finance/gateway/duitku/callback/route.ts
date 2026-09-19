// app/api/finance/gateway/duitku/callback/route.ts
// Webhook Route untuk menerima notifikasi pembayaran dari server Duitku
// Menerima POST request dengan format application/x-www-form-urlencoded atau JSON.

import { NextRequest, NextResponse } from 'next/server'
import { processDuitkuCallback } from '@/lib/finance/gateway/duitku'
import type { DuitkuCallbackPayload } from '@/lib/finance/payment-types'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let payload: Partial<DuitkuCallbackPayload> = {}

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const raw: Record<string, string> = {}
      formData.forEach((value, key) => {
        raw[key] = String(value)
      })
      payload = {
        merchantCode: raw.merchantCode,
        amount: raw.amount,
        merchantOrderId: raw.merchantOrderId,
        productDetail: raw.productDetail,
        additionalParam: raw.additionalParam,
        paymentCode: raw.paymentCode,
        resultCode: raw.resultCode,
        merchantUserId: raw.merchantUserId,
        reference: raw.reference,
        signature: raw.signature,
        publisherOrderId: raw.publisherOrderId,
        spUserHash: raw.spUserHash,
        settlementDate: raw.settlementDate,
        issuerCode: raw.issuerCode,
        customerName: raw.customerName,
      }
    } else {
      // Fallback ke JSON jika dikirim via webhook proxy atau direct API
      try {
        payload = (await request.json()) as Partial<DuitkuCallbackPayload>
      } catch {
        const text = await request.text()
        const params = new URLSearchParams(text)
        payload = Object.fromEntries(params.entries()) as unknown as Partial<DuitkuCallbackPayload>
      }
    }

    const result = await processDuitkuCallback(payload as DuitkuCallbackPayload)

    // Duitku mengharapkan response HTTP 200 dengan text "OK"
    return new NextResponse('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Result-Status': result.matchType,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isClientError =
      message.includes('Bad Signature') ||
      message.includes('tidak lengkap') ||
      message.includes('tidak dapat diidentifikasi')

    return new NextResponse(message, {
      status: isClientError ? 400 : 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}

export async function GET() {
  // Health check endpoint untuk verifikasi URL callback oleh tim Duitku / merchant dashboard
  return new NextResponse('Duitku Callback Endpoint Ready', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
