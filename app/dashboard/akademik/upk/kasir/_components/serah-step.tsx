'use client'

import { cn } from '@/lib/utils'
import { Check, Minus, Plus, X } from 'lucide-react'
import { nomorAntrian, rupiah, type AntrianDetail, type FinalItem } from './types'

export function SerahStep({
  detail,
  finalItems,
  onToggle,
  onQty,
  onSetQty,
  total,
  onPay,
  showPayButton,
}: {
  detail: AntrianDetail | null
  finalItems: FinalItem[]
  onToggle: (itemId: string) => void
  onQty: (itemId: string, delta: number) => void
  onSetQty: (itemId: string, qty: number) => void
  total: number
  onPay: () => void
  showPayButton: boolean
}) {
  if (!detail) {
    return (
      <section className="flex h-full items-center justify-center">
        <div className="py-12 text-center text-sm text-slate-400">Pilih antrian dulu.</div>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-800">Serah Barang</h2>
        <p className="text-xs text-slate-500">
          {nomorAntrian(detail.nomor)} - {detail.nama_santri}
        </p>
      </div>

      <div className="flex-1 divide-y overflow-y-auto">
        {detail.items.map((row) => {
          const final = finalItems.find((f) => f.itemId === row.id)
          const diserahkan = final?.diserahkan ?? true
          const qty = final?.qty ?? row.qty
          const batal = qty === 0
          return (
            <div key={row.id} className={cn('flex items-center gap-3 p-3', batal && 'bg-red-50/40')}>
              <button
                onClick={() => onToggle(row.id)}
                disabled={batal}
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border',
                  batal
                    ? 'border-slate-200 bg-slate-100 text-slate-300'
                    : diserahkan
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-red-200 bg-red-50 text-red-600'
                )}
              >
                {diserahkan ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </button>

              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-bold', batal ? 'text-slate-400 line-through' : 'text-slate-800')}>
                  {row.nama_kitab}
                </p>
                <p className="text-xs text-slate-500">
                  stok {row.jumlah_stok} - {batal ? 'dibatalkan' : diserahkan ? 'diserahkan' : 'masuk pesanan'}
                </p>
              </div>

              <p className={cn('flex-shrink-0 font-mono text-sm font-bold', batal ? 'text-slate-400' : 'text-emerald-700')}>
                {rupiah(row.harga_jual)}
              </p>

              {batal ? (
                <button
                  onClick={() => onSetQty(row.id, 1)}
                  className="flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Pulihkan
                </button>
              ) : (
                <div className="flex flex-shrink-0 items-center overflow-hidden rounded-lg border">
                  <button onClick={() => onQty(row.id, -1)} className="p-2 hover:bg-slate-50">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{qty}</span>
                  <button onClick={() => onQty(row.id, 1)} className="p-2 hover:bg-slate-50">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showPayButton && (
        <div className="sticky bottom-0 -mx-1 mt-2 border-t bg-white/95 px-1 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <button
            onClick={onPay}
            className="flex w-full items-center justify-between rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-700"
          >
            <span>Lanjut Bayar</span>
            <span className="font-mono">{rupiah(total)} →</span>
          </button>
        </div>
      )}
    </section>
  )
}
