'use client'

import { cn } from '@/lib/utils'
import { Check, Loader2, Minus, Package, Plus } from 'lucide-react'
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
  priceMode = 'jual',
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
  priceMode?: 'jual' | 'modal'
}) {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <h2 className="flex flex-shrink-0 items-center gap-2 text-sm font-bold text-slate-800">
          <Package className="h-4 w-4 text-amber-600" /> Kitab
        </h2>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
          placeholder="Cari kitab tambahan…"
          inputMode="search"
        />
      </div>

      <div className="flex-1 divide-y overflow-y-auto">
        {!hasSantri && <div className="py-12 text-center text-sm text-slate-400">Pilih santri dulu.</div>}
        {hasSantri && loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        )}
        {hasSantri && !loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">Tidak ada kitab cocok.</div>
        )}
        {hasSantri &&
          !loading &&
          items.map((item) => {
            const displayPrice = priceMode === 'modal' ? item.harga_beli : item.harga_jual
            return (
            <div key={item.id} className={cn('flex items-center gap-3 p-3', item.selected ? 'bg-blue-50/40' : 'bg-white')}>
              <button
                onClick={() => onToggle(item.id)}
                className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border transition',
                  item.selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
                )}
              >
                <Check className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1" role="button" onClick={() => onToggle(item.id)}>
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-slate-800">{item.nama_kitab}</p>
                  {item.is_default && (
                    <span className="flex-shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {item.marhalah_nama || '-'} - stok {item.jumlah_stok}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="font-mono text-sm font-bold text-emerald-700">{rupiah(displayPrice)}</p>
                {priceMode === 'modal' && <p className="text-[10px] font-bold uppercase text-slate-400">Modal</p>}
              </div>

              <div className="flex flex-shrink-0 items-center overflow-hidden rounded-lg border">
                <button onClick={() => onQty(item.id, -1)} className="p-2 hover:bg-slate-50">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                <button onClick={() => onQty(item.id, 1)} className="p-2 hover:bg-slate-50">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          )})}
      </div>

      {showFooter && (
        <div className="sticky bottom-0 -mx-1 mt-2 border-t bg-white/95 px-1 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <button
            onClick={onNext}
            disabled={selectedCount === 0}
            className="flex w-full items-center justify-between rounded-lg bg-amber-600 px-4 py-3 font-bold text-white transition hover:bg-amber-700 disabled:opacity-40"
          >
            <span>{selectedCount} item dipilih</span>
            <span className="font-mono">{rupiah(total)} →</span>
          </button>
        </div>
      )}
    </section>
  )
}
