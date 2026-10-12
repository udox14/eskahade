// app/api/bri/v1.0/transfer-va/payment/route.ts
// Old Non-Canonical BRIVA Payment Notification Route (Deprecated Alias)
// In production, strictly disabled (HTTP 404). Use canonical path: /snap/v1.0/transfer-va/payment

import { NextRequest, NextResponse } from 'next/server'
import { loadBriConfig, BRI_VA_PAYMENT_CODES, extractBrivaHeaders, handleBrivaPayment } from '@/lib/finance/bri'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const config = loadBriConfig()

  if (config.env === 'production') {
    return NextResponse.json(
      {
        responseCode: BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND,
        responseMessage: 'Route disabled in production. Use canonical SNAP BI path: /snap/v1.0/transfer-va/payment',
      },
      { status: 404 }
    )
  }

  const rawBody = await req.text()
  const headers = extractBrivaHeaders(req.headers)
  const endpointPath = req.nextUrl.pathname

  const result = await handleBrivaPayment({
    rawBody,
    headers,
    endpointPath,
    method: 'POST',
    configOverride: config,
  })

  return NextResponse.json(result.body, { status: result.status })
}
