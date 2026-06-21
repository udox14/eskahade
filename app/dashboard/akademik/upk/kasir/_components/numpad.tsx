'use client'

import { Delete } from 'lucide-react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'] as const

export function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'back') {
      onChange(value.slice(0, -1))
      return
    }
    const next = (value === '0' ? '' : value) + key
    // batasi panjang biar tidak overflow
    onChange(next.replace(/^0+(?=\d)/, '').slice(0, 12))
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          onClick={() => press(key)}
          className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-800 transition active:scale-95 active:bg-slate-100"
        >
          {key === 'back' ? <Delete className="h-5 w-5" /> : key}
        </button>
      ))}
    </div>
  )
}
