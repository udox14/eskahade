'use client'

import { cn } from '@/lib/utils'
import { ChevronRight, Users } from 'lucide-react'
import type { UnitUPK } from './types'

export function UnitPicker({ onPick }: { onPick: (unit: UnitUPK) => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-extrabold text-slate-900">Kasir UPK</h1>
        <p className="mt-1 text-sm text-slate-500">Pilih unit untuk mulai mencatat dan menerima pembayaran.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {([
          { unit: 'PUTRA' as const, label: 'Putra', accent: 'from-green-600 to-emerald-700', desc: 'Santri putra' },
          { unit: 'PUTRI' as const, label: 'Putri', accent: 'from-teal-600 to-emerald-700', desc: 'Santri putri' },
        ]).map(({ unit, label, accent, desc }) => (
          <button
            key={unit}
            onClick={() => onPick(unit)}
            className={cn(
              'group relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-left text-white shadow-lg transition-transform active:scale-[0.98]',
              accent
            )}
          >
            <Users className="h-9 w-9 opacity-90" />
            <p className="mt-6 text-3xl font-extrabold">UPK {label}</p>
            <p className="mt-1 text-sm text-white/80">{desc}</p>
            <span className="absolute right-5 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:translate-x-1">
              <ChevronRight className="h-5 w-5" />
            </span>
            <span className="pointer-events-none absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          </button>
        ))}
      </div>
    </div>
  )
}
