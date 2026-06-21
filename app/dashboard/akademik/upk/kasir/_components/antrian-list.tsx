'use client'

import { cn } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'
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
      <h2 className="mb-3 text-sm font-bold text-slate-800">Antrian Hari Ini</h2>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Nomor / nama / NIS"
          inputMode="search"
        />
        <button onClick={onSearch} className="rounded-lg bg-slate-100 px-3 hover:bg-slate-200">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 flex-1 divide-y overflow-y-auto overflow-hidden rounded-lg border">
        {!loading && list.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Belum ada antrian.</div>}
        {list.map((a) => (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            className={cn('w-full p-3 text-left hover:bg-slate-50', selectedId === a.id && 'bg-emerald-50')}
          >
            <div className="flex justify-between gap-3">
              <p className="text-2xl font-extrabold text-slate-800">{nomorAntrian(a.nomor)}</p>
              <p className="text-sm font-bold text-emerald-700">{rupiah(a.total_tagihan)}</p>
            </div>
            <p className="text-sm font-bold text-slate-800">{a.nama_santri}</p>
            <p className="text-xs text-slate-500">
              {a.nis || '-'} - {a.marhalah_nama || '-'}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}
