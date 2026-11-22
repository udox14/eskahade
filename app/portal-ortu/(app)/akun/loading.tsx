import { Sk, SkCard, SkPage, SkRow } from '../../_components/skeleton'

export default function AkunLoading() {
  return (
    <SkPage title="Akun" gap="space-y-5">
      {/* Profil santri */}
      <SkCard className="p-5 flex items-center gap-4">
        <Sk className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Sk className="h-4 w-3/4" />
          <Sk className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800/70" />
          <Sk className="h-3 w-2/5 bg-slate-100 dark:bg-slate-800/70" />
        </div>
      </SkCard>

      {/* Batas uang jajan */}
      <div className="space-y-2">
        <Sk className="h-4 w-36" />
        <SkCard className="p-5 space-y-3">
          <Sk className="h-3 w-40" />
          <Sk className="h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          <Sk className="h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800/70" />
        </SkCard>
      </div>

      {/* Pengaturan */}
      <SkCard className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        <SkRow right={false} />
        <SkRow right={false} />
        <SkRow right={false} />
      </SkCard>
    </SkPage>
  )
}
