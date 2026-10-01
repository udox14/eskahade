
import { incidentLabel, sessionLabel } from '@/lib/discipline/format'
import Link from 'next/link'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPelanggaranAnak, getTotalPelanggaranAnak } from '@/lib/portal/data'
import { formatTanggalId } from '@/lib/portal/format'

export const dynamic = 'force-dynamic'

const JENIS_STYLE: Record<string, string> = {
  RINGAN: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
  SEDANG: 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300',
  BERAT: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
}

export default async function PelanggaranPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const params=await searchParams
  const page=Math.min(100000,Math.max(1,Number(params.page)||1))
  const session = await requirePortalSessionStrict()
  const [daftar,disiplin]=await Promise.all([getPelanggaranAnak(session.santri_id,page),getTotalPelanggaranAnak(session.santri_id)])

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <div>
        <Link
          href="/portal-ortu/aktivitas"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition mb-2"
        >
          &larr; Kembali ke Aktivitas
        </Link>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Catatan Kedisiplinan</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Catatan kedisiplinan dan pelanggaran dari keamanan dan pengajian pesantren.
        </p>
      </div>

      {/* Summary surface */}
      <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#bef264]">Jumlah Kejadian</p>
          <p className="mt-0.5 text-3xl font-black font-mono leading-none text-white">{disiplin.jumlah}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-emerald-200">Perlu Verifikasi</p>
          <p className="text-lg font-bold font-mono text-white mt-0.5">{disiplin.pending} catatan</p>
        </div>
      </div>

      {disiplin.pending>0&&<p className="text-xs text-amber-700">Jumlah di atas adalah kejadian terkonfirmasi. {disiplin.pending} catatan masih perlu verifikasi.</p>}
      <nav className="flex justify-between text-sm">{page>1&&<Link href={`?page=${page-1}`}>Sebelumnya</Link>}<span>Halaman {page}</span>{page*200<disiplin.catatan&&<Link href={`?page=${page+1}`}>Berikutnya</Link>}</nav>
      {/* Flat List */}
      <div className="space-y-2 pt-1">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Daftar Catatan
        </h2>

        {daftar.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-xs text-emerald-800 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-950 dark:text-emerald-200">Alhamdulillah, bersih!</p>
              <p className="text-slate-500 dark:text-slate-400">Tidak ada catatan pelanggaran yang tercatat untuk santri ini.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {daftar.map((item) => (
              <div key={item.id} className="py-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                      JENIS_STYLE[String(item.jenis).toUpperCase()] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {incidentLabel(item.jenis)}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {formatTanggalId(item.tanggal)}
                  </span>
                </div>
                {item.deskripsi && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">{item.deskripsi}</p>
                )}
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">{item.source==='pengajian'?'Pengajian':'Umum'}{item.sesi&&` · ${sessionLabel(item.sesi,item.jenis,item.source)}`} · {item.perlu_verifikasi?'Perlu verifikasi':'1 kejadian'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
