import { ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPelanggaranAnak } from '@/lib/portal/data'
import { formatTanggalId } from '@/lib/portal/format'
import { PortalPageHeader } from '../../_components/page-header'

export const dynamic = 'force-dynamic'

const JENIS_STYLE: Record<string, string> = {
  RINGAN: 'portal-badge-warning',
  SEDANG: 'bg-orange-100 text-orange-700 border-orange-200',
  BERAT: 'portal-badge-danger',
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
        <div className="mt-5 flex items-center gap-4 rounded-[var(--p-radius-md)] bg-white/10 border border-white/15 px-4 py-3">
          <div>
            <p className="portal-display text-2xl leading-none text-white">{totalPoin}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/60">Total Poin</p>
          </div>
          <div className="w-px h-8 bg-white/15" />
          <div>
            <p className="portal-display text-2xl leading-none text-white">{daftar.length}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/60">Catatan</p>
          </div>
        </div>
      </PortalPageHeader>

      <div className="px-5 -mt-9">
        {daftar.length === 0 ? (
          <div className="portal-rise portal-rise-1 flex items-center gap-3 rounded-[var(--p-radius-lg)] bg-[var(--p-success-soft)] border border-[#cde3d4] px-5 py-6">
            <ShieldCheck className="w-6 h-6 shrink-0 text-[var(--p-success)]" />
            <div>
              <p className="text-sm font-bold text-[var(--p-success)]">Alhamdulillah, bersih!</p>
              <p className="mt-0.5 text-xs text-[var(--p-success)]">
                Tidak ada catatan pelanggaran untuk putra Anda.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {daftar.map((item, index) => (
              <div
                key={item.id}
                className={`portal-rise ${index < 4 ? `portal-rise-${index + 1}` : ''} portal-card px-4 py-3.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`portal-badge ${
                      JENIS_STYLE[String(item.jenis).toUpperCase()] || 'portal-badge-neutral'
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
                <p className="mt-1.5 text-[11px] font-bold text-[var(--p-red)]">{item.poin} poin</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
