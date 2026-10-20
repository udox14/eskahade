import { NextResponse } from 'next/server'

/** Destructive reset is retired in both environments; preserve financial history. */
export async function POST() {
  return NextResponse.json(
    { error: 'Reset data demo dinonaktifkan. Gunakan prosedur pemulihan oleh operator.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
