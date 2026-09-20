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
      <div className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-3" />
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
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
