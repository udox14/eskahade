'use client'

import { cn } from '@/lib/utils'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { nomorAntrian, rupiah, type Antrian } from './types'

export function AntrianList({
  search,
  onSearchChange,
  onSearch,
  list,
  selectedId,
  onPick,
  loading,
}: {
  search: string
  onSearchChange: (v: string) => void
  onSearch: () => void
  list: Antrian[]
  selectedId: string | null
  onPick: (id: string) => void
  loading: boolean
}) {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">Antrian Hari Ini</h2>
        <button onClick={onSearch} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 active:scale-90">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
          placeholder="Nomor / nama / NIS"
          inputMode="search"
        />
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            Belum ada antrian.
          </div>
        )}
        {list.map((a) => (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            className={cn(
              'w-full rounded-2xl border bg-white p-3 text-left transition active:scale-[0.99]',
              selectedId === a.id ? 'border-green-400 bg-green-50 ring-1 ring-green-200' : 'border-slate-200 hover:border-green-300'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg font-extrabold tabular-nums text-white">
                {nomorAntrian(a.nomor)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{a.nama_santri}</p>
                <p className="truncate text-xs text-slate-500">
                  {a.nis || '-'} · {a.marhalah_nama || '-'}
                </p>
              </div>
              <span className="flex-shrink-0 text-sm font-bold tabular-nums text-green-700">{rupiah(a.total_tagihan)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
