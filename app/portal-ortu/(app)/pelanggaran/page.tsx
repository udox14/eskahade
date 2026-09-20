import { ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPelanggaranAnak } from '@/lib/portal/data'
import { formatTanggalId } from '@/lib/portal/format'
import { PortalPageHeader } from '../../_components/page-header'

export const dynamic = 'force-dynamic'

const JENIS_STYLE: Record<string, string> = {
  RINGAN: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  SEDANG: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
  BERAT: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
}

export default async function PelanggaranPage() {
  const session = await requirePortalSessionStrict()
  const daftar = await getPelanggaranAnak(session.santri_id)
  const totalPoin = daftar.reduce((sum, p) => sum + p.poin, 0)

  return (
    <div>
      <PortalPageHeader
        kicker="Catatan Keamanan"
        title="Pelanggaran"
        subtitle="Catatan kedisiplinan dari bagian keamanan pesantren"
      >
        <div className="mt-3 flex items-center gap-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 shadow-2xs">
          <div>
            <p className="text-xl font-bold leading-none text-slate-900">{totalPoin}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Poin</p>
          </div>
          <div className="w-px h-7 bg-slate-200" />
          <div>
            <p className="text-xl font-bold leading-none text-slate-900">{daftar.length}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Catatan</p>
          </div>
        </div>
      </PortalPageHeader>

      <div className="px-4 pt-4 sm:px-5 pb-24 space-y-4">
        {daftar.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50/70 border border-emerald-200 px-4 py-4 shadow-xs">
            <ShieldCheck className="w-6 h-6 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Alhamdulillah, bersih!</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                Tidak ada catatan pelanggaran untuk santri ini.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {daftar.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                      JENIS_STYLE[String(item.jenis).toUpperCase()] || 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20'
                    }`}
                  >
                    {item.jenis}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatTanggalId(item.tanggal)}
                  </span>
                </div>
                {item.deskripsi && (
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700">{item.deskripsi}</p>
                )}
                <p className="mt-1.5 text-xs font-semibold text-rose-600">{item.poin} poin</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
