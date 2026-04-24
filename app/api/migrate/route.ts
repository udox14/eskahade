import { execute } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await execute('ALTER TABLE ehb_event ADD COLUMN tanggal_mulai TEXT')
    await execute('ALTER TABLE ehb_event ADD COLUMN tanggal_selesai TEXT')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
