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
  A: { label: 'Alfa', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  S: { label: 'Sakit', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  I: { label: 'Izin', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
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
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 border border-white/15 px-2 py-2">
          <Link
            href={`/portal-ortu/absensi?bulan=${shiftBulan(tahun, bulan, -1)}`}
            className="p-2 rounded-xl active:bg-white/10"
            aria-label="Bulan sebelumnya"
          >
            <CaretLeft className="w-4 h-4 text-white" />
          </Link>
          <p className="text-sm font-bold text-white">{namaBulanId(bulan)} {tahun}</p>
          <Link
            href={`/portal-ortu/absensi?bulan=${shiftBulan(tahun, bulan, 1)}`}
            className="p-2 rounded-xl active:bg-white/10"
            aria-label="Bulan berikutnya"
          >
            <CaretRight className="w-4 h-4 text-white" />
          </Link>
        </div>
      </PortalPageHeader>

      <div className="px-5 -mt-9 space-y-4">
        {/* Banner Keterangan Update Data */}
        <div className="portal-rise flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 px-4 py-3 text-xs text-amber-900 shadow-sm">
          <Clock className="w-4 h-4 shrink-0 text-amber-600" />
          <p className="font-semibold text-amber-800 leading-normal">
            <span className="font-bold">Informasi Data:</span> Data kehadiran diperbarui setiap <span className="font-extrabold text-amber-950 underline decoration-amber-400">Selasa malam</span> (tidak real-time).
          </p>
        </div>

        {/* Kartu rekap */}
        <div className="portal-rise portal-rise-1 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-[0_18px_40px_-18px_rgba(11,94,63,0.3)]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--p-muted)]">Kehadiran</p>
              <p className="portal-display mt-1 text-3xl leading-none text-[var(--p-emerald-deep)]">
                {rekap.totalSesi > 0 ? `${persen}%` : '—'}
              </p>
            </div>
            <p className="text-xs font-semibold text-[var(--p-muted)]">
              {rekap.hadir} dari {rekap.totalSesi} sesi aktif
            </p>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-[var(--p-cream)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--p-emerald)] transition-all"
              style={{ width: `${persen}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Hadir', value: rekap.hadir, cls: 'text-[var(--p-emerald)]' },
              { label: 'Sakit', value: rekap.sakit, cls: 'text-sky-600' },
              { label: 'Izin', value: rekap.izin, cls: 'text-amber-600' },
              { label: 'Alfa', value: rekap.alfa, cls: 'text-rose-600' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl bg-[var(--p-cream)] py-2.5">
                <p className={`portal-display text-lg leading-none ${item.cls}`}>{item.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail hari bermasalah */}
        <div className="portal-rise portal-rise-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--p-muted)]">
            Catatan Ketidakhadiran
          </h2>
          {!rekap.punyaKelas ? (
            <EmptyNote text="Data kelas aktif belum ditemukan untuk santri ini." />
          ) : rekap.detail.length === 0 ? (
            <EmptyNote text="Alhamdulillah, tidak ada catatan sakit/izin/alfa pada bulan ini." positive />
          ) : (
            <div className="mt-2 space-y-2.5">
              {rekap.detail.map(row => (
                <div
                  key={row.tanggal}
                  className="rounded-2xl bg-[var(--p-card)] border border-[var(--p-line)] px-4 py-3.5 shadow-sm"
                >
                  <p className="text-sm font-bold text-[var(--p-ink)]">{formatTanggalId(row.tanggal)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(['shubuh', 'ashar', 'maghrib'] as const).map(sesi => {
                      const status = row[sesi]
                      if (!status || !STATUS_STYLE[status]) return null
                      const style = STATUS_STYLE[status]
                      return (
                        <span
                          key={sesi}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${style.cls}`}
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
      className={`mt-2 flex items-center gap-2.5 rounded-2xl border px-4 py-4 ${
        positive ? 'bg-emerald-50 border-emerald-200' : 'bg-[var(--p-card)] border-[var(--p-line)]'
      }`}
    >
      <CalendarX className={`w-4 h-4 ${positive ? 'text-[var(--p-emerald)]' : 'text-[var(--p-muted)]'}`} />
      <p className={`text-xs font-semibold ${positive ? 'text-emerald-800' : 'text-[var(--p-muted)]'}`}>{text}</p>
    </div>
  )
}
