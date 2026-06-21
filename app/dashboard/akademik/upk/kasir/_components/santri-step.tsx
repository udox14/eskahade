'use client'

import { ArrowRight, Loader2, Search, User } from 'lucide-react'
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
        <User className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-bold text-slate-800">Santri</h2>
      </div>

      {selected ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="font-bold text-blue-900">{selected.nama_lengkap}</p>
          <p className="text-xs text-blue-700">
            {selected.nis} - {selected.nama_kelas || '-'} - {selected.marhalah_nama || '-'}
          </p>
          <button onClick={onReset} className="mt-3 text-xs font-bold text-blue-700">
            Ganti santri
          </button>
          {showNext && (
            <button
              onClick={onNext}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-bold text-white transition hover:bg-blue-700"
            >
              Lanjut Pilih Kitab <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nama / NIS"
              inputMode="search"
            />
          </div>
          <button
            onClick={onSearch}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Cari Santri
          </button>

          <div className="mt-3 max-h-[360px] flex-1 divide-y overflow-y-auto overflow-hidden rounded-lg border">
            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">Cari santri untuk memulai.</div>
            )}
            {results.map((s) => (
              <button key={s.id} onClick={() => onPick(s)} className="w-full p-3 text-left hover:bg-slate-50">
                <p className="text-sm font-bold text-slate-800">{s.nama_lengkap}</p>
                <p className="text-xs text-slate-500">
                  {s.nis} - {s.nama_kelas || '-'} - {s.marhalah_nama || '-'}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
