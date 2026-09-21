export default function PortalLoading() {
  return (
    <div className="animate-pulse px-5 space-y-6 pt-5 pb-12">
      {/* Greeting skeleton */}
      <div className="flex items-center justify-between pb-1">
        <div className="space-y-1.5 flex-1 pr-3">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-4 w-40 rounded-md bg-slate-200" />
          <div className="h-3 w-32 rounded-full bg-slate-100" />
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
      </div>

      {/* Hero Surface skeleton */}
      <div className="h-36 rounded-[22px] bg-slate-200/80 p-5 space-y-3">
        <div className="h-3 w-28 rounded-full bg-slate-300/70" />
        <div className="h-8 w-48 rounded-lg bg-slate-300/70" />
        <div className="h-3 w-36 rounded-full bg-slate-300/50" />
      </div>

      {/* Quick Action 4-grid skeleton */}
      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-[76px] rounded-[18px] bg-slate-100 p-2 flex flex-col items-center justify-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-200/70" />
            <div className="h-2.5 w-10 rounded-full bg-slate-200/70" />
          </div>
        ))}
      </div>

      {/* Flat list skeleton */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center pb-1">
          <div className="h-4 w-28 rounded-md bg-slate-200" />
          <div className="h-3 w-16 rounded-full bg-slate-100" />
        </div>
        <div className="divide-y divide-slate-100">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100" />
              <div className="space-y-1">
                <div className="h-3.5 w-32 rounded-md bg-slate-200" />
                <div className="h-2.5 w-24 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="w-4 h-4 rounded-full bg-slate-100" />
          </div>
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100" />
              <div className="space-y-1">
                <div className="h-3.5 w-28 rounded-md bg-slate-200" />
                <div className="h-2.5 w-20 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="w-4 h-4 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>

      {/* Feature card skeleton */}
      <div className="h-32 rounded-[22px] bg-slate-100 p-5 space-y-2">
        <div className="h-3 w-20 rounded-full bg-slate-200" />
        <div className="h-6 w-36 rounded-md bg-slate-200" />
        <div className="h-3 w-28 rounded-full bg-slate-200/60" />
      </div>
    </div>
  )
}
