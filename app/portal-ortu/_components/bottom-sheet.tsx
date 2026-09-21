'use client'

import { X } from '@phosphor-icons/react'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" />
      <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-t-[24px] bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.75rem)] shadow-2xl border-t border-slate-200/80 animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-3.5" />
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
