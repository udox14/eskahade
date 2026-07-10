import { ShieldCheck } from 'lucide-react'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPelanggaranAnak } from '@/lib/portal/data'
import { formatTanggalId } from '@/lib/portal/format'
import { PortalPageHeader } from '../../_components/page-header'

export const dynamic = 'force-dynamic'

const JENIS_STYLE: Record<string, string> = {
  RINGAN: 'bg-amber-100 text-amber-700 border-amber-200',
  SEDANG: 'bg-orange-100 text-orange-700 border-orange-200',
  BERAT: 'bg-rose-100 text-rose-700 border-rose-200',
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
        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
          <div>
            <p className="portal-display text-2xl leading-none text-white">{totalPoin}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/80">Total Poin</p>
          </div>
          <div className="w-px h-8 bg-white/15" />
          <div>
            <p className="portal-display text-2xl leading-none text-white">{daftar.length}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/80">Catatan</p>
          </div>
        </div>
      </PortalPageHeader>

      <div className="px-5 -mt-9">
        {daftar.length === 0 ? (
          <div className="portal-rise portal-rise-1 flex items-center gap-3 rounded-3xl bg-emerald-50 border border-emerald-200 px-5 py-6 shadow-sm">
            <ShieldCheck className="w-6 h-6 shrink-0 text-[var(--p-emerald)]" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Alhamdulillah, bersih!</p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Tidak ada catatan pelanggaran untuk putra Anda.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {daftar.map((item, index) => (
              <div
                key={item.id}
                className={`portal-rise ${index < 4 ? `portal-rise-${index + 1}` : ''} rounded-2xl bg-[var(--p-card)] border border-[var(--p-line)] px-4 py-3.5 shadow-sm`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      JENIS_STYLE[String(item.jenis).toUpperCase()] || 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {item.jenis}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--p-muted)]">
                    {formatTanggalId(item.tanggal)}
                  </span>
                </div>
                {item.deskripsi && (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--p-ink)]">{item.deskripsi}</p>
                )}
                <p className="mt-1.5 text-[11px] font-bold text-[var(--p-gold)]">{item.poin} poin</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
