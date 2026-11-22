import { Sk, SkCard, SkPage, SkRow } from '../../_components/skeleton'

export default function RiwayatLoading() {
  return (
    <SkPage title="Riwayat">
      {/* Tab filter */}
      <div aria-hidden className="flex gap-1 rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 p-1">
        <div className="h-[38px] flex-1 rounded-xl bg-white dark:bg-slate-800" />
        <div className="h-[38px] flex-1" />
        <div className="h-[38px] flex-1" />
      </div>

      {[3, 4].map((rows, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-baseline justify-between px-1 pt-2">
            <Sk className="h-4 w-28" />
            <Sk className="h-3 w-16 bg-slate-100 dark:bg-slate-800/70" />
          </div>
          <SkCard className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {Array.from({ length: rows }).map((_, r) => (
              <SkRow key={r} />
            ))}
          </SkCard>
        </div>
      ))}
    </SkPage>
  )
}
