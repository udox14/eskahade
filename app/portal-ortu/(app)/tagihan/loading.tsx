import { Sk, SkCard, SkPage, SkRow } from '../../_components/skeleton'

export default function TagihanLoading() {
  return (
    <SkPage title="Tagihan">
      {/* Hero total belum dibayar */}
      <SkCard className="overflow-hidden">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Sk className="h-3 w-32" />
            <Sk className="h-7 w-24 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
          </div>
          <Sk className="h-8 w-44" />
          <Sk className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/70" />
          <Sk className="h-3 w-56 bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="h-11 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40" />
      </SkCard>

      {/* Tunggakan */}
      <div className="space-y-2 pt-2">
        <Sk className="h-5 w-28" />
        <SkCard className="divide-y divide-slate-100 dark:divide-slate-800">
          <SkRow />
          <SkRow />
        </SkCard>
      </div>

      {/* Tagihan bulan ini */}
      <div className="space-y-2 pt-2">
        <Sk className="h-5 w-40" />
        <SkCard>
          <SkRow />
        </SkCard>
      </div>

      {/* Pembayaran lainnya */}
      <div className="space-y-2 pt-2">
        <Sk className="h-5 w-44" />
        <SkCard>
          <SkRow right={false} />
        </SkCard>
        <SkCard>
          <SkRow right={false} />
        </SkCard>
      </div>
    </SkPage>
  )
}
