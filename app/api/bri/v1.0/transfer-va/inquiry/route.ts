// app/api/bri/v1.0/transfer-va/inquiry/route.ts
// Old Non-Canonical BRIVA Inquiry Route (Deprecated Alias)
// In production, strictly disabled (HTTP 404). Use canonical path: /snap/v1.0/transfer-va/inquiry

import { NextRequest, NextResponse } from 'next/server'
import { loadBriConfig, BRI_VA_INQUIRY_CODES, extractBrivaHeaders, handleBrivaInquiry } from '@/lib/finance/bri'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const config = loadBriConfig()

  if (config.env === 'production') {
    return NextResponse.json(
      {
        responseCode: BRI_VA_INQUIRY_CODES.BILL_NOT_FOUND,
        responseMessage: 'Route disabled in production. Use canonical SNAP BI path: /snap/v1.0/transfer-va/inquiry',
      },
      { status: 404 }
    )
  }

  const rawBody = await req.text()
  const headers = extractBrivaHeaders(req.headers)
  const endpointPath = req.nextUrl.pathname

  const result = await handleBrivaInquiry({
    rawBody,
    headers,
    endpointPath,
    method: 'POST',
    configOverride: config,
  })

  return NextResponse.json(result.body, { status: result.status })
}
