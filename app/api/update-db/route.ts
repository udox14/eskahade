import { execute } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    await execute("UPDATE fitur_akses SET title = 'Ruangan EHB' WHERE href = '/dashboard/ehb/ruangan'")
    await execute("UPDATE fitur_akses SET title = 'Jadwal' WHERE href = '/dashboard/ehb/jadwal'")
    await execute("UPDATE fitur_akses SET title = 'Pengawas' WHERE href = '/dashboard/ehb/pengawas'")
    await execute("DELETE FROM fitur_akses WHERE href = '/dashboard/ehb/ruangan/plotting'")
    await execute("DELETE FROM fitur_akses WHERE href = '/dashboard/ehb/pengawas/plotting'")
    return NextResponse.json({ success: true })
}
