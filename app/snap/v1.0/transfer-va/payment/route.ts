// app/snap/v1.0/transfer-va/payment/route.ts
// Official Canonical SNAP BI BRIVA Payment Notification Inbound Route
// Path: /snap/v1.0/transfer-va/payment

import { NextRequest, NextResponse } from 'next/server'
import { extractBrivaHeaders, handleBrivaPayment } from '@/lib/finance/bri'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const headers = extractBrivaHeaders(req.headers)
  const endpointPath = req.nextUrl.pathname

  const result = await handleBrivaPayment({
    rawBody,
    headers,
    endpointPath,
    method: 'POST',
  })

  return NextResponse.json(result.body, { status: result.status })
}
