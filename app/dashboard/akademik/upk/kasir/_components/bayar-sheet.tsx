'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, Loader2, X } from 'lucide-react'
import { rupiah } from './types'
import { Numpad } from './numpad'

const QUICK = [50000, 100000]

function BayarBody({
  total,
  uangBayar,
  onUangChange,
  kembalianDitahan,
  onKembalianToggle,
  onSubmit,
  loading,
}: BayarProps) {
  const bayar = parseInt(uangBayar || '0', 10) || 0
  const diff = bayar - total

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-slate-50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-mono font-bold text-slate-800">{rupiah(total)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-slate-500">Diterima</span>
          <span className="font-mono text-xl font-extrabold text-slate-900">{rupiah(bayar)}</span>
        </div>
      </div>

      {diff > 0 && <div className="rounded-lg bg-green-50 p-2 text-sm font-bold text-green-700">Kembalian: {rupiah(diff)}</div>}
      {diff < 0 && <div className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">Tunggakan: {rupiah(Math.abs(diff))}</div>}

      <div className="grid grid-cols-3 gap-2">
        {QUICK.map((v) => (
          <button
            key={v}
            onClick={() => onUangChange(String(v))}
            className="rounded-lg border py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {(v / 1000).toLocaleString('id-ID')}rb
          </button>
        ))}
        <button
          onClick={() => onUangChange(String(total))}
          className="rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          Uang Pas
        </button>
      </div>

      <Numpad value={uangBayar} onChange={onUangChange} />

      {diff > 0 && (
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={kembalianDitahan} onChange={onKembalianToggle} className="h-4 w-4" />
          Kembalian belum diserahkan
        </label>
      )}

      <button
        onClick={onSubmit}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        Selesaikan
      </button>
    </div>
  )
}

type BayarProps = {
  total: number
  uangBayar: string
  onUangChange: (v: string) => void
  kembalianDitahan: boolean
  onKembalianToggle: () => void
  onSubmit: () => void
  loading: boolean
}

/** Bottom sheet untuk mobile */
export function BayarSheet({ open, onClose, ...rest }: BayarProps & { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end xl:hidden">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <CheckCircle className="h-4 w-4 text-emerald-600" /> Pembayaran
          </h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <BayarBody {...rest} />
      </div>
    </div>
  )
}

/** Panel statis untuk desktop */
export function BayarPanel(props: BayarProps & { hasAntrian: boolean }) {
  const { hasAntrian, ...rest } = props
  return (
    <section className={cn('rounded-xl border bg-white p-4', !hasAntrian && 'opacity-50')}>
      <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
        <CheckCircle className="h-4 w-4 text-emerald-600" /> Pembayaran
      </h2>
      {hasAntrian ? <BayarBody {...rest} /> : <p className="py-6 text-center text-sm text-slate-400">Pilih antrian dulu.</p>}
    </section>
  )
}
