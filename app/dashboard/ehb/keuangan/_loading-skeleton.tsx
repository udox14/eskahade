import { Wallet } from 'lucide-react'

export default function KeuanganLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6 animate-pulse">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-3">
            <Wallet className="w-3.5 h-3.5" /> Keuangan EHB
          </div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-80 bg-slate-100 rounded mt-3" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(item => (
            <div key={item} className="bg-white border rounded-xl px-4 py-3 w-32">
              <div className="h-3 w-14 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-200 rounded mt-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-1 flex flex-wrap gap-1 w-fit">
        {[1, 2, 3].map(item => (
          <div key={item} className="h-9 w-32 rounded-xl bg-slate-100" />
        ))}
      </div>

      <div className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-4 w-64 bg-slate-100 rounded mt-2" />
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(item => (
            <div key={item} className="h-11 bg-slate-50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

