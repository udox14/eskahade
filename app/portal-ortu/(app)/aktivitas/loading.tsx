import { Sk, SkCard, SkPage } from '../../_components/skeleton'

export default function AktivitasLoading() {
  return (
    <SkPage title="Aktivitas" gap="space-y-5">
      {/* Segmen Kehadiran / Pelanggaran */}
      <div aria-hidden className="flex gap-1 rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 p-1">
        <div className="h-[42px] flex-1 rounded-xl bg-white dark:bg-slate-800" />
        <div className="h-[42px] flex-1" />
      </div>

      {/* Mode 7 hari / bulan */}
      <div className="flex gap-2">
        <Sk className="h-8 w-28 rounded-full" />
        <Sk className="h-8 w-24 rounded-full bg-slate-100 dark:bg-slate-800/70" />
      </div>

      {/* Kartu ringkasan kehadiran */}
      <div aria-hidden className="rounded-[22px] bg-[#064e3b]/90 p-5 space-y-3">
        <Sk className="h-3 w-28 bg-white/25" />
        <Sk className="h-8 w-20 bg-white/25" />
        <Sk className="h-3 w-48 bg-white/15" />
      </div>

      {/* Kotak ringkasan */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(i => (
          <SkCard key={i} className="!rounded-2xl p-3 space-y-2">
            <Sk className="mx-auto h-5 w-6" />
            <Sk className="mx-auto h-2.5 w-9 bg-slate-100 dark:bg-slate-800/70" />
          </SkCard>
        ))}
      </div>

      {/* Kalender */}
      <SkCard className="p-4 space-y-3">
        <Sk className="h-4 w-32" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <Sk key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          ))}
        </div>
      </SkCard>
    </SkPage>
  )
}
