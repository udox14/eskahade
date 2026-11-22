import { Sk, SkCard, SkPage } from '../../_components/skeleton'

export default function AbsensiLoading() {
  return (
    <SkPage title="Kehadiran Pengajian" gap="space-y-5">
      <SkCard className="p-5 space-y-3">
        <Sk className="h-3 w-28" />
        <Sk className="h-8 w-24" />
        <Sk className="h-3 w-52 bg-slate-100 dark:bg-slate-800/70" />
      </SkCard>
      <SkCard className="p-4 space-y-3">
        <Sk className="h-4 w-32" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 21 }).map((_, i) => (
            <Sk key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          ))}
        </div>
      </SkCard>
    </SkPage>
  )
}
