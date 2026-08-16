'use client'

import { useFormStatus } from 'react-dom'

export function SwitchStudentButton() {
  const { pending } = useFormStatus()
  return (
    <button
      disabled={pending}
      className="shrink-0 rounded-[var(--p-radius-sm)] bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/30 active:scale-95 transition disabled:opacity-60"
    >
      {pending ? (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Mengganti...
        </span>
      ) : (
        'Ganti Anak'
      )}
    </button>
  )
}
