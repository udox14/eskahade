'use client'

import { cn } from '@/lib/utils'
import { Check, Loader2, Minus, Package, Plus, Search } from 'lucide-react'
import { rupiah, type CartItem } from './types'

export function KitabStep({
  items,
  search,
  onSearchChange,
  loading,
  hasSantri,
  onToggle,
  onQty,
  selectedCount,
  total,
  onNext,
  showFooter,
}: {
  items: CartItem[]
  search: string
  onSearchChange: (v: string) => void
  loading: boolean
  hasSantri: boolean
  onToggle: (id: number) => void
  onQty: (id: number, delta: number) => void
  selectedCount: number
  total: number
  onNext: () => void
  showFooter: boolean
}) {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-green-700" />
        <h2 className="text-sm font-bold text-slate-800">Pilih Kitab</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
          placeholder="Cari kitab tambahan…"
          inputMode="search"
        />
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pb-2">
        {!hasSantri && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            Pilih santri dulu untuk memuat kitab.
          </div>
        )}
        {hasSantri && loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          </div>
        )}
        {hasSantri && !loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            Tidak ada kitab cocok.
          </div>
        )}
        {hasSantri &&
          !loading &&
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'rounded-2xl border bg-white p-3 transition',
                item.selected ? 'border-green-300 bg-green-50/50 ring-1 ring-green-200' : 'border-slate-200'
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggle(item.id)}
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90',
                    item.selected ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 bg-white text-transparent'
                  )}
                  aria-pressed={item.selected}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </button>

                <div className="min-w-0 flex-1" onClick={() => onToggle(item.id)} role="button">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-slate-800">{item.nama_kitab}</p>
                    {item.is_default && (
                      <span className="flex-shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Default</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {item.marhalah_nama || '-'} · stok {item.jumlah_stok}
                  </p>
                  <p className="text-sm font-bold text-green-700">{rupiah(item.harga_jual)}</p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white">
                  <button onClick={() => onQty(item.id, -1)} className="flex h-9 w-9 items-center justify-center text-slate-600 active:scale-90">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{item.qty}</span>
                  <button onClick={() => onQty(item.id, 1)} className="flex h-9 w-9 items-center justify-center text-slate-600 active:scale-90">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {showFooter && (
        <div className="sticky bottom-0 -mx-1 mt-2 border-t border-slate-100 bg-white/95 px-1 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <button
            onClick={onNext}
            disabled={selectedCount === 0}
            className="flex w-full items-center justify-between rounded-xl bg-green-700 px-4 py-3.5 font-bold text-white transition active:scale-[0.98] hover:bg-green-800 disabled:opacity-40"
          >
            <span>{selectedCount} item dipilih</span>
            <span className="tabular-nums">{rupiah(total)} →</span>
          </button>
        </div>
      )}
    </section>
  )
}
