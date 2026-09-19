// app/api/v1.0/transfer-va/payment/route.ts
// Standard BI SNAP API Route: POST /v1.0/transfer-va/payment
// Meneruskan langsung ke logika proses notifikasi pembayaran SNAP Virtual Account

import { NextRequest, NextResponse } from 'next/server'
import { POST as handleSnapPayment, GET as handleSnapGet } from '@/app/api/finance/gateway/duitku/snap/va/payment/route'

export async function POST(request: NextRequest) {
  return handleSnapPayment(request)
}

export async function GET() {
  return handleSnapGet()
}
