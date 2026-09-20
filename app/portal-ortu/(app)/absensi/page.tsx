import Link from 'next/link'
import { CalendarX, CaretLeft, CaretRight, Clock } from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getRekapAbsensiAnak } from '@/lib/portal/data'
import { formatTanggalId, namaBulanId } from '@/lib/portal/format'
import { toWibDateInputValue } from '@/lib/date/wib'
import { PortalPageHeader } from '../../_components/page-header'

export const dynamic = 'force-dynamic'

const SESI_LABEL = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' } as const
const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  A: { label: 'Alfa', cls: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20' },
  S: { label: 'Sakit', cls: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/20' },
  I: { label: 'Izin', cls: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
}

// Default bulan (tanpa query ?bulan=) mengikuti WIB, bukan waktu server.
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
    <div>
      <PortalPageHeader
        kicker="Rekap Pengajian"
        title="Kehadiran Pengajian"
        subtitle={rekap.namaKelas ? `Kelas ${rekap.namaKelas} • 3 sesi per hari (Shubuh, Ashar, Maghrib)` : '3 sesi per hari (Shubuh, Ashar, Maghrib)'}
      >
        {/* Pemilih bulan */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 shadow-2xs">
          <Link
            href={`/portal-ortu/absensi?bulan=${shiftBulan(tahun, bulan, -1)}`}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition active:scale-95"
            aria-label="Bulan sebelumnya"
          >
            <CaretLeft className="w-4 h-4" />
          </Link>
          <p className="text-xs sm:text-sm font-semibold text-slate-800">{namaBulanId(bulan)} {tahun}</p>
          <Link
            href={`/portal-ortu/absensi?bulan=${shiftBulan(tahun, bulan, 1)}`}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition active:scale-95"
            aria-label="Bulan berikutnya"
          >
            <CaretRight className="w-4 h-4" />
          </Link>
        </div>
      </PortalPageHeader>

      <div className="px-4 pt-4 sm:px-5 pb-24 space-y-4">
        {/* Banner Keterangan Update Data */}
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 shadow-2xs">
          <Clock className="w-4 h-4 shrink-0 text-amber-600" />
          <p className="font-medium leading-normal">
            <span className="font-bold">Informasi Data:</span> Data kehadiran diperbarui setiap <span className="font-bold underline decoration-amber-400">Selasa malam</span> (tidak real-time).
          </p>
        </div>

        {/* Kartu rekap */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kehadiran</p>
              <p className="mt-1 text-3xl font-bold leading-none text-slate-900">
                {rekap.totalSesi > 0 ? `${persen}%` : '—'}
              </p>
            </div>
            <p className="text-xs font-medium text-slate-500">
              {rekap.hadir} dari {rekap.totalSesi} sesi aktif
            </p>
          </div>
          <div className="mt-3.5 h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${persen}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Hadir', value: rekap.hadir, cls: 'text-emerald-700' },
              { label: 'Sakit', value: rekap.sakit, cls: 'text-slate-600' },
              { label: 'Izin', value: rekap.izin, cls: 'text-amber-700' },
              { label: 'Alfa', value: rekap.alfa, cls: 'text-rose-700' },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-slate-50 border border-slate-100 py-2.5">
                <p className={`text-lg font-bold leading-none ${item.cls}`}>{item.value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail hari bermasalah */}
        <div className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Catatan Ketidakhadiran
          </h2>
          {!rekap.punyaKelas ? (
            <EmptyNote text="Data kelas aktif belum ditemukan untuk santri ini." />
          ) : rekap.detail.length === 0 ? (
            <EmptyNote text="Alhamdulillah, tidak ada catatan sakit/izin/alfa pada bulan ini." positive />
          ) : (
            <div className="space-y-2.5">
              {rekap.detail.map(row => (
                <div
                  key={row.tanggal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs"
                >
                  <p className="text-sm font-semibold text-slate-900">{formatTanggalId(row.tanggal)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(['shubuh', 'ashar', 'maghrib'] as const).map(sesi => {
                      const status = row[sesi]
                      if (!status || !STATUS_STYLE[status]) return null
                      const style = STATUS_STYLE[status]
                      return (
                        <span
                          key={sesi}
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${style.cls}`}
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
    </div>
  )
}

function EmptyNote({ text, positive }: { text: string; positive?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3.5 shadow-xs ${
        positive ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-500'
      }`}
    >
      <CalendarX className={`w-4 h-4 shrink-0 ${positive ? 'text-emerald-600' : 'text-slate-400'}`} />
      <p className="text-xs font-medium">{text}</p>
    </div>
  )
}
