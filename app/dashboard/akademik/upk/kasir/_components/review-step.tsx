'use client'

import { Loader2, Ticket } from 'lucide-react'
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
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Nomor Antrian</p>
          <p className="text-5xl font-extrabold text-amber-900">{nomorAntrian(lastNomor)}</p>
          <p className="mt-2 text-sm text-amber-700">Antrian berhasil dibuat.</p>
        </div>
        <button
          onClick={onNewCatat}
          className="mt-6 rounded-lg bg-amber-600 px-6 py-3 font-bold text-white transition hover:bg-amber-700"
        >
          Catat Lagi
        </button>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Ticket className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-bold text-slate-800">Ringkasan</h2>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Belum ada kitab dipilih.</div>}
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-bold text-slate-800 leading-snug">{item.nama_kitab}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {item.qty} × {rupiah(item.harga_jual)}
              </p>
              <p className="font-mono text-sm font-bold text-slate-800">{rupiah(item.qty * item.harga_jual)}</p>
            </div>
          </div>
        ))}

        <textarea
          value={catatan}
          onChange={(e) => onCatatanChange(e.target.value)}
          className="mt-2 min-h-20 w-full rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
          placeholder="Catatan opsional"
        />
      </div>

      <div className="sticky bottom-0 -mx-1 mt-2 border-t bg-white/95 px-1 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-500">Total</span>
          <span className="font-mono text-xl font-extrabold text-slate-900">{rupiah(total)}</span>
        </div>
        <button
          onClick={onSubmit}
          disabled={loading || items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 font-bold text-white transition hover:bg-amber-700 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          Buat Antrian
        </button>
      </div>
    </section>
  )
}
