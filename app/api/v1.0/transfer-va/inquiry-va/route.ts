// app/api/v1.0/transfer-va/inquiry-va/route.ts
// Standard BI SNAP API Route: POST /v1.0/transfer-va/inquiry-va

import { NextRequest, NextResponse } from 'next/server'
import { POST as handleSnapInquiry, GET as handleSnapGet } from '@/app/api/finance/gateway/duitku/snap/va/inquiry/route'

export async function POST(request: NextRequest) {
  return handleSnapInquiry(request)
}

export async function GET() {
  return handleSnapGet()
}
