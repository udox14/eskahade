'use client'

import { cn } from '@/lib/utils'

type Mode = 'CATAT' | 'KASIR'

export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1">
      <button
        onClick={() => onChange('CATAT')}
        className={cn(
          'flex-1 rounded-md px-4 py-2 text-sm font-bold transition',
          mode === 'CATAT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
        )}
      >
        Pencatat
      </button>
      <button
        onClick={() => onChange('KASIR')}
        className={cn(
          'flex-1 rounded-md px-4 py-2 text-sm font-bold transition',
          mode === 'KASIR' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
        )}
      >
        Kasir
      </button>
    </div>
  )
}
