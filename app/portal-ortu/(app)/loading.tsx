export default function PortalLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white border-b border-slate-200/80 px-5 pt-6 pb-5 space-y-2.5">
        <div className="h-3 w-24 rounded-full bg-slate-200" />
        <div className="h-6 w-44 rounded-md bg-slate-200" />
        <div className="h-3.5 w-60 rounded-full bg-slate-100" />
      </div>

      {/* Card skeletons */}
      <div className="px-5 pt-5 space-y-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <div className="h-3.5 w-28 rounded-full bg-slate-200" />
          <div className="h-6 w-48 rounded-md bg-slate-200" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <div className="h-3.5 w-32 rounded-full bg-slate-200" />
          <div className="h-6 w-36 rounded-md bg-slate-200" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <div className="h-3.5 w-24 rounded-full bg-slate-200" />
          <div className="h-6 w-40 rounded-md bg-slate-200" />
        </div>
      </div>
    </div>
  )
}
