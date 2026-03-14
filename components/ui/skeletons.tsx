// Reusable skeleton components untuk Suspense fallbacks

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-12 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex gap-4 px-5 py-3.5 bg-gray-50 border-b border-gray-200">
        {[...Array(cols)].map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4 border-b border-gray-100 last:border-0">
          <div className="h-4 bg-gray-100 rounded w-36" />
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-4 bg-gray-100 rounded flex-1" />
          <div className="h-4 bg-gray-100 rounded w-24" />
          <div className="h-6 bg-gray-200 rounded-full w-14" />
        </div>
      ))}
    </div>
  )
}

export function CardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between mb-3">
            <div className="space-y-1.5">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-14 bg-gray-200 rounded-full" />
          </div>
          <div className="h-3 w-full bg-gray-100 rounded mb-3" />
          <div className="flex gap-2">
            <div className="h-8 flex-1 bg-gray-100 rounded-lg" />
            <div className="h-8 flex-1 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardHeroSkeleton() {
  return (
    <div className="bg-slate-200 rounded-3xl p-8 md:p-10 animate-pulse h-44" />
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
        </div>
      </div>
      {/* Card info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex gap-6">
          <div className="w-24 h-24 bg-gray-200 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded w-full" />
        ))}
      </div>
    </div>
  )
}
