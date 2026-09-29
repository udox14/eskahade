import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPelanggaranAnak, getRekapAbsensiAnak } from '@/lib/portal/data'
import { toWibDateInputValue } from '@/lib/date/wib'
import { AktivitasClient } from './_aktivitas-client'

export const dynamic = 'force-dynamic'

function parseBulanParam(value: string | undefined) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (m) return { tahun: Number(m[1]), bulan: Math.min(12, Math.max(1, Number(m[2]))) }
  const [y, mo] = toWibDateInputValue().split('-').map(Number)
  return { tahun: y, bulan: mo }
}

export default async function AktivitasPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>
}) {
  const session = await requirePortalSessionStrict()
  const { bulan: bulanParam } = await searchParams
  const { tahun, bulan } = parseBulanParam(bulanParam)

  const todayStr = toWibDateInputValue()
  const start = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const end = `${tahun}-${String(bulan).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // 7 hari terakhir
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 6)
  const weekStart = d.toISOString().slice(0, 10)

  const [rekapBulan, rekap7Hari, pelanggaran] = await Promise.all([
    getRekapAbsensiAnak(session.santri_id, start, end),
    getRekapAbsensiAnak(session.santri_id, weekStart, todayStr),
    getPelanggaranAnak(session.santri_id),
  ])

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950">Aktivitas</h1>
      </div>

      <AktivitasClient
        rekapBulan={rekapBulan}
        rekap7Hari={rekap7Hari}
        pelanggaran={pelanggaran}
        currentYear={tahun}
        currentMonth={bulan}
        todayStr={todayStr}
      />
    </div>
  )
}
