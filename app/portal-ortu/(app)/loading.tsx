export default function PortalLoading() {
  return (
    <div className="animate-pulse">
      <div className="bg-[var(--p-ink)] pl-7 pr-6 pt-10 pb-8 border-l-4 border-[var(--p-red)]">
        <div className="h-2.5 w-24 rounded-full bg-white/15" />
        <div className="mt-3 h-6 w-40 rounded-full bg-white/20" />
        <div className="mt-2 h-2.5 w-56 rounded-full bg-white/10" />
      </div>
      <div className="px-5 pt-5 space-y-4">
        <div className="portal-card p-5 space-y-3">
          <div className="h-3 w-28 rounded-full bg-[var(--p-line)]" />
          <div className="h-5 w-40 rounded-full bg-[var(--p-line)]" />
        </div>
        <div className="portal-card p-5 space-y-3">
          <div className="h-3 w-28 rounded-full bg-[var(--p-line)]" />
          <div className="h-5 w-32 rounded-full bg-[var(--p-line)]" />
        </div>
        <div className="portal-card p-5 space-y-3">
          <div className="h-3 w-24 rounded-full bg-[var(--p-line)]" />
          <div className="h-5 w-36 rounded-full bg-[var(--p-line)]" />
        </div>
      </div>
    </div>
  )
}
