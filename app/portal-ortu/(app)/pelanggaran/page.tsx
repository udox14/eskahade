import Link from 'next/link'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPelanggaranAnak } from '@/lib/portal/data'
import { formatTanggalId } from '@/lib/portal/format'

export const dynamic = 'force-dynamic'

const JENIS_STYLE: Record<string, string> = {
  RINGAN: 'bg-amber-100 text-amber-800',
  SEDANG: 'bg-orange-100 text-orange-800',
  BERAT: 'bg-rose-100 text-rose-800',
}

export default async function PelanggaranPage() {
  const session = await requirePortalSessionStrict()
  const daftar = await getPelanggaranAnak(session.santri_id)
  const totalPoin = daftar.reduce((sum, p) => sum + p.poin, 0)

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <div>
        <Link
          href="/portal-ortu/aktivitas"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition mb-2"
        >
          &larr; Kembali ke Aktivitas
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-950">Catatan Kedisiplinan</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Catatan kedisiplinan dan pelanggaran dari bagian keamanan pesantren.
        </p>
      </div>

      {/* Summary surface */}
      <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#bef264]">Total Poin</p>
          <p className="mt-0.5 text-3xl font-black font-mono leading-none text-white">{totalPoin} Poin</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-emerald-200">Jumlah Catatan</p>
          <p className="text-lg font-bold font-mono text-white mt-0.5">{daftar.length} Catatan</p>
        </div>
      </div>

      {/* Flat List */}
      <div className="space-y-2 pt-1">
        <h2 className="text-sm font-bold text-slate-900">
          Daftar Catatan
        </h2>

        {daftar.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-xs text-emerald-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-950">Alhamdulillah, bersih!</p>
              <p className="text-slate-500">Tidak ada catatan pelanggaran yang tercatat untuk santri ini.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {daftar.map((item) => (
              <div key={item.id} className="py-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                      JENIS_STYLE[String(item.jenis).toUpperCase()] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.jenis}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatTanggalId(item.tanggal)}
                  </span>
                </div>
                {item.deskripsi && (
                  <p className="text-xs text-slate-700 leading-relaxed pt-0.5">{item.deskripsi}</p>
                )}
                <p className="text-xs font-bold text-rose-600 font-mono">+{item.poin} poin</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
