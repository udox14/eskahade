// app/api/v1.0/transfer-va/inquiry/route.ts
// Root SNAP BI BRIVA Inquiry Inbound Route Alias (Non-Canonical)
// In production, strictly fail-closed: only canonical path /api/bri/v1.0/transfer-va/inquiry is exposed.

import { NextRequest, NextResponse } from 'next/server'
import { extractBrivaHeaders, handleBrivaInquiry, loadBriConfig, BRI_VA_INQUIRY_CODES } from '@/lib/finance/bri'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const config = loadBriConfig()

  // In production, non-canonical alias paths are strictly disabled
  if (config.env === 'production') {
    return NextResponse.json(
      {
        responseCode: BRI_VA_INQUIRY_CODES.BILL_NOT_FOUND,
        responseMessage: 'Route not available in production. Use canonical callback URL.',
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
