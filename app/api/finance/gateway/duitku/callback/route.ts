import { NextRequest, NextResponse } from 'next/server'
import { processDuitkuCallback } from '@/lib/finance/payments'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  let payload: Record<string, string> = {}
  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({})) as Record<string, unknown>
    payload = Object.fromEntries(Object.entries(json).map(([key, value]) => [key, String(value ?? '')]))
  } else {
    const form = await request.formData()
    payload = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  }
  const result = await processDuitkuCallback(payload)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ success: true })
}
