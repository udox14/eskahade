import { Sk, SkCard, SkPage, SkRow } from '../../_components/skeleton'

export default function PelanggaranLoading() {
  return (
    <SkPage title="Catatan Kedisiplinan" gap="space-y-5">
      <SkCard className="p-5 flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-3 w-28" />
          <Sk className="h-7 w-16" />
        </div>
        <Sk className="h-8 w-24 rounded-full" />
      </SkCard>
      <SkCard className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        <SkRow />
        <SkRow />
        <SkRow />
      </SkCard>
    </SkPage>
  )
}
