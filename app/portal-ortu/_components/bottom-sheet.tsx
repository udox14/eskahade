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
      <button aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="portal-theme relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-[var(--p-radius-lg)] bg-[var(--p-paper)] p-5 pb-8 portal-rise">
        <div className="flex items-center justify-between">
          <h3 className="portal-display text-xl text-[var(--p-ink)]">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-[var(--p-radius-sm)] bg-white border border-[var(--p-line)]" aria-label="Tutup">
            <X className="w-4 h-4 text-[var(--p-muted)]" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
