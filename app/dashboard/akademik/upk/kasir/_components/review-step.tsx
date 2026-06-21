'use client'

import { CheckCircle2, Loader2, Ticket } from 'lucide-react'
import { nomorAntrian, rupiah, type CartItem } from './types'

export function ReviewStep({
  items,
  total,
  catatan,
  onCatatanChange,
  onSubmit,
  loading,
  lastNomor,
  onNewCatat,
}: {
  items: CartItem[]
  total: number
  catatan: string
  onCatatanChange: (v: string) => void
  onSubmit: () => void
  loading: boolean
  lastNomor: number | null
  onNewCatat: () => void
}) {
  if (lastNomor !== null) {
    return (
      <section className="flex h-full flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-300">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <p className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-400">Nomor Antrian</p>
        <p className="text-6xl font-extrabold text-green-700 tabular-nums">{nomorAntrian(lastNomor)}</p>
        <p className="mt-2 text-sm text-slate-500">Antrian berhasil dibuat.</p>
        <button
          onClick={onNewCatat}
          className="mt-6 rounded-xl bg-green-700 px-6 py-3 font-bold text-white transition active:scale-[0.98] hover:bg-green-800"
        >
          Catat Lagi
        </button>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Ticket className="h-4 w-4 text-green-700" />
        <h2 className="text-sm font-bold text-slate-800">Ringkasan</h2>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            Belum ada kitab dipilih.
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{item.nama_kitab}</p>
              <p className="text-xs text-slate-500">
                {item.qty} × {rupiah(item.harga_jual)}
              </p>
            </div>
            <p className="flex-shrink-0 text-sm font-bold tabular-nums text-slate-800">{rupiah(item.qty * item.harga_jual)}</p>
          </div>
        ))}

        <textarea
          value={catatan}
          onChange={(e) => onCatatanChange(e.target.value)}
          className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
          placeholder="Catatan (opsional)"
        />
      </div>

      <div className="sticky bottom-0 -mx-1 mt-2 border-t border-slate-100 bg-white/95 px-1 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-500">Total</span>
          <span className="text-xl font-extrabold tabular-nums text-slate-900">{rupiah(total)}</span>
        </div>
        <button
          onClick={onSubmit}
          disabled={loading || items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3.5 font-bold text-white transition active:scale-[0.98] hover:bg-green-800 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          Buat Antrian
        </button>
      </div>
    </section>
  )
}
