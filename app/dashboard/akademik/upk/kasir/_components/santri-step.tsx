'use client'

import { cn } from '@/lib/utils'
import { ArrowRight, Loader2, Search, User, UserCheck } from 'lucide-react'
import type { SantriOption } from './types'

export function SantriStep({
  search,
  onSearchChange,
  onSearch,
  loading,
  results,
  selected,
  onPick,
  onReset,
  onNext,
  showNext,
}: {
  search: string
  onSearchChange: (v: string) => void
  onSearch: () => void
  loading: boolean
  results: SantriOption[]
  selected: SantriOption | null
  onPick: (s: SantriOption) => void
  onReset: () => void
  onNext: () => void
  showNext: boolean
}) {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-4 w-4 text-green-700" />
        <h2 className="text-sm font-bold text-slate-800">Pilih Santri</h2>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
              <UserCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-green-900">{selected.nama_lengkap}</p>
              <p className="text-xs text-green-700">{selected.nis}</p>
              <p className="mt-0.5 text-xs text-green-700">
                {selected.nama_kelas || '-'} · {selected.marhalah_nama || 'Tanpa marhalah'}
              </p>
            </div>
          </div>
          <button onClick={onReset} className="mt-3 text-xs font-bold text-green-700 underline-offset-2 hover:underline">
            Ganti santri
          </button>
          {showNext && (
            <button
              onClick={onNext}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-bold text-white transition active:scale-[0.98] hover:bg-green-800"
            >
              Lanjut Pilih Kitab <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="Nama atau NIS santri"
                inputMode="search"
              />
            </div>
            <button
              onClick={onSearch}
              className="rounded-xl bg-green-700 px-4 font-bold text-white transition active:scale-[0.98] hover:bg-green-800"
            >
              Cari
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                Cari santri untuk memulai.
              </div>
            )}
            {results.map((s) => (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition active:scale-[0.99] hover:border-green-300 hover:bg-green-50/40'
                )}
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <User className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{s.nama_lengkap}</p>
                  <p className="truncate text-xs text-slate-500">
                    {s.nis} · {s.nama_kelas || '-'} · {s.marhalah_nama || '-'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
