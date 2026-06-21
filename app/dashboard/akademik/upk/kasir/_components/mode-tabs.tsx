'use client'

import { cn } from '@/lib/utils'
import { ClipboardList, Wallet } from 'lucide-react'

type Mode = 'CATAT' | 'KASIR'

export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
      <span
        className={cn(
          'absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out',
          mode === 'KASIR' && 'translate-x-[calc(100%+0.5rem)]'
        )}
        aria-hidden
      />
      <button
        onClick={() => onChange('CATAT')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors',
          mode === 'CATAT' ? 'text-green-700' : 'text-slate-500'
        )}
      >
        <ClipboardList className="h-4 w-4" /> Pencatat
      </button>
      <button
        onClick={() => onChange('KASIR')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors',
          mode === 'KASIR' ? 'text-green-700' : 'text-slate-500'
        )}
      >
        <Wallet className="h-4 w-4" /> Kasir
      </button>
    </div>
  )
}
