// app/api/finance/gateway/duitku/snap/va/payment/route.ts
// Endpoint Webhook Notifikasi Pembayaran Virtual Account Duitku SNAP BI
// Format: POST application/json
// Standar: Bank Indonesia SNAP (Standar Nasional Open API Pembayaran)

import { NextRequest, NextResponse } from 'next/server'
import { processSnapPaymentNotification } from '@/lib/finance/gateway/duitku-snap'
import type { SnapPaymentNotificationPayload } from '@/lib/finance/payment-types'

export async function POST(request: NextRequest) {
  try {
    const timestamp =
      request.headers.get('x-timestamp') ||
      request.headers.get('X-TIMESTAMP') ||
      ''
    const signature =
      request.headers.get('x-signature') ||
      request.headers.get('X-SIGNATURE') ||
      ''
    const partnerId =
      request.headers.get('x-partner-id') ||
      request.headers.get('X-PARTNER-ID') ||
      ''
    const externalId =
      request.headers.get('x-external-id') ||
      request.headers.get('X-EXTERNAL-ID') ||
      ''

    let payload: SnapPaymentNotificationPayload
    try {
      payload = (await request.json()) as SnapPaymentNotificationPayload
    } catch {
      return NextResponse.json(
        {
          responseCode: '4002500',
          responseMessage: 'Invalid JSON payload format.',
        },
        { status: 400 }
      )
    }

    const result = await processSnapPaymentNotification(
      payload,
      { timestamp, signature, partnerId, externalId },
      { endpointPath: '/v1.0/transfer-va/payment' }
    )

    return NextResponse.json(
      {
        responseCode: result.responseCode,
        responseMessage: result.responseMessage,
        virtualAccountData: result.virtualAccountData,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Match-Type': result.matchType,
          'X-Duplicate': String(result.isDuplicate),
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('Bad Signature') || message.includes('Signature SNAP')) {
      return NextResponse.json(
        {
          responseCode: '4017301',
          responseMessage: 'Unauthorized. Invalid Signature',
        },
        { status: 401 }
      )
    }

    if (message.includes('tidak ditemukan')) {
      return NextResponse.json(
        {
          responseCode: '4042512',
          responseMessage: message,
        },
        { status: 404 }
      )
    }

    if (message.includes('tidak lengkap') || message.includes('wajib ada')) {
      return NextResponse.json(
        {
          responseCode: '4002500',
          responseMessage: message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        responseCode: '5002500',
        responseMessage: `Internal Server Error: ${message}`,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      status: 'OK',
      protocol: 'SNAP BI Virtual Account Payment Notification',
      path: '/api/finance/gateway/duitku/snap/va/payment',
    },
    { status: 200 }
  )
}
