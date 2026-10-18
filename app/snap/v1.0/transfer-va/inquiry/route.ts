// app/snap/v1.0/transfer-va/inquiry/route.ts
// Official Canonical SNAP BI BRIVA Inquiry Inbound Route
// Path: /snap/v1.0/transfer-va/inquiry

import { NextRequest, NextResponse } from 'next/server'
import { BRI_VA_INQUIRY_CODES, extractBrivaHeaders, handleBrivaInquiry } from '@/lib/finance/bri'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
  const rawBody = await req.text()
  const headers = extractBrivaHeaders(req.headers)
  const endpointPath = req.nextUrl.pathname

  const result = await handleBrivaInquiry({
    rawBody,
    headers,
    endpointPath,
    method: 'POST',
  })

  return NextResponse.json(result.body, { status: result.status })

  } catch {
    return NextResponse.json({responseCode:BRI_VA_INQUIRY_CODES.GENERAL_ERROR,responseMessage:'General Error'},{status:500,headers:{'Cache-Control':'no-store'}})
  }
}
