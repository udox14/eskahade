'use client'

import { cn } from '@/lib/utils'
import { Check, Minus, Package, Plus, X } from 'lucide-react'
import { nomorAntrian, rupiah, type AntrianDetail, type FinalItem } from './types'

export function SerahStep({
  detail,
  finalItems,
  onToggle,
  onQty,
  total,
  onPay,
  showPayButton,
}: {
  detail: AntrianDetail | null
  finalItems: FinalItem[]
  onToggle: (itemId: string) => void
  onQty: (itemId: string, delta: number) => void
  total: number
  onPay: () => void
  showPayButton: boolean
}) {
  if (!detail) {
    return (
      <section className="flex h-full items-center justify-center">
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-400">
          Pilih antrian dulu.
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-green-700" />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800">Serah Barang</h2>
          <p className="truncate text-xs text-slate-500">
            {nomorAntrian(detail.nomor)} · {detail.nama_santri}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {detail.items.map((row) => {
          const final = finalItems.find((f) => f.itemId === row.id)
          const diserahkan = final?.diserahkan ?? true
          const qty = final?.qty ?? row.qty
          return (
            <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggle(row.id)}
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90',
                    diserahkan ? 'border-green-600 bg-green-600 text-white' : 'border-red-200 bg-red-50 text-red-600'
                  )}
                >
                  {diserahkan ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{row.nama_kitab}</p>
                  <p className="text-xs text-slate-500">
                    stok {row.jumlah_stok} · {diserahkan ? 'diserahkan' : 'masuk pesanan'}
                  </p>
                  <p className="text-sm font-bold text-green-700">{rupiah(row.harga_jual)}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 rounded-xl border border-slate-200">
                  <button onClick={() => onQty(row.id, -1)} className="flex h-9 w-9 items-center justify-center text-slate-600 active:scale-90">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                  <button onClick={() => onQty(row.id, 1)} className="flex h-9 w-9 items-center justify-center text-slate-600 active:scale-90">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showPayButton && (
        <div className="sticky bottom-0 -mx-1 mt-2 border-t border-slate-100 bg-white/95 px-1 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <button
            onClick={onPay}
            className="flex w-full items-center justify-between rounded-xl bg-green-700 px-4 py-3.5 font-bold text-white transition active:scale-[0.98] hover:bg-green-800"
          >
            <span>Lanjut Bayar</span>
            <span className="tabular-nums">{rupiah(total)} →</span>
          </button>
        </div>
      )}
    </section>
  )
}
