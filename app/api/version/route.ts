import { NextResponse } from 'next/server'

// Build ID di-inject saat build via next.config atau env
// Fallback ke timestamp server start (cukup untuk deteksi deploy baru)
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || process.env.BUILD_TIMESTAMP || String(Date.now())

export const runtime = 'edge'
export const revalidate = 0  // tidak di-cache

export function GET() {
  return NextResponse.json(
    { version: BUILD_ID },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    }
  )
}
