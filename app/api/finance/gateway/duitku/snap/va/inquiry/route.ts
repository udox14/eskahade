// app/api/finance/gateway/duitku/snap/va/inquiry/route.ts
// Endpoint Inquiry Virtual Account Duitku SNAP BI
// Format: POST application/json

import { NextRequest, NextResponse } from 'next/server'
import { processSnapVaInquiry } from '@/lib/finance/gateway/duitku-snap'

export async function POST(request: NextRequest) {
  try {
    let payload: {
      partnerServiceId?: string
      customerNo?: string
      virtualAccountNo?: string
      trxId?: string
    }

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        {
          responseCode: '4002400',
          responseMessage: 'Invalid JSON payload format.',
        },
        { status: 400 }
      )
    }

    const result = await processSnapVaInquiry(payload)
    const httpStatus = result.responseCode === '2002600' ? 200 : result.responseCode.startsWith('404') ? 404 : 400

    return NextResponse.json(result, { status: httpStatus })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown inquiry error'
    return NextResponse.json(
      {
        responseCode: '5002400',
        responseMessage: message,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      status: 'OK',
      protocol: 'SNAP BI Virtual Account Inquiry',
      path: '/api/finance/gateway/duitku/snap/va/inquiry',
    },
    { status: 200 }
  )
}
