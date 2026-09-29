import Link from 'next/link'
import { CalendarX, CaretLeft, CaretRight, Clock } from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getRekapAbsensiAnak } from '@/lib/portal/data'
import { formatTanggalId, namaBulanId } from '@/lib/portal/format'
import { toWibDateInputValue } from '@/lib/date/wib'

export const dynamic = 'force-dynamic'

const SESI_LABEL = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' } as const
const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  A: { label: 'Alfa', cls: 'bg-rose-100 text-rose-800' },
  S: { label: 'Sakit', cls: 'bg-slate-100 text-slate-700' },
  I: { label: 'Izin', cls: 'bg-amber-100 text-amber-800' },
}

function parseBulanParam(value: string | undefined) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (m) return { tahun: Number(m[1]), bulan: Math.min(12, Math.max(1, Number(m[2]))) }
  const [y, mo] = toWibDateInputValue().split('-').map(Number)
  return { tahun: y, bulan: mo }
}

function shiftBulan(tahun: number, bulan: number, delta: number) {
  const d = new Date(Date.UTC(tahun, bulan - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default async function AbsensiPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>
}) {
  const session = await requirePortalSessionStrict()
  const { bulan: bulanParam } = await searchParams
  const { tahun, bulan } = parseBulanParam(bulanParam)

  const start = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const end = `${tahun}-${String(bulan).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const rekap = await getRekapAbsensiAnak(session.santri_id, start, end)
  const persen = rekap.totalSesi > 0 ? Math.round((rekap.hadir / rekap.totalSesi) * 100) : 0

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <div>
        <Link
          href="/portal-ortu/aktivitas"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition mb-2"
        >
          &larr; Kembali ke Aktivitas
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">Kehadiran Pengajian</h1>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <Link
              href={`/portal-ortu/absensi?bulan=${shiftBulan(tahun, bulan, -1)}`}
              className="p-1 rounded-lg hover:bg-slate-100 active:scale-95 transition"
              aria-label="Bulan sebelumnya"
            >
              <CaretLeft className="w-4 h-4" />
            </Link>
            <span>{namaBulanId(bulan)} {tahun}</span>
            <Link
              href={`/portal-ortu/absensi?bulan=${shiftBulan(tahun, bulan, 1)}`}
              className="p-1 rounded-lg hover:bg-slate-100 active:scale-95 transition"
              aria-label="Bulan berikutnya"
            >
              <CaretRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {rekap.namaKelas ? `Kelas ${rekap.namaKelas} • 3 sesi per hari (Shubuh, Ashar, Maghrib)` : '3 sesi per hari'}
        </p>
      </div>

      {/* Info data */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <span>Data kehadiran disinkronisasi setiap Selasa malam oleh tim akademik.</span>
      </div>

      {/* Summary surface */}
      <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#bef264]">Persentase Kehadiran</p>
            <p className="mt-1 text-3xl font-black font-mono leading-none text-white">
              {rekap.totalSesi > 0 ? `${persen}%` : '—'}
            </p>
          </div>
          <p className="text-xs text-emerald-200 font-medium">
            {rekap.hadir} dari {rekap.totalSesi} sesi aktif
          </p>
        </div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#bef264] transition-all duration-500"
            style={{ width: `${persen}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          {[
            { label: 'Hadir', value: rekap.hadir, cls: 'text-emerald-300' },
            { label: 'Sakit', value: rekap.sakit, cls: 'text-white' },
            { label: 'Izin', value: rekap.izin, cls: 'text-amber-300' },
            { label: 'Alfa', value: rekap.alfa, cls: 'text-rose-300' },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-white/10 py-2">
              <p className={`text-base font-black font-mono leading-none ${item.cls}`}>{item.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100/70">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail hari bermasalah (Flat list) */}
      <div className="space-y-2 pt-1">
        <h2 className="text-sm font-bold text-slate-900">
          Catatan Ketidakhadiran
        </h2>
        {!rekap.punyaKelas ? (
          <div className="flex items-center gap-2.5 py-4 text-xs text-slate-500">
            <CalendarX className="w-4 h-4 text-slate-600" />
            <span>Data kelas aktif belum ditemukan untuk santri ini.</span>
          </div>
        ) : rekap.detail.length === 0 ? (
          <div className="flex items-center gap-2.5 py-4 text-xs text-emerald-800">
            <CalendarX className="w-4 h-4 text-emerald-600" />
            <span>Alhamdulillah, tidak ada catatan sakit/izin/alfa pada bulan ini.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rekap.detail.map(row => (
              <div
                key={row.tanggal}
                className="py-3 flex items-center justify-between"
              >
                <p className="text-sm font-semibold text-slate-900">{formatTanggalId(row.tanggal)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['shubuh', 'ashar', 'maghrib'] as const).map(sesi => {
                    const status = row[sesi]
                    if (!status || !STATUS_STYLE[status]) return null
                    const style = STATUS_STYLE[status]
                    return (
                      <span
                        key={sesi}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${style.cls}`}
                      >
                        {SESI_LABEL[sesi]}: {style.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
