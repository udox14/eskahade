export default function CentralFinanceLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm font-semibold text-slate-700">Memuat Sistem Keuangan Baru...</p>
      <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-100" aria-hidden="true" />
    </div>
  )
}
